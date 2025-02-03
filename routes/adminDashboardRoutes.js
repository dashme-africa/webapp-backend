const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/adminMiddleware");
const { Controller, Middleware } = require("../middleware/handlers");
const { ApiResponse } = require("../middleware/response");

// @desc Admin dashboard
// @route GET /api/admin/dashboard
// @access Private
router.get(
	"/dashboard",
	Middleware(protectAdmin),
	Controller((req, res) => {
		return new ApiResponse(
			res,
			`Welcome ${req.admin.email}, this is your dashboard`
		);
	})
);

module.exports = router;
