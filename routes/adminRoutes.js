const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { ApiResponse, STATUS_CODE } = require("../middleware/response");
const { AppError, ValidationError } = require("../middleware/exception");
const env = require("../env");
const { Validation } = require("../validation/inputs");
const { Controller } = require("../middleware/handlers");

require("dotenv").config();

// Generate a JWT
const generateToken = (id) => {
	return jwt.sign({ id }, env.ADMIN_TOKEN_SECRET_KEY, {
		expiresIn: "30d",
	});
};

// Admin Login Route
router.post(
	"/login",
	Controller(async (req, res) => {
		const validate = Validation.adminLogin.safeParse(req.body);
		if (!validate.success) throw new ValidationError(validate.error);

		const { email, password } = validate.data;

		const admin = await db.admin.findUnique({ where: { email } });

		console.dir(admin, { depth: 5 });

		if (!admin || !(await bcrypt.compare(password, admin.password))) {
			throw new AppError("Invalid email or password", STATUS_CODE.UNAUTHORIZED);
		}

		const token = generateToken(admin.id);
		// set cookies for the admin
		res.cookie("admin", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
		});

		return new ApiResponse(res, "Admin logged in successfully", {
			admin,
			token,
		});
	})
);

module.exports = router;
