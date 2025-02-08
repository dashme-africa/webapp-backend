/**
 * @typedef {import('nodemailer').SentMessageInfo} SentMessageInfo
 * @typedef {import('nodemailer').Transporter} Transporter
 */

const mailer = require("nodemailer");
const env = require("../env");

/** @type {Transporter} */
const transporter = mailer.createTransport({
	// host: env.MAIL_HOST,
	// service: "gmail",
	// port: 587,
	host: env.EMAIL_HOST,
	auth: {
		user: env.EMAIL_USERNAME,
		pass: env.EMAIL_PASSWORD,
	},
});

/**
 * Sends an email.
 * @param {string} to - The recipient's email address.
 * @param {string} message - The HTML email body.
 * @param {string} [subject] - The email subject.
 * @param {string} [from] - The sender's email address.
 * @returns {Promise<{ success: boolean; message?: string; details: any; }>} - A promise that resolves to an object containing the success status, an optional message, and details about the sent email.
 */
const sendEmail = async (to, message, subject) => {
	try {
		const mailOptions = {
			from: env.EMAIL_USERNAME,
			to,
			subject,
			html: message,
		};

		const info = await transporter.sendMail(mailOptions);

		return {
			success: true,
			message: `Email sent to ${info.envelope.to} `,
			details: info,
		};
	} catch (error) {
		console.error(error);
		return { success: false, details: error, message: `${error}` };
	}
};

/**
 * Sends a test email using ethereal.email.
 * @param {string} to - The recipient's email address.
 * @param {string} message - The HTML email body.
 * @returns {Promise<{ success: boolean; message?: string; details: SentMessageInfo | unknown; }>} - A promise that resolves to an object containing the success status, an optional message, and details about the sent email.
 */
const sendTestMail = async (to, message) => {
	try {
		const testAccount = await mailer.createTestAccount();

		const testTransporter = mailer.createTransport({
			host: "smtp.ethereal.email",
			port: 587,
			secure: false,
			auth: {
				user: testAccount.user,
				pass: testAccount.pass,
			},
		});

		const info = await testTransporter.sendMail({
			from: "",
			to,
			html: message,
		});

		console.log(info);
		console.log("Message sent: %s", info.messageId);
		console.log("Preview URL: %s", mailer.getTestMessageUrl(info));

		return {
			success: true,
			message: `Email sent ${info.messageId} `,
			details: info,
		};
	} catch (error) {
		console.error(error);
		return { success: false, details: error };
	}
};

module.exports = {
	transporter,
	sendEmail,
	sendTestMail,
};

// sendEmail("kingchi005@gmail.com", "test worked", "TEST MAIL FROM BACKEND");
