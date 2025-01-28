const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const db = require("../db");

require("dotenv").config();

// Generate a JWT
const generateToken = (id) => {
	return jwt.sign({ id }, process.env.ADMIN_TOKEN_SECRET_KEY, {
		expiresIn: "30d",
	});
};

// Admin Login Route
router.post("/login", async (req, res) => {
	const { email, password } = req.body;

	try {
		const admin = await db.admin.findFirst({ where: { email } });
		if (!admin || !(await bcrypt.compare(password, admin.password))) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		res.json({
			_id: admin.id,
			email: admin.email,
			token: generateToken(admin.id),
		});
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

module.exports = router;
