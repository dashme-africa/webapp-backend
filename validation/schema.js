const { z } = require("zod");

module.exports.dateSchema = z
	.string()
	.refine((value) => !isNaN(Date.parse(value)), {
		message: "Invalid date format",
	})
	.transform((v) => new Date(v));

// export const getBooleanValidation = (v: string) =>
// 	z
// 		.enum(["true", "false"], {
// 			required_error: `'${v}' is required`,
// 		})
// 		.transform((v) => v == "true");

/** @type {(key:string)=> z.ZodString} */
// module.exports.const getJsonArrayValidation = (key) =>
// 	z
// 		.string({ required_error: `'${key}' is required` })
// 		.refine((value) => isJsonArray(value), {
// 			message: `'${key}' must be a JSON array`,
// 		});
// .transform((v) => JSON.parse(v) as string[]);

/** @type {(key:string)=> z.ZodString } */
module.exports.getStringValidation = (key) =>
	z
		.string({
			required_error: `'${key}' is required`,
			invalid_type_error: `'${key}' must be a string`,
		})
		.min(3, { message: `'${key}' must be 3 or more characters` });

/** @type {(key:string)=> z.ZodString} */
module.exports.getStrNumValidation = (key) =>
	z
		.string({
			required_error: `'${key}' is required`,
		})
		.refine((v) => !isNaN(+v), {
			message: `'${key}' must be a number`,
		})
		.transform((v) => +v);

// /** @type {(key:string)=> z.ZodString} */

/**
 *
 * @param {string} key
 * @returns {z.ZodString}
 */
module.exports.getOptionalStringValidation = (key) =>
	z
		.string({
			invalid_type_error: `'${key}' must be a string`,
		})
		.min(3, { message: `'${key}' must be 3 or more characters` })
		.optional();

/** @type {(key:string)=> z.ZodString} */
module.exports.getNumberValidation = (key) =>
	z.number({
		required_error: `'${key}' is required`,
		invalid_type_error: `'${key}' must be a number`,
	});
