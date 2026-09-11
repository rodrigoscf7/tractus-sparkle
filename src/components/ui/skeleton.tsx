import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Cinza, não amarelo: o amarelo é reservado para ação e marcador de IA.
  return (
    <div
      className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
