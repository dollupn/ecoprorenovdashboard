import { Zap, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface InsightBannerProps {
  insight: string;
  metric?: string;
  onDismiss?: () => void;
}

export function InsightBanner({ insight, metric, onDismiss }: InsightBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden rounded-lg bg-primary/10 border border-primary/20 p-4 mb-6 animate-fade-in">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />

      <div className="relative flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Zap className="h-5 w-5 text-primary animate-pulse" fill="currentColor" />
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{insight}</p>
          {metric && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{metric}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Decorative cards effect */}
      <div className="absolute -right-4 -bottom-2 w-32 h-16 bg-primary/5 rounded-lg transform rotate-6 opacity-50" />
      <div className="absolute -right-2 -bottom-1 w-32 h-16 bg-primary/5 rounded-lg transform rotate-3 opacity-30" />
    </div>
  );
}
