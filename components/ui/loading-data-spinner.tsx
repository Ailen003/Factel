"use client";

interface Props {
  loadingText?: string;
  loadingSubtitle?: string;
}

export function LoadingDataSpinner({
  loadingText = "Loading...",
  loadingSubtitle = "Please wait a moment",
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-32 min-h-[400px]">
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-[6px] border-primary/20 border-t-primary animate-spin"></div>
        <div
          className="absolute inset-0 h-20 w-20 rounded-full border-[6px] border-transparent border-r-primary/40 animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "1s" }}
        ></div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xl font-semibold text-primary animate-pulse">
          {loadingText}
        </span>
        <span className="text-base text-muted-foreground">
          {loadingSubtitle}
        </span>
      </div>
    </div>
  );
}
