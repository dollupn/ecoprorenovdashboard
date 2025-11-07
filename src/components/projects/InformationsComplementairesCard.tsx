import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

interface InformationsComplementairesCardProps {
  project: {
    assigned_to?: string | null;
    building_type?: string | null;
    usage?: string | null;
    surface_batiment_m2?: number | null;
    surface_isolee_m2?: number | null;
    signatory_name?: string | null;
    signatory_title?: string | null;
    siren?: string | null;
    source?: string | null;
    external_reference?: string | null;
    hq_address?: string | null;
    hq_city?: string | null;
    hq_postal_code?: string | null;
  };
  onEdit: () => void;
  memberName?: string | null;
  delegateName?: string | null;
  delegatePrice?: number | null;
}

const surfaceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const InformationsComplementairesCard = ({
  project,
  onEdit,
  memberName,
  delegateName,
  delegatePrice,
}: InformationsComplementairesCardProps) => {
  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    if (!value) return null;
    return (
      <div className="flex flex-col gap-1 py-2 border-b last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium sm:text-right">{value}</span>
      </div>
    );
  };

  const formattedDelegatePrice =
    typeof delegatePrice === "number"
      ? `${currencyFormatter.format(delegatePrice)} / MWh`
      : null;

  const delegateValue =
    delegateName && formattedDelegatePrice
      ? `${delegateName} • ${formattedDelegatePrice}`
      : delegateName || formattedDelegatePrice || "—";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Informations complémentaires</CardTitle>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Modifier le projet
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        <InfoRow label="Assigné à" value={memberName || project.assigned_to || "—"} />
        <InfoRow label="Délégataire" value={delegateValue} />
        <InfoRow label="Type de bâtiment" value={project.building_type || "—"} />
        <InfoRow label="Usage" value={project.usage || "—"} />
        <InfoRow
          label="Surface bâtiment"
          value={
            typeof project.surface_batiment_m2 === "number" &&
            Number.isFinite(project.surface_batiment_m2)
              ? `${surfaceFormatter.format(project.surface_batiment_m2)} m²`
              : "—"
          }
        />
        <InfoRow label="Nom signataire" value={project.signatory_name || "—"} />
        <InfoRow label="Titre signataire" value={project.signatory_title || "—"} />
        <InfoRow label="SIREN" value={project.siren || "—"} />
        <InfoRow label="Source" value={project.source || "—"} />
        <InfoRow label="Référence externe" value={project.external_reference || "—"} />
        
        {(project.hq_address || project.hq_city || project.hq_postal_code) && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-sm font-semibold">Adresse siège social</p>
            </div>
            <InfoRow label="Adresse" value={project.hq_address || "—"} />
            <InfoRow label="Ville" value={project.hq_city || "—"} />
            <InfoRow label="Code postal" value={project.hq_postal_code || "—"} />
          </>
        )}
      </CardContent>
    </Card>
  );
};
