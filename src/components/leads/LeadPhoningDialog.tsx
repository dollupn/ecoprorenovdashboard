import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PhoneCall, Loader2 } from "lucide-react";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLead } from "@/features/leads/api";
import {
  getLeadStatusLabel,
  isLeadStatus,
  leadStatusEnum,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/components/leads/status";
import type { Tables } from "@/integrations/supabase/types";

const CALL_STATUS_OPTIONS = [
  "En attente",
  "Répondu - Intéressé",
  "Répondu - À recontacter",
  "Répondu - Non intéressé",
  "Pas de réponse",
] as const;

type CallStatusOption = (typeof CALL_STATUS_OPTIONS)[number];

type LeadWithExtras = Tables<"leads"> & { extra_fields?: Record<string, unknown> | null };

type PhoningSnapshot = {
  call_status?: CallStatusOption;
  contact_person?: string;
  need_summary?: string;
  timeline?: string;
  budget?: string;
  notes?: string;
  next_status?: LeadStatus;
  last_updated_at?: string;
};

const phoningSchema = z.object({
  call_status: z.enum(CALL_STATUS_OPTIONS, {
    required_error: "Sélectionnez le résultat de l'appel",
  }),
  contact_person: z.string().optional(),
  need_summary: z.string().optional(),
  timeline: z.string().optional(),
  budget: z.string().optional(),
  notes: z.string().optional(),
  next_status: leadStatusEnum,
});

type PhoningFormValues = z.infer<typeof phoningSchema>;

type LeadPhoningDialogProps = {
  lead: LeadWithExtras;
  onCompleted?: () => void | Promise<void>;
};

const sanitizeText = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const extractPhoningSnapshot = (lead: LeadWithExtras): PhoningSnapshot => {
  const extras = lead.extra_fields;
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) {
    return {};
  }

  const snapshot = (extras as Record<string, unknown>).phoning;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const raw = snapshot as Record<string, unknown>;
  const nextStatus = raw.next_status;

  return {
    call_status: CALL_STATUS_OPTIONS.includes(raw.call_status as CallStatusOption)
      ? (raw.call_status as CallStatusOption)
      : undefined,
    contact_person: typeof raw.contact_person === "string" ? raw.contact_person : undefined,
    need_summary: typeof raw.need_summary === "string" ? raw.need_summary : undefined,
    timeline: typeof raw.timeline === "string" ? raw.timeline : undefined,
    budget: typeof raw.budget === "string" ? raw.budget : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    next_status: isLeadStatus(nextStatus as string) ? (nextStatus as LeadStatus) : undefined,
    last_updated_at: typeof raw.last_updated_at === "string" ? raw.last_updated_at : undefined,
  };
};

const resolveInitialNextStatus = (lead: LeadWithExtras, snapshot: PhoningSnapshot): LeadStatus => {
  if (snapshot.next_status && isLeadStatus(snapshot.next_status)) {
    return snapshot.next_status;
  }

  if (isLeadStatus(lead.status)) {
    if (lead.status === "À rappeler") {
      return "Phoning";
    }
    return lead.status as LeadStatus;
  }

  return "Phoning";
};

export const LeadPhoningDialog = ({ lead, onCompleted }: LeadPhoningDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updateLead = useUpdateLead(null);

  const snapshot = useMemo(() => extractPhoningSnapshot(lead), [lead]);

  const form = useForm<PhoningFormValues>({
    resolver: zodResolver(phoningSchema),
    defaultValues: {
      call_status: snapshot.call_status ?? "En attente",
      contact_person: snapshot.contact_person ?? "",
      need_summary: snapshot.need_summary ?? "",
      timeline: snapshot.timeline ?? "",
      budget: snapshot.budget ?? "",
      notes: snapshot.notes ?? "",
      next_status: resolveInitialNextStatus(lead, snapshot),
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      call_status: snapshot.call_status ?? "En attente",
      contact_person: snapshot.contact_person ?? "",
      need_summary: snapshot.need_summary ?? "",
      timeline: snapshot.timeline ?? "",
      budget: snapshot.budget ?? "",
      notes: snapshot.notes ?? "",
      next_status: resolveInitialNextStatus(lead, snapshot),
    });
  }, [open, form, snapshot, lead]);

  const onSubmit = async (values: PhoningFormValues) => {
    const phoningPayload: PhoningSnapshot = {
      call_status: values.call_status,
      contact_person: sanitizeText(values.contact_person),
      need_summary: sanitizeText(values.need_summary),
      timeline: sanitizeText(values.timeline),
      budget: sanitizeText(values.budget),
      notes: sanitizeText(values.notes),
      next_status: values.next_status,
      last_updated_at: new Date().toISOString(),
    };

    const extraFieldsBase =
      lead.extra_fields && typeof lead.extra_fields === "object" && !Array.isArray(lead.extra_fields)
        ? { ...(lead.extra_fields as Record<string, unknown>) }
        : {};

    const updatedExtraFields: Record<string, unknown> = {
      ...extraFieldsBase,
      phoning: phoningPayload,
    };

    try {
      await updateLead.mutateAsync({
        id: lead.id,
        values: {
          extra_fields: updatedExtraFields as any,
          status: values.next_status,
          updated_at: new Date().toISOString(),
        },
      });

      toast({
        title: "Script phoning enregistré",
        description: "Les réponses ont été sauvegardées.",
      });

      setOpen(false);
      await onCompleted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Impossible d'enregistrer le phoning",
        description: message,
        variant: "destructive",
      });
    }
  };

  const lastUpdatedLabel = snapshot.last_updated_at
    ? new Date(snapshot.last_updated_at).toLocaleString("fr-FR")
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PhoneCall className="mr-2 h-4 w-4" />
          Script Phoning
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Script d'appel phoning</DialogTitle>
          <DialogDescription>
            Suivez les questions proposées pendant votre appel et enregistrez les réponses clés.
          </DialogDescription>
        </DialogHeader>

        {lastUpdatedLabel ? (
          <p className="text-xs text-muted-foreground">
            Dernière mise à jour : {lastUpdatedLabel}
          </p>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="call_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Résultat du contact *</FormLabel>
                  <FormDescription>
                    Choisissez le résultat le plus fidèle à l'appel en cours.
                  </FormDescription>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un résultat" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CALL_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
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
              name="contact_person"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interlocuteur principal</FormLabel>
                  <FormDescription>
                    Notez avec qui vous avez échangé et son rôle dans le projet.
                  </FormDescription>
                  <FormControl>
                    <Input placeholder="Ex. Directeur des travaux" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="need_summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Besoin principal du prospect</FormLabel>
                  <FormDescription>
                    Résumez la problématique ou le besoin exprimé lors de l'appel.
                  </FormDescription>
                  <FormControl>
                    <Textarea rows={4} placeholder="Quel est le projet envisagé ?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Échéance souhaitée</FormLabel>
                    <FormDescription>
                      Demandez quand le prospect aimerait démarrer les travaux.
                    </FormDescription>
                    <FormControl>
                      <Input placeholder="Ex. Sous 3 mois" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget estimé</FormLabel>
                    <FormDescription>
                      Mentionnez le budget évoqué ou la fourchette estimée.
                    </FormDescription>
                    <FormControl>
                      <Input placeholder="Ex. 25 000 €" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes complémentaires</FormLabel>
                  <FormDescription>
                    Ajoutez tout élément bloquant ou information utile pour la suite.
                  </FormDescription>
                  <FormControl>
                    <Textarea rows={4} placeholder="Commentaires supplémentaires" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="next_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut après l'appel</FormLabel>
                  <FormDescription>
                    Sélectionnez le statut du lead après ce phoning.
                  </FormDescription>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={updateLead.isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateLead.isPending}>
                {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le phoning
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
