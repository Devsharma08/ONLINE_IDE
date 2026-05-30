import { Outlet, useLocation } from 'react-router-dom'
import Header from './header'
import Footer from './Footer'


const BackgroundShapes = () => (
  <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
    {/* Glowing Orbs for ambiance */}
    <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-teal-500/5 blur-[100px]" />
  </div>
)

const Layout = () => {
  const { pathname } = useLocation()
  const hidden = pathname === "/terminal"
  
  return (
    <div className='flex flex-col min-h-screen relative w-full'>
      <BackgroundShapes />
      <div className="z-10 flex flex-col flex-grow w-full relative">
        {hidden ? null : <Header />}
        <main className={`flex-grow ${hidden ? 'h-screen' : 'h-fit'} w-full relative`}>
          <Outlet/>
        </main>
        {hidden ? null : <Footer />}
      </div>
    </div>
  )
}

export default Layout
