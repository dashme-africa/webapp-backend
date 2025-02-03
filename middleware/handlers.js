const { Request, Response, NextFunction } = require("express");

/**
 * Wraps a controller function to handle errors and pass them to the next middleware.
 *
 * @param {function(Request, Response): Promise<any>} controller - The controller function to wrap.
 * @returns {function(Request, Response, NextFunction): Promise<void>} A middleware function that wraps the controller.
 */
module.exports.Controller = (controller) => async (req, res, next) => {
	try {
		await controller(req, res);
	} catch (error) {
		return next(error);
	}
};

/**
 * Wraps a middleware function to handle errors and pass them to the next middleware.
 *
 * @param {function(Request, Response, NextFunction): Promise<any>} controller - The middleware function to wrap.
 * @returns {function(Request, Response, NextFunction): Promise<void>} A middleware function that wraps the controller.
 */
module.exports.Middleware = (controller) => async (req, res, _next) => {
	try {
		await controller(req, res, _next);
	} catch (error) {
		return _next(error);
	}
};

// module.export.Controller =
// 	(controller: (req: Request, res: Response) => Promise<any>) =>
// 	async (req: Request, res: Response, next: NextFunction) => {
// 		try {
// 			await controller(req, res);
// 		} catch (error) {
// 			return next(error);
// 		}
// 	};

// module.export.Middleware =
// 	(
// 		controller: (
// 			req: Request,
// 			res: Response,
// 			next: NextFunction
// 		) => Promise<any>
// 	) =>
// 	async (req: Request, res: Response, _next: NextFunction) => {
// 		try {
// 			await controller(req, res, _next);
// 		} catch (error) {
// 			return _next(error);
// 		}
// 	};
