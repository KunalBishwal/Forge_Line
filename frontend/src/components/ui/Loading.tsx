import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="glass space-y-4 p-5">
      <Shimmer className="h-4 w-1/3" />
      <Shimmer className="h-10 w-2/3" />
      <Shimmer className="h-2 w-full" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3">
      <Shimmer className="h-4 w-40" />
      <Shimmer className="h-4 w-24" />
      <Shimmer className="ml-auto h-4 w-16" />
    </div>
  );
}
