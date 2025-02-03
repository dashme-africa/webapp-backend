const { NextFunction, Request, Response, Router } = require("express");

class ApiResponse {
	/**
	 * @template D
	 * @param {Response} res
	 * @param {string} message
	 * @param {D} [data]
	 * @param {number} [statusCode=STATUS_CODE.OK]
	 */
	constructor(res, message, data, statusCode = STATUS_CODE.OK) {
		this.res = res;
		this.message = message;
		this.data = data;
		this.statusCode = statusCode;
		this.send();
	}

	send() {
		return this.res.status(this.statusCode).json({
			ok: true,
			message: this.message,
			data: this.data,
		});
	}
}
// create and export a class in commonjs style for use in other files

class ErrorResponse {
	/**@type {Request} */
	#res;

	/**
	 * @param {Response} res
	 * @param {string} message
	 * @param {unknown} [error]
	 * @param {number} [statusCode=STATUS_CODE.INTERNAL_SERVER_ERROR]
	 */

	constructor(
		res,
		message,
		error,
		statusCode = STATUS_CODE.INTERNAL_SERVER_ERROR
	) {
		this.#res = res;
		this.message = message;
		this.error = error;
		this.statusCode = statusCode;
		this.#send();
	}

	#send() {
		return this.#res.status(this.statusCode).json({
			ok: false,
			message: this.message,
			error: this.error,
		});
	}
}

const STATUS_CODE = Object.freeze({
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	NOT_ACCEPTED: 406,
	CONFLICT: 409,
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
	PAYMENT_REQUIRED: 402,
	TOO_MANY_REQUESTS: 429,
});

const UserType = Object.freeze({
	STAFF: "staff",
	ADMIN: "admin",
});

module.exports = {
	ApiResponse,
	ErrorResponse,
	STATUS_CODE,
	UserType,
};
