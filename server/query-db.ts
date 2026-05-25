import { prisma } from "./src/Lib/prisma.js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

async function main() {
  try {
    const problems = await prisma.problem.findMany({
      include: {
        test_cases: true,
        code_snippets: true,
      }
    });
    console.log(`Found ${problems.length} problems in the database:`);
    for (const p of problems) {
      console.log(`[#${p.problem_number}] ${p.name} - github_oid: ${p.github_oid}`);
      console.log(`  Test cases: ${p.test_cases.length}`);
      console.log(`  Snippets: ${p.code_snippets.map(s => s.language).join(", ")}`);
    }
  } catch (error) {
    console.error("Failed to query DB:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
