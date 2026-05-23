import { Loader2 } from "lucide-react";

type LoadingOverlayProps = {
  label?: string;
};

const LoadingOverlay = ({ label = "Loading..." }: LoadingOverlayProps) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05070c]/70 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-lg border border-indigo-400/30 bg-[#111827]/90 px-4 py-3 text-sm font-medium text-indigo-100 shadow-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
        <span>{label}</span>
      </div>
    </div>
  );
};

export default LoadingOverlay;
