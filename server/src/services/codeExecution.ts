/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-useless-assignment, no-useless-escape, preserve-caught-error */
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
  fileName?: unknown;
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
const EXECUTION_FILE_NAMES_CACHE_KEY = "executionFileNames";

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



const getJavaScriptRunner = (exportName: string, paramTypes: string[]) => `const fs = require("fs");
const path = require("path");

class ListNode {
  constructor(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
  }
}
global.ListNode = ListNode;

class TreeNode {
  constructor(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
  }
}
global.TreeNode = TreeNode;

class Node {
  constructor(val, neighbors, next, random) {
    this.val = (val === undefined ? 0 : val);
    this.neighbors = (neighbors === undefined ? [] : neighbors);
    this.next = (next === undefined ? null : next);
    this.random = (random === undefined ? null : random);
  }
}
global.Node = Node;

function parseListNode(raw) {
  if (!raw) return null;
  let arr = Array.isArray(raw) ? raw : null;
  if (!arr) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || trimmed === "[]" || trimmed === "null") return null;
    try { arr = JSON.parse(trimmed); } catch (e) { return null; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const head = new ListNode(arr[0]);
  let current = head;
  for (let i = 1; i < arr.length; i++) {
    current.next = new ListNode(arr[i]);
    current = current.next;
  }
  return head;
}

function parseTreeNode(raw) {
  if (!raw) return null;
  let arr = Array.isArray(raw) ? raw : null;
  if (!arr) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || trimmed === "[]" || trimmed === "null") return null;
    try { arr = JSON.parse(trimmed); } catch (e) { return null; }
  }
  if (!Array.isArray(arr) || arr.length === 0 || arr[0] === null || arr[0] === undefined) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const curr = queue.shift();
    if (i < arr.length) {
      const val = arr[i++];
      if (val !== null && val !== undefined) {
        curr.left = new TreeNode(val);
        queue.push(curr.left);
      }
    }
    if (i < arr.length) {
      const val = arr[i++];
      if (val !== null && val !== undefined) {
        curr.right = new TreeNode(val);
        queue.push(curr.right);
      }
    }
  }
  return root;
}

function parseNode(raw) {
  if (!raw) return null;
  let arr = Array.isArray(raw) ? raw : null;
  if (!arr) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || trimmed === "[]" || trimmed === "null") return null;
    try { arr = JSON.parse(trimmed); } catch (e) { return null; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const isGraph = arr.length > 0 && Array.isArray(arr[0]) && (arr[0].length === 0 || typeof arr[0][0] === "number");
  if (isGraph) {
    const n = arr.length;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      nodes.push(new Node(i + 1));
    }
    for (let i = 0; i < n; i++) {
      const neighbors = arr[i];
      for (const neighborId of neighbors) {
        nodes[i].neighbors.push(nodes[neighborId - 1]);
      }
    }
    return nodes[0];
  } else {
    const n = arr.length;
    const nodes = [];
    const randomIndices = [];
    for (let i = 0; i < n; i++) {
      const pair = arr[i];
      nodes.push(new Node(pair[0]));
      randomIndices.push(pair[1]);
    }
    for (let i = 0; i < n; i++) {
      if (i < n - 1) {
        nodes[i].next = nodes[i + 1];
      }
      const randIdx = randomIndices[i];
      if (randIdx !== null && randIdx !== undefined) {
        nodes[i].random = nodes[randIdx];
      }
    }
    return nodes[0];
  }
}

function formatListNode(head) {
  if (!head) return "null";
  const elements = [];
  let curr = head;
  while (curr) {
    elements.push(curr.val);
    curr = curr.next;
  }
  return "[" + elements.join(",") + "]";
}

function formatTreeNode(root) {
  if (!root) return "[]";
  const elements = [];
  const queue = [root];
  let lastNonNull = 0;
  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr) {
      elements.push(curr.val);
      lastNonNull = elements.length;
      queue.push(curr.left);
      queue.push(curr.right);
    } else {
      elements.push("null");
    }
  }
  const trimmed = elements.slice(0, lastNonNull);
  return "[" + trimmed.join(",") + "]";
}

function formatNode(root) {
  if (!root) return "null";
  const isGraph = root.neighbors !== undefined;
  if (isGraph) {
    const nodeMap = new Map();
    const queue = [root];
    nodeMap.set(root, 1);
    let index = 0;
    while (index < queue.length) {
      const curr = queue[index++];
      for (const neighbor of curr.neighbors) {
        if (!nodeMap.has(neighbor)) {
          nodeMap.set(neighbor, nodeMap.size + 1);
          queue.push(neighbor);
        }
      }
    }
    const listRep = [];
    for (let i = 0; i < queue.length; i++) {
      const curr = queue[i];
      const neighborIds = curr.neighbors.map(n => nodeMap.get(n));
      listRep.push("[" + neighborIds.join(",") + "]");
    }
    return "[" + listRep.join(",") + "]";
  } else {
    const nodeMap = new Map();
    const list = [];
    let curr = root;
    let idx = 0;
    while (curr) {
      list.push(curr);
      nodeMap.set(curr, idx++);
      curr = curr.next;
    }
    const listRep = [];
    for (const node of list) {
      const val = node.val;
      const randNode = node.random;
      const randIdx = randNode === null || randNode === undefined ? "null" : nodeMap.get(randNode);
      listRep.push("[" + val + "," + randIdx + "]");
    }
    return "[" + listRep.join(",") + "]";
  }
}

function format(value) {
  if (value === null || value === undefined) return "null";
  if (value instanceof ListNode) return formatListNode(value);
  if (value instanceof TreeNode) return formatTreeNode(value);
  if (value instanceof Node) return formatNode(value);
  if (Array.isArray(value)) {
    return "[" + value.map(format).join(",") + "]";
  }
  if (typeof value === "object") {
    if ("val" in value && "left" in value && "right" in value) {
      return formatTreeNode(value);
    }
    if ("val" in value && "next" in value) {
      return formatListNode(value);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

const exported = require("./index.js");
const fn = typeof exported === "function" ? exported : exported && typeof exported === "object" ? exported["${exportName}"] || exported[Object.keys(exported)[0]] : null;
if (typeof fn !== "function") {
  throw new Error("Could not resolve exported function for execution");
}
const rawInput = fs.readFileSync(path.join(__dirname, "input.txt"), "utf8");
const lines = rawInput.replace(/\\r\\n/g, "\\n").split("\\n").filter((line) => line.length > 0);
const parseValue = (value) => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^[-+]?[0-9]+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^[-+]?[0-9]*\\.[0-9]+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (/^[\\\"'].*[\\\"']$/.test(trimmed)) return trimmed.replace(/^['\\\"\']|['\\\"\']$/g, "");
  if (/^[\\\[\\{][\\s\\S]*[\\\]\\}]$/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return trimmed;
    }
  }
  return trimmed;
};

const paramTypes = ${JSON.stringify(paramTypes)};
const args = lines.map((line, idx) => {
  const parsed = parseValue(line);
  const type = paramTypes[idx];
  if (type === "TreeNode") return parseTreeNode(parsed);
  if (type === "ListNode") return parseListNode(parsed);
  if (type === "Node") return parseNode(parsed);
  return parsed;
});

(async () => {
  try {
    if ("${exportName}" === "TimeLimitedCache") {
      const cache = new fn();
      const outputs = [];
      const rawActions = rawInput.trim();
      const regex = /(set|get|wait|count)\\(([^)]*)\\)/g;
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
          const ms = argsList[0] || 0;
          await new Promise(resolve => setTimeout(resolve, ms));
        }
      }
      console.log(outputs.join(","));
      return;
    }
    if ("${exportName}" === "timeLimit") {
      const limitFn = fn(async (x) => {
        await new Promise(res => setTimeout(res, x));
        return "Result";
      }, 100);
      const res1 = await limitFn(50).catch(err => err instanceof Error ? err.message : String(err));
      const res2 = await limitFn(150).catch(err => err instanceof Error ? err.message : String(err));
      if (res1 === "Result" && (res2 === "Time Limit Exceeded" || res2.includes("Time Limit"))) {
        console.log("Result or timeout");
      } else {
        console.log("Failed Promise Time Limit: " + res1 + " | " + res2);
      }
      return;
    }
    if ("${exportName}" === "debounce") {
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
        console.log("Delayed execution");
      } else {
        console.log("Failed Debounce: " + countAfter50 + " | " + countAfter150);
      }
      return;
    }
    if ("${exportName}" === "promiseAll") {
      const fn1 = () => new Promise(resolve => setTimeout(() => resolve(5), 10));
      const fn2 = () => new Promise(resolve => setTimeout(() => resolve(10), 20));
      const result = await fn([fn1, fn2]);
      if (result && result[0] === 5 && result[1] === 10) {
        console.log("Both resolved");
      } else {
        console.log("Failed promiseAll: " + JSON.stringify(result));
      }
      return;
    }
    const startMem = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();
    const result = await fn(...args);
    const endTime = process.hrtime.bigint();
    const endMem = process.memoryUsage().heapUsed;
    const durationMs = Number(endTime - startTime) / 1000000;
    const memoryKb = Math.max(0, (endMem - startMem) / 1024);
    if (result !== undefined) {
      let resolved = result;
      if (result !== null && typeof result === "object" && typeof result.then === "function") {
        resolved = await result;
      }
      console.log(format(resolved));
    }
    console.log("// SYS_METRICS: time=" + durationMs.toFixed(3) + " ms, memory=" + memoryKb.toFixed(1) + " KB");
  } catch (err) {
    console.error("Execution Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();`;

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
    if (isDesignCase(Solution.class, lines)) {
      runDesignCase(Solution.class, lines);
      return;
    }
    if (isDesignActionCase(Solution.class, lines)) {
      runDesignActionCase(Solution.class, lines);
      return;
    }

    java.lang.reflect.Method[] candidates = java.util.Arrays.stream(Solution.class.getDeclaredMethods())
        .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
        .filter(m -> !m.getName().equals("main"))
        .filter(m -> !m.isSynthetic())
        .toArray(java.lang.reflect.Method[]::new);
    InvocationPlan plan = selectInvocation(candidates, lines);
    java.lang.reflect.Method target = plan.method;
    Object instance = java.lang.reflect.Modifier.isStatic(target.getModifiers()) ? null : Solution.class.getDeclaredConstructor().newInstance();

    Object[] parsedArgs = plan.args;

    long startMem = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
    long startTime = System.nanoTime();
    Object result = invokeTarget(target, instance, parsedArgs);
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

  private static Object invokeTarget(java.lang.reflect.Method target, Object instance, Object[] args) throws Exception {
    try {
      return target.invoke(instance, args);
    } catch (java.lang.reflect.InvocationTargetException error) {
      throw unwrapInvocationException(error);
    }
  }

  private static Exception unwrapInvocationException(java.lang.reflect.InvocationTargetException error) {
    Throwable cause = error.getCause();
    if (cause instanceof Exception) {
      return (Exception) cause;
    }
    if (cause instanceof Error) {
      throw (Error) cause;
    }
    return new RuntimeException(cause);
  }

  private static class InvocationPlan {
    final java.lang.reflect.Method method;
    final Object[] args;

    InvocationPlan(java.lang.reflect.Method method, Object[] args) {
      this.method = method;
      this.args = args;
    }
  }

  private static class ActionCall {
    final String name;
    final String rawArgs;

    ActionCall(String name, String rawArgs) {
      this.name = name;
      this.rawArgs = rawArgs;
    }
  }

  private static InvocationPlan selectInvocation(java.lang.reflect.Method[] candidates, String[] lines) {
    if (candidates.length == 0) {
      throw new RuntimeException("No public solution method found");
    }

    Exception lastError = null;
    for (java.lang.reflect.Method candidate : candidates) {
      try {
        Object[] args = parseArguments(candidate.getGenericParameterTypes(), lines);
        return new InvocationPlan(candidate, args);
      } catch (Exception error) {
        lastError = error;
      }
    }

    String methodSummary = java.util.Arrays.stream(candidates)
        .map(m -> m.getName() + "(" + java.util.Arrays.stream(m.getGenericParameterTypes()).map(java.lang.reflect.Type::getTypeName).collect(java.util.stream.Collectors.joining(", ")) + ")")
        .collect(java.util.stream.Collectors.joining("; "));
    throw new IllegalArgumentException("Unable to match input with any public solution method. Available methods: " + methodSummary + ". Last parse error: " + (lastError == null ? "unknown" : lastError.getMessage()), lastError);
  }

  private static boolean isDesignCase(Class<?> clazz, String[] lines) {
    if (lines.length < 2) return false;

    java.util.List<String> operations;
    try {
      operations = parseOperationNames(lines[0]);
    } catch (Exception error) {
      return false;
    }

    if (operations.size() < 2) return false;

    java.util.List<String> argumentGroups;
    try {
      argumentGroups = getArrayItems(lines[1]);
    } catch (Exception error) {
      return false;
    }
    if (operations.size() != argumentGroups.size()) return false;

    java.util.Set<String> methodNames = java.util.Arrays.stream(clazz.getDeclaredMethods())
        .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
        .map(java.lang.reflect.Method::getName)
        .collect(java.util.stream.Collectors.toSet());

    for (int i = 1; i < operations.size(); i++) {
      if (!methodNames.contains(operations.get(i))) return false;
    }
    return true;
  }

  private static void runDesignCase(Class<?> clazz, String[] lines) throws Exception {
    java.util.List<String> operations = parseOperationNames(lines[0]);
    java.util.List<String> argumentGroups = getArrayItems(lines[1]);
    java.util.List<String> outputs = new java.util.ArrayList<>();

    Object instance = constructDesignInstance(clazz, argumentGroups.get(0));
    outputs.add("null");

    for (int i = 1; i < operations.size(); i++) {
      java.lang.reflect.Method target = findDesignMethod(clazz, operations.get(i), argumentGroups.get(i));
      Object[] args = parseArgumentGroup(target.getGenericParameterTypes(), argumentGroups.get(i));
      Object result = invokeTarget(target, java.lang.reflect.Modifier.isStatic(target.getModifiers()) ? null : instance, args);
      outputs.add(target.getReturnType() == void.class ? "null" : format(result));
    }

    System.out.println("[" + String.join(",", outputs) + "]");
  }

  private static boolean isDesignActionCase(Class<?> clazz, String[] lines) {
    java.util.List<ActionCall> calls = parseDesignActionCalls(lines);
    if (calls.isEmpty()) return false;

    java.util.Set<String> methodNames = java.util.Arrays.stream(clazz.getDeclaredMethods())
        .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
        .map(java.lang.reflect.Method::getName)
        .collect(java.util.stream.Collectors.toSet());

    int start = methodNames.contains(calls.get(0).name) ? 0 : 1;
    if (start == 1 && calls.size() == 1) return true;

    for (int i = start; i < calls.size(); i++) {
      if (!methodNames.contains(calls.get(i).name)) return false;
    }
    return true;
  }

  private static void runDesignActionCase(Class<?> clazz, String[] lines) throws Exception {
    java.util.List<ActionCall> calls = parseDesignActionCalls(lines);
    java.util.List<String> outputs = new java.util.ArrayList<>();
    java.util.Set<String> methodNames = java.util.Arrays.stream(clazz.getDeclaredMethods())
        .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
        .map(java.lang.reflect.Method::getName)
        .collect(java.util.stream.Collectors.toSet());

    int start = 0;
    Object instance;
    if (!calls.isEmpty() && !methodNames.contains(calls.get(0).name)) {
      instance = constructDesignInstance(clazz, calls.get(0).rawArgs);
      outputs.add("null");
      start = 1;
    } else {
      instance = constructDesignInstance(clazz, "[]");
    }

    for (int i = start; i < calls.size(); i++) {
      ActionCall call = calls.get(i);
      java.lang.reflect.Method target = findDesignMethod(clazz, call.name, call.rawArgs);
      Object[] args = parseArgumentGroup(target.getGenericParameterTypes(), call.rawArgs);
      Object result = invokeTarget(target, java.lang.reflect.Modifier.isStatic(target.getModifiers()) ? null : instance, args);
      outputs.add(target.getReturnType() == void.class ? "null" : format(result));
    }

    System.out.println("[" + String.join(",", outputs) + "]");
  }

  private static Object constructDesignInstance(Class<?> clazz, String rawArgs) throws Exception {
    Exception lastError = null;
    for (java.lang.reflect.Constructor<?> constructor : clazz.getDeclaredConstructors()) {
      try {
        constructor.setAccessible(true);
        Object[] args = parseArgumentGroup(constructor.getGenericParameterTypes(), rawArgs);
        try {
          return constructor.newInstance(args);
        } catch (java.lang.reflect.InvocationTargetException error) {
          throw unwrapInvocationException(error);
        }
      } catch (Exception error) {
        lastError = error;
      }
    }
    throw new IllegalArgumentException("Unable to construct design class from arguments " + rawArgs + ": " + (lastError == null ? "unknown" : lastError.getMessage()), lastError);
  }

  private static java.lang.reflect.Method findDesignMethod(Class<?> clazz, String methodName, String rawArgs) {
    Exception lastError = null;
    for (java.lang.reflect.Method method : clazz.getDeclaredMethods()) {
      if (!java.lang.reflect.Modifier.isPublic(method.getModifiers()) || !method.getName().equals(methodName)) {
        continue;
      }
      try {
        parseArgumentGroup(method.getGenericParameterTypes(), rawArgs);
        return method;
      } catch (Exception error) {
        lastError = error;
      }
    }
    throw new IllegalArgumentException("Unable to match design method '" + methodName + "' with arguments " + rawArgs + ": " + (lastError == null ? "method not found" : lastError.getMessage()), lastError);
  }

  private static java.util.List<String> parseOperationNames(String raw) {
    java.util.List<String> items = getArrayItems(raw);
    java.util.List<String> operations = new java.util.ArrayList<>();
    for (String item : items) {
      String trimmed = item.trim();
      if (!isQuoted(trimmed)) return java.util.Collections.emptyList();
      operations.add(unquote(trimmed));
    }
    return operations;
  }

  private static java.util.List<ActionCall> parseDesignActionCalls(String[] lines) {
    String raw = String.join(",", lines).trim();
    if (raw.isEmpty()) return java.util.Collections.emptyList();
    if (looksLikeArray(raw)) {
      raw = raw.substring(1, raw.length() - 1);
    }

    java.util.List<ActionCall> calls = new java.util.ArrayList<>();
    for (String item : splitTopLevel(raw)) {
      String trimmed = item.trim();
      int openParen = trimmed.indexOf('(');
      if (openParen <= 0 || !trimmed.endsWith(")")) {
        return java.util.Collections.emptyList();
      }

      String name = trimmed.substring(0, openParen).trim();
      if (!name.matches("[A-Za-z_$][A-Za-z0-9_$]*")) {
        return java.util.Collections.emptyList();
      }

      String args = trimmed.substring(openParen + 1, trimmed.length() - 1).trim();
      calls.add(new ActionCall(name, args.isEmpty() ? "[]" : "[" + args + "]"));
    }
    return calls;
  }

  private static Object[] parseArgumentGroup(java.lang.reflect.Type[] paramTypes, String rawArgs) {
    java.util.List<String> items = getArrayItems(rawArgs);
    if (items.size() != paramTypes.length) {
      throw new IllegalArgumentException("Expected " + paramTypes.length + " argument(s), received " + items.size());
    }

    Object[] args = new Object[paramTypes.length];
    for (int i = 0; i < paramTypes.length; i++) {
      args[i] = parseValue(items.get(i), paramTypes[i]);
    }
    return args;
  }

  private static Object[] parseArguments(java.lang.reflect.Type[] paramTypes, String[] lines) {
    if (paramTypes.length > 1 && lines.length == 1 && looksLikeArray(lines[0])) {
      try {
        Object[] packedArgs = parseArgumentGroup(paramTypes, lines[0]);
        return packedArgs;
      } catch (Exception ignored) {
        // Fall back to one input line per parameter below.
      }
    }

    Object[] args = new Object[paramTypes.length];
    for (int i = 0; i < paramTypes.length; i++) {
      if (i >= lines.length) {
        args[i] = getDefaultValue(paramTypes[i]);
      } else {
        try {
          args[i] = parseValue(lines[i], paramTypes[i]);
        } catch (Exception e) {
          String typeName = paramTypes[i] instanceof Class<?> ? ((Class<?>)paramTypes[i]).getSimpleName() : paramTypes[i].toString();
          throw new IllegalArgumentException("Parameter mismatch at index " + i + ": Unable to parse '" + lines[i] + "' as type '" + typeName + "'. Make sure inputs match the problem signature. Error: " + e.getMessage(), e);
        }
      }
    }
    return args;
  }

  private static boolean looksLikeArray(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    return trimmed.startsWith("[") && trimmed.endsWith("]");
  }

  private static boolean isNullLiteral(String raw) {
    return raw == null || raw.trim().equalsIgnoreCase("null");
  }

  private static boolean isQuoted(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    if (trimmed.length() < 2) return false;
    char first = trimmed.charAt(0);
    char last = trimmed.charAt(trimmed.length() - 1);
    return (first == '"' && last == '"') || (first == '\\'' && last == '\\'');
  }

  private static String unquote(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    return isQuoted(trimmed) ? trimmed.substring(1, trimmed.length() - 1) : trimmed;
  }

  private static int parseIntLiteral(String raw) {
    String clean = unquote(raw).trim();
    if (clean.equalsIgnoreCase("INF") || clean.equalsIgnoreCase("INFINITY") || clean.equalsIgnoreCase("INTEGER.MAX_VALUE")) {
      return Integer.MAX_VALUE;
    }
    if (clean.equalsIgnoreCase("-INF") || clean.equalsIgnoreCase("-INFINITY") || clean.equalsIgnoreCase("INTEGER.MIN_VALUE")) {
      return Integer.MIN_VALUE;
    }
    return Integer.parseInt(clean);
  }

  private static long parseLongLiteral(String raw) {
    return Long.parseLong(unquote(raw).trim());
  }

  private static double parseDoubleLiteral(String raw) {
    return Double.parseDouble(unquote(raw).trim());
  }

  private static java.util.List<String> getArrayItems(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    if (!looksLikeArray(trimmed)) {
      throw new IllegalArgumentException("Expected JSON-style array, received '" + raw + "'");
    }
    if (trimmed.equals("[]")) {
      return new java.util.ArrayList<>();
    }
    return splitTopLevel(trimmed.substring(1, trimmed.length() - 1));
  }

  private static Object getDefaultValue(java.lang.reflect.Type type) {
    if (type instanceof Class<?>) {
      Class<?> clazz = (Class<?>) type;
      if (clazz == int.class || clazz == Integer.class) return 0;
      if (clazz == long.class || clazz == Long.class) return 0L;
      if (clazz == double.class || clazz == Double.class) return 0.0;
      if (clazz == float.class || clazz == Float.class) return 0.0f;
      if (clazz == boolean.class || clazz == Boolean.class) return false;
      if (clazz == char.class || clazz == Character.class) return '\\0';
      if (clazz == String.class) return "";
      if (clazz.isArray()) {
        return java.lang.reflect.Array.newInstance(clazz.getComponentType(), 0);
      }
      if (java.util.List.class.isAssignableFrom(clazz)) {
        return new java.util.ArrayList<>();
      }
    }
    if (type instanceof java.lang.reflect.ParameterizedType) {
      java.lang.reflect.ParameterizedType parameterized = (java.lang.reflect.ParameterizedType) type;
      java.lang.reflect.Type rawType = parameterized.getRawType();
      if (rawType instanceof Class<?> && java.util.List.class.isAssignableFrom((Class<?>) rawType)) {
        return new java.util.ArrayList<>();
      }
    }
    return null;
  }

  private static Object parseValue(String raw, java.lang.reflect.Type type) {
    String trimmed = raw.trim();
    if (type instanceof Class<?>) {
      Class<?> clazz = (Class<?>) type;
      if (isNullLiteral(trimmed) && !clazz.isPrimitive()) {
        return null;
      }
      if (clazz == String.class) {
        return unquote(trimmed);
      }
      if (clazz == int.class || clazz == Integer.class) {
        return parseIntLiteral(trimmed);
      }
      if (clazz == long.class || clazz == Long.class) {
        return parseLongLiteral(trimmed);
      }
      if (clazz == double.class || clazz == Double.class) {
        return parseDoubleLiteral(trimmed);
      }
      if (clazz == boolean.class || clazz == Boolean.class) {
        return Boolean.parseBoolean(unquote(trimmed));
      }
      if (clazz == char.class || clazz == Character.class) {
        String cleanChar = unquote(trimmed);
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
      if (clazz.getSimpleName().equals("Interval")) {
        return parseInterval(trimmed);
      }
      return parseObject(trimmed, clazz);
    }
    if (type instanceof java.lang.reflect.ParameterizedType) {
      java.lang.reflect.ParameterizedType parameterized = (java.lang.reflect.ParameterizedType) type;
      java.lang.reflect.Type rawType = parameterized.getRawType();
      if (rawType instanceof Class<?> && java.util.List.class.isAssignableFrom((Class<?>) rawType)) {
        java.lang.reflect.Type elementType = parameterized.getActualTypeArguments()[0];
        return parseList(trimmed, elementType);
      }
    }
    return unquote(trimmed);
  }

  private static Object parseArray(String raw, Class<?> componentType) {
    String trimmed = raw.trim();
    if (isNullLiteral(trimmed)) {
      return null;
    }
    if (!looksLikeArray(trimmed)) {
      throw new IllegalArgumentException("Expected array for type " + componentType.getSimpleName() + "[], received '" + raw + "'");
    }
    if (trimmed.equals("[]")) {
      return java.lang.reflect.Array.newInstance(componentType, 0);
    }
    java.util.List<String> items = getArrayItems(trimmed);
    Object array = java.lang.reflect.Array.newInstance(componentType, items.size());
    for (int i = 0; i < items.size(); i++) {
      java.lang.reflect.Array.set(array, i, parseValue(items.get(i), componentType));
    }
    return array;
  }

  private static java.util.List<Object> parseList(String raw, java.lang.reflect.Type elementType) {
    String trimmed = raw.trim();
    if (isNullLiteral(trimmed)) {
      return null;
    }
    if (!looksLikeArray(trimmed)) {
      throw new IllegalArgumentException("Expected list input, received '" + raw + "'");
    }
    if (trimmed.equals("[]")) {
      return new java.util.ArrayList<>();
    }
    java.util.List<String> items = getArrayItems(trimmed);
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
      if (c == '[' || c == '{' || c == '(') {
        depth++;
      } else if (c == ']' || c == '}' || c == ')') {
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
    if (clazz.getSimpleName().equals("Interval")) {
      return formatInterval(value);
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
    if (trimmed.equals("[]") || isNullLiteral(trimmed)) {
      return null;
    }
    if (!looksLikeArray(trimmed)) {
      throw new IllegalArgumentException("Invalid linked list format: '" + raw + "'. Linked lists must be represented as a JSON array (e.g., [1,2,3]).");
    }
    java.util.List<String> items = getArrayItems(trimmed);
    if (items.isEmpty()) {
      return null;
    }
    try {
      Class<?> listNodeClass = Class.forName("ListNode");
      java.lang.reflect.Constructor<?> valueConstructor = listNodeClass.getConstructor(int.class);
      Object head = null;
      Object current = null;
      for (String item : items) {
        int val = parseIntLiteral(item);
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
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("Invalid linked list element: '" + e.getMessage() + "'. Elements must be integers.");
    } catch (Exception e) {
      throw new RuntimeException("Error parsing linked list: " + e.getMessage(), e);
    }
  }

  private static Object parseTreeNode(String raw) {
    String trimmed = raw.trim();
    if (trimmed.equals("[]") || isNullLiteral(trimmed)) {
      return null;
    }
    if (!looksLikeArray(trimmed)) {
      throw new IllegalArgumentException("Invalid binary tree format: '" + raw + "'. Trees must be represented as a JSON array (e.g., [1,2,null,3]).");
    }
    java.util.List<String> items = getArrayItems(trimmed);
    if (items.isEmpty() || isNullLiteral(items.get(0))) {
      return null;
    }
    try {
      Class<?> treeNodeClass = Class.forName("TreeNode");
      java.lang.reflect.Constructor<?> constructor = treeNodeClass.getConstructor(int.class);
      java.lang.reflect.Field leftField = treeNodeClass.getField("left");
      java.lang.reflect.Field rightField = treeNodeClass.getField("right");

      Object root;
      try {
        root = constructor.newInstance(parseIntLiteral(items.get(0)));
      } catch (NumberFormatException e) {
        throw new IllegalArgumentException("Invalid binary tree node value: '" + items.get(0).trim() + "'. Node values must be integers or null.");
      }
      java.util.Queue<Object> queue = new java.util.LinkedList<>();
      queue.add(root);

      int i = 1;
      while (!queue.isEmpty() && i < items.size()) {
        Object curr = queue.poll();

        if (i < items.size()) {
          String valStr = items.get(i).trim();
          if (!isNullLiteral(valStr) && !valStr.isEmpty()) {
            Object left;
            try {
              left = constructor.newInstance(parseIntLiteral(valStr));
            } catch (NumberFormatException e) {
              throw new IllegalArgumentException("Invalid binary tree node value: '" + valStr + "'. Node values must be integers or null.");
            }
            leftField.set(curr, left);
            queue.add(left);
          }
          i++;
        }

        if (i < items.size()) {
          String valStr = items.get(i).trim();
          if (!isNullLiteral(valStr) && !valStr.isEmpty()) {
            Object right;
            try {
              right = constructor.newInstance(parseIntLiteral(valStr));
            } catch (NumberFormatException e) {
              throw new IllegalArgumentException("Invalid binary tree node value: '" + valStr + "'. Node values must be integers or null.");
            }
            rightField.set(curr, right);
            queue.add(right);
          }
          i++;
        }
      }
      return root;
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new RuntimeException("Error parsing binary tree: " + e.getMessage(), e);
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
        java.util.List<String> items = getArrayItems(trimmed);
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
          java.util.List<String> neighborIds = getArrayItems(neighborListRaw);
          java.util.List<Object> neighbors = (java.util.List<Object>) neighborsField.get(nodes[i]);
          for (String idStr : neighborIds) {
            int id = parseIntLiteral(idStr);
            neighbors.add(nodes[id - 1]);
          }
        }
        return nodes[0];
      } else {
        java.util.List<String> items = getArrayItems(trimmed);
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
          java.util.List<String> pair = getArrayItems(pairRaw);
          int val = parseIntLiteral(pair.get(0));
          nodes[i] = constructor.newInstance(val);
          
          String randStr = pair.get(1).trim();
          if (!isNullLiteral(randStr) && !randStr.isEmpty()) {
            randomIndices[i] = parseIntLiteral(randStr);
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

  private static Object parseInterval(String raw) {
    String trimmed = raw.trim();
    if (isNullLiteral(trimmed)) return null;
    java.util.List<String> items = getArrayItems(trimmed);
    if (items.size() != 2) {
      throw new IllegalArgumentException("Interval input must contain [start,end], received '" + raw + "'");
    }
    try {
      Class<?> intervalClass = Class.forName("Interval");
      try {
        java.lang.reflect.Constructor<?> constructor = intervalClass.getConstructor(int.class, int.class);
        return constructor.newInstance(parseIntLiteral(items.get(0)), parseIntLiteral(items.get(1)));
      } catch (NoSuchMethodException ignored) {
        Object interval = intervalClass.getDeclaredConstructor().newInstance();
        intervalClass.getField("start").set(interval, parseIntLiteral(items.get(0)));
        intervalClass.getField("end").set(interval, parseIntLiteral(items.get(1)));
        return interval;
      }
    } catch (Exception error) {
      throw new RuntimeException("Error parsing interval: " + error.getMessage(), error);
    }
  }

  private static Object parseObject(String raw, Class<?> clazz) {
    String trimmed = raw.trim();
    if (isNullLiteral(trimmed)) return null;

    if (looksLikeArray(trimmed)) {
      Exception lastError = null;
      for (java.lang.reflect.Constructor<?> constructor : clazz.getDeclaredConstructors()) {
        try {
          constructor.setAccessible(true);
          Object[] args = parseArgumentGroup(constructor.getGenericParameterTypes(), trimmed);
          return constructor.newInstance(args);
        } catch (Exception error) {
          lastError = error;
        }
      }
      throw new IllegalArgumentException("Unable to construct " + clazz.getSimpleName() + " from " + raw + ": " + (lastError == null ? "no matching constructor" : lastError.getMessage()), lastError);
    }

    try {
      java.lang.reflect.Constructor<?> stringConstructor = clazz.getDeclaredConstructor(String.class);
      stringConstructor.setAccessible(true);
      return stringConstructor.newInstance(unquote(trimmed));
    } catch (Exception ignored) {
      throw new IllegalArgumentException("Unsupported object input for " + clazz.getSimpleName() + ": '" + raw + "'");
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

  private static String formatInterval(Object interval) {
    if (interval == null) return "null";
    try {
      Class<?> intervalClass = interval.getClass();
      Object start = intervalClass.getField("start").get(interval);
      Object end = intervalClass.getField("end").get(interval);
      return "[" + start + "," + end + "]";
    } catch (Exception error) {
      return interval.toString();
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
    if (cleanCode.includes("Interval") && !/class\s+Interval\b/.test(codeWithoutComment)) {
      helperClasses += `
class Interval {
    public int start;
    public int end;
    public Interval() {}
    public Interval(int start, int end) {
        this.start = start;
        this.end = end;
    }
}
`;
    }

    if (useCustomMain) {
      processedCode = `${autoImports}\n\n${cleanCode}\n${wrapperCode}\n${helperClasses}`;
    } else if (hasJavaMain(cleanCode)) {
      const mainClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)(?:(?!class)[\s\S])*?void\s+main\s*\(/);
      const mainClassName = mainClassMatch ? mainClassMatch[1] : null;
      processedCode = `${autoImports}\n\n${mainClassName ? cleanCode.replace(new RegExp(`class\\s+${mainClassName}\\b`), "class Main") : cleanCode}\n${helperClasses}`;
    } else {
      let solutionClassReadyCode = cleanCode;
      const allClassMatches = [...codeWithoutComment.matchAll(/class\s+([A-Za-z0-9_]+)\b/g)];
      let mainClassMatch = allClassMatches.find(m => m[1]?.toLowerCase() === "solution");
      if (!mainClassMatch) {
        mainClassMatch = allClassMatches.find(m => m[1] !== undefined && !["listnode", "treenode", "node", "interval"].includes(m[1].toLowerCase()));
      }
      if (mainClassMatch?.[1]) {
        const className = mainClassMatch[1];
        if (className !== "Solution") {
          solutionClassReadyCode = cleanCode.replace(new RegExp(`\\b${className}\\b`, "g"), "Solution");
        }
      } else {
        solutionClassReadyCode = `class Solution {\n${cleanCode}\n}`;
      }
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

  // Extract JSDoc param types
  const paramRegex = /@param\s*\{([A-Za-z0-9_\[\]]+)\}/g;
  const paramTypes: string[] = [];
  let match;
  while ((match = paramRegex.exec(wrapperCode || "")) !== null) {
    if (match[1]) paramTypes.push(match[1]);
  }
  if (paramTypes.length === 0) {
    while ((match = paramRegex.exec(code || "")) !== null) {
      if (match[1]) paramTypes.push(match[1]);
    }
  }

  const finalWrapper = exportName && !wrapperCode.includes("module.exports")
    ? `\nmodule.exports = { ${exportName} };`
    : wrapperCode;

  const processedCode = finalWrapper ? `${code}\n${finalWrapper}` : code;
  await fs.writeFile(path.join(tempDir, fileName), processedCode);

  if (exportName) {
    const runnerFile = "runner.js";
    await fs.writeFile(path.join(tempDir, runnerFile), getJavaScriptRunner(exportName, paramTypes));
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

const problemExecutionSelect = {
  id: true,
  name: true,
  test_cases: true,
  code_snippets: true,
} as const;

const getProblemBaseName = (fileName?: string | null) => {
  const trimmed = fileName?.trim();
  if (!trimmed) return null;

  const leafName = trimmed.split(/[\\/]/).pop() || trimmed;
  const querylessName = leafName.split("?")[0] || leafName;
  const extensionIndex = querylessName.lastIndexOf(".");

  return extensionIndex > 0 ? querylessName.slice(0, extensionIndex) : querylessName;
};

const getProblemNumber = (baseName: string) => {
  const match = baseName.match(/leetcode[-_]?0*(\d+)/i) || baseName.match(/0*(\d+)/);
  return match ? Number.parseInt(match[1] || match[0], 10) : null;
};

const findProblemForExecution = async (baseName: string) => {
  const exactMatch = await prisma.problem.findFirst({
    where: {
      name: {
        equals: baseName,
        mode: "insensitive",
      },
    },
    select: problemExecutionSelect,
  });

  if (exactMatch) {
    return exactMatch;
  }

  const problemNum = getProblemNumber(baseName);
  if (problemNum) {
    const rawNumber = String(problemNum);
    const paddedTwo = rawNumber.padStart(2, "0");
    const paddedThree = rawNumber.padStart(3, "0");

    const numberMatch = await prisma.problem.findFirst({
      where: {
        OR: [
          { problem_number: problemNum },
          { name: { startsWith: `LeetCode-${paddedTwo}`, mode: "insensitive" } },
          { name: { startsWith: `LeetCode-${paddedThree}`, mode: "insensitive" } },
          { name: { startsWith: `LeetCode-${rawNumber}`, mode: "insensitive" } },
        ],
      },
      select: problemExecutionSelect,
    });

    if (numberMatch) {
      return numberMatch;
    }
  }

  const allProblems = await prisma.problem.findMany({
    select: problemExecutionSelect,
  });

  const target = baseName.toLowerCase();
  let bestMatch: (typeof allProblems)[number] | null = null;
  let bestSimilarity = 0;

  for (const problem of allProblems) {
    const dbName = problem.name.toLowerCase();

    if (dbName.includes(target) || target.includes(dbName)) {
      return problem;
    }

    const distance = getLevenshteinDistance(target, dbName);
    const similarity = 1 - distance / Math.max(target.length, dbName.length);

    if (similarity > bestSimilarity && similarity >= 0.85) {
      bestSimilarity = similarity;
      bestMatch = problem;
    }
  }

  return bestMatch;
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

    internalCache.set(EXECUTION_FILE_NAMES_CACHE_KEY, unifiedResponse, 10 * 60);
    return unifiedResponse;
  } catch (error) {
    console.error("Failed to dynamically fetch and cache file names in execution:", error);
    return [];
  }
};

export const executeCode = async (req: Request, res: Response) => {
  const { code, language, oid, mode, customInput, fileName } = req.body as ExecuteBody;

  const sourceCode = typeof code === "string" ? code : "";
  const githubOid = typeof oid === "string" ? oid.trim() : "";
  const requestedBaseName = getProblemBaseName(typeof fileName === "string" ? fileName : null);
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

  if (githubOid && !githubOid.startsWith("local-") && !isGitObjectId(githubOid)) {
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

    let fileData = requestedBaseName && !githubOid.startsWith("local-")
      ? await findProblemForExecution(requestedBaseName)
      : null;

    if (!fileData) {
      fileData = await prisma.problem.findUnique({
        where: { github_oid: githubOid },
        select: problemExecutionSelect,
      });
    }

    if (!fileData) {
      // Fallback: search in cached filenames
      let cachedFiles = internalCache.get<any[]>(EXECUTION_FILE_NAMES_CACHE_KEY);
      if (!cachedFiles || cachedFiles.length === 0) {
        cachedFiles = await fetchAndCacheFileNames();
      }
      const matchedFile = cachedFiles?.find((f) => f.oid === githubOid);
      if (matchedFile && typeof matchedFile.name === "string") {
        const baseName = getProblemBaseName(matchedFile.name);
        if (baseName) {
          fileData = await findProblemForExecution(baseName);
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
    const runtimeErrorResult = results.find((result) => result.runtimeError);
    const passed = !runtimeErrorResult && (isFreeForm ? true : totalPassed === casesToRun.length);

    return res.json({
      mode: executionMode,
      totalCases: casesToRun.length,
      passedCases: isFreeForm && !runtimeErrorResult ? casesToRun.length : totalPassed,
      passed,
      status: runtimeErrorResult ? "FAILED" : isFreeForm ? "COMPLETED" : totalPassed === casesToRun.length ? "PASSED" : "FAILED",
      problemId: isFreeForm ? "" : testCases[0]?.problemId || "",
      details: results,
      error: runtimeErrorResult?.runtimeError || null,
      execution_status: passed ? "SUCCESS" : 'ERROR',
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
        const runtimeErrorResult = localResults.find((result) => result.runtimeError);
        const passed = !runtimeErrorResult && (isFreeForm ? true : localPassedCount === testCasesToRun.length);

        return res.json({
          mode: executionMode,
          totalCases: testCasesToRun.length,
          passedCases: isFreeForm && !runtimeErrorResult ? testCasesToRun.length : localPassedCount,
          passed,
          status: runtimeErrorResult ? "FAILED" : isFreeForm ? "COMPLETED" : localPassedCount === testCasesToRun.length ? "PASSED" : "FAILED",
          problemId: isFreeForm ? "" : testCases[0]?.problemId || "",
          details: localResults,
          error: runtimeErrorResult?.runtimeError || null,
          execution_status: passed ? "SUCCESS" : 'ERROR',
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
