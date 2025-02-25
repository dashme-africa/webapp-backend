const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("node:crypto");
const db = require("../db");
const env = require("../env");
const { Controller } = require("../middleware/handlers");
const { AppError } = require("../middleware/exception");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { error } = require("console");
const { sendEmail } = require("../middleware/email");
const { hashPassword } = require("../utils");

require("dotenv").config();

// Generate a JWT
const generateToken = (id) => {
	return jwt.sign({ id }, env.TOKEN_SECRET_KEY, { expiresIn: "30d" });
};

// User registration
// @desc Register a new user
// @route POST /api/users/register
router.post(
	"/register",
	Controller(async (req, res) => {
		const {
			fullName,
			username,
			email,
			password: raw,
			confirmPassword,
		} = req.body;

		// Validate input
		if (!fullName || !username || !email || !raw || !confirmPassword) {
			throw new AppError("Please provide all fields.", STATUS_CODE.BAD_REQUEST);
		}

		if (raw !== confirmPassword) {
			throw new AppError("Passwords do not match.", STATUS_CODE.NOT_ACCEPTED);
		}

		// Check if user already exists
		const userExists = await db.user.findFirst({ where: { email } });

		if (userExists) {
			throw new AppError("Email already exists.", STATUS_CODE.CONFLICT);
		}

		const password = await hashPassword(raw);

		console.log({ email, username, fullName, password });

		// Create new user
		await db.user.create({
			data: { email, username, fullName, password },
		});

		return new ApiResponse(
			res,
			"Registration successful",
			{},
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

		const user = await db.user.update({
			where: { email },
			data: { resetPasswordExpires, resetPasswordToken },
		});

		if (!user) {
			throw new AppError("User not found.", STATUS_CODE.NOT_FOUND);
		}

		// Send the reset email
		const resetURL = `${env.FRONTEND_URL_PRODUCTION}/reset-password?token=${resetPasswordToken}`;

		const emailRes = await sendEmail(
			user.email,
			`To reset your password, click the following link: ${resetURL}`,
			"Password Reset Request"
		);

		if (!emailRes.success)
			throw new AppError(
				`Error while sending email: ${emailRes.message}`,
				STATUS_CODE.GATEWAY_TIMEOUT,
				emailRes.details
			);

		// console.log(resetURL);

		return new ApiResponse(
			res,
			"A reset link has been sent to your email address."
		);
	})
);

router.post(
	"/reset-password",
	Controller(async (req, res) => {
		const { token, password: raw } = req.body;

		if (!raw)
			throw new AppError("Provide a new password", STATUS_CODE.BAD_REQUEST);

		// Find the user by token and ensure the token is not expired
		const user = await db.user.findFirst({
			where: {
				resetPasswordToken: token,
			},
		});

		if (!user || user.resetPasswordExpires.getMilliseconds() > Date.now()) {
			throw new AppError("Invalid or expired token.", STATUS_CODE.UNAUTHORIZED);
		}

		const password = await hashPassword(raw);
		// // Save the updated user
		await db.user.update({
			where: { id: user.id },
			data: { resetPasswordExpires: null, resetPasswordToken: "", password },
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
