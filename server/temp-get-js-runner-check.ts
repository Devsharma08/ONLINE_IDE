const getJavaScriptRunner = (exportName: string) => `const fs = require("fs");\nconst path = require("path");\nconst exported = require("./index.js");\nconst fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["${exportName}"] || exported[Object.keys(exported)[0]] : null;\nif (typeof fn !== "function") {\n  throw new Error("Could not resolve exported function for execution");\n}\nconst rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");\nconst lines = rawInput.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);\n`;
const runner = getJavaScriptRunner('twoSum');
console.log('index literal', runner.indexOf('\\r\\n'));
console.log('index actual', runner.indexOf('\r\n'));
console.log('json', JSON.stringify(runner));
