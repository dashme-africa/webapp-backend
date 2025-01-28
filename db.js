const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("./utils");

const db = new PrismaClient();

db.$extends({
	query: {
		user: {
			async create({ args, query }) {
				args.data.password = await hashPassword(args.data.password);
				return query(args);
			},
			async update({ args, query }) {
				const password = args.data.password;
				if (password)
					args.data.password = await hashPassword(args.data.password);
				return query(args);
			},
			async upsert({ args, query }) {
				const updatePassword = args.update.password;
				const createPassword = args.create.password;
				if (updatePassword)
					args.update.password = await hashPassword(updatePassword);
				if (createPassword)
					args.create.password = await hashPassword(updatePassword);
				return query(args);
			},
		},
	},
});

module.exports = db;
