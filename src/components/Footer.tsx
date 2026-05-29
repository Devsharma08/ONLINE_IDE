import { IceCream as Github,Table as Twitter } from 'lucide-react'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <footer className="w-full border-t border-white/5 bg-black/40 backdrop-blur-md mt-auto relative z-10 font-mono text-xs">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <span className="text-sm font-bold tracking-widest text-white">
            BRACE // <span className="text-cyan-400">RCE</span>
          </span>
          <p className="text-[10px] text-slate-500 mt-1 uppercase">
            BRIDGING_THE_GAP_BETWEEN_LEARNING_AND_DOING
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-6">
          <Link to="/" className="text-slate-400 hover:text-cyan-400 transition-colors uppercase">[ HOME ]</Link>
          <Link to="/about" className="text-slate-400 hover:text-cyan-400 transition-colors uppercase">[ ABOUT ]</Link>
          <a href="https://github.com/Devsharma08/DSA-LEETCODE" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-cyan-400 transition-colors uppercase">[ REPOSITORY ]</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com/Devsharma08/DSA-LEETCODE" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-cyan-400 transition-colors">
            <span className="sr-only">GitHub</span>
            <Github className="w-4 h-4" />
          </a>
          <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">
            <span className="sr-only">Twitter</span>
            <Twitter className="w-4 h-4" />
          </a>
        </div>
      </div>
      
      <div className="w-full border-t border-white/5 py-4 text-center">
        <p className="text-[9px] text-slate-600 uppercase">
          &copy; {new Date().getFullYear()} BRACERCE. OPEN_SOURCE // BUILT_FOR_DEVELOPERS.
        </p>
      </div>
    </footer>
  )
}

export default Footer
