import type { Request, Response } from "express";
import { CACHE_KEYS, GITHUB_OWNER, GITHUB_REPO } from "../../config/github.js";
import { getCacheKey } from "../../utils/cacheKey.js";
import { getQueryValue, isGitObjectId } from "../../utils/request.js";
import { internalCache } from "../../Lib/cache.js";
import { postGraphQL } from "../../Lib/githubClient.js";
import { prisma } from "../../Lib/prisma.js";
import type { GitHubFileContentResponse } from "../../types/github.js";

type CachedFileName = {
  oid: string;
  name?: string;
};

const getLevenshteinDistance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + substitutionCost
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[b.length] ?? 0;
};

const problemSelect = {
  name: true,
  test_cases: true,
  id: true,
  problem_definition: true,
  problem_hints: true,
  difficulty_level: true,
  data_structure: true,
} as const;

const getProblemBaseName = (fileName?: string | null) => {
  const trimmed = fileName?.trim();
  if (!trimmed) return null;

  const leafName = trimmed.split(/[\\/]/).pop() || trimmed;
  const querylessName = leafName.split("?")[0] || leafName;
  const extensionIndex = querylessName.lastIndexOf(".");

  return extensionIndex > 0 ? querylessName.slice(0, extensionIndex) : querylessName;
};

const getProblemNumber = (baseName: string) => {
  const match = baseName.match(/leetcode[-_]?0*(\d+)/i) || baseName.match(/0*(\d+)/);
  return match ? Number.parseInt(match[1] || match[0], 10) : null;
};

const findProblemByBaseName = async (baseName: string) => {
  const exactMatch = await prisma.problem.findFirst({
    where: {
      name: {
        equals: baseName,
        mode: "insensitive",
      },
    },
    select: problemSelect,
  });

  if (exactMatch) {
    return exactMatch;
  }

  const problemNum = getProblemNumber(baseName);
  if (problemNum) {
    const rawNumber = String(problemNum);
    const paddedTwo = rawNumber.padStart(2, "0");
    const paddedThree = rawNumber.padStart(3, "0");

    const numberMatch = await prisma.problem.findFirst({
      where: {
        OR: [
          { problem_number: problemNum },
          { name: { startsWith: `LeetCode-${paddedTwo}`, mode: "insensitive" } },
          { name: { startsWith: `LeetCode-${paddedThree}`, mode: "insensitive" } },
          { name: { startsWith: `LeetCode-${rawNumber}`, mode: "insensitive" } },
        ],
      },
      select: problemSelect,
    });

    if (numberMatch) {
      return numberMatch;
    }
  }

  const allProblems = await prisma.problem.findMany({
    select: problemSelect,
  });

  const target = baseName.toLowerCase();
  let bestMatch: (typeof allProblems)[number] | null = null;
  let bestSimilarity = 0;

  for (const problem of allProblems) {
    const dbName = problem.name.toLowerCase();
    if (dbName.includes(target) || target.includes(dbName)) {
      return problem;
    }

    const distance = getLevenshteinDistance(target, dbName);
    const similarity = 1 - distance / Math.max(target.length, dbName.length);

    if (similarity > bestSimilarity && similarity >= 0.85) {
      bestSimilarity = similarity;
      bestMatch = problem;
    }
  }

  return bestMatch;
};

export const getFileContent = async (req: Request, res: Response) => {
  const oid = getQueryValue(req.query.oid);
  const nameParam = getQueryValue(req.query.name);

  if (!oid) {
    return res.status(400).json({ error: "Missing required oid query parameter" });
  }

  if (!isGitObjectId(oid)) {
    return res.status(400).json({ error: "Invalid oid query parameter" });
  }

  const requestedBaseName = getProblemBaseName(nameParam);
  const cacheKeyValue = requestedBaseName ? `${oid}:${requestedBaseName.toLowerCase()}` : oid;
  const cacheKey = getCacheKey(CACHE_KEYS.fileContent, cacheKeyValue);
  const cached = internalCache.get(cacheKey);
  if (cached) {
    res.set("Cache-Control", "public,max-age=600");
    res.setHeader("Content-Type", "application/json");
    return res.json(cached);
  }

  try {
    const data = await postGraphQL<GitHubFileContentResponse>({
      query: `
        query($owner: String!, $name: String!, $oid: GitObjectID!) {
          repository(owner: $owner, name: $name) {
            object(oid:$oid) {
              ... on Blob {
                text
              }
            }
          }
        }
      `,
      variables: {
        owner: GITHUB_OWNER,
        name: GITHUB_REPO,
        oid,
      },
    });

    let testcases = requestedBaseName ? await findProblemByBaseName(requestedBaseName) : null;

    if (!testcases) {
      testcases = await prisma.problem.findUnique({
        where: {
          github_oid: oid,
        },
        select: problemSelect,
      });
    }

    // Fallback: search in cached filenames or use the provided name query parameter
    if (!testcases) {
      let baseName = requestedBaseName;

      if (!baseName) {
        const cachedFiles = internalCache.get<CachedFileName[]>(CACHE_KEYS.fileNames);
        const matchedFile = cachedFiles?.find((f) => f.oid === oid);
        if (matchedFile && typeof matchedFile.name === "string") {
          baseName = getProblemBaseName(matchedFile.name);
        }
      }

      if (baseName) {
        testcases = await findProblemByBaseName(baseName);
      }
    }


    const content = {
      content: data.data?.repository?.object?.text,
      test_cases: testcases?.test_cases || [],
      problem_definition: testcases?.problem_definition,
      problem_hints: testcases?.problem_hints,
      difficulty_level: testcases?.difficulty_level,
      data_structure: testcases?.data_structure,
      id: testcases?.id,
      name: testcases?.name,
    };

    if (!content.content) {
      return res.status(404).json({ error: "File not found or empty" });
    }

    if (content.content.length > 50000) {
      return res.status(413).json({ error: "File content is too large" });
    }

    internalCache.set(cacheKey, content, 10 * 60);
    res.set("Cache-Control", "public,max-age=600");
    res.setHeader("Content-Type", "application/json");
    return res.json(content);
  } catch (error) {
    console.error("GraphQL Fetch Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
