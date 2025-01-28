const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const db = require("../db");
require("dotenv").config();

const protectAdmin = async (req, res, next) => {
	let token;

	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		try {
			token = req.headers.authorization.split(" ")[1];

			const decoded = jwt.verify(token, process.env.ADMIN_TOKEN_SECRET_KEY);
			// req.admin = await Admin.findById(decoded.id).select('-password'); // Exclude password
			req.admin = await db.admin.findUnique({ where: { id: decoded.id } });

			next();
		} catch (error) {
			res.status(401).json({ message: "Not authorized, token failed" });
		}
	}

	if (!token) {
		res.status(401).json({ message: "Not authorized, no token" });
	}
};

module.exports = { protectAdmin };
