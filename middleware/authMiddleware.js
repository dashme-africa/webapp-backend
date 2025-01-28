const jwt = require("jsonwebtoken");
const User = require("../models/User");
const db = require("../db");

require("dotenv").config();

const protect = async (req, res, next) => {
	let token;

	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		try {
			token = req.headers.authorization.split(" ")[1];

			// Decode token
			const decoded = jwt.verify(token, process.env.TOKEN_SECRET_KEY);

			// Attach user to request

			req.user = await db.user.findUnique({ where: { id: decoded.id } });

			next();
		} catch (error) {
			res.status(401).json({ message: "Not authorized, token failed" });
		}
	}

	if (!token) {
		res.status(401).json({ message: "Not authorized, no token" });
	}
};

module.exports = { protect };
