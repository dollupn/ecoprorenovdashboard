import { Loader2, Palette, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectStatusBadgeStyle, type ProjectStatusSetting } from "@/lib/projects";

interface ProjectStatusesCardProps {
  statuses: ProjectStatusSetting[];
  busy: boolean;
  disableReset: boolean;
  onReset: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onValueChange: (id: string, value: string) => void;
  onColorChange: (id: string, color: string) => void;
}

export const ProjectStatusesCard = ({
  statuses,
  busy,
  disableReset,
  onReset,
  onAdd,
  onRemove,
  onLabelChange,
  onValueChange,
  onColorChange,
}: ProjectStatusesCardProps) => {
  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Palette className="h-5 w-5 text-primary" />
            Statuts des projets
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personnalisez les libellés et les couleurs utilisés sur l&apos;ensemble du tableau de bord.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy ? (
            <span className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Synchronisation…
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={onReset} disabled={disableReset || busy}>
            Réinitialiser
          </Button>
          <Button size="sm" variant="secondary" className="gap-2" onClick={onAdd} disabled={busy}>
            <Plus className="h-4 w-4" />
            Ajouter un statut
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {busy && statuses.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`project-status-skeleton-${index}`}
                className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-9 w-9" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
            Aucun statut n&apos;est configuré. Ajoutez un statut pour commencer.
          </div>
        ) : (
          <>
            {statuses.map((status) => {
              const badgeStyle = getProjectStatusBadgeStyle(status.color);
              return (
                <div key={status.id} className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" style={badgeStyle} className="px-3 py-1">
                        {status.label || status.value}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {status.value}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(status.id)}
                      disabled={statuses.length <= 1 || busy}
                      aria-label={`Supprimer le statut ${status.label || status.value}`}
                      className="h-9 w-9 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Nom affiché</Label>
                      <Input
                        value={status.label}
                        placeholder="Nom du statut"
                        onChange={(event) => onLabelChange(status.id, event.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code interne</Label>
                      <Input
                        value={status.value}
                        onChange={(event) => onValueChange(status.id, event.target.value)}
                        placeholder="NOUVEAU"
                        disabled={busy}
                      />
                      <p className="text-xs text-muted-foreground">
                        Identifiant synchronisé avec vos exports et intégrations.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur du badge</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={status.color}
                          onChange={(event) => onColorChange(status.id, event.target.value)}
                          className="h-10 w-16 cursor-pointer rounded-md border border-border/60 bg-background p-1"
                          aria-label={`Couleur du statut ${status.label || status.value}`}
                          disabled={busy}
                        />
                        <span className="text-sm text-muted-foreground">{status.color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {busy ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Synchronisation des statuts en cours…
              </div>
            ) : null}
          </>
        )}
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
          Les modifications sont appliquées instantanément aux listes, aux filtres et aux formulaires de création de projet.
        </div>
      </CardContent>
    </Card>
  );
};
