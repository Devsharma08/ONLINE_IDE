import { FileCode, FilePenIcon as CreateFileIcon, Loader2, ScissorsIcon } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ChangeEvent } from "react";
import type { FileEntry } from "../../../context/fileNamesContext";
import type { FileContentResponse } from "../types";

type FileExplorerProps = {
  activeFile: string | null;
  files: FileEntry[];
  fileData: FileContentResponse | null;
  language: string;
  setDifficultyFilter: (filter: "ALL" | "EASY" | "MEDIUM" | "HARD") => void;
  difficultyFilter: "ALL" | "EASY" | "MEDIUM" | "HARD";
  testCaseCount: number;
  sidebarWidth: number;
  onFileClick: (oid: string, name: string) => void;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onCreateFile?: (name: string) => void;
  isLoadingFiles: boolean;
  selectedMode: "files-mode" | "terminal-mode";
  setSelectedMode: (mode: "files-mode" | "terminal-mode") => void;
};

const DifficultyBadge = ({ level }: { level: string }) => {
  const colorMap: Record<string, string> = {
    H: "bg-red-500/20 text-red-400 border-red-400/25",
    M: "bg-yellow-500/20 text-yellow-400 border-yellow-400/25",
    E: "bg-green-500/20 text-green-400 border-green-400/25",
    Hard: "bg-red-500/20 text-red-400 border-red-400/25",
    Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-400/25",
    Easy: "bg-green-500/20 text-green-400 border-green-400/25",
  };

  const labelMap: Record<string, string> = {
    H: "Hard",
    M: "Medium",
    E: "Easy",
    Hard: "Hard",
    Medium: "Medium",
    Easy: "Easy",
  };

  const shortLabelMap: Record<string, string> = {
    H: "H",
    M: "M",
    E: "E",
    Hard: "H",
    Medium: "M",
    Easy: "E",
  };

  const miniColorMap: Record<string, string> = {
    H: "bg-red-500",
    M: "bg-yellow-500",
    E: "bg-green-500",
    Hard: "bg-red-500",
    Medium: "bg-yellow-500",
    Easy: "bg-green-500",
  };

  return (
    <>
      <span className={`large-badge px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${colorMap[level] || colorMap.E}`}>
        <span className="badge-text-full">{labelMap[level] || level || "Easy"}</span>
        <span className="badge-text-short">{shortLabelMap[level] || level[0] || "E"}</span>
      </span>
      <span className={`mini-badge ${miniColorMap[level] || miniColorMap.E}`} />
    </>
  );
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
  isLoadingFiles,
  selectedMode,
  setSelectedMode,
  difficultyFilter,
  setDifficultyFilter,
}: FileExplorerProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileName, setFileName] = useState("");

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
    return files.filter((file) => {
      // 1. Difficulty Level Filtering
      if (difficultyFilter !== "ALL") {
        const fileDiff = file.difficulty_level || file.diffculty_level || "E";
        const targetDiff = difficultyFilter === "EASY" ? "E" : difficultyFilter === "MEDIUM" ? "M" : "H";
        if (fileDiff !== targetDiff) {
          return false;
        }
      }

      // 2. Search Text Filtering
      if (debouncedSearch) {
        const name = file.name.toLowerCase();
        const path = file.path?.toLowerCase() ?? "";
        const type = file.type?.toLowerCase() ?? "";
        return (
          name.includes(debouncedSearch) ||
          path.includes(debouncedSearch) ||
          type.includes(debouncedSearch)
        );
      }

      return true;
    });
  }, [files, debouncedSearch, difficultyFilter]);

  const searchActive = Boolean(searchInput.trim()) || difficultyFilter !== "ALL";

  const deleteLocalFileFromStorage = (activeFileId: string) => {
    if (!activeFileId) return;
    localStorage.removeItem(`localFile:${activeFileId}`);
    window.location.reload();
  };

  const detailsPanelClass = "p-4  sidebar-details space-y-4 border-b border-[#2b2b2b] bg-[#141518] text-sm text-slate-300";
  const sidebarStyle = { "--sidebar-width": `${sidebarWidth}px` } as CSSProperties;
  
  const renderLoadingState = (label: string) => (
    <div className="flex items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
      <span>{label}</span>
    </div>
  );

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

    if (!baseName?.match(/^[a-zA-Z0-9_-]+$/)) {
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
        style={sidebarStyle}

        className="sidebar flex max-h-[42dvh] min-h-[220px] w-full flex-none flex-col overflow-y-auto border-b border-[#2b2b2b] bg-[#111214] p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-gray-300 md:h-full md:max-h-none md:min-h-0 md:w-[var(--sidebar-width)] md:border-b-0 md:border-r"
      >
        <div className="hideScrollbar">
        {/* SELECTING FILE EXPLORER OR TERMINAL MODE */}
        <div className="mb-2 grid grid-cols-1 sidebar-details mode-selector space-y-1 gap-2 px-2 text-xs uppercase tracking-widest text-slate-500 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <label htmlFor="mode-files" className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-cyan-400 cursor-pointer">
            <span className="mode-text-full">Practice files</span>
            <span className="mode-text-short">Files</span>
            <span className="mode-text-tiny">P</span>
            <input
              type="radio"
              name="mode"
              id="mode-files"
              value="files"
              checked={selectedMode === "files-mode"}
              className="ml-1 accent-cyan-400 cursor-pointer"
              onChange={handleTerminalModeChange}
            />
          </label>
          <label htmlFor="mode-terminal" className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-cyan-400 cursor-pointer">
            <span className="mode-text-full">Empty terminal</span>
            <span className="mode-text-short">Term</span>
            <span className="mode-text-tiny">E</span>
            <input
              type="radio"
              id="mode-terminal"
              name="mode"
              value="terminal"
              checked={selectedMode === "terminal-mode"}
              className="ml-1 accent-cyan-400 cursor-pointer"
              onChange={handleTerminalModeChange}
            />
          </label>
        </div>

        {selectedMode === "files-mode" ? (
          <>
            <div className="p-4 border-b border-[#2b2b2b] bg-[#16181c] relative overflow-visible rounded-xl search-container">
              <div className="space-y-3">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={sidebarWidth < 160 ? "Search..." : "Type name, path, or file type"}
                  className="w-full rounded-3xl border border-[#2f333b] bg-[#111214] px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                />

                {/* Dynamic difficulty level pills */}
                <div className="flex gap-1.5 mt-2">
                  {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((filter) => {
                    const isActive = difficultyFilter === filter;
                    const activeClasses: Record<string, string> = {
                      ALL: "bg-indigo-500/20 text-indigo-400 border-indigo-400/50 shadow-[0_0_8px_rgba(99,102,241,0.15)]",
                      EASY: "bg-green-500/20 text-green-400 border-green-400/50 shadow-[0_0_8px_rgba(34,197,94,0.15)]",
                      MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-400/50 shadow-[0_0_8px_rgba(234,179,8,0.15)]",
                      HARD: "bg-red-500/20 text-red-400 border-red-400/50 shadow-[0_0_8px_rgba(239,68,68,0.15)]",
                    };
                    const inactiveClasses = "text-slate-400 border-white/5 hover:border-white/10 hover:text-slate-300 bg-transparent";

                    return (
                      <button
                        key={filter}
                        onClick={() => setDifficultyFilter(filter)}
                        type="button"
                        className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase border tracking-wider transition-all duration-150 active:scale-95 cursor-pointer ${
                          isActive ? activeClasses[filter] : inactiveClasses
                        }`}
                      >
                        <span className="badge-text-full">{filter}</span>
                        <span className="badge-text-short">{filter === "ALL" ? "ALL" : filter[0]}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex sidebar-details items-center justify-between gap-1 text-[11px] uppercase tracking-widest text-slate-500">
                  <span>
                    {searchActive
                      ? `${filteredFiles.length}/${files.length} matches`
                      : "Type to find files"}
                  </span>
                  {searchActive && <span className="text-cyan-400">Search active</span>}
                </div>
              </div>

              {searchActive && (
                <div className="absolute sidebar-details [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-gray-300 left-4 right-4 top-full z-20 mt-3 max-h-72 overflow-y-auto rounded-3xl border border-[#2f333b] bg-[#0c1014] shadow-[0_32px_80px_rgba(0,0,0,0.55)] p-2">
                  {isLoadingFiles ? (
                    <div className="p-3">{renderLoadingState("Searching files...")}</div>
                  ) : filteredFiles.length > 0 ? (
                    <div className="space-y-1 p-1 text-sm text-slate-200">
                      {filteredFiles.map((file) => (
                        <button
                          key={file.oid || file.name}
                          type="button"
                          onClick={() => {
                            onFileClick(file.oid, file.name);
                            setSearchInput("");
                          }}
                          className="group file-button-compact flex w-full items-center justify-between gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d] cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileCode className="file-icon h-4 w-4 text-cyan-400 flex-shrink-0" />
                            <span className="file-name-text font-medium text-white truncate">{file.name}</span>
                          </div>
                          <DifficultyBadge level={file.difficulty_level || file.diffculty_level || "E"} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-slate-400">No files match your filters.</div>
                  )}
                </div>
              )}
            </div>

            {isLoadingFiles ? (
              <div className="border-b sidebar-details border-[#2b2b2b] bg-[#141518] p-4">
                {renderLoadingState("Syncing repository files...")}
              </div>
            ) : null}

            <div className={detailsPanelClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Selected file info</div>
                  <div className="text-xl font-semibold text-white break-words mt-2">
                    {activeFileEntry?.name || "No file selected"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400 font-mono">
                    {language.toUpperCase() || ""}
                  </span>
                  <DifficultyBadge level={fileData?.difficulty_level || "E"} />
                  <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400 font-mono">
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
                          <pre className="rounded bg-[#0f1114] p-3 text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed">{testCase.input ?? "-"}</pre>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Expected output</div>
                          <pre className="rounded bg-[#0f1114] p-3 text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed">{testCase.expectedOutput ?? "-"}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No test cases available for this file.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="flex sidebar-details items-center border-b border-[#2b2b2b] bg-[#16181c] p-3 sm:p-4 create-file-container">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createNewFile(e)}
                  title="Create File"
                  className="w-full rounded-lg border border-white/10 bg-[#101216] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Create file name (e.g., solution.js)"
                  aria-label="Create file name"
                />
              </div>

              <div className="p-[5px] sidebar-list-container text-sm text-slate-400 flex flex-col gap-3">
                <div className="text-xs sidebar-details font-bold uppercase tracking-widest text-end text-slate-500 mb-2">Files you have saved</div>
                <div className="flex flex-col gap-2">
                  {localFiles.length > 0 ? (
                    localFiles.map((file) => (
                      <div
                        key={file.oid}
                        role="button"
                        tabIndex={0}
                        onClick={() => onFileClick(file.oid, file.name)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onFileClick(file.oid, file.name);
                          }
                        }}
                        className="group file-button-compact flex w-full items-center justify-between gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d] cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode className="file-icon h-4 w-4 text-cyan-400 flex-shrink-0" />
                          <span className="file-name-text font-medium text-white truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.confirm(`Are you sure you want to delete ${file.name}? This action cannot be undone.`)) {
                              deleteLocalFileFromStorage(file.oid);
                            }
                          }}
                          className="ml-auto sidebar-details text-red-500 hover:text-red-700 cursor-pointer p-1"
                        >
                          <ScissorsIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500 sidebar-details">You have not saved any files yet.</div>
                  )}
                </div>

                <div className="text-xs sidebar-details font-bold uppercase tracking-widest text-end text-slate-500 mt-4 mb-2">Files from the problem repository</div>
                <div className="flex flex-col gap-2">
                  {isLoadingFiles ? (
                    renderLoadingState("Loading repository files...")
                  ) : repositoryFiles.length > 0 ? (
                    repositoryFiles.map((file) => (
                      <button
                        key={file.oid || file.name}
                        type="button"
                        onClick={() => onFileClick(file.oid, file.name)}
                        className="group file-button-compact flex w-full items-center justify-between gap-3 rounded-2xl border border-[#20252c] bg-[#13161a] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-500/30 hover:bg-[#1c232d] cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode className="file-icon h-4 w-4 text-cyan-400 flex-shrink-0" />
                          <span className="file-name-text font-medium text-white truncate">{file.name}</span>
                        </div>
                        <DifficultyBadge level={file.difficulty_level || file.diffculty_level || "E"} />
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No files available for this problem.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </aside>
      <div
        onMouseDown={onResizeStart}
        className="hidden h-full w-2 sidebar-details cursor-col-resize bg-white/10 transition-colors hover:bg-white/20 active:color-white/80 md:block"
      />
    </>
  );
};

export default FileExplorer;
