const { z } = require("zod");
const {
	getStringValidation,
	getStrNumValidation,
	getOptionalStringValidation,
	getNumberValidation,
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
		price: getStrNumValidation("Price"),
		priceCategory: getOptionalStringValidation("Pricecategory"),
		location: getOptionalStringValidation("Location"),
		tag: getOptionalStringValidation("Tag"),
	}),
	editmyProduct: z.object({
		title: getOptionalStringValidation("Title"),
		description: getOptionalStringValidation("Description"),
		// category: getOptionalStringValidation("Category"),
		price: getNumberValidation("Price"),
		// priceCategory: getOptionalStringValidation("Pricecategory"),
		// location: getOptionalStringValidation("Location"),
		// tag: getOptionalStringValidation("Tag"),
	}),
});
