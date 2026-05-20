export const GITHUB_OWNER = "Devsharma08";
export const GITHUB_REPO = "DSA-LEETCODE";

export const CACHE_KEYS = {
  files: "getFiles",
  fileNames: "getFilesNames",
  fileContent: "getFileContent",
  downloadInfo: "getDownloadInfo",
  commitHistory: "commitHistory",
  repoStats: "getRepoStats",
} as const;

export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  java: "Java",
  js: "JavaScript",
  jsx: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  py: "Python",
  cpp: "C++",
  c: "C",
};
