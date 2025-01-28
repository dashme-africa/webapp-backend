const bcrypt = require("bcryptjs");

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
