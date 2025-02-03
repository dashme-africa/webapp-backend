const jwt = require("jsonwebtoken");
const db = require("../db");
const env = require("../env");

require("dotenv").config();

const protect = async (req, res, next) => {
	if (
		!req?.headers?.authorization &&
		!req?.headers?.authorization?.startsWith("Bearer") &&
		!req?.cookies?.["auth"]
	)
		throw new AppError("Not authorized, no token", STATUS_CODE.UNAUTHORIZED);

	const token = req.headers.authorization.split(" ")[1] || req.cookies["auth"];

	if (!token)
		throw new AppError("Not authorized, no token", STATUS_CODE.UNAUTHORIZED);

	const decoded = jwt.verify(token, process.env.ADMIN_TOKEN_SECRET_KEY);

	const user = await db.user.findUnique({ where: { id: decoded.id } });

	if (!user) throw new AppError("Invalid token", STATUS_CODE.UNAUTHORIZED);

	req.user = user;

	next();
};

module.exports = { protect };
