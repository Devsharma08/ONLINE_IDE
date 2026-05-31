import { createContext } from "react";
import type { ExecutionResult, SupportedLanguage } from "../features/terminal/types";

export type TestCase = { input: string; expectedOutput: string; problemId?: string };

export type CodeContextType = {
    code: string;
    language: SupportedLanguage;
    setCode: (code: string) => void;
    setLanguage: (language: SupportedLanguage) => void;
    testCases: TestCase[];
    setTestCases: (testCases: TestCase[]) => void;
    activeFile: string;
    output: ExecutionResult | null;
    customInput: string;
    setCustomInput: (customInput: string) => void;
    customInputActive: boolean;
    setCustomInputActive: (active: boolean) => void;
    setActiveFile: (activeFile: string) => void;
    setOutput: (output: ExecutionResult | null) => void;
}

export const CodeContext = createContext<CodeContextType>({
    code: "",
    language: "",
    setCode: () => {},
    setLanguage: () => {},
    testCases: [],
    setTestCases: () => {},
    activeFile: "",
    output: null,
    customInput: "",
    setCustomInput: () => {},
    customInputActive: false,
    setCustomInputActive: () => {},
    setActiveFile: () => {},
    setOutput: () => {},
});
