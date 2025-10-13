import { useEffect, useState } from "react";
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
import { useUpdateLead } from "@/features/leads/api";

const scheduleSchema = z.object({
  date_rdv: z.string().min(1, "La date du rendez-vous est requise"),
  heure_rdv: z.string().min(1, "L'heure du rendez-vous est requise"),
  status: leadStatusEnum,
  commentaire: z.string().optional(),
});

type ScheduleLeadForm = z.infer<typeof scheduleSchema>;

type LeadRecord = Tables<"leads">;

interface ScheduleLeadDialogProps {
  lead: LeadRecord;
  onScheduled?: () => void | Promise<void>;
}

const resolveInitialStatus = (status: string): LeadStatus => {
  if (isLeadStatus(status)) {
    if (status === "À rappeler") {
      return "À recontacter";
    }
    if (status === "À recontacter") {
      return "Programmer pré-visite";
    }
    return status;
  }
  return "À recontacter";
};

export const ScheduleLeadDialog = ({ lead, onScheduled }: ScheduleLeadDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updateLead = useUpdateLead(null);

  const form = useForm<ScheduleLeadForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date_rdv: lead.date_rdv ?? "",
      heure_rdv: lead.heure_rdv ?? "",
      commentaire: lead.commentaire ?? "",
      status: resolveInitialStatus(lead.status),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date_rdv: lead.date_rdv ?? "",
        heure_rdv: lead.heure_rdv ?? "",
        commentaire: lead.commentaire ?? "",
        status: resolveInitialStatus(lead.status),
      });
    }
  }, [open, lead, form]);

  const onSubmit = async (values: ScheduleLeadForm) => {
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        values: {
          date_rdv: values.date_rdv,
          heure_rdv: values.heure_rdv,
          commentaire: values.commentaire?.trim() ? values.commentaire : null,
          status: values.status,
          updated_at: new Date().toISOString(),
        },
      });

      toast({
        title: "RDV planifié",
        description: `Le rendez-vous avec ${lead.full_name} est enregistré`,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planifier un rendez-vous</DialogTitle>
          <DialogDescription>
            Confirmez la date, l'heure et le statut du lead
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      {LEAD_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getLeadStatusLabel(status)}
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
              <Button type="submit" disabled={updateLead.isPending}>
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
