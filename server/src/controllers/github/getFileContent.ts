import type { Request, Response } from "express";
import { CACHE_KEYS, GITHUB_OWNER, GITHUB_REPO } from "../../config/github.js";
import { getCacheKey } from "../../utils/cacheKey.js";
import { getQueryValue, isGitObjectId } from "../../utils/request.js";
import { internalCache } from "../../Lib/cache.js";
import { postGraphQL } from "../../Lib/githubClient.js";
import { prisma } from "../../Lib/prisma.js";
import type { GitHubFileContentResponse } from "../../types/github.js";


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

export const getFileContent = async (req: Request, res: Response) => {
  const oid = getQueryValue(req.query.oid);

  if (!oid) {
    return res.status(400).json({ error: "Missing required oid query parameter" });
  }

  if (!isGitObjectId(oid)) {
    return res.status(400).json({ error: "Invalid oid query parameter" });
  }

  const cacheKey = getCacheKey(CACHE_KEYS.fileContent, oid);
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

    let testcases = await prisma.problem.findUnique({
      where: {
        github_oid: oid,
      },
      select: {
        test_cases: true,
        id: true,
        problem_definition: true,
        problem_hints: true,
        difficulty_level: true,
        data_structure: true,
      },
    });

    // Fallback: search in cached filenames
    if (!testcases) {
      const cachedFiles = internalCache.get<any[]>(CACHE_KEYS.fileNames);
      const matchedFile = cachedFiles?.find((f) => f.oid === oid);
      if (matchedFile && typeof matchedFile.name === "string") {
        const baseName = matchedFile.name.split(".")[0];
        if (baseName) {
          testcases = await prisma.problem.findFirst({
            where: {
              name: {
                equals: baseName,
                mode: "insensitive",
              },
            },
            select: {
              test_cases: true,
              id: true,
              problem_definition: true,
              problem_hints: true,
              difficulty_level: true,
              data_structure: true,
            },
          });
        }

        // fuzzy match if exact match not found
               // Declare matching variables in the outer scope so they are compile-safe!
        let bestMatch: any = null;
        let bestSimilarity = 0;

        // fuzzy match if exact match not found
        if (!testcases) {
          const allProblems = await prisma.problem.findMany({
            select: {
              id: true,
              name: true,
              test_cases: true,
              problem_definition: true,
              problem_hints: true,
              difficulty_level: true,
              data_structure: true,
            }
          });

          const target = baseName.toLowerCase();

          for (const p of allProblems) {
            const dbName = p.name.toLowerCase();
            if (dbName.includes(target) || target.includes(dbName)) {
              bestMatch = p;
              break;
            }

            const distance = getLevenshteinDistance(target, dbName);
            const similarity = 1 - distance / Math.max(target.length, dbName.length);

            if (similarity > bestSimilarity && similarity >= 0.4) {
              bestSimilarity = similarity;
              bestMatch = p;
            }
          }

          if (bestMatch) {
            testcases = bestMatch;
          }
        }

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
