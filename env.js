const { z } = require("zod");

const envSchema = z.object({
	CORS_ORIGINS: z.string(),
	MONGO_URI: z.string(),
	DATABASE_URL: z.string(),
	ADMIN_TOKEN_SECRET_KEY: z.string(),
	TOKEN_SECRET_KEY: z.string(),
	CLOUDINARY_CLOUD_NAME: z.string(),
	CLOUDINARY_API_KEY: z.string(),
	CLOUDINARY_API_SECRET: z.string(),
	EMAIL_PASSWORD: z.string(),
	EMAIL_USERNAME: z.string(),
	PAYSTACK_SECRET_KEY: z.string(),
	GOSHIIP_BASE_URL: z.string(),
	GOSHIIP_API_KEY: z.string(),
	GOSHIP_USER_ID: z.string(),
});

module.exports = envSchema.parse(process.env);
