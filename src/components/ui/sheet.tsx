import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetPrimitive.DialogContentProps & { side?: "right" | "bottom" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 bg-black/40" />
      <SheetPrimitive.Content
        className={cn(
          "fixed bg-white shadow-2xl outline-none",
          side === "right"
            ? "right-0 top-0 h-dvh w-[min(24rem,100vw)]"
            : "bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-lg",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
          <X aria-hidden />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
