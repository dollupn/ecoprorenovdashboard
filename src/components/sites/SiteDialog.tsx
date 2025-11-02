import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiteForm, type SiteFormProps } from "./SiteForm";

export type { SiteFormValues, SiteProjectOption, SiteSubmitValues } from "./SiteForm";

interface SiteDialogProps extends Omit<SiteFormProps, "onCancel"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SiteDialog = ({ open, onOpenChange, ...formProps }: SiteDialogProps) => {
  const { mode, readOnly } = formProps;
  const isReadOnly = Boolean(readOnly);

  const title = isReadOnly
    ? "Détails du chantier"
    : mode === "create"
      ? "Nouveau chantier"
      : "Modifier le chantier";

  const description = isReadOnly
    ? "Consultez les informations opérationnelles et financières du chantier."
    : "Renseignez les informations financières et opérationnelles du chantier.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <SiteForm {...formProps} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};
