import dotenv from "dotenv";
import path from "path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Level, PrismaClient } from "../src/generated/prisma/client.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

const getConnectionString = () => {
  const directUrl = process.env.DIRECT_URL;

  if (!directUrl) {
    throw new Error("DIRECT_URL is required to seed LeetCode problems.");
  }

  return directUrl;
};

const connectionString = getConnectionString();

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MAX_TEST_CASES_PER_PROBLEM = 3;

type SeedLanguage = "javascript" | "java";

type SeedTestCase = {
  input: string;
  expectedOutput: string;
  is_public: boolean;
};

type SeedCodeSnippet = {
  language: SeedLanguage;
  code: string;
  wrapperCode: string;
};

type SeedProblem = {
  name: string;
  problem_number: number;
  github_oid: string;
  problem_definition: string;
  problem_hints: string[];
  difficulty_level: Level;
  test_cases: SeedTestCase[];
  code_snippets: SeedCodeSnippet[];
};

const problems: SeedProblem[] = [
  {
    name: "LeetCode-01E.java",
    problem_number: 1,
    github_oid: "67a013521d80b36dba6b2d0b1f9bf2b824c79028",
    difficulty_level: Level.EASY,
    problem_definition:
      "Given an integer array nums and an integer target, return the zero-based indices of two distinct elements whose values add up to target. Each test case has exactly one valid answer.",
    problem_hints: [
      "Track each value's index while scanning the array.",
      "For every number, check whether target - number has already been seen.",
    ],
    test_cases: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1", is_public: true },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2", is_public: true },
      { input: "4\n-3 4 3 90\n0", expectedOutput: "0 2", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var twoSum = function(nums, target) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
const n = Number(input[0]);
const nums = input.slice(1, n + 1).map(Number);
const target = Number(input[n + 1]);
const result = twoSum(nums, target);
console.log(result.join(" "));`,
      },
      {
        language: "java",
        code: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        
        return new int[]{};
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        int[] result = new Solution().twoSum(nums, target);
        System.out.print(result[0] + " " + result[1]);
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-02M.java",
    problem_number: 2,
    github_oid: "93969c1d8d756ed2f5f1bfc443c0e2186625ff5f",
    difficulty_level: Level.MEDIUM,
    problem_definition:
      "Two non-empty linked lists store non-negative integers in reverse digit order. Add the numbers and return the sum as a linked list in the same reverse order.",
    problem_hints: [
      "Walk both lists together while keeping a carry value.",
      "Create a new node for every computed digit.",
    ],
    test_cases: [
      { input: "3\n2 4 3\n3\n5 6 4", expectedOutput: "7 0 8", is_public: true },
      { input: "1\n0\n1\n0", expectedOutput: "0", is_public: true },
      {
        input: "7\n9 9 9 9 9 9 9\n4\n9 9 9 9",
        expectedOutput: "8 9 9 9 0 0 0 1",
        is_public: false,
      },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = val === undefined ? 0 : val;
 *     this.next = next === undefined ? null : next;
 * }
 */
var addTwoNumbers = function(l1, l2) {
    
};`,
        wrapperCode: `function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}
const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
let index = 0;
const buildList = () => {
  const length = Number(input[index++]);
  let head = null;
  let tail = null;
  for (let i = 0; i < length; i++) {
    const node = new ListNode(Number(input[index++]));
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
};
let result = addTwoNumbers(buildList(), buildList());
const output = [];
while (result) {
  output.push(result.val);
  result = result.next;
}
console.log(output.join(" "));`,
      },
      {
        language: "java",
        code: `/**
 * Definition for singly-linked list.
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        return null;
    }
}`,
        wrapperCode: `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

public class Main {
    private static ListNode buildList(java.util.Scanner sc) {
        int length = sc.nextInt();
        ListNode head = null;
        ListNode tail = null;
        for (int i = 0; i < length; i++) {
            ListNode node = new ListNode(sc.nextInt());
            if (head == null) {
                head = node;
                tail = node;
            } else {
                tail.next = node;
                tail = node;
            }
        }
        return head;
    }

    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        ListNode result = new Solution().addTwoNumbers(buildList(sc), buildList(sc));
        while (result != null) {
            System.out.print(result.val + (result.next != null ? " " : ""));
            result = result.next;
        }
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-03M.java",
    problem_number: 3,
    github_oid: "9d51bad1004d468f0ac051dd468b1afb4118e5d3",
    difficulty_level: Level.MEDIUM,
    problem_definition:
      "Given a string s, return the length of the longest contiguous substring that contains no repeated characters.",
    problem_hints: [
      "Use a sliding window over the string.",
      "Move the left pointer past the previous occurrence of a repeated character.",
    ],
    test_cases: [
      { input: "abcabcbb", expectedOutput: "3", is_public: true },
      { input: "bbbbb", expectedOutput: "1", is_public: true },
      { input: "pwwkew", expectedOutput: "3", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var lengthOfLongestSubstring = function(s) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").replace(/\\r?\\n$/, "");
console.log(lengthOfLongestSubstring(input));`,
      },
      {
        language: "java",
        code: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        return 0;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String s = sc.nextLine();
        System.out.print(new Solution().lengthOfLongestSubstring(s));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-04H.java",
    problem_number: 4,
    github_oid: "8f39117c6921856cf14f210a71b30bed718779c8",
    difficulty_level: Level.HARD,
    problem_definition:
      "Given two sorted integer arrays nums1 and nums2, return the median value of the combined sorted data set.",
    problem_hints: [
      "Partition the two sorted arrays instead of merging every value.",
      "Binary search the smaller array to find a valid left and right partition.",
    ],
    test_cases: [
      { input: "2\n1 3\n1\n2", expectedOutput: "2.00000", is_public: true },
      { input: "2\n1 2\n2\n3 4", expectedOutput: "2.50000", is_public: true },
      { input: "0\n3\n2 3 4", expectedOutput: "3.00000", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var findMedianSortedArrays = function(nums1, nums2) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
let index = 0;
const m = Number(input[index++]);
const nums1 = input.slice(index, index + m).map(Number);
index += m;
const n = Number(input[index++]);
const nums2 = input.slice(index, index + n).map(Number);
console.log(findMedianSortedArrays(nums1, nums2).toFixed(5));`,
      },
      {
        language: "java",
        code: `class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        return 0.0;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int m = sc.nextInt();
        int[] nums1 = new int[m];
        for (int i = 0; i < m; i++) nums1[i] = sc.nextInt();
        int n = sc.nextInt();
        int[] nums2 = new int[n];
        for (int i = 0; i < n; i++) nums2[i] = sc.nextInt();
        System.out.printf("%.5f", new Solution().findMedianSortedArrays(nums1, nums2));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-05M.java",
    problem_number: 5,
    github_oid: "473d9f0eba85b7d488ffd0f8d8c68cdbce0c3a4e",
    difficulty_level: Level.MEDIUM,
    problem_definition:
      "Given a string s, return its longest palindromic substring. Test cases are chosen so the expected output is deterministic.",
    problem_hints: [
      "A palindrome expands symmetrically from its center.",
      "Check both odd-length and even-length centers.",
    ],
    test_cases: [
      { input: "cbbd", expectedOutput: "bb", is_public: true },
      { input: "a", expectedOutput: "a", is_public: true },
      { input: "forgeeksskeegfor", expectedOutput: "geeksskeeg", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var longestPalindrome = function(s) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").replace(/\\r?\\n$/, "");
console.log(longestPalindrome(input));`,
      },
      {
        language: "java",
        code: `class Solution {
    public String longestPalindrome(String s) {
        return "";
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String s = sc.nextLine();
        System.out.print(new Solution().longestPalindrome(s));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-20E.java",
    problem_number: 20,
    github_oid: "8b0b86420efb5693e0b9a5b71a237fac503d4641",
    difficulty_level: Level.EASY,
    problem_definition:
      "Given a string containing only parentheses, brackets, and braces, return true when every opening character is closed by the same type in the correct order.",
    problem_hints: [
      "Push opening brackets onto a stack.",
      "When a closing bracket appears, it must match the stack's top value.",
    ],
    test_cases: [
      { input: "()[]{}", expectedOutput: "true", is_public: true },
      { input: "([)]", expectedOutput: "false", is_public: true },
      { input: "{[]}", expectedOutput: "true", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var isValid = function(s) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").replace(/\\r?\\n$/, "");
console.log(isValid(input));`,
      },
      {
        language: "java",
        code: `class Solution {
    public boolean isValid(String s) {
        return false;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String s = sc.nextLine();
        System.out.print(new Solution().isValid(s));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-21E.java",
    problem_number: 21,
    github_oid: "975cabd5e3ed98ab0b9046dc9a67486ee7f7c1be",
    difficulty_level: Level.EASY,
    problem_definition:
      "Given the heads of two sorted linked lists, merge them into one sorted linked list and return the merged list.",
    problem_hints: [
      "Use a dummy head to simplify list construction.",
      "Always attach the smaller current node, then advance that list.",
    ],
    test_cases: [
      { input: "3\n1 2 4\n3\n1 3 4", expectedOutput: "1 1 2 3 4 4", is_public: true },
      { input: "2\n1 3\n1\n2", expectedOutput: "1 2 3", is_public: true },
      { input: "1\n5\n3\n1 2 4", expectedOutput: "1 2 4 5", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = val === undefined ? 0 : val;
 *     this.next = next === undefined ? null : next;
 * }
 */
var mergeTwoLists = function(list1, list2) {
    
};`,
        wrapperCode: `function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}
const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
let index = 0;
const buildList = () => {
  const length = Number(input[index++]);
  let head = null;
  let tail = null;
  for (let i = 0; i < length; i++) {
    const node = new ListNode(Number(input[index++]));
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
};
let result = mergeTwoLists(buildList(), buildList());
const output = [];
while (result) {
  output.push(result.val);
  result = result.next;
}
console.log(output.join(" "));`,
      },
      {
        language: "java",
        code: `/**
 * Definition for singly-linked list.
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        return null;
    }
}`,
        wrapperCode: `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

public class Main {
    private static ListNode buildList(java.util.Scanner sc) {
        int length = sc.nextInt();
        ListNode head = null;
        ListNode tail = null;
        for (int i = 0; i < length; i++) {
            ListNode node = new ListNode(sc.nextInt());
            if (head == null) {
                head = node;
                tail = node;
            } else {
                tail.next = node;
                tail = node;
            }
        }
        return head;
    }

    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        ListNode result = new Solution().mergeTwoLists(buildList(sc), buildList(sc));
        while (result != null) {
            System.out.print(result.val + (result.next != null ? " " : ""));
            result = result.next;
        }
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-121E.java",
    problem_number: 121,
    github_oid: "abd9bcf674fde34a7cd15f1c2178e37f573fabe3",
    difficulty_level: Level.EASY,
    problem_definition:
      "Given daily stock prices, choose one buy day and one later sell day to maximize profit. Return 0 when no profitable transaction exists.",
    problem_hints: [
      "Keep the lowest price seen before the current day.",
      "Compare each day's price against that minimum to update the best profit.",
    ],
    test_cases: [
      { input: "6\n7 1 5 3 6 4", expectedOutput: "5", is_public: true },
      { input: "5\n7 6 4 3 1", expectedOutput: "0", is_public: true },
      { input: "6\n2 4 1 7 5 3", expectedOutput: "6", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var maxProfit = function(prices) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
const n = Number(input[0]);
const prices = input.slice(1, n + 1).map(Number);
console.log(maxProfit(prices));`,
      },
      {
        language: "java",
        code: `class Solution {
    public int maxProfit(int[] prices) {
        return 0;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] prices = new int[n];
        for (int i = 0; i < n; i++) prices[i] = sc.nextInt();
        System.out.print(new Solution().maxProfit(prices));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-125E.java",
    problem_number: 125,
    github_oid: "3589b6cae424511420a375ea3d0929cf6d0e473b",
    difficulty_level: Level.EASY,
    problem_definition:
      "Return true when the string reads the same forward and backward after ignoring non-alphanumeric characters and letter casing.",
    problem_hints: [
      "Use two pointers from the start and end of the string.",
      "Skip characters that are not letters or digits before comparing.",
    ],
    test_cases: [
      { input: "A man, a plan, a canal: Panama", expectedOutput: "true", is_public: true },
      { input: "race a car", expectedOutput: "false", is_public: true },
      { input: "0P", expectedOutput: "false", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var isPalindrome = function(s) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").replace(/\\r?\\n$/, "");
console.log(isPalindrome(input));`,
      },
      {
        language: "java",
        code: `class Solution {
    public boolean isPalindrome(String s) {
        return false;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String s = sc.nextLine();
        System.out.print(new Solution().isPalindrome(s));
    }
}`,
      },
    ],
  },
  {
    name: "LeetCode-704E.java",
    problem_number: 704,
    github_oid: "f4e323242c80d60a67e780a55e100a1bfa364c25",
    difficulty_level: Level.EASY,
    problem_definition:
      "Given a sorted integer array and a target value, return the target's index if it exists in the array. Otherwise, return -1.",
    problem_hints: [
      "Keep left and right search boundaries.",
      "Compare the target with the middle value to discard half of the range.",
    ],
    test_cases: [
      { input: "6\n-1 0 3 5 9 12\n9", expectedOutput: "4", is_public: true },
      { input: "6\n-1 0 3 5 9 12\n2", expectedOutput: "-1", is_public: true },
      { input: "1\n5\n5", expectedOutput: "0", is_public: false },
    ],
    code_snippets: [
      {
        language: "javascript",
        code: `var search = function(nums, target) {
    
};`,
        wrapperCode: `const fs = require("fs");
const input = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);
if (!input[0]) process.exit(0);
const n = Number(input[0]);
const nums = input.slice(1, n + 1).map(Number);
const target = Number(input[n + 1]);
console.log(search(nums, target));`,
      },
      {
        language: "java",
        code: `class Solution {
    public int search(int[] nums, int target) {
        return -1;
    }
}`,
        wrapperCode: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        System.out.print(new Solution().search(nums, target));
    }
}`,
      },
    ],
  },
];

const validateSeedData = () => {
  for (const problem of problems) {
    if (!problem.name.startsWith("LeetCode-")) {
      throw new Error(`Seed data must stay LeetCode-only. Invalid problem: ${problem.name}`);
    }

    if (problem.test_cases.length > MAX_TEST_CASES_PER_PROBLEM) {
      throw new Error(
        `${problem.name} has ${problem.test_cases.length} test cases. Maximum allowed is ${MAX_TEST_CASES_PER_PROBLEM}.`,
      );
    }

    const languages = new Set(problem.code_snippets.map((snippet) => snippet.language));
    if (!languages.has("java") || !languages.has("javascript")) {
      throw new Error(`${problem.name} must include Java and JavaScript snippets.`);
    }
  }
};

async function main() {
  validateSeedData();

  console.log("Starting LeetCode problem seed...");
  console.log("Connecting to:", connectionString.replace(/:([^@]+)@/, ":***@"));

  for (const problemSeed of problems) {
    const { test_cases, code_snippets, ...problemData } = problemSeed;

    const problem = await prisma.problem.upsert({
      where: { problem_number: problemData.problem_number },
      update: problemData,
      create: problemData,
    });

    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    await prisma.codeSnippet.deleteMany({ where: { problemId: problem.id } });

    await prisma.testCase.createMany({
      data: test_cases.map((testCase) => ({
        ...testCase,
        problemId: problem.id,
      })),
    });

    await prisma.codeSnippet.createMany({
      data: code_snippets.map((snippet) => ({
        ...snippet,
        problemId: problem.id,
      })),
    });

    console.log(
      `Seeded [#${problem.problem_number}] ${problem.name}: ${test_cases.length} tests, ${code_snippets.length} snippets`,
    );
  }

  console.log("LeetCode problem seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
