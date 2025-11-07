import { useMemo, useState } from "react";
import { Plus, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  getKpiMetricLabel,
  getKpiPeriodLabel,
  type KpiGoalFormValues,
} from "@/lib/kpi-goals";
import {
  mapGoalToFormValues,
  useCreateKpiGoal,
  useDeleteKpiGoal,
  useKpiGoals,
  useToggleKpiGoal,
  useUpdateKpiGoal,
  type KpiGoal,
} from "@/features/kpi/api";
import { KpiGoalForm } from "./KpiGoalForm";

interface KpiGoalListProps {
  orgId: string | null;
}

export function KpiGoalList({ orgId }: KpiGoalListProps) {
  const { toast } = useToast();
  const { data: goals = [], isLoading, error } = useKpiGoals(orgId);
  const createGoal = useCreateKpiGoal(orgId);
  const updateGoal = useUpdateKpiGoal(orgId);
  const deleteGoal = useDeleteKpiGoal(orgId);
  const toggleGoal = useToggleKpiGoal(orgId);

  const [formState, setFormState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    goal: KpiGoal | null;
  }>({ open: false, mode: "create", goal: null });
  const [goalToDelete, setGoalToDelete] = useState<KpiGoal | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const formDefaultValues = useMemo<Partial<KpiGoalFormValues> | undefined>(
    () => (formState.goal ? mapGoalToFormValues(formState.goal) : undefined),
    [formState.goal],
  );

  const handleOpenCreate = () => {
    setFormState({ open: true, mode: "create", goal: null });
  };

  const handleOpenEdit = (goal: KpiGoal) => {
    setFormState({ open: true, mode: "edit", goal });
  };

  const handleDialogClose = () => {
    setFormState({ open: false, mode: "create", goal: null });
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      handleDialogClose();
    }
  };

  const handleFormSubmit = (values: KpiGoalFormValues) => {
    if (formState.mode === "edit") {
      const payload = {
        ...values,
        id: values.id ?? formState.goal?.id,
        orgId: values.orgId ?? formState.goal?.org_id,
      } as KpiGoalFormValues;

      updateGoal.mutate(payload, {
        onSuccess: () => {
          toast({
            title: "Objectif mis à jour",
            description: "Les informations de l'objectif ont été enregistrées.",
          });
          handleDialogClose();
        },
        onError: (mutationError) => {
          toast({
            variant: "destructive",
            title: "Erreur lors de la mise à jour",
            description: mutationError instanceof Error
              ? mutationError.message
              : "Impossible de modifier l'objectif pour le moment.",
          });
        },
      });
      return;
    }

    createGoal.mutate(values, {
      onSuccess: () => {
        toast({
          title: "Objectif créé",
          description: "Le nouvel objectif KPI a été ajouté avec succès.",
        });
        handleDialogClose();
      },
      onError: (mutationError) => {
        toast({
          variant: "destructive",
          title: "Erreur lors de la création",
          description: mutationError instanceof Error
            ? mutationError.message
            : "Impossible d'enregistrer le nouvel objectif.",
        });
      },
    });
  };

  const handleToggle = (goal: KpiGoal, isActive: boolean) => {
    setTogglingId(goal.id);
    toggleGoal.mutate(
      { id: goal.id, isActive },
      {
        onSuccess: () => {
          toast({
            title: isActive ? "Objectif activé" : "Objectif désactivé",
            description: isActive
              ? "Cet objectif sera pris en compte dans les tableaux de bord."
              : "Cet objectif est temporairement exclu du suivi.",
          });
        },
        onError: (mutationError) => {
          toast({
            variant: "destructive",
            title: "Impossible de mettre à jour l'objectif",
            description: mutationError instanceof Error
              ? mutationError.message
              : "La modification de l'état actif a échoué.",
          });
        },
        onSettled: () => {
          setTogglingId(null);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!goalToDelete) return;

    deleteGoal.mutate(
      { id: goalToDelete.id },
      {
        onSuccess: () => {
          toast({
            title: "Objectif supprimé",
            description: "L'objectif ne sera plus suivi dans vos KPI.",
          });
          setGoalToDelete(null);
        },
        onError: (mutationError) => {
          toast({
            variant: "destructive",
            title: "Suppression impossible",
            description: mutationError instanceof Error
              ? mutationError.message
              : "Veuillez réessayer dans quelques instants.",
          });
        },
      },
    );
  };

  const isOrgMissing = !orgId;
  const isSaving = createGoal.isPending || updateGoal.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Objectifs de performance</h3>
          <p className="text-sm text-muted-foreground">
            Créez des objectifs alignés avec votre stratégie et suivez-les directement dans les dashboards.
          </p>
        </div>
        <Button onClick={handleOpenCreate} disabled={isOrgMissing} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nouvel objectif
        </Button>
      </div>

      {isOrgMissing && (
        <Alert>
          <AlertTitle>Organisation requise</AlertTitle>
          <AlertDescription>
            Sélectionnez une organisation pour gérer ses objectifs KPI.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de charger les objectifs</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "Une erreur est survenue lors de la connexion à Supabase."}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-lg border border-border/60 bg-muted/40 p-4"
            >
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-4 h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun objectif KPI n'a encore été défini. Créez votre premier objectif pour suivre vos performances.
          </p>
          <Button onClick={handleOpenCreate} className="mt-4" disabled={isOrgMissing}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un objectif
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-lg border border-border/60 bg-card/80 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {goal.title}
                    </span>
                    <Badge variant="secondary">{getKpiMetricLabel(goal.metric)}</Badge>
                    <Badge variant="outline">{getKpiPeriodLabel(goal.period)}</Badge>
                    {!goal.is_active && (
                      <Badge variant="outline" className="border-dashed text-muted-foreground">
                        Inactif
                      </Badge>
                    )}
                  </div>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Objectif :
                    <span className="ml-1 font-medium text-foreground">
                      {goal.target_value.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}
                      {goal.target_unit ? ` ${goal.target_unit}` : ""}
                    </span>
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{goal.is_active ? "Actif" : "Inactif"}</span>
                    <Switch
                      checked={goal.is_active}
                      onCheckedChange={(checked) => handleToggle(goal, checked)}
                      disabled={togglingId === goal.id || toggleGoal.isPending}
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(goal)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setGoalToDelete(goal)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formState.open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formState.mode === "create" ? "Nouvel objectif KPI" : "Modifier l'objectif"}
            </DialogTitle>
            <DialogDescription>
              Définissez les cibles à atteindre pour piloter votre activité commerciale.
            </DialogDescription>
          </DialogHeader>

          <KpiGoalForm
            defaultValues={formDefaultValues}
            onSubmit={handleFormSubmit}
            onCancel={handleDialogClose}
            submitLabel={formState.mode === "create" ? "Créer l'objectif" : "Enregistrer"}
            isSubmitting={isSaving}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={goalToDelete !== null} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'objectif</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'objectif sera supprimé de manière définitive et ne sera plus visible dans les rapports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGoal.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteGoal.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteGoal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
