import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted ? currentTheme === "dark" : false;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative"
      aria-label="Basculer le thème"
    >
      <Sun
        className={cn(
          "h-5 w-5 rotate-0 scale-100 transition-all",
          isDark && "-rotate-90 scale-0",
        )}
      />
      <Moon
        className={cn(
          "absolute h-5 w-5 rotate-90 scale-0 transition-all",
          isDark && "rotate-0 scale-100",
        )}
      />
      <span className="sr-only">Basculer le thème</span>
    </Button>
  );
}
