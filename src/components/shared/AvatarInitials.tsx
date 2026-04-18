import { avatarColor, cn, initials } from "@/lib/utils";

const sizes = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-16 text-xl",
};

export function AvatarInitials({
  name,
  size = "md",
  className,
}: {
  name?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        avatarColor(name),
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
