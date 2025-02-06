const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../db");
const env = require("../env");
const { Controller } = require("../middleware/handlers");
const { AppError } = require("../middleware/exception");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { error } = require("console");

require("dotenv").config();

// Generate a JWT
const generateToken = (id) => {
	return jwt.sign({ id }, process.env.TOKEN_SECRET_KEY, { expiresIn: "30d" });
};

// User registration
// @desc Register a new user
// @route POST /api/users/register
router.post(
	"/register",
	Controller(async (req, res) => {
		const { fullName, username, email, password, confirmPassword } = req.body;

		// Validate input
		if (!fullName || !username || !email || !password || !confirmPassword) {
			throw new AppError("Please provide all fields.", STATUS_CODE.BAD_REQUEST);
		}

		if (password !== confirmPassword) {
			throw new AppError("Passwords do not match.", STATUS_CODE.NOT_ACCEPTED);
		}

		// Check if user already exists
		const userExists = await db.user.findFirst({ where: { email } });

		if (userExists) {
			throw new AppError("Email already exists.", STATUS_CODE.CONFLICT);
		}
		// return console.log(userExists);

		// Create new user
		const newUser = await db.user.create({
			data: { email, username, fullName, password },
		});

		return new ApiResponse(
			res,
			"Registration successful",
			newUser,
			STATUS_CODE.CREATED
		);
	})
);

// @desc Authenticate user
// @route POST /api/users/login
router.post(
	"/login",
	Controller(async (req, res) => {
		const { email, password } = req.body;

		if (!email || !password) {
			throw new AppError(
				"Please provide email and password",
				STATUS_CODE.BAD_REQUEST
			);
		}

		const user = await db.user.findFirst({ where: { email } });

		// Check if user exists and compare passwords
		if (!user || !(await bcrypt.compare(password, user.password))) {
			throw new AppError("Invalid email or password", STATUS_CODE.UNAUTHORIZED);
		}

		return new ApiResponse(res, "Login successful", {
			_id: user.id,
			fullName: user.fullName,
			email: user.email,
			token: generateToken(user.id),
		});
	})
);

// @desc Logout user
// @route POST /api/users/logout
// @access Private
router.post(
	"/logout",
	Controller((req, res) => {
		// This is just to inform the user that they are logged out on the server side.
		// No need to perform any action if you are using JWT as the token is stored client-side.
		return new ApiResponse(res, "User logged out");
	})
);

// Configure nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: env.EMAIL_USERNAME, // Use your Gmail username
		pass: env.EMAIL_PASSWORD, // Use your Gmail app password
	},
	tls: {
		rejectUnauthorized: false,
	},
});

// Forgot Password - Request reset link
router.post(
	"/forgot-password",
	Controller(async (req, res) => {
		const { email } = req.body;

		if (!email) {
			throw new AppError(
				"Please provide an email address.",
				STATUS_CODE.BAD_REQUEST
			);
		}

		// Generate a reset token
		const resetPasswordToken = crypto.randomBytes(20).toString("hex");
		const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour from now
		// Save token and expiration to user
		// user.resetPasswordToken = resetToken;
		// user.resetPasswordExpires = resetTokenExpiration;
		const user = await db.user.update({
			where: { email },
			data: { resetPasswordExpires, resetPasswordToken },
		});

		if (!user) {
			throw new AppError("User not found.", STATUS_CODE.NOT_FOUND);
		}

		// Send the reset email
		const resetURL = `${env.FRONTEND_URL_PRODUCTION}/reset-password?token=${resetPasswordToken}`;

		const mailOptions = {
			from: env.EMAIL_USERNAME,
			to: user.email,
			subject: "Password Reset Request",
			text: `To reset your password, click the following link: ${resetURL}`,
		};
		// console.log(resetURL);

		transporter.sendMail(mailOptions, (err) => {
			console.log("Error sending email", err);

			if (err) {
				throw new AppError(
					`Error sending email: ${error.message}`,
					STATUS_CODE.GATEWAY_TIMEOUT,
					error
				);
			}
			return new ApiResponse(
				res,
				"A reset link has been sent to your email address."
			);
		});
	})
);

router.post(
	"/reset-password",
	Controller(async (req, res) => {
		const { token } = req.body;

		// Find the user by token and ensure the token is not expired
		const user = await db.user.findFirst({
			where: {
				resetPasswordToken: token,
			},
		});
		// 	resetPasswordToken: token,
		// 	resetPasswordExpires: { $gt: Date.now() }, // Ensure the token has not expired
		// });

		if (!user || user.resetPasswordExpires.getMilliseconds() > Date.now()) {
			throw new AppError("Invalid or expired token.", STATUS_CODE.UNAUTHORIZED);
		}

		// user.password = password;

		// // Clear the reset token and expiration fields
		// user.resetPasswordToken = undefined;
		// user.resetPasswordExpires = undefined;

		// // Save the updated user
		await db.user.update({
			where: { id: user.id },
			data: { resetPasswordExpires: null, resetPasswordToken: "" },
		});

		return new ApiResponse(res, "Password reset successful.");
	})
);

router.get(
	"/message-profile",
	Controller(async (req, res) => {
		const username = req.query.username;

		if (!username) throw new AppError("User not found", STATUS_CODE.NOT_FOUND);

		const userProfile = await db.user.findFirst({ where: { username } });

		// const products = await Product.find({ uploader: userProfile.id });
		const products = await db.product.findFirst({
			where: { uploader: userProfile.id },
		});

		if (!userProfile)
			throw new AppError("User not found", STATUS_CODE.NOT_FOUND);

		return new ApiResponse(res, "Fetched", { ...userProfile._doc, products });
	})
);

module.exports = router;
