import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { SUPER_ADMIN_EMAIL, normalizeEmail } from "../src/lib/auth/constants";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = normalizeEmail(SUPER_ADMIN_EMAIL);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.passwordHash) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  const initialPassword =
    process.env.ADMIN_INITIAL_PASSWORD ??
    `OPE-${randomBytes(9).toString("base64url")}`;

  const passwordHash = await hashPassword(initialPassword);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isAuthorized: true,
      mustChangePassword: true,
    },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      isAuthorized: true,
      mustChangePassword: true,
    },
  });

  console.log("\n=== Obsidian Prospect Engine — Super Admin ===");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${initialPassword}`);
  console.log("You will be prompted to change this password on first login.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
