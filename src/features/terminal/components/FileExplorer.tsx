import { FileCode } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ChangeEvent } from "react";
import type { FileEntry } from "../../../context/fileNamesContext";
import type { FileContentResponse } from "../types";
import { FilePenIcon as CreateFileIcon } from "lucide-react";

type FileExplorerProps = {
  activeFile: string | null;
  files: FileEntry[];
  fileData: FileContentResponse | null;
  language: string;
  testCaseCount: number;
  sidebarWidth: number;
  onFileClick: (oid: string, name: string) => void;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onCreateFile?: (name: string) => void;
  selectedMode: "files-mode" | "terminal-mode";
  setSelectedMode: (mode: "files-mode" | "terminal-mode") => void;
};

const FileExplorer = ({
  activeFile,
  files,
  fileData,
  language,
  testCaseCount,
  sidebarWidth,
  onFileClick,
  onResizeStart,
  onCreateFile,
  selectedMode,
  setSelectedMode,
}: FileExplorerProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileName,setFileName] = useState("");

  const activeFileEntry = files.find((file) => file.oid === activeFile);
  const localFiles = files.filter((file) => file.isLocal);
  const repositoryFiles = files.filter((file) => !file.isLocal);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filteredFiles = useMemo(() => {
    if (!debouncedSearch) return files;

    return files.filter((file) => {
      const name = file.name.toLowerCase();
      const path = file.path?.toLowerCase() ?? "";
      const type = file.type?.toLowerCase() ?? "";
      return (
        name.includes(debouncedSearch) ||
        path.includes(debouncedSearch) ||
        type.includes(debouncedSearch)
      );
    });
  }, [files, debouncedSearch]);

  const searchActive = Boolean(searchInput.trim());

  const detailsPanelClass = "p-4 space-y-4 border-b border-[#2b2b2b] bg-[#141518] text-sm text-slate-300";

  const crossCheckFileName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("Please enter a file name.");
      return false;
    }

    const parts = trimmedName.toLowerCase().split(".");
    if (parts.length > 2) {
      alert("Invalid file name. Only one dot is allowed for a file extension.");
      return false;
    }

    const baseName = parts[0];
    const extension = parts.length === 2 ? parts[1] : null;

    if (!baseName.match(/^[a-zA-Z0-9_-]+$/)) {
      alert("Invalid file name. Only letters, numbers, underscores and hyphens are allowed.");
      return false;
    }

    if (baseName.length > 50) {
      alert("File name too long. Please keep it under 50 characters.");
      return false;
    }

    if (extension && extension !== "js" && extension !== "java") {
      alert("Invalid file extension. Only .js and .java files are allowed.");
      return false;
    }

    const normalizedName = trimmedName.toLowerCase();
    if (files.some((file) => file.name.toLowerCase() === normalizedName)) {
      alert("File name already exists. Please choose a different name.");
      return false;
    }

    return true;
  };

  const createNewFile = (e?: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    const newFileName = fileName.trim();
    if (!crossCheckFileName(newFileName)) {
      return;
    }

    if (typeof onCreateFile === "function") {
      onCreateFile(newFileName);
    } else {
      console.log("create new file", newFileName);
    }

    setFileName(""); // reset file name after creating file
  };

  const handleTerminalModeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedMode(event.target.value === "terminal" ? "terminal-mode" : "files-mode");
  };

  return (
    <>
      <aside
        style={{
          width: `${sidebarWidth}px`,
          height: "100%",
        }}
        className="h-full p-2 border-r [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-gray-300 border-[#2b2b2b] bg-[#111214] flex flex-col overflow-y-auto"
        >
        {/* SELECTING FILE EXPLORER OR TERMINAL MODE - option for files explorer section or an empty terminal section*/}
        <div className="px-2 text-xs justify-between sm:flex uppercase tracking-widest text-slate-500 xs:flex-col flex-nowrap mb-1">
          <label htmlFor="mode-files" className="text-cyan-400 flex items-center">
            practice with files
            <input
              type="radio"
              name="mode"
              id="mode-files"
              value="files"
              checked={selectedMode === "files-mode"}
              className="ml-1"
              onChange={handleTerminalModeChange}
            />
          </label>
          <label htmlFor="mode-terminal" className="text-cyan-400 flex items-center">
            Empty Terminal
            <input
              type="radio"
              id="mode-terminal"
              name="mode"
              value="terminal"
              checked={selectedMode === "terminal-mode"}
              className="ml-1"
              onChange={handleTerminalModeChange}
            />
          </label>
        </div>

        {selectedMode === "files-mode" ? <>
         <div className="p-4 border-b border-[#2b2b2b] bg-[#16181c] relative overflow-visible">
          <div className="space-y-3">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Type name, path, or file type"
              className="w-full rounded-3xl border border-[#2f333b] bg-[#111214] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
            />
            <div className="flex items-center justify-between gap-1 text-[11px] uppercase tracking-widest text-slate-500">
              <span>{searchActive ? `${filteredFiles.length}/${files.length} matches` : "Type to find files"}</span>
              {searchActive && <span className="text-cyan-400">Search active</span>}
            </div>
          </div>

          {searchActive && (
            <div className="absolute [&::-webkit-scrollbar]:[width:6px] [&::-webkit-scrollbar-track]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-gray-300 left-4 right-4 top-full z-20 mt-3 max-h-72 overflow-y-auto rounded-3xl border border-[#2f333b] bg-[#0c1014] shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
              {filteredFiles.length > 0 ? (
                <div className="space-y-1 p-3 text-sm text-slate-200 ">
                  {filteredFiles.map((file) => (
                    <button
                      key={file.oid || file.name}
                      type="button"
                      onClick={() => {
                        onFileClick(file.oid, file.name);
                        setSearchInput("");
                      }}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d]"
                    >
                      <FileCode className="h-4 w-4 text-cyan-400" />
                      <div className="min-w-0 gap-2">
                        <div className="font-medium text-white truncate">{file.name}</div>
                        
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-slate-400">No files match your search.</div>
              )}
            </div>
          )}
        </div>
       

        <div className={detailsPanelClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">Selected file info</div>
              <div className="text-xl font-semibold text-white break-words mt-2">
                {activeFileEntry?.name || "No file selected"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                {language.toUpperCase() || ""}
              </span>
              <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                {fileData?.difficulty_level || ""}
              </span>
              <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                {testCaseCount ? `${testCaseCount} cases` : ""}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#2f333b] bg-[#12151a] p-4 text-sm text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-3">Problem definition</div>
            <div className="whitespace-pre-wrap leading-6 text-slate-200">
              {fileData?.problem_definition || "No description available for this file."}
            </div>
          </div>

          <div className="rounded-3xl border border-[#2f333b] bg-[#12151a] p-4 text-sm text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-3">Test cases</div>
            {fileData?.test_cases?.length ? (
              <div className="space-y-3">
                {fileData.test_cases.map((testCase, index) => (
                  <div key={`test-case-${index}`} className="rounded-2xl border border-[#20252c] bg-[#111214] p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Case {index + 1}</div>
                    <div className="mb-3">
                      <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Input</div>
                      <pre className="rounded bg-[#0f1114] p-3 text-[13px] text-slate-200 whitespace-pre-wrap">{testCase.input ?? "-"}</pre>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Expected output</div>
                      <pre className="rounded bg-[#0f1114] p-3 text-[13px] text-slate-200 whitespace-pre-wrap">{testCase.expectedOutput ?? "-"}</pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No test cases available for this file.</div>
            )}
          </div>
        </div>
        </> : <>
          <div>
            {/* search bar - with menu different menus for now just creating 1 level files */}
            <div className="p-4 border-b relative border-[#2b2b2b] bg-[#16181c] relative overflow-visible flex items-center justify-between gap-2">
              {/* input for file name search , create files etc - this can be used to create new files and search for existing ones - we can also have a dropdown to select between different file types like .js, .java etc and create files of those types */}
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNewFile(e)}
                title="Create File"
                className="bg-[#16181c] flex-1 text-slate-400 px-2 placeholder:text-slate-500 border-0 outline-none"
                placeholder="Create file name (e.g., solution.js)"
                aria-label="Create file name"
              />
              {/* container for creating files */}
              <div className="absolute right-4 top-4 flex items-center gap-2 bg-black p-[3px] rounded">
                <button type="button" className="text-white rounded px-2 py-1" onClick={() => createNewFile()} aria-label="Create file">
                  <CreateFileIcon className="text-md" />
                </button>
              </div>
            </div>
            {/* content - search results and files on local system */}
            <div className="p-[5px] text-sm text-slate-400 flex flex-col gap-3">
              <div className="text-xs font-bold uppercase tracking-widest text-end text-slate-500 mb-2">Files you have saved</div>
              <div className="flex flex-col gap-2">
                {localFiles.length > 0 ? localFiles.map((file) => (
                  <button
                    key={file.oid}
                    type="button"
                    onClick={() => onFileClick(file.oid, file.name)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d]"
                  >
                    <FileCode className="h-4 w-4 text-cyan-400" />
                    <div className="min-w-0 gap-2">
                      <div className="font-medium text-white truncate">{file.name}</div>
                    </div>
                  </button>
                )) : <div className="text-sm text-slate-500">You have not saved any files yet.</div>}
               </div>
              <div className="text-xs font-bold uppercase tracking-widest text-end text-slate-500 mt-4 mb-2">Files from the problem repository</div>
              <div className="flex flex-col gap-2">
                {repositoryFiles.length > 0 ? repositoryFiles.map((file) => (
                  <button
                    key={file.oid || file.name}
                    type="button"
                    onClick={() => onFileClick(file.oid, file.name)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d]"
                  >
                    <FileCode className="h-4 w-4 text-cyan-400" />
                    <div className="min-w-0 gap-2">
                      <div className="font-medium text-white truncate">{file.name}</div>
                    </div>
                  </button>
                )) : <div className="text-sm text-slate-500">No files available for this problem.</div>}
               </div>
             </div>
            </div>
        </>
      }
       
      </aside>
      <div
        onMouseDown={onResizeStart}
        className="w-2 h-full bg-white/10 hover:bg-white/20 transition-colors active:color-white/80 cursor-col-resize"
      />
    </>
  );
};

export default FileExplorer;
