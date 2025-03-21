const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { ApiResponse, STATUS_CODE } = require("../middleware/response");
const { AppError, ValidationError } = require("../middleware/exception");
const env = require("../env");
const { Validation } = require("../validation/inputs");
const { Controller, Middleware } = require("../middleware/handlers");
const { protectAdmin } = require("../middleware/adminMiddleware");

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

		// console.dir(admin, { depth: 5 });

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

router.get(
	"/all-transactions",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		const transactions = await db.transaction.findMany({
			orderBy: { createdAt: "desc" },
			include: { user: {}, order: {} },
		});
		// console.log(transactions);
		return new ApiResponse(
			res,
			"Transactions retrieved successfully",
			transactions
		);
	})
);

router.get(
	"/users",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		/**@type{(import("@prisma/client").User ${referralCount:number})[]} */
		const users = await db.$queryRaw`
			SELECT 
				u.*, 
				COALESCE(json_agg(r) FILTER (WHERE r.id IS NOT NULL), '[]') AS referrals
			FROM "User" u
			LEFT JOIN "User" r ON r."referredBy" = u."refID"
			GROUP BY u."id";
		`;

		return new ApiResponse(res, "Users retrieved successfully", users);
	})
);

module.exports = router;

// db.$queryRaw`
// SELECT
//   u.*,
//   COALESCE(json_agg(r) FILTER (WHERE r.id IS NOT NULL), '[]') AS referrals
// FROM "User" u
// LEFT JOIN "User" r ON r."referredBy" = u."refID"
// GROUP BY u."id";
// 		`.then((data) => console.dir(data, { depth: 5 }));
