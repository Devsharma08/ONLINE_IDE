import { execFile } from "child_process";
import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../Lib/prisma.js";
import { internalCache } from "../Lib/cache.js";
import { isGitObjectId } from "../utils/request.js";
import vm from "node:vm";
import { postGraphQL } from "../Lib/githubClient.js";

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
  metrics?: {
    durationMs: number;
    memoryKb: number;
  } | null;
};

const execFileAsync = promisify(execFile);

const EXECUTION_TIMEOUT_MS = 20_000;
const DOCKER_TIMEOUT_MS = EXECUTION_TIMEOUT_MS + 5_000;
const MAX_CODE_BYTES = 50_000;
const MAX_CUSTOM_INPUT_BYTES = 20_000;
const MAX_DOCKER_OUTPUT_BYTES = 1024 * 1024;
const MAX_SUBMIT_TEST_CASES = 25;

const getByteLength = (value: string) => Buffer.byteLength(value, "utf8");

const isInProcessFallbackEnabled = () => {
  return process.env.NODE_MODE !== "production" && process.env.ALLOW_IN_PROCESS_JS_FALLBACK === "true";
};

const normalize = (value: string) => (value || "").replace(/\r\n/g, "\n").trim();

const problemIdPayload = (currentCase: TestCaseRecord) => {
  return currentCase.problemId ? { problemId: currentCase.problemId } : {};
};

const getExecutionMode = (mode: unknown): ExecutionMode | null => {
  if (mode === undefined || mode === null || mode === "") {
    return "RUN";
  }

  return mode === "RUN" || mode === "SUBMIT" ? mode : null;
};

const getLanguage = (language: unknown): SupportedLanguage | null => {
  return language === "javascript" || language === "java" ? language : null;
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



const getJavaScriptRunner = (exportName: string) => `const fs = require("fs");\nconst path = require("path");\nconst exported = require("./index.js");\nconst fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["${exportName}"] || exported[Object.keys(exported)[0]] : null;\nif (typeof fn !== "function") {\n  throw new Error("Could not resolve exported function for execution");\n}\nconst rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");\nconst lines = rawInput.replace(/\\r\\n/g, "\\n").split("\\n").filter((line) => line.length > 0);\nconst parseValue = (value) => {\n  const trimmed = value.trim();\n  if (trimmed === "true") return true;\n  if (trimmed === "false") return false;\n  if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);\n  if (/^[-+]?[0-9]*\\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);\n  if (/^[\"'].*[\"']$/.test(trimmed)) return trimmed.replace(/^['\"]|['\"]$/g, "");\n  if (/^[\\\[\\{][\\s\\S]*[\\\]\\}]$/.test(trimmed)) {\n    try {\n      return JSON.parse(trimmed);\n    } catch (e) {\n      return trimmed;\n    }\n  }\n  return trimmed;\n};\nconst args = lines.map(parseValue);\n(async () => {\n  try {\n    if ("${exportName}" === "TimeLimitedCache") {\n      const cache = new fn();\n      const outputs = [];\n      const rawActions = rawInput.trim();\n      const regex = /(set|get|wait|count)\\(([^)]*)\\)/g;\n      let match;\n      while ((match = regex.exec(rawActions)) !== null) {\n        const method = match[1];\n        const rawArgs = match[2];\n        const argsList = rawArgs ? rawArgs.split(",").map(s => {\n          const trimmed = s.trim();\n          if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);\n          if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);\n          if (trimmed === "true") return true;\n          if (trimmed === "false") return false;\n          return Number(trimmed);\n        }) : [];\n        if (method === "set") {\n          cache.set(...argsList);\n        } else if (method === "get") {\n          const res = cache.get(...argsList);\n          const val = (res === -1 || res === undefined) ? "undefined" : res;\n          outputs.push(val);\n        } else if (method === "count") {\n          const res = cache.count();\n          outputs.push(res);\n        } else if (method === "wait") {\n          const ms = argsList[0] || 0;\n          await new Promise(resolve => setTimeout(resolve, ms));\n        }\n      }\n      console.log(outputs.join(","));\n      return;\n    }\n    if ("${exportName}" === "timeLimit") {\n      const limitFn = fn(async (x) => {\n        await new Promise(res => setTimeout(res, x));\n        return "Result";\n      }, 100);\n      const res1 = await limitFn(50).catch(err => err instanceof Error ? err.message : String(err));\n      const res2 = await limitFn(150).catch(err => err instanceof Error ? err.message : String(err));\n      if (res1 === "Result" && (res2 === "Time Limit Exceeded" || res2.includes("Time Limit"))) {\n        console.log("Result or timeout");\n      } else {\n        console.log("Failed Promise Time Limit: " + res1 + " | " + res2);\n      }\n      return;\n    }\n    if ("${exportName}" === "debounce") {\n      let count = 0;\n      const debounced = fn(() => { count++; }, 100);\n      debounced();\n      debounced();\n      debounced();\n      await new Promise(res => setTimeout(res, 50));\n      const countAfter50 = count;\n      await new Promise(res => setTimeout(res, 100));\n      const countAfter150 = count;\n      if (countAfter50 === 0 && countAfter150 === 1) {\n        console.log("Delayed execution");\n      } else {\n        console.log("Failed Debounce: " + countAfter50 + " | " + countAfter150);\n      }\n      return;\n    }\n    if ("${exportName}" === "promiseAll") {\n      const fn1 = () => new Promise(resolve => setTimeout(() => resolve(5), 10));\n      const fn2 = () => new Promise(resolve => setTimeout(() => resolve(10), 20));\n      const result = await fn([fn1, fn2]);\n      if (result && result[0] === 5 && result[1] === 10) {\n        console.log("Both resolved");\n      } else {\n        console.log("Failed promiseAll: " + JSON.stringify(result));\n      }\n      return;\n    }\n    const startMem = process.memoryUsage().heapUsed;\n    const startTime = process.hrtime.bigint();\n    const result = await fn(...args);\n    const endTime = process.hrtime.bigint();\n    const endMem = process.memoryUsage().heapUsed;\n    const durationMs = Number(endTime - startTime) / 1000000;\n    const memoryKb = Math.max(0, (endMem - startMem) / 1024);\n    if (result !== undefined) {\n      if (result !== null && typeof result === "object" && typeof result.then === "function") {\n        const resolved = await result;\n        if (resolved !== undefined) {\n          console.log(typeof resolved === "object" ? JSON.stringify(resolved) : resolved);\n        }\n      } else if (typeof result === "object") {\n        console.log(JSON.stringify(result));\n      } else {\n        console.log(result);\n      }\n    }\n    console.log(\"// SYS_METRICS: time=\" + durationMs.toFixed(3) + \" ms, memory=\" + memoryKb.toFixed(1) + \" KB\");\n  } catch (err) {\n    console.error(\"Execution Error:\", err instanceof Error ? err.message : String(err));\n    process.exit(1);\n  }\n})();`;

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

    long startMem = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
    long startTime = System.nanoTime();
    Object result = target.invoke(instance, parsedArgs);
    long endTime = System.nanoTime();
    long endMem = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();

    double durationMs = (endTime - startTime) / 1000000.0;
    double memoryKb = Math.max(0, (endMem - startMem) / 1024.0);

    if (target.getReturnType() == void.class) {
      if (parsedArgs.length > 0) {
        System.out.println(format(parsedArgs[0]));
      }
    } else if (result != null) {
      System.out.println(format(result));
    }

    System.out.println("// SYS_METRICS: time=" + String.format("%.3f", durationMs) + " ms, memory=" + String.format("%.1f", memoryKb) + " KB");
  }

  private static Object[] parseArguments(java.lang.reflect.Type[] paramTypes, String[] lines) {
    Object[] args = new Object[paramTypes.length];
    for (int i = 0; i < paramTypes.length; i++) {
      if (i >= lines.length) {
        throw new IllegalArgumentException("Not enough input lines. Required " + paramTypes.length + " parameters, but received only " + lines.length);
      }
      try {
        args[i] = parseValue(lines[i], paramTypes[i]);
      } catch (Exception e) {
        String typeName = paramTypes[i] instanceof Class<?> ? ((Class<?>)paramTypes[i]).getSimpleName() : paramTypes[i].toString();
        throw new IllegalArgumentException("Parameter mismatch at index " + i + ": Unable to parse '" + lines[i] + "' as type '" + typeName + "'. Make sure inputs match the problem signature. Error: " + e.getMessage(), e);
      }
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
        String cleanChar = trimmed.replaceAll("^['\\\"']|['\\\"']$", "");
        return cleanChar.length() > 0 ? cleanChar.charAt(0) : '\\0';
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
      if (clazz.getSimpleName().equals("Node")) {
        return parseNode(trimmed);
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
    if (clazz.getSimpleName().equals("Node")) {
      return formatNode(value);
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

  private static Object parseNode(String raw) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]") || trimmed.equals("null")) {
      return null;
    }
    try {
      Class<?> nodeClass = Class.forName("Node");
      boolean isGraph = false;
      try {
        nodeClass.getField("neighbors");
        isGraph = true;
      } catch (Exception e) {
        isGraph = false;
      }

      if (isGraph) {
        String inner = trimmed.substring(1, trimmed.length() - 1);
        java.util.List<String> items = splitTopLevel(inner);
        if (items.isEmpty()) return null;
        
        java.lang.reflect.Constructor<?> constructor = nodeClass.getConstructor(int.class);
        java.lang.reflect.Field neighborsField = nodeClass.getField("neighbors");
        
        int n = items.size();
        Object[] nodes = new Object[n];
        for (int i = 0; i < n; i++) {
          nodes[i] = constructor.newInstance(i + 1);
        }
        
        for (int i = 0; i < n; i++) {
          String neighborListRaw = items.get(i).trim();
          if (neighborListRaw.equals("[]") || neighborListRaw.isEmpty()) continue;
          String subInner = neighborListRaw.substring(1, neighborListRaw.length() - 1);
          java.util.List<String> neighborIds = splitTopLevel(subInner);
          java.util.List<Object> neighbors = (java.util.List<Object>) neighborsField.get(nodes[i]);
          for (String idStr : neighborIds) {
            int id = Integer.parseInt(idStr.trim());
            neighbors.add(nodes[id - 1]);
          }
        }
        return nodes[0];
      } else {
        String inner = trimmed.substring(1, trimmed.length() - 1);
        java.util.List<String> items = splitTopLevel(inner);
        if (items.isEmpty()) return null;
        
        java.lang.reflect.Constructor<?> constructor = nodeClass.getConstructor(int.class);
        java.lang.reflect.Field nextField = nodeClass.getField("next");
        java.lang.reflect.Field randomField = nodeClass.getField("random");
        
        int n = items.size();
        Object[] nodes = new Object[n];
        int[] randomIndices = new int[n];
        java.util.Arrays.fill(randomIndices, -1);
        
        for (int i = 0; i < n; i++) {
          String pairRaw = items.get(i).trim();
          String pairInner = pairRaw.substring(1, pairRaw.length() - 1);
          java.util.List<String> pair = splitTopLevel(pairInner);
          int val = Integer.parseInt(pair.get(0).trim());
          nodes[i] = constructor.newInstance(val);
          
          String randStr = pair.get(1).trim();
          if (!randStr.equals("null") && !randStr.isEmpty()) {
            randomIndices[i] = Integer.parseInt(randStr);
          }
        }
        
        for (int i = 0; i < n; i++) {
          if (i < n - 1) {
            nextField.set(nodes[i], nodes[i + 1]);
          }
          if (randomIndices[i] != -1) {
            randomField.set(nodes[i], nodes[randomIndices[i]]);
          }
        }
        return nodes[0];
      }
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

  private static String formatNode(Object root) {
    if (root == null) {
      return "null";
    }
    try {
      Class<?> nodeClass = Class.forName("Node");
      boolean isGraph = false;
      try {
        nodeClass.getField("neighbors");
        isGraph = true;
      } catch (Exception e) {
        isGraph = false;
      }

      if (isGraph) {
        java.lang.reflect.Field neighborsField = nodeClass.getField("neighbors");
        java.util.Map<Object, Integer> nodeMap = new java.util.HashMap<>();
        java.util.List<Object> queue = new java.util.ArrayList<>();
        
        queue.add(root);
        nodeMap.put(root, 1);
        int index = 0;
        while (index < queue.size()) {
          Object curr = queue.get(index);
          java.util.List<?> neighbors = (java.util.List<?>) neighborsField.get(curr);
          for (Object neighbor : neighbors) {
            if (!nodeMap.containsKey(neighbor)) {
              nodeMap.put(neighbor, nodeMap.size() + 1);
              queue.add(neighbor);
            }
          }
          index++;
        }
        
        java.util.List<String> listRepresentation = new java.util.ArrayList<>();
        for (int i = 0; i < queue.size(); i++) {
          Object curr = queue.get(i);
          java.util.List<?> neighbors = (java.util.List<?>) neighborsField.get(curr);
          java.util.List<String> neighborIds = new java.util.ArrayList<>();
          for (Object neighbor : neighbors) {
            neighborIds.add(String.valueOf(nodeMap.get(neighbor)));
          }
          listRepresentation.add("[" + String.join(",", neighborIds) + "]");
        }
        return "[" + String.join(",", listRepresentation) + "]";
      } else {
        java.lang.reflect.Field valField = nodeClass.getField("val");
        java.lang.reflect.Field nextField = nodeClass.getField("next");
        java.lang.reflect.Field randomField = nodeClass.getField("random");
        
        java.util.Map<Object, Integer> nodeMap = new java.util.HashMap<>();
        java.util.List<Object> list = new java.util.ArrayList<>();
        
        Object curr = root;
        int idx = 0;
        while (curr != null) {
          list.add(curr);
          nodeMap.put(curr, idx++);
          curr = nextField.get(curr);
        }
        
        java.util.List<String> listRepresentation = new java.util.ArrayList<>();
        for (Object node : list) {
          int val = (Integer) valField.get(node);
          Object randNode = randomField.get(node);
          String randIdx = randNode == null ? "null" : String.valueOf(nodeMap.get(randNode));
          listRepresentation.add("[" + val + "," + randIdx + "]");
        }
        return "[" + String.join(",", listRepresentation) + "]";
      }
    } catch (Exception e) {
      return "null";
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
    const autoImports = getJavaImports();
    const useCustomMain = !isDefaultJavaWrapper(wrapperCode) && hasJavaMain(wrapperCode);
    let processedCode: string;
    const cleanCode = code.replace(/public\s+class\b/g, "class");
    const codeWithoutComment = cleanCode
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Dynamic Helper Classes Injection
    let helperClasses = "";
    if (cleanCode.includes("ListNode") && !/class\s+ListNode\b/.test(codeWithoutComment)) {
      helperClasses += `
class ListNode {
    public int val;
    public ListNode next;
    public ListNode() {}
    public ListNode(int val) { this.val = val; }
    public ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;
    }
    if (cleanCode.includes("TreeNode") && !/class\s+TreeNode\b/.test(codeWithoutComment)) {
      helperClasses += `
class TreeNode {
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode() {}
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
`;
    }
    if (cleanCode.includes("Node") && !/class\s+Node\b/.test(codeWithoutComment)) {
      if (cleanCode.includes("neighbors") || cleanCode.includes("List<Node>")) {
        helperClasses += `
class Node {
    public int val;
    public java.util.List<Node> neighbors;
    public Node() { val = 0; neighbors = new java.util.ArrayList<Node>(); }
    public Node(int _val) { val = _val; neighbors = new java.util.ArrayList<Node>(); }
    public Node(int _val, java.util.ArrayList<Node> _neighbors) { val = _val; neighbors = _neighbors; }
}
`;
      } else if (cleanCode.includes("random")) {
        helperClasses += `
class Node {
    public int val;
    public Node next;
    public Node random;
    public Node(int val) { this.val = val; this.next = null; this.random = null; }
}
`;
      }
    }

    if (useCustomMain) {
      processedCode = `${autoImports}\n\n${cleanCode}\n${wrapperCode}\n${helperClasses}`;
    } else if (hasJavaMain(cleanCode)) {
      const mainClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)(?:(?!class)[\s\S])*?void\s+main\s*\(/);
      const mainClassName = mainClassMatch ? mainClassMatch[1] : null;
      processedCode = `${autoImports}\n\n${mainClassName ? cleanCode.replace(new RegExp(`class\\s+${mainClassName}\\b`), "class Main") : cleanCode}\n${helperClasses}`;
    } else {
      const hasSolutionClass = /class\s+Solution\b/.test(cleanCode);
      const solutionClassReadyCode = hasSolutionClass
        ? cleanCode
        : cleanCode.replace(/class\s+[A-Za-z0-9_]+/, "class Solution");
      processedCode = `${autoImports}\n\n${solutionClassReadyCode}\n\n${getJavaMainWrapper()}\n${helperClasses}`;
    }

    await fs.writeFile(path.join(tempDir, "Main.java"), processedCode);

    return {
      dockerImage: "amazoncorretto:17-alpine",
      runCommand: "javac Main.java && java Main < input.txt",
    };
  }

  const fileName = "index.js";
  let exportName = extractJsExportName(wrapperCode);

  // Dynamic JS Function detection fallback if wrapper is missing
  if (!exportName) {
    const codeWithoutComment = code
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const matchFunction = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(codeWithoutComment);
    if (matchFunction) {
      exportName = matchFunction[1] ?? null;
    } else {
      const matchVar = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*/.exec(codeWithoutComment);
      if (matchVar) exportName = matchVar[1] ?? null;
    }
  }

  const finalWrapper = exportName && !wrapperCode.includes("module.exports")
    ? `\nmodule.exports = { ${exportName} };`
    : wrapperCode;

  const processedCode = finalWrapper ? `${code}\n${finalWrapper}` : code;
  await fs.writeFile(path.join(tempDir, fileName), processedCode);

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


const buildDockerArgs = ({
  dockerImage,
  runCommand,
  tempDir,
}: {
  dockerImage: string;
  runCommand: string;
  tempDir: string;
}) => {
  return [
    "run",
    "--rm",
    "--init",
    "--network",
    "none",
    "--user",
    "1000:1000",
    "--cap-drop=ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--pids-limit",
    "64",
    "--memory",
    "128m",
    "--memory-swap",
    "128m",
    "--cpus",
    ".5",
    "-v",
    `${tempDir}:/app:rw`,
    "-w",
    "/app",
    dockerImage,
    "sh",
    "-c",
    `timeout ${Math.ceil(EXECUTION_TIMEOUT_MS / 1000)}s ${runCommand}`,
  ];
};

const executeInDocker = async (options: {
  dockerImage: string;
  runCommand: string;
  tempDir: string;
}) => {
  const args = buildDockerArgs(options);
  const { stdout, stderr } = await execFileAsync("docker", args, {
    timeout: DOCKER_TIMEOUT_MS,
    maxBuffer: MAX_DOCKER_OUTPUT_BYTES,
    windowsHide: true,
  });

  return {
    stdout: String(stdout),
    stderr: String(stderr),
  };
};

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

const fetchAndCacheFileNames = async (): Promise<any[]> => {
  try {
    const rawData = await postGraphQL<any>({
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
          }
        }
      `,
    });

    const entries = rawData.data?.repository?.object?.entries;
    if (!entries) return [];

    const leetcodeEntries = entries.filter(
      (item: any) => item.type === "blob" && item.name.toLowerCase().startsWith("leetcode")
    );

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

    const unifiedResponse = leetcodeEntries.map((item: any) => {
      const parts = item.name.split(".");
      const baseName = parts[0]?.toLowerCase() || "";
      const dbProblem = dbProblemMap.get(baseName);
      const dataStructure = dbProblem?.data_structure || null;

      return {
        name: item.name,
        type: item.type,
        oid: item.oid,
        data_structure: dataStructure
      };
    });

    internalCache.set("getFilesNames", unifiedResponse, 10 * 60);
    return unifiedResponse;
  } catch (error) {
    console.error("Failed to dynamically fetch and cache file names in execution:", error);
    return [];
  }
};

export const executeCode = async (req: Request, res: Response) => {
  const { code, language, oid, mode, customInput } = req.body as ExecuteBody;

  const sourceCode = typeof code === "string" ? code : "";
  const githubOid = typeof oid === "string" ? oid.trim() : "";
  const executionMode = getExecutionMode(mode);
  const executionLanguage = getLanguage(language);
  const customInputValue = typeof customInput === "string" ? customInput.trim() : "";
  const useCustomInput = customInputValue.length > 0; // in case of custom input data
  const jobId = uuidv4();
  const tempDir = path.join(process.cwd(), "temp", jobId);

  if (typeof code !== "string" || sourceCode.trim().length === 0) {
    return res.status(400).json({ error: "Code is required", error_status: "VALIDATION_ERROR" });
  }

  if (!executionLanguage) {
    return res.status(400).json({ error: "Unsupported language", error_status: "VALIDATION_ERROR" });
  }

  if (!executionMode) {
    return res.status(400).json({ error: "Unsupported execution mode", error_status: "VALIDATION_ERROR" });
  }

  if (customInput !== undefined && typeof customInput !== "string") {
    return res.status(400).json({ error: "Custom input must be a string", error_status: "VALIDATION_ERROR" });
  }

  if (githubOid && !isGitObjectId(githubOid)) {
    return res.status(400).json({ error: "Invalid problem oid", error_status: "VALIDATION_ERROR" });
  }

  if (getByteLength(sourceCode) > MAX_CODE_BYTES) {
    return res.status(413).json({ error: "Code payload is too large", error_status: "VALIDATION_ERROR" });
  }

  if (getByteLength(customInputValue) > MAX_CUSTOM_INPUT_BYTES) {
    return res.status(413).json({ error: "Custom input is too large", error_status: "VALIDATION_ERROR" });
  }

  let testCases: TestCaseRecord[] = [];
  let codeSnippets: CodeSnippetRecord[] = [];
  let wrapperCode = "";

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
      let cachedFiles = internalCache.get<any[]>("getFilesNames");
      if (!cachedFiles || cachedFiles.length === 0) {
        cachedFiles = await fetchAndCacheFileNames();
      }
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

          let bestMatch: any = null;
          let bestSimilarity = 0;

          if (!fileData) {
            const allProblems = await prisma.problem.findMany({
              select: {
                id: true,
                name: true,
                test_cases: true,
                code_snippets: true,
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
              fileData = bestMatch;
            }
          }
        }
      }
    }

    testCases = (fileData?.test_cases ?? []) as TestCaseRecord[];
    codeSnippets = (fileData?.code_snippets ?? []) as CodeSnippetRecord[];
    wrapperCode = codeSnippets.find((snippet) => snippet.language === executionLanguage)?.wrapperCode ?? "";

    const casesToRun = useCustomInput
      ? [{ input: customInputValue, expectedOutput: "" }]
      : testCases.length === 0
        ? [{ input: "", expectedOutput: "" }]
        : executionMode === "SUBMIT"
          ? testCases.slice(0, MAX_SUBMIT_TEST_CASES)
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

      try {
        const { stdout, stderr } = await executeInDocker({ dockerImage, runCommand, tempDir });

        let cleanStderr = normalize(stderr);
        if (executionLanguage === "java") {
          cleanStderr = cleanStderr
            .split("\n")
            .filter((line) => {
              const trimmed = line.trim().toLowerCase();
              return !trimmed.startsWith("note:") && !trimmed.includes("recompile with -xlint");
            })
            .join("\n")
            .trim();
        }

        if (cleanStderr) {
          results.push({
            testCaseIndex: index,
            output: stdout,
            expectedOutput: currentCase.expectedOutput,
            passed: false,
            runtimeError: cleanStderr,
          });
          break;
        }


        const actualOutput = normalize(stdout);

        let durationMs = 0;
        let memoryKb = 0;
        let cleanedOutput = actualOutput;

        const metricsMatch = /\/\/ SYS_METRICS: time=([\d.]+)\s*ms,\s*memory=([\d.]+)\s*KB/.exec(actualOutput);
        if (metricsMatch) {
          durationMs = parseFloat(metricsMatch[1] || "0");
          memoryKb = parseFloat(metricsMatch[2] || "0");
          cleanedOutput = actualOutput.replace(/\/\/ SYS_METRICS: time=[\d.]+\s*ms,\s*memory=[\d.]+\s*KB/, "").trim();
        }

        const expectedOutput = normalize(currentCase.expectedOutput);
        const isFreeForm = testCases.length === 0 || useCustomInput;
        const passed = isFreeForm ? true : cleanedOutput === expectedOutput;

        if (passed) totalPassed++;

        results.push({
          testCaseIndex: index,
          output: cleanedOutput,
          expectedOutput: currentCase.expectedOutput,
          passed,
          ...problemIdPayload(currentCase),
          runtimeError: null,
          metrics: metricsMatch ? { durationMs, memoryKb } : null,
        });

        if (executionMode === "SUBMIT" && !passed) {
          break;
        }
      } catch (execError) {
        const error = execError as { stdout?: string | Buffer; stderr?: string | Buffer; killed?: boolean };
        const stdout = error.stdout ? String(error.stdout) : "";
        const stderr = error.stderr ? String(error.stderr) : "";
        let cleanStderr = normalize(stderr);
        if (executionLanguage === "java") {
          cleanStderr = cleanStderr
            .split("\n")
            .filter((line) => {
              const trimmed = line.trim().toLowerCase();
              return !trimmed.startsWith("note:") && !trimmed.includes("recompile with -xlint");
            })
            .join("\n")
            .trim();
        }
        results.push({
          testCaseIndex: index,
          output: stdout,
          expectedOutput: currentCase.expectedOutput,
          passed: false,
          ...problemIdPayload(currentCase),
          runtimeError: cleanStderr || (error.killed ? "Execution timed out" : "Timeout or Execution Interruption"),
        });
        break;
      }
    }

    const isFreeForm = testCases.length === 0 || useCustomInput;
    return res.json({
      mode: executionMode,
      totalCases: casesToRun.length,
      passedCases: isFreeForm ? casesToRun.length : totalPassed,
      passed: isFreeForm ? true : totalPassed === casesToRun.length,
      status: isFreeForm ? "COMPLETED" : totalPassed === casesToRun.length ? "PASSED" : "FAILED",
      problemId: isFreeForm ? "" : testCases[0]?.problemId || "",
      details: results,
      error: results.find((r) => r.runtimeError)?.runtimeError || null,
      execution_status: (isFreeForm || totalPassed === casesToRun.length) ? "SUCCESS" : 'ERROR',
    });
  } catch (error) {
    if (executionLanguage === "javascript" && isInProcessFallbackEnabled()) {
      try {
        const testCasesToRun = useCustomInput
          ? [{ input: customInputValue, expectedOutput: "" }]
          : testCases.length === 0
            ? [{ input: "", expectedOutput: "" }]
            : executionMode === "SUBMIT"
              ? testCases.slice(0, MAX_SUBMIT_TEST_CASES)
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

          let exportName = extractJsExportName(wrapperCode);
          if (!exportName) {
            const codeWithoutComment = sourceCode
              .replace(/\/\/.*$/gm, "")
              .replace(/\/\*[\s\S]*?\*\//g, "");

            const matchFunction = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(codeWithoutComment);
            if (matchFunction) {
              exportName = matchFunction[1] ?? null;
            } else {
              const matchVar = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*/.exec(codeWithoutComment);
              if (matchVar) exportName = matchVar[1] ?? null;
            }
          }

          const dynamicExport = exportName && !wrapperCode.includes("module.exports")
            ? `\nmodule.exports = { ${exportName} };`
            : wrapperCode;
          const combinedSource = dynamicExport ? `${sourceCode}\n${dynamicExport}` : sourceCode;

          const context = vm.createContext(sandbox);
          const userScript = new vm.Script(combinedSource, { filename: "solution.js" });
          userScript.runInContext(context, { timeout: 1000 });
          let stdoutValue = "";
          let runtimeErrorVal: string | null = null;

          try {
            if (exportName) {
              const exported = sandbox.module.exports as any;
              const firstKey = exported && typeof exported === "object" ? Object.keys(exported)[0] : undefined;
              const fn = typeof exported === "function"
                ? exported
                : exported && typeof exported === "object"
                  ? (exportName ? exported[exportName] : null) || (firstKey ? exported[firstKey] : null)
                  : null;

              if (typeof fn !== "function") {
                throw new Error("Could not resolve exported function for execution");
              }

              const lines = (currentCase.input || "").replace(/\r\n/g, "\n").split("\n").filter((line: string) => line.length > 0);
              const parseValue = (value: string) => {
                const trimmed = value.trim();
                if (trimmed === "true") return true;
                if (trimmed === "false") return false;
                if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
                if (/^[-+]?[0-9]*\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);
                if (/^["'].*["']$/.test(trimmed)) {
                  return trimmed.replace(/^['"]|['"]$/g, "");
                }
                if (/^[\[\{][\s\S]*[\]\}]$/.test(trimmed)) {
                  try {
                    return JSON.parse(trimmed);
                  } catch (e) {
                    return trimmed;
                  }
                }
                return trimmed;
              };

              const args = lines.map(parseValue);
              let result: any;
              if (exportName === "TimeLimitedCache") {
                const cache = new fn();
                const outputs: any[] = [];
                const rawActions = (currentCase.input || "").trim();
                const regex = /(set|get|wait|count)\(([^)]*)\)/g;
                let match;
                while ((match = regex.exec(rawActions)) !== null) {
                  const method = match[1];
                  const rawArgs = match[2];
                  const argsList = rawArgs ? rawArgs.split(",").map(s => {
                    const trimmed = s.trim();
                    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
                    if (trimmed === "true") return true;
                    if (trimmed === "false") return false;
                    return Number(trimmed);
                  }) : [];
                  if (method === "set") {
                    cache.set(...argsList);
                  } else if (method === "get") {
                    const res = cache.get(...argsList);
                    const val = (res === -1 || res === undefined) ? "undefined" : res;
                    outputs.push(val);
                  } else if (method === "count") {
                    const res = cache.count();
                    outputs.push(res);
                  } else if (method === "wait") {
                    const ms = Number(argsList[0] || 0);
                    await new Promise(resolve => setTimeout(resolve, Number.isFinite(ms) ? ms : 0));
                  }
                }
                result = outputs.join(",");
              } else if (exportName === "timeLimit") {
                const limitFn = fn(async (x: number) => {
                  await new Promise(res => setTimeout(res, x));
                  return "Result";
                }, 100);
                const res1 = await limitFn(50).catch((err: any) => err instanceof Error ? err.message : String(err));
                const res2 = await limitFn(150).catch((err: any) => err instanceof Error ? err.message : String(err));
                if (res1 === "Result" && (res2 === "Time Limit Exceeded" || res2.includes("Time Limit"))) {
                  result = "Result or timeout";
                } else {
                  result = "Failed Promise Time Limit: " + res1 + " | " + res2;
                }
              } else if (exportName === "debounce") {
                let count = 0;
                const debounced = fn(() => { count++; }, 100);
                debounced();
                debounced();
                debounced();
                await new Promise(res => setTimeout(res, 50));
                const countAfter50 = count;
                await new Promise(res => setTimeout(res, 100));
                const countAfter150 = count;
                if (countAfter50 === 0 && countAfter150 === 1) {
                  result = "Delayed execution";
                } else {
                  result = "Failed Debounce: " + countAfter50 + " | " + countAfter150;
                }
              } else if (exportName === "promiseAll") {
                const fn1 = () => new Promise(resolve => setTimeout(() => resolve(5), 10));
                const fn2 = () => new Promise(resolve => setTimeout(() => resolve(10), 20));
                const res = await fn([fn1, fn2]);
                if (res && res[0] === 5 && res[1] === 10) {
                  result = "Both resolved";
                } else {
                  result = "Failed promiseAll: " + JSON.stringify(res);
                }
              } else {
                const startMem = process.memoryUsage().heapUsed;
                const startTime = process.hrtime.bigint();
                const rawResult = fn(...args);
                if (rawResult !== null && typeof rawResult === "object" && typeof rawResult.then === "function") {
                  result = await rawResult;
                } else {
                  result = rawResult;
                }
                const endTime = process.hrtime.bigint();
                const endMem = process.memoryUsage().heapUsed;
                const durationMs = Number(endTime - startTime) / 1000000;
                const memoryKb = Math.max(0, (endMem - startMem) / 1024);
                logs.push(`// SYS_METRICS: time=${durationMs.toFixed(3)} ms, memory=${memoryKb.toFixed(1)} KB`);
              }

              let resultStr = "";
              if (result !== undefined) {
                resultStr = typeof result === "object" ? JSON.stringify(result) : String(result);
              }
              // Merge both console logs AND function return value
              stdoutValue = logs.length > 0 ? `${logs.join("\n")}\n${resultStr}`.trim() : resultStr;
            } else {
              stdoutValue = logs.join("\n");
            }
          } catch (runErr) {
            runtimeErrorVal = runErr instanceof Error ? runErr.stack || runErr.message : String(runErr);
          }

          const actualOutput = normalize(stdoutValue);

          let durationMs = 0;
          let memoryKb = 0;
          let cleanedOutput = actualOutput;

          const metricsMatch = /\/\/ SYS_METRICS: time=([\d.]+)\s*ms,\s*memory=([\d.]+)\s*KB/.exec(actualOutput);
          if (metricsMatch) {
            durationMs = parseFloat(metricsMatch[1] || "0");
            memoryKb = parseFloat(metricsMatch[2] || "0");
            cleanedOutput = actualOutput.replace(/\/\/ SYS_METRICS: time=[\d.]+\s*ms,\s*memory=[\d.]+\s*KB/, "").trim();
          }

          const expectedOutput = normalize(currentCase.expectedOutput);
          const isFreeForm = testCases.length === 0 || useCustomInput;
          const passed = runtimeErrorVal === null && (isFreeForm ? true : cleanedOutput === expectedOutput);

          if (passed) {
            localPassedCount++;
          }

          localResults.push({
            testCaseIndex: index,
            output: cleanedOutput,
            expectedOutput: currentCase.expectedOutput,
            passed,
            ...problemIdPayload(currentCase),
            runtimeError: runtimeErrorVal,
            metrics: metricsMatch ? { durationMs, memoryKb } : null,
          });

          if (executionMode === "SUBMIT" && !passed) {
            break;
          }
        }

        const isFreeForm = testCases.length === 0 || useCustomInput;
        return res.json({
          mode: executionMode,
          totalCases: testCasesToRun.length,
          passedCases: isFreeForm ? testCasesToRun.length : localPassedCount,
          passed: isFreeForm ? true : localPassedCount === testCasesToRun.length,
          status: isFreeForm ? "COMPLETED" : localPassedCount === testCasesToRun.length ? "PASSED" : "FAILED",
          problemId: isFreeForm ? "" : testCases[0]?.problemId || "",
          details: localResults,
          error: localResults.find((r) => r.runtimeError)?.runtimeError || null,
          execution_status: (isFreeForm || localPassedCount === testCasesToRun.length) ? "SUCCESS" : 'ERROR',
        });
      } catch (sandboxErr) {
        const message = sandboxErr instanceof Error ? sandboxErr.message : "Sandbox crash";
        const error_status = sandboxErr instanceof Error ? sandboxErr.message.includes('time limit exceed') ? 'TIMEOUT' : 'RUNTIME_ERROR' : 'ERROR'
        console.error("Local VM Sandbox Fault:", sandboxErr);
        return res.status(500).json({ error: "Local Sandbox execution failure", details: message, error_status });
      }
    }

    let message = error instanceof Error ? error.message : "Unknown execution failure";
    const error_status = error instanceof Error ? error.message.includes('time limit exceed') ? 'TIMEOUT' : 'RUNTIME_ERROR' : 'ERROR'


    if (
      message.toLowerCase().includes("docker: command not found") ||
      message.toLowerCase().includes("enoent") ||
      message.toLowerCase().includes("cannot connect to the docker daemon") ||
      message.toLowerCase().includes("docker daemon is not running") ||
      message.toLowerCase().includes("is the docker daemon running") ||
      message.toLowerCase().includes("error during connect")
    ) {
      message = "DOCKER_DAEMON_OFFLINE: The Docker service is missing or not active on the host machine. Please start Docker Desktop to compile and execute code securely.";
    }

    console.error("System Core Fault:", error);
    return res.status(500).json({ error: "System execution failure", details: message, error_status });



  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
