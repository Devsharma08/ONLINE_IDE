import dotenv from "dotenv";
import path from "path";
import { pathToFileURL } from "url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Level, PrismaClient } from "../src/generated/prisma/client.js";
import { rawProblems, type RawSeedProblem } from "./leetcodeProblems.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

const MAX_TEST_CASES_PER_PROBLEM = 3;
const GITHUB_OID_PATTERN = /^[a-f0-9]{40}$/i;

type SeedProblem = Omit<RawSeedProblem, "difficulty_level"> & {
  difficulty_level: Level;
};

const getConnectionString = () => {
  const directUrl = process.env.DIRECT_URL;

  if (!directUrl) {
    throw new Error("DIRECT_URL is required to seed LeetCode problems.");
  }

  return directUrl;
};

const maskConnectionString = (connectionString: string) =>
  connectionString.replace(/:([^@]+)@/, ":***@");

const toLevel = (difficulty: RawSeedProblem["difficulty_level"]): Level => {
  const level = Level[difficulty];

  if (!level) {
    throw new Error(`Unsupported difficulty level: ${difficulty}`);
  }

  return level;
};

export const problems: SeedProblem[] = rawProblems.map((problem) => ({
  ...problem,
  difficulty_level: toLevel(problem.difficulty_level),
}));

export const validateSeedData = () => {
  const problemNames = new Set<string>();
  const problemNumbers = new Set<number>();
  const githubOids = new Set<string>();

  for (const problem of problems) {
    if (!problem.name.toLowerCase().startsWith("leetcode")) {
      throw new Error(`Seed data must stay LeetCode-only. Invalid problem: ${problem.name}`);
    }

    if (problemNames.has(problem.name)) {
      throw new Error(`Duplicate problem name in seed data: ${problem.name}`);
    }
    problemNames.add(problem.name);

    if (problemNumbers.has(problem.problem_number)) {
      throw new Error(`Duplicate problem_number in seed data: ${problem.problem_number}`);
    }

    if (!Number.isInteger(problem.problem_number) || problem.problem_number <= 0) {
      throw new Error(`${problem.name} has an invalid problem_number: ${problem.problem_number}`);
    }
    problemNumbers.add(problem.problem_number);

    if (githubOids.has(problem.github_oid)) {
      throw new Error(`Duplicate github_oid in seed data: ${problem.github_oid}`);
    }

    if (!GITHUB_OID_PATTERN.test(problem.github_oid)) {
      throw new Error(`${problem.name} has an invalid github_oid: ${problem.github_oid}`);
    }
    githubOids.add(problem.github_oid);

    if (problem.test_cases.length === 0) {
      throw new Error(`${problem.name} must include at least one test case.`);
    }

    if (problem.test_cases.length > MAX_TEST_CASES_PER_PROBLEM) {
      throw new Error(
        `${problem.name} has ${problem.test_cases.length} test cases. Maximum allowed is ${MAX_TEST_CASES_PER_PROBLEM}.`,
      );
    }

    if (problem.code_snippets.length === 0) {
      throw new Error(`${problem.name} must include at least one code snippet.`);
    }

    for (const snippet of problem.code_snippets) {
      if (snippet.language !== "java" && snippet.language !== "javascript") {
        throw new Error(`${problem.name} has unsupported snippet language: ${snippet.language}`);
      }
    }
  }
};

const createPrisma = () => {
  const connectionString = getConnectionString();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { connectionString, pool, prisma };
};

async function main() {
  validateSeedData();

  const { connectionString, pool, prisma } = createPrisma();

  try {
    console.log(`Starting LeetCode problem seed for ${problems.length} problems...`);
    console.log("Connecting to:", maskConnectionString(connectionString));

    const problemNumbers = problems.map((problem) => problem.problem_number);
    const githubOids = problems.map((problem) => problem.github_oid);

    await prisma.$transaction(
      async (tx) => {
        const conflictingProblems = await tx.problem.findMany({
          where: {
            OR: [{ problem_number: { in: problemNumbers } }, { github_oid: { in: githubOids } }],
          },
          select: { id: true },
        });

        if (conflictingProblems.length > 0) {
          await tx.problem.deleteMany({
            where: { id: { in: conflictingProblems.map((problem) => problem.id) } },
          });
        }

        for (const problemSeed of problems) {
          const { test_cases, code_snippets, ...problemData } = problemSeed;

          await tx.problem.create({
            data: {
              ...problemData,
              test_cases: {
                create: test_cases,
              },
              code_snippets: {
                create: code_snippets,
              },
            },
          });

          console.log(
            `Seeded [#${problemSeed.problem_number}] ${problemSeed.name}: ${test_cases.length} tests, ${code_snippets.length} snippets`,
          );
        }
      },
      { maxWait: 20_000, timeout: 120_000 },
    );

    console.log("LeetCode problem seed complete.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectRun = () => {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
};

if (isDirectRun()) {
  main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
