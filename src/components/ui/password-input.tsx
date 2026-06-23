import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <ToggleButton visible={visible} onToggle={() => setVisible((v) => !v)} />
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

/** Versão para usar com <input> nativo (sem classes do shadcn) */
export const RawPasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ style, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "block" }}>
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        style={{ paddingRight: "2.25rem", ...style }}
        {...props}
      />
      <ToggleButton visible={visible} onToggle={() => setVisible((v) => !v)} />
    </div>
  );
});
RawPasswordInput.displayName = "RawPasswordInput";

function ToggleButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      tabIndex={-1}
      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      style={{ background: "transparent", border: 0, cursor: "pointer" }}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
