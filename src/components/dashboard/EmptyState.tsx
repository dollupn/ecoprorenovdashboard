import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-12 h-12 mb-4 text-muted-foreground/50" />
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      {action && (
        <Button size="sm" onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}
