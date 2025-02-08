const { NextFunction, Request, Response } = require("express");
const {
	PrismaClientKnownRequestError,
} = require("@prisma/client/runtime/library");
const { STATUS_CODE, ErrorResponse } = require("./response");

class AppError extends Error {
	/**
	 * @param {string} message
	 * @param {number} statusCode
	 * @param {unknown} [details]
	 */
	constructor(message, statusCode, details) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
	}
}

class ValidationError extends Error {
	/**@type{number} */
	statusCode = STATUS_CODE.BAD_REQUEST;
	/**@type{unknown} */
	details;

	/**@param {ZodError<any>} error  */
	constructor(error) {
		super(error.issues.map((d) => d.message).join(", "));
		this.details = error;
	}
}

/**@type {(error: any,req: Request,res: Response,next: NextFunction)=>unknown} */
const errorHandler = (error, req, res, next) => {
	console.log(`path: ${req.path} method: ${req.method}`);
	console.log(error);

	if (error instanceof AppError)
		return new ErrorResponse(
			res,
			error.message,
			error.details,
			error.statusCode
		);

	if (error instanceof ValidationError)
		return new ErrorResponse(
			res,
			error.message,
			error.details,
			STATUS_CODE.BAD_REQUEST
		);
	/* 
	if (error instanceof JsonWebTokenError)
		return new ErrorResponse(
			res,
			"Invalid API key",
			error,
			STATUS_CODE.UNAUTHORIZED
		);
 */
	if (error instanceof PrismaClientKnownRequestError && error.code == "P2002")
		return new ErrorResponse(
			res,
			`${error.meta?.modelName} with this ${error.meta?.target?.[0]} already exists`,
			error,
			STATUS_CODE.CONFLICT
		);

	if (error instanceof PrismaClientKnownRequestError && error.code == "P2025")
		return new ErrorResponse(
			res,
			`${error.meta.modelName} not found`,
			error,
			STATUS_CODE.NOT_FOUND
		);

	return new ErrorResponse(res, "Something went wrong.", error);
};

module.exports = {
	AppError,
	ValidationError,
	errorHandler,
};
