import { useState } from 'react'
import { MenuIcon, Terminal, IdCardLanyard, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UseHeadroom } from '../utils/styles/headRoom'

const Header = () => {
   const direction = UseHeadroom();
   const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className={`fixed top-0 right-0 left-0  z-50 glass-dark glass-rim backdrop-blur-md backdrop-saturate-150 py-4 px-6 w-full shadow-sm shadow-white/5 bg-darkbg/60 border-b border-white/10 transition-transform duration-100 ${direction === 'down' ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className='flex items-center max-w-7xl mx-auto font-bold justify-between'>
         <Link to="/" onClick={() => setIsMenuOpen(false)} className='flex items-center gap-3 group'>
            <div className='bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300'>
               <Terminal className='w-5 h-5 text-textwhite' />
            </div>
            <span className='text-xl tracking-tight text-textwhite bg-clip-text'>DSA<span className='text-indigo-400'>Hub</span></span>
         </Link>
         
         <div className='hidden wmd:flex items-center text-sm font-medium space-x-8'>
            <Link to="/terminal" className='text-textdimwhite hover:text-textwhite transition-colors duration-200 relative after:content-[""] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-indigo-400 after:transition-all after:duration-300 hover:after:w-full'>Terminal</Link>
            <Link to="/about" className='text-textdimwhite hover:text-textwhite transition-colors duration-200 relative after:content-[""] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-indigo-400 after:transition-all after:duration-300 hover:after:w-full'>About</Link>
            <a href="https://github.com/Devsharma08/DSA-LEETCODE" target="_blank" rel="noreferrer" className='flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] text-textwhite'>
               <IdCardLanyard className='w-4 h-4' />
               <span>GitHub</span>
            </a>
         </div>
         <button
            type="button"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className='wmd:hidden block p-2 rounded-lg bg-white/5 border border-white/10 text-textwhite cursor-pointer hover:bg-white/10 transition-all'
         >
            {isMenuOpen ? <X className='w-5 h-5'/> : <MenuIcon className='w-5 h-5'/>}
         </button>
      </div>
      {isMenuOpen ? (
         <div className="wmd:hidden mx-auto mt-4 grid max-w-7xl gap-2 border-t border-white/10 pt-4 text-sm font-medium">
            <Link to="/terminal" onClick={() => setIsMenuOpen(false)} className='rounded-lg px-3 py-3 text-textdimwhite hover:bg-white/5 hover:text-textwhite transition-colors duration-200'>Terminal</Link>
            <Link to="/about" onClick={() => setIsMenuOpen(false)} className='rounded-lg px-3 py-3 text-textdimwhite hover:bg-white/5 hover:text-textwhite transition-colors duration-200'>About</Link>
            <a href="https://github.com/Devsharma08/DSA-LEETCODE" target="_blank" rel="noreferrer" className='flex items-center gap-2 rounded-lg px-3 py-3 text-textdimwhite hover:bg-white/5 hover:text-textwhite transition-colors duration-200'>
               <IdCardLanyard className='w-4 h-4' />
               <span>GitHub</span>
            </a>
         </div>
      ) : null}
    </nav>
  )
}

export default Header
