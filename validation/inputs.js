const { z } = require("zod");
const {
	getStringValidation,
	getStrNumValidation,
	getOptionalStringValidation,
} = require("./schema");

module.exports.Validation = Object.freeze({
	adminLogin: z.object({
		email: getStringValidation("Email").email(),
		password: getStringValidation("Password"),
	}),
	editProduct: z.object({
		title: getOptionalStringValidation("Title"),
		description: getOptionalStringValidation("Description"),
		category: getOptionalStringValidation("Category"),
		price: getStrNumValidation("Price").optional(),
		priceCategory: getOptionalStringValidation("Pricecategory"),
		location: getOptionalStringValidation("Location"),
		tag: getOptionalStringValidation("Tag"),
	}),
});
