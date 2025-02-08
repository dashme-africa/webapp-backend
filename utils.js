const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid"); // Import the UUID library

module.exports = {
	/**
	 *
	 * @param {string} raw
	 * @returns {Promise<string>}
	 */
	async hashPassword(raw) {
		const salt = await bcrypt.genSalt(10);
		return await bcrypt.hash(raw, salt);
	},
};

/**
 * Generates a unique transaction reference (TRX REF).
 *
 * @param {string} [prefix='TRX'] - Optional prefix for the TRX REF.
 * @returns {string} - The generated transaction reference.
 */
module.exports.generateTrxRef = function (prefix = "TRX") {
	const uuid = uuidv4().replace(/-/g, ""); // Generate a UUID and remove hyphens
	const timestamp = Date.now().toString(36); // Get current timestamp in base-36

	return `${prefix}-${timestamp}-${uuid.slice(0, 8).toUpperCase()}`; // Combine prefix, timestamp, and part of UUID
};

module.exports.APPROVED_PRODUCTS = { status: "approved" };
