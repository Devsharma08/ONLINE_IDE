import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { FileNamesContext } from "../context/fileNamesContext";
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
   const [language, setLanguage] = useState<SupportedLanguage>("java");
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

   // function to fetch code and test cases when a file is clicked
   const handleFileClick = useCallback(async (oid: string, name: string) => {
      setOutput(null);
      setOutputText("");
      setContextOutput(null);
      setLoading(true);
      setActiveFile(oid);

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

   // function to fetch file names
   const handleFetchFileNames = useCallback(async () => {
      try {
         const data = await fetchFileNames();
         setFilesData(data);
         setStatus("SUCCESS");
      } catch {
         setStatus("ERROR");
      }
   }, [setFilesData, setStatus]);

   useEffect(() => {
      void handleFetchFileNames();
   }, [handleFetchFileNames]);

   const handleCodeChange = useCallback((nextCode: string) => {
      setCode(nextCode);
      setContextCode(nextCode);
   }, [setContextCode]);

   const activeFileName = filesData.find((file) => file.oid === activeFile)?.name || "Editor";


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
         />

         <main className='flex-1 flex flex-col min-h-0'>
            <div className="w-full bg-[#151515] border-b border-white/10 px-4 py-2 text-sm text-slate-300">
               <span className="font-medium">Terminal Workspace</span>
            </div>

            <div className='flex-1 min-h-0 relative'>
               {loading && <LoadingOverlay />}

               <div className='absolute inset-0 flex flex-col min-h-0'>
                  {activeFile ? (
                     <>
                        <EditorToolbar
                           disabled={resLoading}
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
