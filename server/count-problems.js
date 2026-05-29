import pg from "pg";
import dotenv from "dotenv";
import path from "path";

const loadEnv = () => {
  const envPath = path.resolve(process.cwd(), process.env.NODE_MODE === "production" ? ".env.production" : ".env.development");
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    const fallbackPath = path.resolve(process.cwd(), ".env");
    dotenv.config({ path: fallbackPath, override: false });
  }
};
loadEnv();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DIRECT_URL or DATABASE_URL is not defined in your env files!");
  process.exit(1);
}

console.log("Connecting to:", connectionString.replace(/:([^@]+)@/, ":***@"));

const pool = new pg.Pool({ connectionString });

async function main() {
  try {
    const resProblems = await pool.query('SELECT COUNT(*) FROM "Problem"');
    console.log("✅ Connection Successful!");
    console.log(`Count of Problems: ${resProblems.rows[0].count}`);

    const resTestCases = await pool.query('SELECT COUNT(*) FROM "TestCase"');
    console.log(`Count of TestCases: ${resTestCases.rows[0].count}`);
  } catch (error) {
    console.error("❌ Database Query Error:", error);
  } finally {
    await pool.end();
  }
}

main();
