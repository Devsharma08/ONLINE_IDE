export const assertRuntimeEnv = () => {
  if (!process.env.GITHUB_KEY || process.env.GITHUB_KEY === "your_github_token_here") {
    console.error("Fatal: GITHUB_KEY is missing or still a placeholder. Set a real GitHub token in your env file.");
    process.exit(1);
  }
};
