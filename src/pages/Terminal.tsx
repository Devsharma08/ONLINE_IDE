import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileNamesContext, type FileEntry } from "../context/fileNamesContext";
import { CodeContext } from "../context/codeContext";
import { UserResponseContext } from "../context/responseContent";
import { executeCode, fetchFileContent, fetchFileNames } from "../features/terminal/api";
import EditorToolbar from "../features/terminal/components/EditorToolbar";
import EmptyTerminalState from "../features/terminal/components/EmptyTerminalState";
import FileExplorer from "../features/terminal/components/FileExplorer";
import LoadingOverlay from "../features/terminal/components/LoadingOverlay";
import MonacoIDE from "../features/terminal/components/MonacoIDE";
import OutputPanel from "../features/terminal/components/OutputPanel";
import {
   buildProblemTestCases,
   detectLanguageFromFileName,
   formatExecutionOutput,
} from "../features/terminal/executionOutput";
import { useTerminalLayout } from "../features/terminal/hooks/useTerminalLayout";
import type { ExecutionMode, ExecutionResult, FileContentResponse, ProblemTestCase, SupportedLanguage } from "../features/terminal/types";
import { usePreventTabClose } from '../utils/terminalUtils/HandleWindowClose'
const LOCAL_FILE_ID_PREFIX = "local-";
const LOCAL_FILE_STORAGE_PREFIX = "localFile:";
const NEW_TEMP_LOCAL_STORAGE_KEY = "newLocalFileContent#";

const getLocalStorageKey = (oid: string) => `${LOCAL_FILE_STORAGE_PREFIX}${oid}`;
const isLocalFile = (oid: string | null): boolean => Boolean(oid && oid.startsWith(LOCAL_FILE_ID_PREFIX));



const readLocalFile = (oid: string) => {
   const raw = localStorage.getItem(getLocalStorageKey(oid));
   if (!raw) return null;
   try {
      return JSON.parse(raw) as { name: string; content: string; language: SupportedLanguage; createdAt: number; updatedAt: number };
   } catch {
      return null;
   }
};

const Terminal = () => {
   const [searchParams] = useSearchParams();
   const queryFile = searchParams.get("file");
   const [code, setCode] = useState<string>("");
   const [language, setLanguage] = useState<SupportedLanguage>("");
   const [loading, setLoading] = useState<boolean>(false);
   const [filesLoading, setFilesLoading] = useState<boolean>(true);
   const [activeFile, setActiveFile] = useState<string | null>(null);
   const [isExecuting, setIsExecuting] = useState(false);
   const [executingMode, setExecutingMode] = useState<ExecutionMode | null>(null);
   const [outputText, setOutputText] = useState<string>("");
   const [outputStatus, setOutputStatus] = useState<"RUNTIME_ERROR" | "SUCCESS" | "ERROR" | "LOADING" | "TIMEOUT" | null>(null);
   const [output, setOutput] = useState<ExecutionResult | null>(null);
   const [resLoading, setResponseLoading] = useState<boolean>(false);
   const [customInput, setCustomInput] = useState<string>("");
   const [customInputActive, setCustomInputActive] = useState<boolean>(false);
   const [isCustomInputRun, setIsCustomInputRun] = useState<boolean>(false);

   
   // local file content
   const [checkFileExists, setCheckFileExists] = useState<boolean>(false);
   
   usePreventTabClose(true);
   useEffect(() => {
      if (!activeFile) {
         setCheckFileExists(false);
         return;
      }
      const key = getLocalStorageKey(activeFile); 
      const exists = isLocalFile(key) ? Boolean(readLocalFile(activeFile)) : true;
      setCheckFileExists(exists);
   },[activeFile]);
   

   // selection b/w output or test cases
   const [isOutputActive, setIsOutputActive] = useState<boolean>(true);

   // testcases
   const [testCases, setTestCases] = useState<ProblemTestCase[]>([]);
   const [fileData, setFileData] = useState<FileContentResponse | null>(null);

   // terminal mode 
   const [selectedMode, setSelectedMode] = useState<"files-mode" | "terminal-mode">("terminal-mode");
   const [dismissRotationAlert, setDismissRotationAlert] = useState<boolean>(false);

   const {
      outputHeight,
      sidebarWidth,  
      setOutputHeight,
      startOutputDragging,
      startSidebarDragging,
      setSidebarWidth,
   } = useTerminalLayout();

   // context states
   const {
      filesData,
      setFilesData
   } = useContext(FileNamesContext);
   
   const { setStatus } = useContext(UserResponseContext);
   const {
      setCode: setContextCode,
      setLanguage: setContextLanguage,
      setTestCases: setContextTestCases,
      setActiveFile: setContextActiveFile,
      setOutput: setContextOutput,
      setCustomInput: setContextCustomInput,
      setCustomInputActive: setContextCustomInputActive,
   } = useContext(CodeContext);
   
   const executeCache = useRef<Map<string, ExecutionResult>>(new Map());
   const formatEditorRef = useRef<(() => void) | null>(null);

   // filter files accoring to difficulty level
   const [difficultyFilter, setDifficultyFilter] = useState<"ALL" | "EASY" | "MEDIUM" | "HARD">("ALL");

   const fetchFileCode = async (oid: string) => {
      try {
         const response = await fetchFileContent(oid);
         const { content, language } = response.data;
         setContextCode(content);
         setContextLanguage(language);
      } catch (error) {
         // console.log(error);
      }
   }
   
   // move to previous file state 
   const checkIfFileIdInLocalStorage = useCallback((oid: string | null): boolean => {
      if (!oid) return false;
      if(oid.startsWith(LOCAL_FILE_ID_PREFIX)) {
         const localFile = readLocalFile(oid);
         return Boolean(localFile);
      }
      return false;
   },[]);

    const handleResetCode = useCallback(async () => {
       if (!activeFile) return;

       if (isLocalFile(activeFile)) {
          // Reset local file to empty string template
          const localKey = getLocalStorageKey(activeFile);
          const existing = readLocalFile(activeFile);
          if (existing) {
             localStorage.setItem(
                localKey,
                JSON.stringify({
                   ...existing,
                   content: "",
                   updatedAt: Date.now(),
                })
             );
          }
          setCode("");
          setContextCode("");
       } else {
          // Seed/Repository file - Re-fetch clean template from backend
          setLoading(true);
          try {
             const fileContent = await fetchFileContent(activeFile);
             const nextCode = fileContent.content || "";
             setCode(nextCode);
             setContextCode(nextCode);
          } catch (error) {
             console.error("Failed to reset template:", error);
          } finally {
             setLoading(false);
          }
       }
    }, [activeFile, setContextCode]);


   const createFileInLocalStorage = useCallback((name: string, language: SupportedLanguage): string => {
      if(checkIfFileIdInLocalStorage(activeFile)) {
         const oid = `${LOCAL_FILE_ID_PREFIX}${crypto.randomUUID?.() ?? Date.now().toString()}`;
         const localFile = {
            name,
            content: "",
            language,
            createdAt: Date.now(),
            updatedAt: Date.now(),
         };
         localStorage.setItem(getLocalStorageKey(oid), JSON.stringify(localFile));
         return oid;
      }
   },[activeFile,checkIfFileIdInLocalStorage])
   

   const handleFormatCode = useCallback(() => {
      formatEditorRef.current?.();
   }, []);
   
   const saveLocalFileContent = useCallback((oid: string, content: string) => {
      const existing = readLocalFile(oid);
      if (!existing) return;
      localStorage.setItem(
         getLocalStorageKey(oid),
         JSON.stringify({
            ...existing,
            content,
            updatedAt: Date.now(),
         }),
      );
   }, []);
   
   // console.log("activeFile", activeFile, fileData);

   const handleFileClick = useCallback(async (oid: string, name: string) => {
      setOutput(null);
      setOutputText("");
      setOutputStatus('LOADING');
      setContextOutput(null);
      setActiveFile(oid);
      setLoading(!isLocalFile(oid));

      if (isLocalFile(oid)) {
         const localFile = readLocalFile(oid);
         const nextLanguage = localFile?.language ?? detectLanguageFromFileName(name);
         const nextCode = localFile?.content ?? "";

         setFileData({
            content: nextCode,
            test_cases: [],
            id: oid,
            problem_definition: "",
            difficulty_level: "",
         });
         setTestCases([]);
         setLanguage(nextLanguage);
         setCode(nextCode);
         setContextCode(nextCode);
         setContextLanguage(nextLanguage);
         setContextTestCases([]);
         setContextActiveFile(oid);
         setCustomInput("");
         setContextCustomInput("");
         setCustomInputActive(false);
         setContextCustomInputActive(false);
         setIsCustomInputRun(false);
         setLoading(false);
         return;
      }

      try {
         const fileContent = await fetchFileContent(oid);
         const nextTestCases = buildProblemTestCases(fileContent);
         const nextLanguage = detectLanguageFromFileName(name);
         const nextCode = fileContent.content || "";

         setFileData(fileContent);
         setTestCases(nextTestCases);
         setLanguage(nextLanguage);
         setCode(nextCode);
         setContextCode(nextCode);
         setContextLanguage(nextLanguage);
         setContextTestCases(nextTestCases);
         setContextActiveFile(oid);
         setCustomInput("");
         setContextCustomInput("");
         setCustomInputActive(false);
         setContextCustomInputActive(false);
         setIsCustomInputRun(false);
      } catch {
         setFileData(null);
         setCode("error some thing wen't wrong");
         setStatus("ERROR");
      }
      finally {
         setLoading(false);
      }
   }, [setContextActiveFile, setContextCode, setContextCustomInput, setContextCustomInputActive, setContextLanguage, setContextOutput, setContextTestCases, setIsCustomInputRun, setStatus]);


   // function to run the code 
   const handleRunCode = useCallback(async (nextCode: string, nextLanguage: SupportedLanguage, oid: string, mode: ExecutionMode = "RUN") => {
      const customInputValue = customInputActive ? customInput.trim() : "";
      const isCustomExecution = customInputValue.length > 0;
      setIsCustomInputRun(isCustomExecution);
      const cacheKey = `${oid}-${nextLanguage}-${mode}-${nextCode}-${customInputValue}`;
      const cached = executeCache.current.get(cacheKey);
      if (cached) {
         setOutput(cached);
         setContextOutput(cached);
         setStatus("SUCCESS");
         setOutputText(formatExecutionOutput(cached, mode));
         setOutputStatus(cached.status === "success" ? "SUCCESS" : cached.status === "runtime_error" ? "RUNTIME_ERROR" : "ERROR");
         return;
      }

      setResponseLoading(true);
      setIsExecuting(true);
      setExecutingMode(mode);
      setStatus("LOADING");
      setOutputStatus("LOADING");

      try {
         const data = await executeCode({ code: nextCode, language: nextLanguage, oid, mode, customInput: customInputValue });
         executeCache.current.set(cacheKey, data);
         setOutput(data);
         setContextOutput(data);
         setStatus("SUCCESS");
         setOutputText(formatExecutionOutput(data, mode));
      } catch (error) {
         const message = error instanceof Error ? error.message : "something went wrong";
         setOutputText(`ERROR: ${message}`);
         setOutput(null);
         setStatus("ERROR");
      } finally {
         setIsExecuting(false);
         setExecutingMode(null);
         setResponseLoading(false);
         setCustomInput("");
         setContextCustomInput("");
         if (!isCustomExecution) {
            setIsCustomInputRun(false);
         }
      }
   }, [customInput, customInputActive, setContextOutput, setContextCustomInput, setIsCustomInputRun, setStatus]);

   // console.log("fileData", fileNamesData);

   const loadLocalFiles = useCallback(() => {
      const localFiles: FileEntry[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
         const key = localStorage.key(index);
         if (!key?.startsWith(LOCAL_FILE_STORAGE_PREFIX)) continue;

         const raw = localStorage.getItem(key);
         if (!raw) continue;

         try {
            const parsed = JSON.parse(raw) as { name: string; content: string; language: SupportedLanguage };
            const oid = key.replace(LOCAL_FILE_STORAGE_PREFIX, "");
            localFiles.push({
               name: parsed.name,
               oid,
               type: parsed.language === "java" ? "text/java" : "text/javascript",
               isLocal: true,
            });
         } catch {
            // ignore invalid local file entries
         }
      }
      return localFiles;
   }, []);

   useEffect(() => {      
      if (activeFile && isLocalFile(activeFile)) {
         const localFile = readLocalFile(activeFile);
         if (localFile) {
            localStorage.setItem(getLocalStorageKey(activeFile), JSON.stringify({
               ...localFile,
               content: code,
               updatedAt: Date.now(),
            }));
         }
      }
   }, [code]);

   useEffect(() => {
      let cancelled = false;
      setOutputStatus(null);

      const loadFileNames = async () => {
         await Promise.resolve();
         const localFiles = loadLocalFiles();
         if (cancelled) return;

         setFilesLoading(true);
         setFilesData(localFiles);
         setStatus("LOADING");

         try {
            const data = await fetchFileNames();
            if (cancelled) return;
            setFilesData([...localFiles, ...data]);
            setStatus("SUCCESS");
         } catch {
            if (cancelled) return;
            setFilesData(localFiles);
            setStatus("ERROR");
         } finally {
            if (!cancelled) {
               setFilesLoading(false);
            }
         }
      };

      void loadFileNames();

      return () => {
         cancelled = true;
      };
   }, [loadLocalFiles, setFilesData, setStatus]);

   useEffect(() => {
      if (!filesLoading && filesData.length > 0 && queryFile) {
         const matched = filesData.find(
            (file) => file.name.toLowerCase() === queryFile.toLowerCase() || file.oid === queryFile
         );
         if (matched && activeFile !== matched.oid) {
            void handleFileClick(matched.oid, matched.name);
         }
      }
   }, [filesLoading, filesData, queryFile, activeFile, handleFileClick]);

   // console.log("filesData", filesData);

   const handleCodeChange = useCallback((nextCode: string) => {
      setCode(nextCode);
      setContextCode(nextCode);
   }, [setContextCode]);

   useEffect(() => {
      if (!activeFile || !isLocalFile(activeFile)) {
         return;
      }

      const timeoutId = window.setTimeout(() => {
         saveLocalFileContent(activeFile, code);
      }, 200);

      return () => window.clearTimeout(timeoutId);
   }, [activeFile, code, saveLocalFileContent]);

   const activeFileName = filesData.find((file) => file.oid === activeFile)?.name || "Editor";

   const handleCreateLocalFile = (name: string) => {
      const normalizedName = name.trim();
      const languageFromName = detectLanguageFromFileName(normalizedName);
      const oid = `${LOCAL_FILE_ID_PREFIX}${crypto.randomUUID?.() ?? Date.now().toString()}`;
      const localFile = {
         name: normalizedName,
         content: "",
         language: languageFromName,
         createdAt: Date.now(),
         updatedAt: Date.now(),
      };

      localStorage.setItem(getLocalStorageKey(oid), JSON.stringify(localFile));
      setFilesData([
         ...filesData,
         {
            name: normalizedName,
            oid,
            type: languageFromName === "java" ? "text/java" : "text/javascript",
            isLocal: true,
         },
      ]);

      setActiveFile(oid);
      setFileData({
         content: "",
         test_cases: [],
         id: oid,
         problem_definition: "",
         difficulty_level: "",
      });
      setTestCases([]);
      setLanguage(languageFromName);
      setCode("");
      setContextCode("");
      setContextLanguage(languageFromName);
      setContextTestCases([]);
      setContextActiveFile(oid);
      setCustomInput("");
      setContextCustomInput("");
      setCustomInputActive(false);
      setContextCustomInputActive(false);
      setIsCustomInputRun(false);
   };

   return (
      <div className='flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#08090a] fui-grid-bg text-white md:flex-row'>
         <FileExplorer
            activeFile={activeFile}
            files={filesData}
            difficultyFilter={difficultyFilter}
            setDifficultyFilter={setDifficultyFilter}
            fileData={fileData}
            language={language}
            testCaseCount={testCases.length}
            onFileClick={handleFileClick}
            onResizeStart={startSidebarDragging}
            sidebarWidth={sidebarWidth}
            onCreateFile={handleCreateLocalFile}
            isLoadingFiles={filesLoading}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
         />

         <main className='flex min-h-0 min-w-0 flex-1 flex-col bg-black/40'>
            <div className="flex w-full items-center justify-between gap-3 border-b border-white/5 bg-[#0b0c0e] px-3 py-2 text-xs font-mono text-cyan-400/80 sm:px-4">
               <span>SYS // TERMINAL_WORKSPACE</span>
               <span className="truncate text-slate-500 uppercase">{filesLoading ? "SYNCING..." : activeFileName}</span>
            </div>

            <div className='flex-1 min-h-0 relative'>
               {loading && <LoadingOverlay label="Loading file content..." />}

               <div className='absolute inset-0 flex flex-col min-h-0'>
                  {activeFile ? (
                     <>
                        <EditorToolbar
                           activeFile={activeFile}
                           disabled={resLoading}
                           executingMode={executingMode}
                           language={language}
                           setLanguage={setLanguage}
                           sidebarWidth={sidebarWidth}
                           setSidebarWidth={setSidebarWidth}
                           setCode={setCode}
                           fileName={activeFileName}
                           onRun={() => void handleRunCode(code, language, activeFile, "RUN")}
                           onSubmit={() => void handleRunCode(code, language, activeFile, "SUBMIT")}
                           onFormat={handleFormatCode}
                           onReset={handleResetCode}
                        />

                        <div className='flex-1 min-h-0 grid' style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}>
                           <div className="min-h-0 overflow-hidden">
                              <MonacoIDE
                                 handleRunCode={handleRunCode}
                                 language={language}
                                 code={code}
                                 
                                 oid={activeFile}
                                 onCodeChange={handleCodeChange}
                                 onFormatMount={(formatAction) => {
                                    formatEditorRef.current = formatAction;
                                 }}
                              />
                           </div>

                           <OutputPanel
                              isExecuting={isExecuting}
                              isOutputActive={isOutputActive}
                              output={output}
                              outputHeight={outputHeight}
                              setOutputHeight={setOutputHeight}
                              outputText={outputText}
                              testCases={testCases}
                              customInput={customInput}
                              customInputActive={customInputActive}
                              isCustomInputRun={isCustomInputRun}
                              setCustomInput={setCustomInput}
                              setCustomInputActive={setCustomInputActive}
                              onResizeStart={startOutputDragging}
                              setIsOutputActive={setIsOutputActive}
                           />
                        </div>
                     </>
                  ) : (
                     <EmptyTerminalState />
                  )}
               </div>
            </div>
         </main>

         {/* ⚠️ FUI Dynamic Portrait Layout Rotation Warning Overlay */}
         {!dismissRotationAlert && (
            <div className="portrait-rotate-warning fixed inset-0 z-[9999] hidden flex-col items-center justify-center bg-[#08090a]/90 p-6 text-center font-mono backdrop-blur-md select-none">
               {/* Styling animations and media queries */}
               <style dangerouslySetInnerHTML={{__html: `
                  @keyframes portraitDeviceRotate {
                     0%, 100% {
                        transform: rotate(0deg);
                     }
                     40%, 60% {
                        transform: rotate(90deg);
                     }
                  }
                  .animate-portrait-rotate {
                     animation: portraitDeviceRotate 3.5s ease-in-out infinite;
                  }
                  @media (max-width: 767px) and (orientation: portrait) {
                     .portrait-rotate-warning {
                        display: flex !important;
                     }
                  }
               `}} />

               {/* Ambient glowing border box */}
               <div className="relative max-w-sm rounded-none border border-cyan-500/30 bg-[#0c0d10] p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center text-center">
                  
                  {/* Cyber corner L-brackets */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400"></div>

                  {/* Rotating device visual animation */}
                  <div className="w-16 h-16 rounded-none bg-cyan-950/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 relative overflow-hidden">
                     <svg 
                        className="w-8 h-8 animate-portrait-rotate" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                     >
                        <rect x="5" y="2" width="14" height="20" rx="2" className="origin-center" />
                        <path d="M12 18h.01" />
                     </svg>
                  </div>

                  {/* Warning headers */}
                  <span className="text-[10px] text-cyan-400/60 font-bold tracking-[0.25em] mb-2 uppercase select-none">
                     // SYS // PORTRAIT_LAYOUT_DETECTED
                  </span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 leading-relaxed">
                     Rotate Device for Landscape Workspace
                  </h3>
                  
                  {/* Details */}
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase mb-6 tracking-wide">
                     The Monaco Editor and telemetry consoles require a horizontal layout to display constraints, codes, and test cases side-by-side. Please rotate your device.
                  </p>

                  {/* Snappy action button to bypass */}
                  <button
                     onClick={() => setDismissRotationAlert(true)}
                     className="group relative inline-flex items-center justify-center gap-2 border border-cyan-500/35 bg-cyan-950/10 hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-950/20 py-2.5 px-5 font-mono text-[10px] font-bold tracking-[0.15em] text-cyan-400 transition-all duration-300 cursor-pointer select-none rounded-none w-full"
                  >
                     <span>[ CONTINUE_IN_PORTRAIT ]</span>
                  </button>
               </div>
            </div>
         )}
      </div>
   );

}

export default Terminal;
