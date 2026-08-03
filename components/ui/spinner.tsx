import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("loading loading-spinner size-4 text-current", className)}
      {...props}
    />
  );
}

export { Spinner };
