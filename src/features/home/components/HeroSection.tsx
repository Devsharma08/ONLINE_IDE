import { ChevronRight, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <div className="z-10 flex min-h-[72vh] w-full max-w-4xl flex-col items-center justify-center pb-16 text-center sm:min-h-[80vh] sm:pb-20 font-mono">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border border-cyan-500/20 bg-cyan-950/5 text-xs text-cyan-400 uppercase tracking-wider mb-8">
        <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping"></span>
        SYS // LIVE_DSA_RUNTIME_SOLUTIONS
      </div>

      <h1 className="mb-6 bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent drop-shadow-sm sm:text-5xl md:text-6xl uppercase">
        MASTER_ALGORITHMS <br />
        <span className="bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">ONE_FILE_AT_A_TIME</span>
      </h1>

      <p className="mb-10 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm uppercase tracking-wide">
        Explore a carefully curated collection of Data Structures and Algorithms solutions. Browse the monospaced file tree, analyze structural complexity, and run compilations inside sandboxed system runtimes.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Link
          to="/terminal"
          className="group relative px-6 py-2.5 border border-cyan-500/30 bg-cyan-950/10 hover:border-cyan-400 hover:bg-cyan-950/20 text-cyan-400 font-bold transition-all duration-300 flex items-center justify-center gap-2"
        >
          <span>[ BROWSE_WORKSPACE ]</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>

        <button className="px-6 py-2.5 border border-white/5 bg-black/40 hover:border-white/10 text-slate-400 hover:text-slate-200 font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer">
          <GitBranch className="w-3.5 h-3.5 text-slate-500" />
          <span>[ VIEW_SOURCE ]</span>
        </button>
      </div>
    </div>
  );
};

export default HeroSection;
