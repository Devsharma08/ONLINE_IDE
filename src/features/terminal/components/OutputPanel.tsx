import { Loader2, Check, X, AlertTriangle, Clock } from "lucide-react";
import type { ExecutionResult, ProblemTestCase } from "../types";
import type { MouseEvent } from "react";
import {Maximize2} from 'lucide-react';

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
  setOutputHeight: (height: number) => void;
  setCustomInput: (value: string) => void;
  setCustomInputActive: (active: boolean) => void;
  setIsOutputActive: (active: boolean) => void;
};

const getTabClassName = (isActive: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
    isActive
      ? "text-indigo-400 border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
      : "text-slate-400 border-white/5 bg-transparent hover:border-white/10 hover:text-slate-300"
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
  onResizeStart,
  setOutputHeight,
  setCustomInput,
  setCustomInputActive,
  setIsOutputActive,
}: OutputPanelProps) => {
  const getResultForCase = (index: number) => {
    if (isCustomInputRun) {
      return null;
    }
    return output?.details?.find((detail) => detail.testCaseIndex === index);
  };

  // Dynamically compute output status to prevent prop-drilling errors from Terminal.tsx
  const hasError = output?.details?.some((detail) => detail.runtimeError);
  const allPassed = output?.status === "PASSED" || (output?.passedCases === output?.totalCases && output?.totalCases > 0);

  // handeling maximize output panel
  const handleMaximizeOutput = () => {
    const reservedHeight = 150;
    if(outputHeight === window.innerHeight - reservedHeight) {
      setOutputHeight(200);
      return;
    }
    const maximizedHeight = Math.max(150, window.innerHeight - reservedHeight);
    setOutputHeight(maximizedHeight);
    
  };

  const outputStatus: "LOADING" | "TIMEOUT" | "RUNTIME_ERROR" | "ACCEPTED" | "WRONG_ANSWER" | "IDLE" = isExecuting
    ? "LOADING"
    : output
    ? hasError
      ? output.details?.some((d) => d.runtimeError?.toLowerCase().includes("timeout"))
        ? "TIMEOUT"
        : "RUNTIME_ERROR"
      : allPassed
      ? "ACCEPTED"
      : "WRONG_ANSWER"
    : "IDLE";

  return (
    <>
      {/* Resizer Handle */}
      <div
        onMouseDown={onResizeStart}
        className="w-full h-1.5 hover:bg-indigo-500/50 cursor-row-resize transition-all z-10 bg-white/5"
      />
      
      <div
        style={{
          height: `${outputHeight}px`,
          maxHeight: outputHeight > 600 ? "none" : "min(70vh, 600px)",
        }}
        className="flex-none overflow-y-auto border-t border-white/10 bg-[#0c0d0f] p-4 font-mono [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900/40 [&::-webkit-scrollbar-thumb]:bg-slate-700/60 sm:p-5"
      >
        {/* Navigation Tabs */}
        <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-3 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsOutputActive(true)} className={getTabClassName(isOutputActive)}>
              Console Output
            </button>
            <button onClick={() => setIsOutputActive(false)} className={getTabClassName(!isOutputActive)}>
              Test Suite Cases
            </button>
          </div>

            {/* maximize o/p pannel */}
            {!isOutputActive && (
              <button className="hover:bg-white/10 p-2 rounded-lg transition-colors" title="Maximize output panel" onClick={handleMaximizeOutput}>
                <Maximize2 className="h-3 w-3 text-slate-400" />
              </button>
            )}
          {isOutputActive ? (
            <div className="flex items-center gap-4">
              <button className="hover:bg-white/10 p-2 rounded-lg transition-colors" title="Maximize output panel" onClick={handleMaximizeOutput}>
                <Maximize2 className="h-3 w-3 text-slate-400" />
              </button>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.05] transition-all">
              
              <span>Custom Input Parameters</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-500 rounded cursor-pointer"
                title="Toggle custom stdin input"
                checked={customInputActive}
                onChange={() => setCustomInputActive(!customInputActive)}
              />
            </label>
            </div>
          ) : null}
        </div>

        {/* Custom Input Textarea */}
        {isOutputActive && customInputActive ? (
          <div className="mb-4 flex flex-col gap-2">
            <textarea
              value={customInput}
              title="Enter custom stdin"
              onChange={(e) => setCustomInput(e.target.value)}
              className="h-28 rounded-xl border border-white/10 bg-[#14161a] p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all [&&::-webkit-scrollbar]:w-1.5 [&&::-webkit-scrollbar-thumb]:bg-slate-700"
              placeholder={`Enter custom stdin parameters. Example:
5
1 2 3 4 5
3`}
              rows={4}
            />
          </div>
        ) : null}

        {/* Execution Output Panel */}
        {isExecuting ? (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-indigo-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-sm font-semibold tracking-wide">Executing your solution in Docker sandbox...</span>
          </div>
        ) : isOutputActive ? (
          <div className="space-y-4">
            {/* Elegant Top Status Banner */}
            {outputStatus !== "IDLE" && (
              <div
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border p-4 shadow-lg ${
                  outputStatus === "ACCEPTED"
                    ? "border-emerald-500/20 bg-emerald-500/[0.03] text-emerald-400"
                    : outputStatus === "WRONG_ANSWER"
                    ? "border-rose-500/20 bg-rose-500/[0.03] text-rose-400"
                    : outputStatus === "TIMEOUT"
                    ? "border-amber-500/20 bg-amber-500/[0.03] text-amber-400"
                    : "border-rose-500/20 bg-rose-500/[0.03] text-rose-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  {outputStatus === "ACCEPTED" ? (
                    <div className="bg-emerald-500/10 p-2 rounded-xl">
                      <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : outputStatus === "TIMEOUT" ? (
                    <div className="bg-amber-500/10 p-2 rounded-xl">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                  ) : (
                    <div className="bg-rose-500/10 p-2 rounded-xl">
                      <X className="w-5 h-5 text-rose-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-base font-bold tracking-tight">
                      {outputStatus === "ACCEPTED"
                        ? "Accepted"
                        : outputStatus === "WRONG_ANSWER"
                        ? "Wrong Answer"
                        : outputStatus === "TIMEOUT"
                        ? "Time Limit Exceeded"
                        : "Runtime Execution Error"}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {isCustomInputRun
                        ? "Custom input execution complete."
                        : `Passed ${output?.passedCases || 0} of ${output?.totalCases || 0} test cases.`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Raw Console Console */}
            <div className="rounded-2xl border border-white/5 bg-[#111215] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-white/5 pb-1">
                Standard Output Console
              </div>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-sm text-slate-300 leading-relaxed font-mono">
                {outputText || "// Console logs and execution output will appear here"}
              </pre>
            </div>

            {/* Side-by-Side Diff Viewer for First Failed Case */}
            {outputStatus === "WRONG_ANSWER" && output?.details && (
              <div className="rounded-2xl border border-rose-500/10 bg-[#161314]/20 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Mismatched Output (Test Case {output.details.findIndex(d => !d.passed) + 1})
                </div>

                {/* Grid Comparison */}
                {(() => {
                  const failedCase = output.details.find((d) => !d.passed);
                  if (!failedCase) return null;

                  return (
                    <div className="space-y-3">
                      {failedCase.problemId && (
                        <div className="rounded-lg bg-black/40 border border-white/5 p-3 text-xs">
                          <span className="text-slate-500 font-semibold uppercase tracking-wider mr-2">Input:</span>
                          <span className="text-slate-300 whitespace-pre-wrap">{failedCase.expectedOutput ? testCases[failedCase.testCaseIndex]?.input : "-"}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Actual Output */}
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.02] p-3.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            Your Output
                          </div>
                          <pre className="rounded bg-black/40 border border-rose-500/10 p-3 text-sm text-rose-200 whitespace-pre-wrap break-words leading-relaxed font-mono">
                            {failedCase.output || "empty"}
                          </pre>
                        </div>

                        {/* Expected Output */}
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-3.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Expected Output
                          </div>
                          <pre className="rounded bg-black/40 border border-emerald-500/10 p-3 text-sm text-emerald-200 whitespace-pre-wrap break-words leading-relaxed font-mono">
                            {failedCase.expectedOutput || "empty"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          /* Test Suite Cases Tab */
          <div className="space-y-4">
            {isCustomInputRun ? (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-950/5 p-4 text-yellow-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>Custom input execution is active. Test case suite comparisons are hidden.</span>
              </div>
            ) : null}
            
            {testCases.length === 0 ? (
              <p className="text-slate-600 text-sm">No structured test cases available for this file.</p>
            ) : (
              testCases.map((item, index) => {
                const match = getResultForCase(index);
                const borderClassName = match
                  ? match.passed
                    ? "border-emerald-500/30 bg-emerald-500/[0.01]"
                    : "border-rose-500/30 bg-rose-500/[0.01]"
                  : "border-white/5 bg-[#111215]/50";

                return (
                  <div key={`${item.input}-${index}`} className={`flex flex-col border rounded-xl p-4 gap-3 transition-all ${borderClassName}`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Case {index + 1}
                      </span>
                      {match && (
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          match.passed
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            : "text-rose-400 border-rose-500/20 bg-rose-500/10"
                        }`}>
                          {match.passed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Input parameters</div>
                        <pre className="rounded-lg bg-black/35 border border-white/5 p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{item.input ?? "-"}</pre>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Expected return value</div>
                        <pre className="rounded-lg bg-black/35 border border-white/5 p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{item.expectedOutput ?? "-"}</pre>
                      </div>
                    </div>

                    {match && (
                      <div className="border-t border-white/5 pt-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Execution Return Results</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Actual return value */}
                          <div className={`rounded-xl border p-3 ${
                            match.passed ? "border-emerald-500/10 bg-emerald-500/[0.01]" : "border-rose-500/10 bg-rose-500/[0.01]"
                          }`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Actual Output</div>
                            <pre className={`rounded-lg bg-black/40 p-2.5 text-xs whitespace-pre-wrap font-mono ${
                              match.passed ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              {match.output || (match.runtimeError ? "Compilation/Runtime Error" : "empty")}
                            </pre>
                          </div>

                          {/* Error block if any */}
                          {match.runtimeError && (
                            <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3 flex flex-col justify-center">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">Sandbox System Trace</div>
                              <pre className="rounded-lg bg-black/40 p-2.5 text-xs text-rose-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                                {match.runtimeError}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
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
