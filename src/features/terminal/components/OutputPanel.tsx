import { Loader2 } from "lucide-react";
import type { ExecutionResult, ProblemTestCase } from "../types";
import type { MouseEvent } from "react";

type OutputPanelProps = {
  isExecuting: boolean;
  isOutputActive: boolean;
  isCustomInputRun: boolean;
  output: ExecutionResult | null;
  outputHeight: number;
  outputText: string;
  testCases: ProblemTestCase[];
  customInput: string;
  customInputActive: boolean;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  setCustomInput: (value: string) => void;
  setCustomInputActive: (active: boolean) => void;
  setIsOutputActive: (active: boolean) => void;
};

const getTabClassName = (isActive: boolean) =>
  `mx-2 bg-indigo-500/10 cursor-pointer active:scale-95 transition-transform duration-100 font-semibold border-2 px-2 rounded-sm uppercase ${
    isActive ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-white/10"
  }`;

const OutputPanel = ({
  isExecuting,
  isOutputActive,
  isCustomInputRun,
  output,
  outputHeight,
  outputText,
  testCases,
  customInput,
  customInputActive,
  setCustomInput,
  setCustomInputActive,
  onResizeStart,
  setIsOutputActive,
}: OutputPanelProps) => {
  const getResultForCase = (index: number) => {
    if (isCustomInputRun) {
      return null;
    }

    return output?.details?.find((detail) => detail.testCaseIndex === index);
  };

  return (
    <>
      <div
        onMouseDown={onResizeStart}
        className="w-full h-1.5 hover:bg-indigo-500/50 cursor-row-resize transition-colors z-10"
      />
      <div
        style={{ height: `${outputHeight}px`, maxHeight: "60vh" }}
        className="flex-none bg-[#1e1e1e] border-t border-white/10 p-4 font-mono [&::-webkit-scrollbar]:[width:6px] [&::-webkit-scrollbar-track]:bg-gray-600  [&::-webkit-scrollbar-thumb]:bg-gray-300 overflow-y-auto"
      >
        <div className="text-slate-500 text-md mb-2 border-b border-white/10 pb-1 flex justify-between items-center">
        <div>
          <button onClick={() => setIsOutputActive(true)} className={getTabClassName(isOutputActive)}>
            Output
          </button>
          <button onClick={() => setIsOutputActive(false)} className={getTabClassName(!isOutputActive)}>
            Test Cases
          </button>
        </div>
          {/* button for custom input */}
        {isOutputActive ? (
          <div className="text-xs text-slate-400 space-x-2 flex items-center">
            <span>Check for custom input</span>
            <input 
              type="checkbox" 
              className="px-2 py-1 border border-white/10 rounded hover:bg-white/10 active:bg-white/20 transition-colors" 
              placeholder="Custom Input" 
              title="click for custom input" 
              checked={customInputActive}
              onChange={() => setCustomInputActive(!customInputActive)}
            />
          </div>
        ) : null}
        </div>

        {isOutputActive && customInputActive ? (
          <div className="flex flex-col gap-4">
            <textarea
              value={customInput}
              title="Enter custom input for your code here."
              onChange={(e) => setCustomInput(e.target.value)}
              className="bg-[#2d2d2d] [&&::-webkit-scrollbar]:[width:6px] [&&::-webkit-scrollbar-track]:bg-gray-600 [&&::-webkit-scrollbar-thumb]:bg-gray-300 text-slate-400 px-2 placeholder:text-slate-500 h-fit border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`Enter raw stdin exactly as your code reads it.
Examples:
- Single value: 5
- Two values: 2 7
- Array with length: 5\n1 2 3 4 5
- Array without length: 1 2 3 4 5
- Array + target: 5\n1 2 3 4 5\n3
- Matrix: 2 2\n1 2\n3 4
- String: hello`}
              rows={5}
            />
          </div>
        ) : null}

        {isExecuting ? (
          <div className="flex items-center gap-2 text-indigo-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Executing...</span>
          </div>
        ) : isOutputActive  ? (
          <pre className="whitespace-pre-wrap text-gray-300">
            {outputText || "// Output will appear here after running the code"}
          </pre>
        ) : (
          <div className="space-y-4">
            {isCustomInputRun ? (
              <div className="rounded border border-yellow-500/30 bg-yellow-950/10 p-3 text-yellow-200 text-sm">
                Custom input execution is active. Test case matches are hidden while the custom input run is shown in the Output tab.
              </div>
            ) : null}
            {testCases.length === 0 ? (
              <p className="text-slate-500">No test cases loaded.</p>
            ) : (
              testCases.map((item, index) => {
                const match = getResultForCase(index);
                const borderClassName = match
                  ? match.passed
                    ? "border-green-500"
                    : "border-red-500"
                  : "border-white/10";

                return (
                  <div key={`${item.input}-${index}`} className={`output flex border-2 flex-col p-3 rounded-md gap-2 ${borderClassName}`}>
                    <p className="border border-white/10 text-start rounded-sm p-1.5 text-sm font-medium bg-white/5">
                      <span className="text-slate-400 font-semibold">Input:</span> {item.input}
                    </p>
                    <p className="text-sm font-medium">
                      <span className="text-slate-400 font-semibold">Expected Output:</span> {item.expectedOutput}
                    </p>

                    {match && (
                      <>
                        <p className="text-sm font-medium">
                          <span className="text-slate-400 font-semibold">Actual Output:</span>{" "}
                          <span className={match.passed ? "text-green-400" : "text-red-400"}>
                            {match.output || (match.runtimeError ? "Error" : "empty")}
                          </span>
                        </p>
                        {match.runtimeError && (
                          <p className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-2 rounded whitespace-pre-wrap">
                            <span className="font-bold">Error:</span> {match.runtimeError}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default OutputPanel;
