import { useEffect } from "react";

export const usePreventTabClose = (isUnsaved: boolean) => {
  useEffect(() => {
    if (!isUnsaved) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      
      event.preventDefault();
      event.returnValue = ""; // this is required for some browsers to show the confirmation dialog
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    // Clean up event listener when component unmounts
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUnsaved]);
};