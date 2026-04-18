import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";

export const Avatar = AvatarPrimitive.Root;
export const AvatarImage = AvatarPrimitive.Image;

export function AvatarFallback({
  className,
  name,
}: {
  className?: string;
  name?: string | null;
}) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-brand-accent text-sm font-medium text-white",
        className,
      )}
    >
      {initials(name)}
    </AvatarPrimitive.Fallback>
  );
}
