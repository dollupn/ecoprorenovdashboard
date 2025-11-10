import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

import {
  getLeadStatusLabel,
  isLeadStatus,
  leadStatusEnum,
  type LeadStatus,
  LEAD_STATUSES,
} from "./status";
import { getLeadStatusSettings, LEAD_STATUS_SETTINGS_UPDATED_EVENT } from "@/lib/leads";
import { useAppointmentTypes, useUpdateLead } from "@/features/leads/api";

const scheduleSchema = z.object({
  date_rdv: z.string().min(1, "La date du rendez-vous est requise"),
  heure_rdv: z.string().min(1, "L'heure du rendez-vous est requise"),
  status: leadStatusEnum,
  commentaire: z.string().optional(),
  appointment_type_id: z
    .string({ required_error: "Le type de rendez-vous est requis" })
    .min(1, "Le type de rendez-vous est requis"),
});

type ScheduleLeadForm = z.infer<typeof scheduleSchema>;

type LeadRecord = Tables<"leads">;

interface ScheduleLeadDialogProps {
  lead: LeadRecord;
  onScheduled?: () => void | Promise<void>;
}

export const ScheduleLeadDialog = ({ lead, onScheduled }: ScheduleLeadDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updateLead = useUpdateLead(null);
  const {
    data: appointmentTypes = [],
    isLoading: appointmentTypesLoading,
  } = useAppointmentTypes(lead.org_id ?? null);

  const [statusSettings, setStatusSettings] = useState(() =>
    getLeadStatusSettings({ includeInactive: false })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUpdate = () => {
      setStatusSettings(getLeadStatusSettings({ includeInactive: false, skipCache: true }));
    };

    window.addEventListener(LEAD_STATUS_SETTINGS_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener(LEAD_STATUS_SETTINGS_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  const statusOptions = statusSettings
    .filter((status) => status.isActive)
    .sort((a, b) => a.order - b.order);

  const resolveInitialStatus = useCallback(
    (status: string): LeadStatus => {
      const defaultStatus = (statusOptions[0]?.value ?? LEAD_STATUSES[0]) as LeadStatus;
      if (!isLeadStatus(status) || !statusOptions.some((option) => option.value === status)) {
        return defaultStatus;
      }

      const transitions: Partial<Record<LeadStatus, LeadStatus>> = {
        "À rappeler": "Phoning",
        Phoning: "À recontacter",
        "À recontacter": "Programmer pré-visite",
      };

      const next = transitions[status] ?? status;
      if (next && statusOptions.some((option) => option.value === next)) {
        return next;
      }

      return defaultStatus;
    },
    [statusOptions]
  );

  const form = useForm<ScheduleLeadForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date_rdv: lead.date_rdv ?? "",
      heure_rdv: lead.heure_rdv ?? "",
      commentaire: lead.commentaire ?? "",
      status: resolveInitialStatus(lead.status),
      appointment_type_id: lead.appointment_type_id ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date_rdv: lead.date_rdv ?? "",
        heure_rdv: lead.heure_rdv ?? "",
        commentaire: lead.commentaire ?? "",
        status: resolveInitialStatus(lead.status),
        appointment_type_id: lead.appointment_type_id ?? "",
      });
    }
  }, [open, lead, form, resolveInitialStatus]);

  useEffect(() => {
    if (!open) return;
    if (appointmentTypes.length === 0) return;
    const currentValue = form.getValues("appointment_type_id");
    if (currentValue) return;

    const defaultType =
      appointmentTypes.find((type) => type.is_default) ?? appointmentTypes[0] ?? null;
    if (defaultType) {
      form.setValue("appointment_type_id", defaultType.id);
    }
  }, [appointmentTypes, form, open]);

  const onSubmit = async (values: ScheduleLeadForm) => {
    try {
      const selectedType = appointmentTypes.find((type) => type.id === values.appointment_type_id);

      await updateLead.mutateAsync({
        id: lead.id,
        values: {
          date_rdv: values.date_rdv,
          heure_rdv: values.heure_rdv,
          commentaire: values.commentaire?.trim() ? values.commentaire : null,
          status: values.status,
          appointment_type_id: values.appointment_type_id,
          updated_at: new Date().toISOString(),
        },
      });

      toast({
        title: "RDV planifié",
        description:
          `Le rendez-vous avec ${lead.full_name} est enregistré` +
          (selectedType ? ` (${selectedType.name})` : ""),
      });

      setOpen(false);
      await onScheduled?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarIcon className="mr-2 h-4 w-4" />
          Planifier RDV
        </Button>
      </DialogTrigger>
      <DialogContent data-lead-dialog-ignore="true">
        <DialogHeader>
          <DialogTitle>Planifier un rendez-vous</DialogTitle>
          <DialogDescription>
            Confirmez la date, l'heure et le statut du lead
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="date_rdv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date du RDV *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heure_rdv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure du RDV *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appointment_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de RDV *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      disabled={appointmentTypesLoading || appointmentTypes.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type de RDV" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {appointmentTypesLoading ? (
                          <SelectItem value="__loading" disabled>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Chargement...
                          </SelectItem>
                        ) : (
                          appointmentTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {!appointmentTypesLoading && appointmentTypes.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Configurez des types de RDV dans les paramètres pour planifier un rendez-vous.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut du lead</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {getLeadStatusLabel(status.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentaire</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes internes, contexte supplémentaire..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  updateLead.isPending ||
                  appointmentTypesLoading ||
                  appointmentTypes.length === 0
                }
              >
                {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le RDV
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
