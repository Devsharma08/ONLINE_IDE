import fs from 'fs/promises';
import path from 'path';

const JS_EXPORT_REGEX = /module\.exports\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*;?/;
const extractJsExportName = (wrapperCode: string): string | null => {
  const match = JS_EXPORT_REGEX.exec(wrapperCode);
  return match ? match[1] ?? null : null;
};

const getJavaScriptRunner = (exportName: string) => `const fs = require("fs");\nconst path = require("path");\nconst exported = require("./index.js");\nconst fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["${exportName}"] || exported[Object.keys(exported)[0]] : null;\nif (typeof fn !== "function") {\n  throw new Error("Could not resolve exported function for execution");\n}\nconst rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");\nconst lines = rawInput.replace(/\\r\\n/g, "\\n").split("\\n").filter((line) => line.length > 0);\nconst parseValue = (value) => {\n  const trimmed = value.trim();\n  if (trimmed === "true") return true;\n  if (trimmed === "false") return false;\n  if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);\n  if (/^[-+]?[0-9]*\\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);\n  if (/^[\[\{].*[\]\}]$/.test(trimmed) || (/^\".*\"$/.test(trimmed) || /^\'.*\'$/.test(trimmed))) {\n    try {\n      return JSON.parse(trimmed);\n    } catch (e) {\n      return trimmed.replace(/^['\\"]|['\\"]$/g, "");\n    }\n  }\n  return trimmed;\n};\nconst args = lines.map(parseValue);\nconst result = fn(...args);\nif (result !== undefined) {\n  if (typeof result === "object") {\n    console.log(JSON.stringify(result));\n  } else {\n    console.log(result);\n  }\n}`;

const run = async () => {
  const tempDir = path.join(process.cwd(), 'temp-test');
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, 'index.js'), `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    return [0,1];\n};\nmodule.exports = { twoSum };`);
  await fs.writeFile(path.join(tempDir, 'input.txt'), '[2,7,11,15]\n9\n');

  const runner = getJavaScriptRunner('twoSum');
  await fs.writeFile(path.join(tempDir, 'runner.js'), runner);

  const { execSync } = await import('child_process');
  const out = execSync('node runner.js', { cwd: tempDir, encoding: 'utf8' });
  console.log({ status: 0, stdout: out, stderr: '' });
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});