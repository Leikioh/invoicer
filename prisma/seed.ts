import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();


async function main() {
await prisma.client.upsert({
where: { email: "billing@acme.test" },
update: {},
create: { displayName: "ACME", email: "billing@acme.test" }
});
}


main().finally(async () => prisma.$disconnect());