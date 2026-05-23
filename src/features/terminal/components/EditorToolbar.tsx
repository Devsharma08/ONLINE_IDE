import { useContext } from "react";
import { FileCode, Loader2, Play, Send } from "lucide-react";
import type { ExecutionMode, SupportedLanguage } from "../types";
import { CodeContext } from "../../../context/codeContext.tsx";
import {BrushCleaning as Clear,Indent as IndentationIcon} from 'lucide-react'


type EditorToolbarProps = {
  disabled: boolean;
  activeFile: string | null;
  fileName: string;
  language: SupportedLanguage;
  executingMode: ExecutionMode | null;
  setLanguage: (language: SupportedLanguage) => void;
  setCode: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onFormat: () => void;
};

const EditorToolbar = ({ disabled, fileName, onRun, onSubmit, onFormat, language, executingMode, setLanguage, setCode }: EditorToolbarProps) => {
  
  const context = useContext(CodeContext);
  if (!context) {
    throw new Error("EditorToolbar must be used inside a CodeContext.Provider");
  }

  const {
      setCode: setContextCode,
      setOutput: setContextOutput,
      setCustomInput: setContextCustomInput,
   } = context;

  const ClearChanges = () => {
      setCode("");
      setContextCode("");
      setContextOutput(null);
      setContextCustomInput("");
   }

  return (
    <div className="flex flex-col gap-2 border-b border-white/10 bg-[#252526] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <FileCode className="w-4 h-4 text-orange-500" />
        <input
          type="text"
          className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-gray-300 outline-none"
          value={fileName}
          readOnly
          placeholder="Enter file name"
          aria-label="File name"
        />
      </div>

      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:w-auto">
        <button type="button" onClick={onFormat} title="Format code" className="flex items-center justify-center gap-2 rounded-md bg-[#1e1e1e] px-3 py-2 text-sm text-gray-300 hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <IndentationIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => ClearChanges()} title="Clear Changes" className="flex items-center justify-center gap-2 rounded-md bg-[#1e1e1e] px-3 py-2 text-sm text-gray-300 hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <Clear className="w-4 h-4" />
        </button>
        <select className="min-w-0 rounded bg-[#1e1e1e] px-2 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
        </select>
        <button
          onClick={onRun}
          disabled={disabled}
          aria-busy={executingMode === "RUN"}
          className={`flex min-h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700 ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {executingMode === "RUN" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>Run</span>
        </button>

        <button
          onClick={onSubmit}
          disabled={disabled}
          aria-busy={executingMode === "SUBMIT"}
          className={`flex min-h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700 ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {executingMode === "SUBMIT" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Submit</span>
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
