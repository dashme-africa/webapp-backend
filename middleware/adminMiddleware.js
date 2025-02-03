const jwt = require("jsonwebtoken");
const db = require("../db");
const { STATUS_CODE, ErrorResponse } = require("./response");
const { AppError } = require("./exception");
require("dotenv").config();

const protectAdmin = async (req, res, next) => {
	if (
		!req?.headers?.authorization &&
		!req?.headers?.authorization?.startsWith("Bearer") &&
		!req?.cookies?.["admin"]
	)
		throw new AppError("Not authorized, no token", STATUS_CODE.UNAUTHORIZED);

	const token = req.headers.authorization.split(" ")[1] || req.cookies["admin"];

	if (!token)
		throw new AppError("Not authorized, no token", STATUS_CODE.UNAUTHORIZED);

	const decoded = jwt.verify(token, process.env.ADMIN_TOKEN_SECRET_KEY);
	const admin = await db.admin.findUnique({ where: { id: decoded.id } });

	if (!admin) throw new AppError("Invalid token", STATUS_CODE.UNAUTHORIZED);

	req.admin = admin;

	next();
};

module.exports = { protectAdmin };
