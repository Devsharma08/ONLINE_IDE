import { useState, useEffect, useCallback, useContext, useRef } from "react";
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

const Terminal = () => {
   const [code, setCode] = useState<string>("");
   const [language, setLanguage] = useState<SupportedLanguage>("");
   const [loading, setLoading] = useState<boolean>(false);
   const [activeFile, setActiveFile] = useState<string | null>(null);
   const [isExecuting, setIsExecuting] = useState(false);
   const [outputText, setOutputText] = useState<string>("");
   const [output, setOutput] = useState<ExecutionResult | null>(null);
   const [resLoading, setResponseLoading] = useState<boolean>(false);
   const [customInput, setCustomInput] = useState<string>("");
   const [customInputActive, setCustomInputActive] = useState<boolean>(false);
   const [isCustomInputRun, setIsCustomInputRun] = useState<boolean>(false);
   

   // selection b/w output or test cases
   const [isOutputActive, setIsOutputActive] = useState<boolean>(true);

   // testcases
   const [testCases, setTestCases] = useState<ProblemTestCase[]>([]);
   const [fileData, setFileData] = useState<FileContentResponse | null>(null);

   // terminal mode 
   const [selectedMode, setSelectedMode] = useState<"files-mode" | "terminal-mode">("terminal-mode");

   const {
      outputHeight,
      sidebarWidth,
      startOutputDragging,
      startSidebarDragging,
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
   const LOCAL_FILE_ID_PREFIX = "local-";
   const LOCAL_FILE_STORAGE_PREFIX = "localFile:";

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


   const handleFileClick = useCallback(async (oid: string, name: string) => {
      setOutput(null);
      setOutputText("");
      setContextOutput(null);
      setLoading(true);
      setActiveFile(oid);

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
         return;
      }

      setResponseLoading(true);
      setIsExecuting(true);
      setStatus("LOADING");

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
         setResponseLoading(false);
         setCustomInput("");
         setContextCustomInput("");
         if (!isCustomExecution) {
            setIsCustomInputRun(false);
         }
      }
   }, [customInput, customInputActive, setContextOutput, setContextCustomInput, setIsCustomInputRun, setStatus]);

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

   // function to fetch file names
   const handleFetchFileNames = useCallback(async () => {
      const localFiles = loadLocalFiles();
      try {
         const data = await fetchFileNames();
         setFilesData([...localFiles, ...data]);
         setStatus("SUCCESS");
      } catch {
         setFilesData(localFiles);
         setStatus("ERROR");
      }
   }, [loadLocalFiles, setFilesData, setStatus]);

   useEffect(() => {
      void handleFetchFileNames();
   }, [handleFetchFileNames]);

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
      <div className='flex h-screen min-h-screen bg-[#1e1e1e] text-white'>
         <FileExplorer
            activeFile={activeFile}
            files={filesData}
            fileData={fileData}
            language={language}
            testCaseCount={testCases.length}
            onFileClick={handleFileClick}
            onResizeStart={startSidebarDragging}
            sidebarWidth={sidebarWidth}
            onCreateFile={handleCreateLocalFile}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
         />

         <main className='flex-1 flex flex-col min-h-0'>
            <div className="w-full bg-[#151515] border-b border-white/10 px-4 py-2 text-sm text-slate-300">
               <span className="font-medium">Terminal Workspace</span>
            </div>

            <div className='flex-1 min-h-0 relative'>
               {loading && <LoadingOverlay />}

               <div className='absolute inset-0 flex flex-col min-h-0'>
                  {!!activeFile ? (
                     <>
                        <EditorToolbar
                           activeFile={activeFile}
                           disabled={resLoading}
                           language={language}
                           setLanguage={setLanguage}
                           fileName={activeFileName}
                           onRun={() => void handleRunCode(code, language, activeFile, "RUN")}
                           onSubmit={() => void handleRunCode(code, language, activeFile, "SUBMIT")}
                        />

                        <div className='flex-1 min-h-0 grid' style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}>
                           <div className="min-h-0 overflow-hidden">
                              <MonacoIDE
                                 handleRunCode={handleRunCode}
                                 language={language}
                                 code={code}
                                 oid={activeFile}
                                 onCodeChange={handleCodeChange}
                              />
                           </div>

                           <OutputPanel
                              isExecuting={isExecuting}
                              isOutputActive={isOutputActive}
                              output={output}
                              outputHeight={outputHeight}
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
      </div>
   );

}

export default Terminal;
