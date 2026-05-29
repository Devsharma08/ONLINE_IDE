import dotenv from "dotenv";
import path from "path";
import { pathToFileURL } from "url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Level, PrismaClient } from "../src/generated/prisma/client.js";
import { rawProblems, type RawSeedProblem } from "./leetcodeProblems.js";

const loadEnv = () => {
  const envPath = path.resolve(process.cwd(), process.env.NODE_MODE === "production" ? ".env.production" : ".env.development");
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    const fallbackPath = path.resolve(process.cwd(), ".env");
    dotenv.config({ path: fallbackPath, override: false });
  }
};
loadEnv();

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

const PROBLEM_CATEGORY_MAP: Record<string, string> = {
  "LeetCode-01E": "array",
  "LeetCode-02M": "linked list",
  "LeetCode-03M": "string",
  "LeetCode-04H": "searching",
  "LeetCode-05M": "dynamic prog",
  "LeetCode-06M": "string",
  "LeetCode-07M": "math",
  "LeetCode-08M": "string",
  "LeetCode-09E": "math",
  "LeetCode-100E": "tree",
  "LeetCode-101E": "tree",
  "LeetCode-102M": "tree",
  "LeetCode-103M": "tree",
  "LeetCode-1046E": "queue",
  "LeetCode-104E": "tree",
  "LeetCode-105M": "tree",
  "LeetCode-106M": "tree",
  "LeetCode-108E": "tree",
  "LeetCode-110E": "tree",
  "LeetCode-111E": "tree",
  "LeetCode-112E": "tree",
  "LeetCode-114M": "tree",
  "LeetCode-118M": "array",
  "LeetCode-119E": "array",
  "LeetCode-11M": "array",
  "LeetCode-120M": "dynamic prog",
  "LeetCode-121E": "array",
  "LeetCode-1249M": "stack",
  "LeetCode-125E": "string",
  "LeetCode-127H": "graph",
  "LeetCode-128M": "array",
  "LeetCode-130M": "graph",
  "LeetCode-133M": "graph",
  "LeetCode-138M": "linked list",
  "LeetCode-13E": "math",
  "LeetCode-139M": "dynamic prog",
  "LeetCode-141E": "linked list",
  "LeetCode-142M": "linked list",
  "LeetCode-143M": "linked list",
  "LeetCode-1448M": "tree",
  "LeetCode-148M": "linked list",
  "LeetCode-1480E": "array",
  "LeetCode-14E": "string",
  "LeetCode-15M": "array",
  "LeetCode-150M": "stack",
  "LeetCode-152M": "dynamic prog",
  "LeetCode-153M": "searching",
  "LeetCode-155E": "stack",
  "LeetCode-160E": "linked list",
  "LeetCode-162M": "searching",
  "LeetCode-167M": "array",
  "LeetCode-169E": "array",
  "LeetCode-17M": "backtracking",
  "LeetCode-189E": "array",
  "LeetCode-19M": "linked list",
  "LeetCode-199M": "tree",
  "LeetCode-198M": "dynamic prog",
  "LeetCode-20E": "stack",
  "LeetCode-200M": "graph",
  "LeetCode-205E": "string",
  "LeetCode-206E": "linked list",
  "LeetCode-207M": "graph",
  "LeetCode-208M": "tree",
  "LeetCode-21E": "linked list",
  "LeetCode-210M": "graph",
  "LeetCode-213M": "dynamic prog",
  "LeetCode-215M": "queue",
  "LeetCode-217E": "array",
  "LeetCode-219E": "array",
  "LeetCode-22M": "backtracking",
  "LeetCode-224H": "stack",
  "LeetCode-225E": "stack",
  "LeetCode-226E": "tree",
  "LeetCode-23H": "linked list",
  "LeetCode-230M": "tree",
  "LeetCode-232E": "stack",
  "LeetCode-234E": "linked list",
  "LeetCode-235E": "tree",
  "LeetCode-237E": "linked list",
  "LeetCode-238M": "array",
  "LeetCode-239H": "queue",
  "LeetCode-242E": "string",
  "LeetCode-25H": "linked list",
  "LeetCode-26E": "array",
  "LeetCode-261M": "graph",
  "LeetCode-2622M": "array",
  "LeetCode-2625M": "recursion",
  "LeetCode-2627M": "recursion",
  "LeetCode-2637M": "recursion",
  "LeetCode-269H": "graph",
  "LeetCode-27E": "array",
  "LeetCode-2705M": "recursion",
  "LeetCode-271M": "string",
  "LeetCode-2721M": "recursion",
  "LeetCode-2722M": "array",
  "LeetCode-277M": "array",
  "LeetCode-278E": "searching",
  "LeetCode-279M": "dynamic prog",
  "LeetCode-28E": "string",
  "LeetCode-286M": "graph",
  "LeetCode-287M": "searching",
  "LeetCode-29M": "math",
  "LeetCode-290E": "string",
  "LeetCode-295H": "queue",
  "LeetCode-297H": "tree",
  "LeetCode-300M": "dynamic prog",
  "LeetCode-309M": "dynamic prog",
  "LeetCode-31M": "array",
  "LeetCode-32H": "stack",
  "LeetCode-323M": "graph",
  "LeetCode-322M": "dynamic prog",
  "LeetCode-33M": "searching",
  "LeetCode-332M": "graph",
  "LeetCode-34M": "searching",
  "LeetCode-347M": "queue",
  "LeetCode-35E": "searching",
  "LeetCode-355M": "graph",
  "LeetCode-366M": "tree",
  "LeetCode-378M": "queue",
  "LeetCode-38M": "string",
  "LeetCode-383E": "string",
  "LeetCode-394M": "stack",
  "LeetCode-41H": "array",
  "LeetCode-412E": "math",
  "LeetCode-417M": "graph",
  "LeetCode-42H": "array",
  "LeetCode-43M": "math",
  "LeetCode-49M": "string",
  "LeetCode-496E": "stack",
  "LeetCode-50M": "math",
  "LeetCode-51H": "backtracking",
  "LeetCode-53M": "array",
  "LeetCode-543E": "tree",
  "LeetCode-547M": "graph",
  "LeetCode-55M": "greedy",
  "LeetCode-56M": "interval problems",
  "LeetCode-57M": "interval problems",
  "LeetCode-572E": "tree",
  "LeetCode-58E": "string",
  "LeetCode-61M": "linked list",
  "LeetCode-62M": "dynamic prog",
  "LeetCode-621M": "greedy",
  "LeetCode-63M": "dynamic prog",
  "LeetCode-64M": "dynamic prog",
  "LeetCode-647M": "dynamic prog",
  "LeetCode-66E": "array",
  "LeetCode-67E": "string",
  "LeetCode-68H": "string",
  "LeetCode-684M": "graph",
  "LeetCode-69E": "math",
  "LeetCode-695M": "graph",
  "LeetCode-70E": "dynamic prog",
  "LeetCode-703E": "queue",
  "LeetCode-704E": "searching",
  "LeetCode-71M": "stack",
  "LeetCode-739M": "stack",
  "LeetCode-74M": "searching",
  "LeetCode-743M": "graph",
  "LeetCode-75M": "array",
  "LeetCode-752M": "graph",
  "LeetCode-759H": "interval problems",
  "LeetCode-76H": "string",
  "LeetCode-778H": "graph",
  "LeetCode-78M": "backtracking",
  "LeetCode-785M": "graph",
  "LeetCode-787M": "graph",
  "LeetCode-79M": "backtracking",
  "LeetCode-797M": "graph",
  "LeetCode-802M": "graph",
  "LeetCode-82H": "linked list",
  "LeetCode-83E": "linked list",
  "LeetCode-84H": "stack",
  "LeetCode-841M": "graph",
  "LeetCode-853M": "stack",
  "LeetCode-86M": "linked list",
  "LeetCode-875M": "searching",
  "LeetCode-876E": "linked list",
  "LeetCode-88E": "array",
  "LeetCode-91M": "dynamic prog",
  "LeetCode-92M": "linked list",
  "LeetCode-94E": "tree",
  "LeetCode-973M": "queue",
  "LeetCode-98M": "tree",
  "LeetCode-994M": "graph",
  "LeetCode-997E": "graph",
};

export function inferDataStructure(name: string, definition: string): string {
  const cleanName = name.trim().split(".")[0];
  if (cleanName && PROBLEM_CATEGORY_MAP[cleanName]) {
    return PROBLEM_CATEGORY_MAP[cleanName];
  }

  const content = `${name} ${definition}`.toLowerCase();
  
  if (content.includes("linked list") || content.includes("listnode") || content.includes("list node") || content.includes("merge k sorted lists")) {
    return "linked list";
  }
  if (content.includes("binary tree") || content.includes("treenode") || content.includes(" bst") || content.includes("tree") || content.includes("postorder") || content.includes("preorder") || content.includes("inorder")) {
    return "tree";
  }
  if (content.includes("graph") || content.includes("clone graph") || content.includes("course schedule") || content.includes("dijkstra") || content.includes("bipartite")) {
    return "graph";
  }
  if (content.includes("stack") || content.includes("valid parentheses") || content.includes("parentheses")) {
    return "stack";
  }
  if (content.includes("queue")) {
    return "queue";
  }
  if (content.includes("dynamic programming") || content.includes("dp") || content.includes("coin change") || content.includes("longest common subsequence") || content.includes("climbing stairs") || content.includes("edit distance") || content.includes("house robber") || content.includes("word break")) {
    return "dynamic prog";
  }
  if (content.includes("greedy") || content.includes("jump game") || content.includes("gas station")) {
    return "greedy";
  }
  if (content.includes("backtracking") || content.includes("n-queens") || content.includes("permutations") || content.includes("subsets") || content.includes("combination sum") || content.includes("sudoku")) {
    return "backtracking";
  }
  if (content.includes("recursion") || content.includes("recursive")) {
    return "recursion";
  }
  if (content.includes("binary search") || content.includes("search in rotated") || content.includes("search a 2d matrix") || content.includes("searching")) {
    return "searching";
  }
  if (content.includes("interval") || content.includes("merge intervals") || content.includes("insert interval") || content.includes("meeting rooms")) {
    return "interval problems";
  }
  if (content.includes("string") || content.includes("palindrome") || content.includes("valid anagram") || content.includes("substring") || content.includes("anagram") || content.includes("atoi") || content.includes("reverse string")) {
    return "string";
  }
  if (content.includes("math") || content.includes("pow") || content.includes("sqrt") || content.includes("integer") || content.includes("two sum") || content.includes("sum") || content.includes("add") || content.includes("digit") || content.includes("reverse integer")) {
    return "math";
  }
  if (content.includes("array") || content.includes("matrix") || content.includes("rotate image") || content.includes("spiral matrix") || content.includes("nums") || content.includes("indices") || content.includes("subarrays")) {
    return "array";
  }
  return "array"; // Default fallback
}

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
              data_structure: inferDataStructure(problemData.name, problemData.problem_definition),
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
