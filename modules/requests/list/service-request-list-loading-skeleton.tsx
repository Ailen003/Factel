import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceRequestListLoadingSkeleton() {
  return <div className="space-y-3 rounded-lg border p-4">
    <Skeleton className="h-8 w-48" />
    {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
  </div>;
}
