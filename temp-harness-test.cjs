const fs = require('fs');
const path = require('path');
const temp = path.join(process.cwd(), 'temp-test');
fs.rmSync(temp, { recursive: true, force: true });
fs.mkdirSync(temp, { recursive: true });
fs.writeFileSync(path.join(temp, 'index.js'), `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    return [0,1];
};
module.exports = { twoSum };`);
fs.writeFileSync(path.join(temp, 'input.txt'), '[2,7,11,15]\n9\n');
fs.writeFileSync(path.join(temp, 'runner.js'), `const fs = require("fs");
const path = require("path");
const exported = require("./index.js");
const fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["twoSum"] || exported[Object.keys(exported)[0]] : null;
if (typeof fn !== "function") {
  throw new Error("Could not resolve exported function for execution");
}
const rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");
const lines = rawInput.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
const parseValue = (value) => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^[-+]?[0-9]*\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (/^[\[\{].*[\]\}]$/.test(trimmed) || (/^\".*\"$/.test(trimmed) || /^\'.*\'$/.test(trimmed))) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return trimmed.replace(/^['\"]|['\"]$/g, "");
    }
  }
  return trimmed;
};
const args = lines.map(parseValue);
const result = fn(...args);
if (result !== undefined) {
  if (typeof result === "object") {
    console.log(JSON.stringify(result));
  } else {
    console.log(result);
  }
}`);
const out = require('child_process').execSync('node runner.js', { cwd: temp, encoding: 'utf8' });
console.log('output:', out);
