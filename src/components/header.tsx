import { useState } from 'react'
import { MenuIcon, Terminal, IdCardLanyard, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UseHeadroom } from '../utils/styles/headRoom'

const Header = () => {
   const direction = UseHeadroom();
   const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className={`fixed top-0 right-0 left-0 z-50 backdrop-blur-md backdrop-saturate-150 py-4 px-6 w-full shadow-none bg-black/60 border-b border-white/5 font-mono text-xs transition-transform duration-100 ${direction === 'down' ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className='flex items-center max-w-7xl mx-auto justify-between'>
         <Link to="/" onClick={() => setIsMenuOpen(false)} className='flex items-center gap-2.5 group'>
            <div className='border border-cyan-500/30 bg-cyan-950/10 p-2 rounded-none transition-all duration-300 group-hover:border-cyan-400 group-hover:bg-cyan-950/20'>
               <Terminal className='w-4 h-4 text-cyan-400' />
            </div>
            <span className='text-sm uppercase tracking-widest text-white font-bold'>
               BRACE // <span className='text-cyan-400'>RCE</span>
            </span>
         </Link>
                 <div className='hidden wmd:flex items-center space-x-6'>
            <Link to="/terminal" className='text-slate-400 hover:text-cyan-400 transition-colors duration-200 uppercase tracking-wider'>[ TERMINAL ]</Link>
            <Link to="/about" className='text-slate-400 hover:text-cyan-400 transition-colors duration-200 uppercase tracking-wider'>[ ABOUT_&_FC ]</Link>
            <a href="https://github.com/Devsharma08/ONLINE_IDE" target="_blank" rel="noreferrer" className='flex items-center gap-2 px-3 py-1.5 bg-cyan-950/10 hover:bg-cyan-950/20 border border-cyan-500/30 hover:border-cyan-400 rounded-none transition-all duration-300 text-cyan-400 uppercase tracking-wider'>
               <IdCardLanyard className='w-3.5 h-3.5' />
               <span>ONLINE IDE</span>
            </a>
         </div>
         <button
            type="button"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className='wmd:hidden block p-2 rounded-none bg-black/40 border border-white/10 text-cyan-400 cursor-pointer hover:bg-cyan-950/10 transition-all'
         >
            {isMenuOpen ? <X className='w-4 h-4'/> : <MenuIcon className='w-4 h-4'/>}
         </button>
      </div>
      {isMenuOpen ? (
         <div className="wmd:hidden mx-auto mt-4 grid max-w-7xl gap-1.5 border-t border-white/5 pt-4 text-xs font-mono">
            <Link to="/terminal" onClick={() => setIsMenuOpen(false)} className='rounded-none px-3 py-2 text-slate-400 hover:bg-cyan-950/5 hover:text-cyan-400 border border-transparent hover:border-cyan-500/20 transition-all uppercase'>[ TERMINAL ]</Link>
            <Link to="/about" onClick={() => setIsMenuOpen(false)} className='rounded-none px-3 py-2 text-slate-400 hover:bg-cyan-950/5 hover:text-cyan-400 border border-transparent hover:border-cyan-500/20 transition-all uppercase'>[ ABOUT ]</Link>
            <a href="https://github.com/Devsharma08/ONLINE_IDE" target="_blank" rel="noreferrer" className='flex items-center gap-2 rounded-none px-3 py-2 text-slate-400 hover:bg-cyan-950/5 hover:text-cyan-400 border border-transparent hover:border-cyan-500/20 transition-all uppercase'>
               <IdCardLanyard className='w-3.5 h-3.5' />
               <span>ONLINE IDE</span>
            </a>
         </div>
      ) : null}
    </nav>
  )
}

export default Header
