import { Info, IceCream as Github, User, Heart } from 'lucide-react'

const About = () => {
  return (
    <section className="relative flex h-full flex-col items-center overflow-hidden px-4 pt-24 sm:px-6 font-mono">

      <div className="z-10 mb-12 flex w-full max-w-4xl flex-col items-center text-center sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border border-cyan-500/20 bg-cyan-950/5 text-xs text-cyan-400 uppercase tracking-wider mb-6 cursor-default">
          <Info className="w-3.5 h-3.5" />
          SYS // ABOUT_DSA_HUB
        </div>
        
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl uppercase">
          BRIDGING_THE_GAP_BETWEEN <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">LEARNING_&_DOING</span>
        </h1>
        
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm uppercase tracking-wide">
          DSAHub is an open-source platform designed to make exploring Data Structures and Algorithms seamless. By connecting directly to GitHub, it provides a real-time, cached, and interactive way to study code.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-3xl rounded-none border border-white/5 bg-black/40 p-5 backdrop-blur-md sm:p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-none bg-cyan-950/15 flex items-center justify-center border border-cyan-500/30 text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">// THE_CREATOR</h3>
            <p className="text-slate-400 text-xs leading-relaxed uppercase">
              Built by Dev Sharma as a way to share coding solutions and experiment with modern web technologies, combining the power of GitHub APIs with high-performance caching.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-none bg-rose-950/15 flex items-center justify-center border border-rose-500/30 text-rose-400">
              <Heart className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">// OPEN_SOURCE</h3>
            <p className="text-slate-400 text-xs leading-relaxed uppercase">
              Everything you see here is open-source. We believe that coding education should be accessible and visually engaging for everyone.
            </p>
            <a href="https://github.com/Devsharma08/DSA-LEETCODE" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-2 text-cyan-400 hover:text-cyan-300 transition-colors font-bold text-xs uppercase tracking-wider w-fit">
              <Github className="w-4 h-4" /> <span>[ VIEW_REPOSITORY ]</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default About
