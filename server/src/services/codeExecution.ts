import { exec } from "child_process";
import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../Lib/prisma.js";
import { internalCache } from "../Lib/cache.js";
import vm from "node:vm";



type SupportedLanguage = "javascript" | "java";
type ExecutionMode = "RUN" | "SUBMIT";

type ExecuteBody = {
  code?: unknown;
  language?: unknown;
  oid?: unknown;
  mode?: unknown;
  customInput?: unknown;
};

type TestCaseRecord = {
  input: string;
  expectedOutput: string;
  problemId?: string;
};

type CodeSnippetRecord = {
  language: string;
  wrapperCode?: string | null;
};

type ExecutionDetail = {
  testCaseIndex: number;
  output: string;
  expectedOutput: string;
  passed: boolean;
  problemId?: string;
  runtimeError: string | null;
};

const execAsync = promisify(exec);

const normalize = (value: string) => (value || "").replace(/\r\n/g, "\n").trim();

const problemIdPayload = (currentCase: TestCaseRecord) => {
  return currentCase.problemId ? { problemId: currentCase.problemId } : {};
};

const getExecutionMode = (mode: unknown): ExecutionMode => {
  return mode === "SUBMIT" ? "SUBMIT" : "RUN";
};

const getLanguage = (language: unknown): SupportedLanguage => {
  return language === "java" ? "java" : "javascript";
};

const getJavaImports = () => {
  return ["import java.util.*", "import java.io.*", "import java.math.*", "import java.util.stream.*"]
    .map((importLine) => `${importLine};`)
    .join("\n");
};

const JS_EXPORT_REGEX = /module\.exports\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*;?/;
const extractJsExportName = (wrapperCode: string): string | null => {
  const match = JS_EXPORT_REGEX.exec(wrapperCode);
  return match ? match[1] ?? null : null;
};

const getJavaScriptRunner = (exportName: string) => `const fs = require("fs");\nconst path = require("path");\nconst exported = require("./index.js");\nconst fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["${exportName}"] || exported[Object.keys(exported)[0]] : null;\nif (typeof fn !== "function") {\n  throw new Error("Could not resolve exported function for execution");\n}\nconst rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");\nconst lines = rawInput.replace(/\\r\\n/g, "\\n").split("\\n").filter((line) => line.length > 0);\nconst parseValue = (value) => {\n  const trimmed = value.trim();\n  if (trimmed === "true") return true;\n  if (trimmed === "false") return false;\n  if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);\n  if (/^[-+]?[0-9]*\\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);\n  if (/^[\[\{].*[\]\}]$/.test(trimmed) || (/^\".*\"$/.test(trimmed) || /^\'.*\'$/.test(trimmed))) {\n    try {\n      return JSON.parse(trimmed);\n    } catch (e) {\n      return trimmed.replace(/^['\"]|['\"]$/g, "");\n    }\n  }\n  return trimmed;\n};\nconst args = lines.map(parseValue);\nconst result = fn(...args);\nif (result !== undefined) {\n  if (typeof result === "object") {\n    console.log(JSON.stringify(result));\n  } else {\n    console.log(result);\n  }\n}`;

// checking wrappercode contains // test wrapper comment
const isDefaultJavaWrapper = (wrapperCode: string) => wrapperCode.includes("// Test wrapper");

// checking if the user has written main method in his code
const hasJavaMain = (code: string) => /public\s+static\s+void\s+main\s*\(/.test(code) || /public\s+class\s+Main\s*/.test(code);


const getJavaMainWrapper = () => `public class Main {
  public static void main(String[] args) throws Exception {
    String raw = java.nio.file.Files.readString(java.nio.file.Path.of("input.txt"));
    String[] lines = java.util.Arrays.stream(raw.replace("\\\\r\\\\n", "\\\\n").split("\\\\n"))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toArray(String[]::new);
    java.lang.reflect.Method target = java.util.Arrays.stream(Solution.class.getDeclaredMethods())
        .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
        .filter(m -> !m.getName().equals("main"))
        .findFirst()
        .orElseThrow(() -> new RuntimeException("No public solution method found"));
    Object instance = java.lang.reflect.Modifier.isStatic(target.getModifiers()) ? null : Solution.class.getDeclaredConstructor().newInstance();
    Object[] parsedArgs = parseArguments(target.getGenericParameterTypes(), lines);
    Object result = target.invoke(instance, parsedArgs);
    if (result != null) {
      System.out.println(format(result));
    }
  }

  private static Object[] parseArguments(java.lang.reflect.Type[] paramTypes, String[] lines) {
    Object[] args = new Object[paramTypes.length];
    for (int i = 0; i < paramTypes.length; i++) {
      if (i >= lines.length) {
        throw new IllegalArgumentException("Not enough input lines for solution arguments");
      }
      args[i] = parseValue(lines[i], paramTypes[i]);
    }
    return args;
  }

  private static Object parseValue(String raw, java.lang.reflect.Type type) {
    String trimmed = raw.trim();
    if (type instanceof Class<?>) {
      Class<?> clazz = (Class<?>) type;
      if (clazz == String.class) {
        return trimmed.replaceAll("^['\\\"']|['\\\"']$", "");
      }
      if (clazz == int.class || clazz == Integer.class) {
        return Integer.parseInt(trimmed);
      }
      if (clazz == long.class || clazz == Long.class) {
        return Long.parseLong(trimmed);
      }
      if (clazz == double.class || clazz == Double.class) {
        return Double.parseDouble(trimmed);
      }
      if (clazz == boolean.class || clazz == Boolean.class) {
        return Boolean.parseBoolean(trimmed);
      }
      if (clazz == char.class || clazz == Character.class) {
        return trimmed.length() > 0 ? trimmed.charAt(0) : '\\0';
      }
      if (clazz.isArray()) {
        return parseArray(trimmed, clazz.getComponentType());
      }
      if (java.util.List.class.isAssignableFrom(clazz)) {
        return parseList(trimmed, Object.class);
      }
      if (clazz.getSimpleName().equals("ListNode")) {
        return parseListNode(trimmed);
      }
      if (clazz.getSimpleName().equals("TreeNode")) {
        return parseTreeNode(trimmed);
      }
      return null;
    }
    if (type instanceof java.lang.reflect.ParameterizedType) {
      java.lang.reflect.ParameterizedType parameterized = (java.lang.reflect.ParameterizedType) type;
      java.lang.reflect.Type rawType = parameterized.getRawType();
      if (rawType == java.util.List.class) {
        java.lang.reflect.Type elementType = parameterized.getActualTypeArguments()[0];
        return parseList(trimmed, elementType);
      }
    }
    return trimmed.replaceAll("^['\\\"']|['\\\"']$", "");
  }

  private static Object parseArray(String raw, Class<?> componentType) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]")) {
      return java.lang.reflect.Array.newInstance(componentType, 0);
    }
    String inner = trimmed.substring(1, trimmed.length() - 1);
    java.util.List<String> items = splitTopLevel(inner);
    Object array = java.lang.reflect.Array.newInstance(componentType, items.size());
    for (int i = 0; i < items.size(); i++) {
      java.lang.reflect.Array.set(array, i, parseValue(items.get(i), componentType));
    }
    return array;
  }

  private static java.util.List<Object> parseList(String raw, java.lang.reflect.Type elementType) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]")) {
      return new java.util.ArrayList<>();
    }
    String inner = trimmed.substring(1, trimmed.length() - 1);
    java.util.List<String> items = splitTopLevel(inner);
    java.util.List<Object> list = new java.util.ArrayList<>();
    for (String item : items) {
      list.add(parseValue(item, elementType));
    }
    return list;
  }

  private static java.util.List<String> splitTopLevel(String raw) {
    java.util.List<String> values = new java.util.ArrayList<>();
    int depth = 0;
    boolean inString = false;
    char quote = '\\0';
    StringBuilder current = new StringBuilder();
    for (int i = 0; i < raw.length(); i++) {
      char c = raw.charAt(i);
      if (inString) {
        if (c == quote) {
          inString = false;
        }
        current.append(c);
        continue;
      }
      if (c == '\\'' || c == '"') {
        inString = true;
        quote = c;
        current.append(c);
        continue;
      }
      if (c == '[' || c == '{') {
        depth++;
      } else if (c == ']' || c == '}') {
        depth--;
      } else if (c == ',' && depth == 0) {
        values.add(current.toString().trim());
        current.setLength(0);
        continue;
      }
      current.append(c);
    }
    if (current.length() > 0) {
      values.add(current.toString().trim());
    }
    return values;
  }

  private static String format(Object value) {
    if (value == null) {
      return "null";
    }
    Class<?> clazz = value.getClass();
    if (clazz.getSimpleName().equals("ListNode")) {
      return formatListNode(value);
    }
    if (clazz.getSimpleName().equals("TreeNode")) {
      return formatTreeNode(value);
    }
    if (clazz.isArray()) {
      return arrayToString(value);
    }
    if (value instanceof java.util.Collection) {
      java.util.List<String> elements = new java.util.ArrayList<>();
      for (Object item : (java.util.Collection<?>) value) {
        elements.add(format(item));
      }
      return "[" + String.join(",", elements) + "]";
    }
    return value.toString();
  }

  private static String arrayToString(Object array) {
    int length = java.lang.reflect.Array.getLength(array);
    java.util.List<String> items = new java.util.ArrayList<>();
    for (int i = 0; i < length; i++) {
      items.add(format(java.lang.reflect.Array.get(array, i)));
    }
    return "[" + String.join(",", items) + "]";
  }

  private static Object parseListNode(String raw) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]") || trimmed.equals("null")) {
      return null;
    }
    String inner = trimmed.substring(1, trimmed.length() - 1);
    java.util.List<String> items = splitTopLevel(inner);
    if (items.isEmpty()) {
      return null;
    }
    try {
      Class<?> listNodeClass = Class.forName("ListNode");
      java.lang.reflect.Constructor<?> valueConstructor = listNodeClass.getConstructor(int.class);
      Object head = null;
      Object current = null;
      for (String item : items) {
        int val = Integer.parseInt(item.trim());
        Object node = valueConstructor.newInstance(val);
        if (head == null) {
          head = node;
          current = node;
        } else {
          java.lang.reflect.Field nextField = listNodeClass.getField("next");
          nextField.set(current, node);
          current = node;
        }
      }
      return head;
    } catch (Exception e) {
      e.printStackTrace();
      return null;
    }
  }

  private static Object parseTreeNode(String raw) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]") || trimmed.equals("null")) {
      return null;
    }
    String inner = trimmed.substring(1, trimmed.length() - 1);
    java.util.List<String> items = splitTopLevel(inner);
    if (items.isEmpty() || items.get(0).equals("null")) {
      return null;
    }
    try {
      Class<?> treeNodeClass = Class.forName("TreeNode");
      java.lang.reflect.Constructor<?> constructor = treeNodeClass.getConstructor(int.class);
      java.lang.reflect.Field leftField = treeNodeClass.getField("left");
      java.lang.reflect.Field rightField = treeNodeClass.getField("right");

      Object root = constructor.newInstance(Integer.parseInt(items.get(0).trim()));
      java.util.Queue<Object> queue = new java.util.LinkedList<>();
      queue.add(root);

      int i = 1;
      while (!queue.isEmpty() && i < items.size()) {
        Object curr = queue.poll();

        if (i < items.size()) {
          String valStr = items.get(i).trim();
          if (!valStr.equals("null") && !valStr.isEmpty()) {
            Object left = constructor.newInstance(Integer.parseInt(valStr));
            leftField.set(curr, left);
            queue.add(left);
          }
          i++;
        }

        if (i < items.size()) {
          String valStr = items.get(i).trim();
          if (!valStr.equals("null") && !valStr.isEmpty()) {
            Object right = constructor.newInstance(Integer.parseInt(valStr));
            rightField.set(curr, right);
            queue.add(right);
          }
          i++;
        }
      }
      return root;
    } catch (Exception e) {
      e.printStackTrace();
      return null;
    }
  }

  private static String formatListNode(Object head) {
    if (head == null) {
      return "null";
    }
    try {
      Class<?> listNodeClass = Class.forName("ListNode");
      java.lang.reflect.Field valField = listNodeClass.getField("val");
      java.lang.reflect.Field nextField = listNodeClass.getField("next");

      java.util.List<String> elements = new java.util.ArrayList<>();
      Object curr = head;
      while (curr != null) {
        elements.add(String.valueOf(valField.get(curr)));
        curr = nextField.get(curr);
      }
      return "[" + String.join(",", elements) + "]";
    } catch (Exception e) {
      return "null";
    }
  }

  private static String formatTreeNode(Object root) {
    if (root == null) {
      return "[]";
    }
    try {
      Class<?> treeNodeClass = Class.forName("TreeNode");
      java.lang.reflect.Field valField = treeNodeClass.getField("val");
      java.lang.reflect.Field leftField = treeNodeClass.getField("left");
      java.lang.reflect.Field rightField = treeNodeClass.getField("right");

      java.util.List<String> elements = new java.util.ArrayList<>();
      java.util.List<Object> queue = new java.util.ArrayList<>();
      queue.add(root);

      int lastNonNull = 0;
      int i = 0;
      while (i < queue.size()) {
        Object curr = queue.get(i);
        if (curr != null) {
          elements.add(String.valueOf(valField.get(curr)));
          lastNonNull = elements.size();
          queue.add(leftField.get(curr));
          queue.add(rightField.get(curr));
        } else {
          elements.add("null");
        }
        i++;
      }

      java.util.List<String> trimmed = elements.subList(0, lastNonNull);
      return "[" + String.join(",", trimmed) + "]";
    } catch (Exception e) {
      return "[]";
    }
  }
}`;

const prepareSourceFile = async ({
  code,
  language,
  tempDir,
  wrapperCode,
}: {
  code: string;
  language: SupportedLanguage;
  tempDir: string;
  wrapperCode: string;
}) => {
  if (language.toLowerCase() === "java") {
    const autoImports = getJavaImports(); // importing dependencies ex- import java.utils.io, etc
    const useCustomMain = !isDefaultJavaWrapper(wrapperCode) && hasJavaMain(wrapperCode); // defaultjavawrapper - contains // testwrapper code
    let processedCode: string;
    const cleanCode = code.replace(/public\s+class\b/g, "class");

    if (useCustomMain) {
      processedCode = `${autoImports}\n\n${cleanCode}\n${wrapperCode}`;
    } else if (hasJavaMain(cleanCode)) {
      // Find the class that contains the main method and rename it to Main so the javac / java command runs perfectly
      const mainClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)(?:(?!class)[\s\S])*?void\s+main\s*\(/);
      const mainClassName = mainClassMatch ? mainClassMatch[1] : null;
      processedCode = `${autoImports}\n\n${mainClassName ? cleanCode.replace(new RegExp(`class\\s+${mainClassName}\\b`), "class Main") : cleanCode}`;
    } else {
      const hasSolutionClass = /class\s+Solution\b/.test(cleanCode);
      const solutionClassReadyCode = hasSolutionClass 
        ? cleanCode 
        : cleanCode.replace(/class\s+[A-Za-z0-9_]+/, "class Solution");
      processedCode = `${autoImports}\n\n${solutionClassReadyCode}\n\n${getJavaMainWrapper()}`;
    }

    await fs.writeFile(path.join(tempDir, "Main.java"), processedCode);

    return {
      dockerImage: "eclipse-temurin:17-alpine",
      runCommand: "javac Main.java && java Main < input.txt",
    };
  }

  const fileName = "index.js";
  const processedCode = wrapperCode ? `${code}\n${wrapperCode}` : code;
  await fs.writeFile(path.join(tempDir, fileName), processedCode);

  const exportName = extractJsExportName(wrapperCode);
  if (exportName) {
    const runnerFile = "runner.js";
    await fs.writeFile(path.join(tempDir, runnerFile), getJavaScriptRunner(exportName));
    return {
      dockerImage: "node:18-slim",
      runCommand: `node ${runnerFile}`,
    };
  }

  return {
    dockerImage: "node:18-slim",
    runCommand: `node ${fileName} < input.txt`,
  };
};

const buildDockerCommand = ({
  dockerImage,
  runCommand,
  tempDir,
}: {
  dockerImage: string;
  runCommand: string;
  tempDir: string;
}) => {
  return `docker run --rm \
                --network none \
                --user 1000:1000 \
                --pids-limit 64 \
                --memory="128m" \
                --cpus=".5" \
                -v "${tempDir}:/app" \
                -w /app \
                ${dockerImage} \
                sh -c "timeout 20s ${runCommand}"`;
};

export const executeCode = async (req: Request, res: Response) => {
  const { code, language, oid, mode, customInput } = req.body as ExecuteBody;
  
  const sourceCode = typeof code === "string" ? code : "";
  const githubOid = typeof oid === "string" ? oid : "";
  const executionMode = getExecutionMode(mode);
  const executionLanguage = getLanguage(language);
  const customInputValue = typeof customInput === "string" ? customInput.trim() : "";
  const useCustomInput = customInputValue.length > 0; // in case of custom input data
  const jobId = uuidv4();
  const tempDir = path.join(process.cwd(), "temp", jobId);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    let fileData = await prisma.problem.findUnique({
      where: { github_oid: githubOid },
      select: {
        id: true,
        test_cases: true,
        code_snippets: true,
      },
    });

    if (!fileData) {
      // Fallback: search in cached filenames
      const cachedFiles = internalCache.get<any[]>("getFilesNames");
      const matchedFile = cachedFiles?.find((f) => f.oid === githubOid);
      if (matchedFile && typeof matchedFile.name === "string") {
        const baseName = matchedFile.name.split(".")[0];
        if (baseName) {
          fileData = await prisma.problem.findFirst({
            where: {
              name: {
                equals: baseName,
                mode: "insensitive",
              },
            },
            select: {
              id: true,
              test_cases: true,
              code_snippets: true,
            },
          });

          // Sync database OID for future fast lookups
          if (fileData) {
            await prisma.problem.update({
              where: { id: fileData.id },
              data: { github_oid: githubOid },
            }).catch((err) => console.error("Failed to sync fallback OID in codeExecution:", err));
          }
        }
      }
    }

    const testCases = (fileData?.test_cases ?? []) as TestCaseRecord[];
    const codeSnippets = (fileData?.code_snippets ?? []) as CodeSnippetRecord[];
    const wrapperCode = codeSnippets.find((snippet) => snippet.language === executionLanguage)?.wrapperCode ?? "";
    const casesToRun = useCustomInput
      ? [{ input: customInputValue, expectedOutput: "" }]
      : testCases.length === 0
        ? [{ input: "", expectedOutput: "" }]
        : executionMode === "SUBMIT"
          ? testCases
          : testCases.slice(0, 1);

    const { dockerImage, runCommand } = await prepareSourceFile({
      code: sourceCode,
      language: executionLanguage,
      tempDir,
      wrapperCode,
    });

    const results: ExecutionDetail[] = [];
    let totalPassed = 0;

    for (const [index, currentCase] of casesToRun.entries()) {
      const testCasePath = path.join(tempDir, "input.txt");
      await fs.writeFile(testCasePath, (currentCase.input || "").trim());

      const dockerCmd = buildDockerCommand({ dockerImage, runCommand, tempDir });

      try {
        const { stdout, stderr } = await execAsync(dockerCmd);

        if (normalize(stderr)) {
          results.push({
            testCaseIndex: index,
            output: stdout,
            expectedOutput: currentCase.expectedOutput,
            passed: false,
            runtimeError: stderr,
          });
          break;
        }

        const actualOutput = normalize(stdout);
        const expectedOutput = normalize(currentCase.expectedOutput);
        const passed = actualOutput === expectedOutput;

        if (passed) totalPassed++;

        results.push({
          testCaseIndex: index,
          output: stdout,
          expectedOutput: currentCase.expectedOutput,
          passed,
          ...problemIdPayload(currentCase),
          runtimeError: null,
        });

        if (executionMode === "SUBMIT" && !passed) {
          break;
        }
      } catch (execError) {
        const error = execError as { stdout?: string; stderr?: string };
        results.push({
          testCaseIndex: index,
          output: error.stdout || "",
          expectedOutput: currentCase.expectedOutput,
          passed: false,
          ...problemIdPayload(currentCase),
          runtimeError: error.stderr || "Timeout or Execution Interruption",
        });
        break;
      }
    }

    return res.json({
      mode: executionMode,
      totalCases: casesToRun.length,
      passedCases: totalPassed,
      status: useCustomInput ? "COMPLETED" : totalPassed === casesToRun.length ? "PASSED" : "FAILED",
      problemId: useCustomInput ? "" : testCases[0]?.problemId || "",
      details: results,
      execution_status:totalPassed === casesToRun.length ? "SUCCESS" : 'ERROR',
    });
  } catch (error) {
    if (executionLanguage === "javascript") {
      try {
        const testCasesToRun = useCustomInput
          ? [{ input: customInputValue, expectedOutput: "" }]
          : testCases.length === 0
            ? [{ input: "", expectedOutput: "" }]
            : executionMode === "SUBMIT"
              ? testCases
              : testCases.slice(0, 1);

        const localResults: ExecutionDetail[] = [];
        let localPassedCount = 0;

        for (const [index, currentCase] of testCasesToRun.entries()) {
          const logs: string[] = [];
          
          const sandbox = {
            console: {
              log: (...args: any[]) => {
                logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
              },
              error: (...args: any[]) => {
                logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
              },
              warn: (...args: any[]) => {
                logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
              },
            },
            module: { exports: {} },
            exports: {},
            require: (moduleName: string) => {
              if (moduleName === "./index.js" || moduleName.endsWith("index.js")) {
                return sandbox.module.exports;
              }
              throw new Error(`Require for module "${moduleName}" is blocked in sandbox mode.`);
            },
            __dirname: "",
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            Promise,
          };

          const context = vm.createContext(sandbox);
          const combinedSource = wrapperCode ? `${sourceCode}\n${wrapperCode}` : sourceCode;
          const userScript = new vm.Script(combinedSource, { filename: "solution.js" });
          userScript.runInContext(context);

          const exportName = extractJsExportName(wrapperCode);
          let stdoutValue = "";
          let runtimeErrorVal: string | null = null;

          try {
            if (exportName) {
              const exported = sandbox.module.exports as any;
              const fn = typeof exported === "function" 
                ? exported 
                : exported && typeof exported === "object" 
                  ? exported[exportName] || exported[Object.keys(exported)[0]] 
                  : null;

              if (typeof fn !== "function") {
                throw new Error("Could not resolve exported function for execution");
              }

              const lines = (currentCase.input || "").replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
              const parseValue = (value: string) => {
                const trimmed = value.trim();
                if (trimmed === "true") return true;
                if (trimmed === "false") return false;
                if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
                if (/^[-+]?[0-9]*\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);
                if (/^[\[\{].*[\]\}]$/.test(trimmed) || (/^\".*\"$/.test(trimmed) || /^\'.*\'$/.test(trimmed))) {
                  try {
                    return JSON.parse(trimmed);
                  } catch (e) {
                    return trimmed.replace(/^['"]|['"]$/g, "");
                  }
                }
                return trimmed;
              };

              const args = lines.map(parseValue);
              const result = fn(...args);
              if (result !== undefined) {
                if (typeof result === "object") {
                  stdoutValue = JSON.stringify(result);
                } else {
                  stdoutValue = String(result);
                }
              }
            } else {
              stdoutValue = logs.join("\n");
            }
          } catch (runErr) {
            runtimeErrorVal = runErr instanceof Error ? runErr.stack || runErr.message : String(runErr);
          }

          const actualOutput = normalize(stdoutValue);
          const expectedOutput = normalize(currentCase.expectedOutput);
          const passed = runtimeErrorVal === null && actualOutput === expectedOutput;

          if (passed) {
            localPassedCount++;
          }

          localResults.push({
            testCaseIndex: index,
            output: stdoutValue,
            expectedOutput: currentCase.expectedOutput,
            passed,
            ...problemIdPayload(currentCase),
            runtimeError: runtimeErrorVal,
          });

          if (executionMode === "SUBMIT" && !passed) {
            break;
          }
        }

        return res.json({
          mode: executionMode,
          totalCases: testCasesToRun.length,
          passedCases: localPassedCount,
          status: useCustomInput ? "COMPLETED" : localPassedCount === testCasesToRun.length ? "PASSED" : "FAILED",
          problemId: useCustomInput ? "" : testCases[0]?.problemId || "",
          details: localResults,
          execution_status:localPassedCount === testCasesToRun.length ? "SUCCESS" : 'ERROR',
        });
      } catch (sandboxErr) {
        const message = sandboxErr instanceof Error ? sandboxErr.message : "Sandbox crash";
        const error_status = sandboxErr instanceof Error ? sandboxErr.message.includes('time limit exceed') ? 'TIMEOUT' : 'RUNTIME_ERROR' : 'ERROR'
        console.error("Local VM Sandbox Fault:", sandboxErr);
        return res.status(500).json({ error: "Local Sandbox execution failure", details: message, error_status });
      }
    }

    const message = error instanceof Error ? error.message : "Unknown execution failure";
    const error_status = error instanceof Error ? error.message.includes('time limit exceed') ? 'TIMEOUT' : 'RUNTIME_ERROR' : 'ERROR'

    console.error("System Core Fault:", error);
    return res.status(500).json({ error: "System execution failure", details: message ,error_status});



  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
