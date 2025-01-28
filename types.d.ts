import { User } from "@prisma/client";

type Tuser = User;

interface IUser extends User {
	login(): void;
}
