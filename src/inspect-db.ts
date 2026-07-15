import { prisma } from "./app/lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("LAST 5 USERS:", JSON.stringify(users, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
