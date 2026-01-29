import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ThreadLoadingProps = {
  nested?: boolean;
};

export function ThreadLoading({ nested }: ThreadLoadingProps) {
  return (
    <div
      className={cn("space-y-2 px-2 py-1", nested && "pl-5")}
      aria-label="Loading agents"
    >
      <Skeleton className="h-2 w-3/4" />
      <Skeleton className="h-2 w-2/3" />
      <Skeleton className="h-2 w-1/2" />
    </div>
  );
}
