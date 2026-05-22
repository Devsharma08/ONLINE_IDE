import { useEffect, useState } from "react";
import { FileCode, Play, Send } from "lucide-react";
import type { SupportedLanguage } from "../types";

type EditorToolbarProps = {
  disabled: boolean;
  activeFile: string | null;
  fileName: string;
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  onRun: () => void;
  onSubmit: () => void;
};

const EditorToolbar = ({ disabled, activeFile = "", fileName, onRun, onSubmit, language, setLanguage }: EditorToolbarProps) => {
  const [editableFileName, setEditableFileName] = useState(fileName);
  const isEditable = !activeFile;

  useEffect(() => {
    setEditableFileName(fileName);
  }, [fileName]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-white/10">
      <div className="flex items-center gap-2">
        <FileCode className="w-4 h-4 text-orange-500" />
        <input
          type="text"
          className="bg-transparent border-none outline-none focus:none active:none text-sm text-gray-300 font-medium "
          value={editableFileName}
          onChange={(e) => {
            if (!isEditable) return;
            setEditableFileName(e.target.value);
          }}
          readOnly={!isEditable}
          placeholder="Enter file name"
          aria-label="File name"
        />
      </div>

      <div className="flex items-center gap-2">
        <select className="bg-[#1e1e1e] text-sm text-gray-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
        </select>
        <button
          onClick={onRun}
          disabled={disabled}
          className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <Play className="w-4 h-4" />
          Run
        </button>

        <button
          onClick={onSubmit}
          disabled={disabled}
          className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <Send className="w-4 h-4" />
          Submit
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
