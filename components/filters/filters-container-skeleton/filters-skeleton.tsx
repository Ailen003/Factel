import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  inputCount?: number;
}

export default function FiltersSkeleton({ inputCount = 3 }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 p-2">
        {Array.from({ length: inputCount }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
