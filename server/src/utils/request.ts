export const getQueryValue = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

const GIT_OBJECT_ID_PATTERN = /^[a-f0-9]{40,64}$/i;
const SAFE_REPO_PATH_PATTERN = /^[A-Za-z0-9._\-/ ]+$/;

export const isGitObjectId = (value: string) => {
  return GIT_OBJECT_ID_PATTERN.test(value);
};

export const isSafeRepoPath = (value: string) => {
  if (!value || value.length > 240 || value.startsWith("/") || value.includes("\\")) {
    return false;
  }

  if (!SAFE_REPO_PATH_PATTERN.test(value)) {
    return false;
  }

  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
};
