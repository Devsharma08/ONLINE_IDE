import { FileCode } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { FileEntry } from "../../../context/fileNamesContext";
import type { FileContentResponse } from "../types";

type FileExplorerProps = {
  activeFile: string | null;
  files: FileEntry[];
  fileData: FileContentResponse | null;
  language: string;
  testCaseCount: number;
  sidebarWidth: number;
  onFileClick: (oid: string, name: string) => void;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
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
}: FileExplorerProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const activeFileEntry = files.find((file) => file.oid === activeFile);

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

  return (
    <>
      <aside
        style={{
          width: `${sidebarWidth}px`,
          height: "100%",
        }}
        className="h-full p-2 border-r [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-gray-300 border-[#2b2b2b] bg-[#111214] flex flex-col overflow-y-auto"
      >
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
                {language.toUpperCase()}
              </span>
              <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                {fileData?.difficulty_level || "UNKNOWN"}
              </span>
              <span className="rounded-full border border-[#20252c] bg-[#111214] px-3 py-1 text-[11px] uppercase tracking-widest text-slate-400">
                {testCaseCount} cases
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
      </aside>
      <div
        onMouseDown={onResizeStart}
        className="w-2 h-full bg-white/10 hover:bg-white/20 transition-colors active:color-white/80 cursor-col-resize"
      />
    </>
  );
};

export default FileExplorer;
