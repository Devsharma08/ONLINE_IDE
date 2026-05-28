import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const problems = await prisma.problem.findMany({
    where: {
      name: {
        contains: "time",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      code_snippets: true,
      test_cases: true,
    },
  });

  console.log(JSON.stringify(problems, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
