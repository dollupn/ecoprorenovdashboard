import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <AlertCircle className="w-10 h-10 mb-3 text-destructive/70" />
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} variant="outline">
          Réessayer
        </Button>
      )}
    </div>
  );
}
