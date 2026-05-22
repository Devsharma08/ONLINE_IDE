import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { ExecutionMode, SupportedLanguage } from "../types";

type EditorInstance = Parameters<OnMount>[0];

type MonacoIDEProps = {
  code: string;
  language: SupportedLanguage;
  oid: string;
  handleRunCode: (
    code: string,
    language: SupportedLanguage,
    oid: string,
    mode?: ExecutionMode,
  ) => Promise<void> | void;
  onCodeChange: (code: string) => void;
};

const MonacoIDE = ({ handleRunCode, language, code, oid, onCodeChange }: MonacoIDEProps) => {
  const editorRef = useRef<EditorInstance | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (language === "java" && !code) {
      const lockedBoilerplate = [
        "import java.util.*;",
        "import java.io.*;",
        "import java.math.*;",
        "class Solution {",
        "    public static void main(String[] args) {",
        "// --- DO NOT ALTER ABOVE THIS LINE ---",
        "        // Your code here",
        "    }",
        "}",
      ].join("\n");

      editor.setValue(lockedBoilerplate);
    }

    if (language === "java") {
      editor.onDidChangeCursorPosition((e) => {
        const currentLine = e.position.lineNumber;
        if (currentLine < 8) {
          editor.setPosition({ lineNumber: 8, column: 1 });
        }
      });
    }

    if (monaco.editor) {
      monaco.editor.defineTheme("dark-theme", {
        base: "vs-dark",
        inherit: false,
        rules: [
          { token: "comment", foreground: "6b7280", fontStyle: "italic" },
          { token: "keyword", foreground: "82aaff", fontStyle: "bold" },
          { token: "keyword.operator", foreground: "f5c24d" },
          { token: "number", foreground: "f78c6c" },
          { token: "string", foreground: "c3e88d" },
          { token: "delimiter.bracket", foreground: "c792ea" },
          { token: "type", foreground: "7fdbca" },
          { token: "class", foreground: "ffcb6b", fontStyle: "bold" },
          { token: "variable", foreground: "d6deeb" },
          { token: "variable.predefined", foreground: "82aaff" },
          { token: "function", foreground: "82cfff" },
          { token: "identifier", foreground: "d6deeb" },
          { token: "operator", foreground: "89ddff" },
          { token: "delimiter", foreground: "89ddff" },
          { token: "tag", foreground: "ff5370" },
          { token: "attribute.name", foreground: "c792ea" },
          { token: "namespace", foreground: "89ddff" },
          { token: "meta", foreground: "b2ccd6" },
          { token: "regexp", foreground: "ecc48d" },
        ],
        colors: {
          "editor.background": "#01050f",
          "editor.foreground": "#d6deeb",
          "editorLineNumber.foreground": "#3b4252",
          "editorLineNumber.activeForeground": "#88c0d0",
          "editorCursor.foreground": "#7fdbca",
          "editor.selectionBackground": "#334e68",
          "editor.inactiveSelectionBackground": "#22303c",
          "editorIndentGuide.background": "#2f3c4a",
          "editorIndentGuide.activeBackground": "#5c7e91",
          "editorLineHighlightBackground": "#112131",
          "editor.selectionHighlightBackground": "#334e68",
          "editor.findMatchBackground": "#5f7c8e",
          "editor.findMatchHighlightBackground": "#3b4c5c",
          "editor.hoverHighlightBackground": "#2a3744",
          "editorBracketMatch.background": "#21405b",
          "editorBracketMatch.border": "#67c5ff",
          "editorOverviewRuler.border": "#00000000",
          "sideBar.background": "#020812",
          "editorGutter.modifiedBackground": "#e7c547",
          "editorGutter.addedBackground": "#a3be8c",
          "editorGutter.deletedBackground": "#bf616a",
        },
      });
      monaco.editor.setTheme("dark-theme");
    }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode(editor.getValue(), language, oid, "RUN");
    });
  };

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  return (
    <div className="h-full border border-white/10 rounded-xl overflow-hidden">
      <Editor
        height="100%"
        language={language}
        value={code}
        options={{
          readOnly: false,
          minimap: { enabled: false },
          fontFamily: "'Fira Code', monospace",
          fontLigatures: true,
          automaticLayout: true,
          padding: { top: 20 },
          smoothScrolling: true,
          cursorBlinking: "expand",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          fontSize: 14,
        }}
        onChange={(value) => onCodeChange(value ?? "")}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default MonacoIDE;
