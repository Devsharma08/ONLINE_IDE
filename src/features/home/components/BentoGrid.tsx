import { Link } from "react-router-dom";
import { bentoItems } from "../content";

const BentoGrid = () => {
  return (
    <div className="z-10 mx-auto mt-16 w-full max-w-6xl px-0 pb-24 sm:mt-20 sm:px-4 sm:pb-32">
      <div className="mb-10 text-center sm:mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-textwhite mb-4">Master Every Structure</h2>
        <p className="text-base text-textdimwhite sm:text-lg">Dive deep into categorized concepts directly from the repository.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-4 gap-4 md:gap-6 px-4 md:px-0">
        {bentoItems.map((item) => (
          <Link
            key={item.title}
            to={`/ds/${item.slug}`}
            className={`group relative overflow-hidden rounded-3xl cursor-pointer border border-white/10 shadow-lg hover:border-cyan-500/30 transition-all duration-300 block ${item.className}`}
          >
            <img
              src={item.img}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110 opacity-50 group-hover:opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-darkbg via-darkbg/60 to-transparent group-hover:from-darkbg/90 transition-all duration-500"></div>

            <div className="absolute inset-0 p-8 flex flex-col justify-end">
              <h3 className="text-2xl font-bold text-textwhite mb-1 transform transition-transform duration-500 group-hover:-translate-y-2">
                {item.title}
              </h3>
              <p className="text-textdimwhite text-sm font-medium opacity-0 transform translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 line-clamp-2">
                {item.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BentoGrid;
