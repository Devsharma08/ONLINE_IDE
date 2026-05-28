import type { Request, Response } from "express";
import { CACHE_KEYS, EXTENSION_LANGUAGE_MAP } from "../../config/github.js";
import { internalCache } from "../../Lib/cache.js";
import { postGraphQL } from "../../Lib/githubClient.js";
import { prisma } from "../../Lib/prisma.js";
import type { GitHubFileNamesResponse } from "../../types/github.js";

type LanguageMeta = {
  size: number;
  color: string | null;
};

const checkDiffuclty = (name: string, arr: string[]): string => {
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    if (val && name.endsWith(val)) {
      return val;
    }
  }
  return 'E';
};

export const getFileNames = async (_req: Request, res: Response) => {
  try {
    const cached = internalCache.get(CACHE_KEYS.fileNames);
    if (cached) {
      res.set("Cache-Control", "public,max-age=600");
      return res.status(200).json(cached);
    }

    const rawData = await postGraphQL<GitHubFileNamesResponse>({
      query: `
        query {
          repository(owner: "Devsharma08", name: "DSA-LEETCODE") {
            object(expression: "main:") {
              ... on Tree {
                entries {
                  name
                  type
                  oid
                }
              }
            }
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      `,
    });

    const entries = rawData.data?.repository?.object?.entries; // The main file/directory listing from the root of the repository
    const languagesData = rawData.data?.repository?.languages?.edges; // The language breakdown data for the repository

    if (!entries) {
      return res.status(404).json({ error: "Repository structure data not found" });
    }

    // Keep only LeetCode challenge templates of type blob
    const leetcodeEntries = entries.filter(
      (item) => item.type === "blob" && item.name.toLowerCase().startsWith("leetcode")
    );

    const languageMap = new Map<string, LanguageMeta>();
    for (const edge of languagesData ?? []) {
      languageMap.set(edge.node.name.toLowerCase(), {
        size: edge.size,
        color: edge.node.color ?? null,
      });
    }

    const dbProblemsList = await prisma.problem.findMany({
      select: { name: true, difficulty_level: true, data_structure: true }
    });
    const dbProblemMap = new Map<string, { difficulty_level: string; data_structure: string | null }>();
    for (const p of dbProblemsList) {
      dbProblemMap.set(p.name.toLowerCase(), {
        difficulty_level: p.difficulty_level,
        data_structure: p.data_structure
      });
    }

    const unifiedResponse = leetcodeEntries.map((item) => {
      let matchedLanguage: string | null;
      let difficulty: string = 'E';

      if (item.type === "tree") {
        matchedLanguage = EXTENSION_LANGUAGE_MAP[item.name.toLowerCase()] || item.name;
      } else {
        const parts = item.name.split(".");
        difficulty = checkDiffuclty(parts[0] || "", ['H', 'M', 'E']);
        const extension = parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
        matchedLanguage = EXTENSION_LANGUAGE_MAP[extension] || null;
      }

      const langMeta = matchedLanguage ? languageMap.get(matchedLanguage.toLowerCase()) : null;

      const baseName = item.name.split(".")[0]?.toLowerCase() || "";
      const dbProblem = dbProblemMap.get(baseName);
      const dataStructure = dbProblem?.data_structure || null;

      let mappedDifficulty = difficulty;
      if (dbProblem?.difficulty_level) {
        mappedDifficulty = dbProblem.difficulty_level === "HARD" ? "H" : dbProblem.difficulty_level === "MEDIUM" ? "M" : "E";
      }

      return {
        name: item.name,
        type: item.type,
        oid: item.oid,
        language: matchedLanguage || "Unknown",
        size: langMeta?.size ?? 0,
        color: langMeta?.color || "#cccccc",
        difficulty_level: mappedDifficulty,
        data_structure: dataStructure
      };
    });

    // Sync OIDs to database in the background without blocking client response
    void (async () => {
      try {
        const dbProblems = await prisma.problem.findMany({
          select: { id: true, name: true, github_oid: true }
        });
        const dbProblemMap = new Map<string, { id: string; github_oid: string }>();
        for (const p of dbProblems) {
          dbProblemMap.set(p.name.toLowerCase(), { id: p.id, github_oid: p.github_oid });
        }

        const updatePromises: Promise<unknown>[] = [];
        for (const item of leetcodeEntries) {
          if (item.type !== "blob") continue;
          const baseName = item.name.split(".")[0]?.toLowerCase();
          if (!baseName) continue;

          const dbProblem = dbProblemMap.get(baseName);
          if (dbProblem && dbProblem.github_oid !== item.oid) {
            updatePromises.push(
              prisma.problem.update({
                where: { id: dbProblem.id },
                data: { github_oid: item.oid }
              }).catch((err) => {
                console.error(`Failed to background-sync OID for problem ${baseName}:`, err);
              })
            );
          }
        }

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(`Successfully auto-synced ${updatePromises.length} dynamic problem OIDs in the database.`);
        }
      } catch (syncError) {
        console.error("Failed to dynamically sync LeetCode file OIDs to DB:", syncError);
      }
    })();

    internalCache.set(CACHE_KEYS.fileNames, unifiedResponse, 10 * 60);
    res.set("Cache-Control", "public,max-age=600");
    return res.status(200).json(unifiedResponse);
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
