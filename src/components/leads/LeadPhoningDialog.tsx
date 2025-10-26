import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PhoneCall, Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLead } from "@/features/leads/api";
import {
  getLeadStatusLabel,
  isLeadStatus,
  leadStatusEnum,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/components/leads/status";
import { getLeadStatusSettings, LEAD_STATUS_SETTINGS_UPDATED_EVENT } from "@/lib/leads";
import type { Tables } from "@/integrations/supabase/types";

const CONTACT_RESULT_OPTIONS = [
  "Éligible",
  "Pas éligible",
  "Pas de réponse",
  "À recontacter",
  "Autres",
] as const;

type ContactResultOption = (typeof CONTACT_RESULT_OPTIONS)[number];

type LeadWithExtras = Tables<"leads"> & { extra_fields?: Record<string, unknown> | null };

type PhoningSnapshot = {
  contact_result?: ContactResultOption;
  recontact_date?: string;
  recontact_time?: string;
  site_address?: string;
  headquarters_address?: string;
  estimated_area?: string;
  previsit_date?: string;
  previsit_time?: string;
  notes?: string;
  next_status?: LeadStatus;
  last_updated_at?: string;
};

const phoningSchema = z.object({
  contact_result: z.enum(CONTACT_RESULT_OPTIONS, {
    required_error: "Sélectionnez le résultat du contact",
  }),
  recontact_date: z.string().optional(),
  recontact_time: z.string().optional(),
  site_address: z.string().optional(),
  headquarters_address: z.string().optional(),
  estimated_area: z.string().optional(),
  previsit_date: z.string().optional(),
  previsit_time: z.string().optional(),
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
    contact_result: CONTACT_RESULT_OPTIONS.includes(raw.contact_result as ContactResultOption)
      ? (raw.contact_result as ContactResultOption)
      : undefined,
    recontact_date: typeof raw.recontact_date === "string" ? raw.recontact_date : undefined,
    recontact_time: typeof raw.recontact_time === "string" ? raw.recontact_time : undefined,
    site_address: typeof raw.site_address === "string" ? raw.site_address : undefined,
    headquarters_address: typeof raw.headquarters_address === "string" ? raw.headquarters_address : undefined,
    estimated_area: typeof raw.estimated_area === "string" ? raw.estimated_area : undefined,
    previsit_date: typeof raw.previsit_date === "string" ? raw.previsit_date : undefined,
    previsit_time: typeof raw.previsit_time === "string" ? raw.previsit_time : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    next_status: isLeadStatus(nextStatus as string) ? (nextStatus as LeadStatus) : undefined,
    last_updated_at: typeof raw.last_updated_at === "string" ? raw.last_updated_at : undefined,
  };
};

export const LeadPhoningDialog = ({ lead, onCompleted }: LeadPhoningDialogProps) => {
  const [open, setOpen] = useState(false);
  const [recontactDate, setRecontactDate] = useState<Date | undefined>();
  const [previsitDate, setPrevisitDate] = useState<Date | undefined>();
  const { toast } = useToast();
  const updateLead = useUpdateLead(null);

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

  const statusOptions = useMemo(
    () => statusSettings.filter((status) => status.isActive).sort((a, b) => a.order - b.order),
    [statusSettings]
  );

  const snapshot = useMemo(() => extractPhoningSnapshot(lead), [lead]);

  const defaultStatus = useMemo(
    () => (statusOptions[0]?.value ?? LEAD_STATUSES[0]) as LeadStatus,
    [statusOptions]
  );

  const initialNextStatus = useMemo(() => {
    if (snapshot.next_status && isLeadStatus(snapshot.next_status)) {
      if (statusOptions.some((status) => status.value === snapshot.next_status)) {
        return snapshot.next_status;
      }
    }

    if (isLeadStatus(lead.status)) {
      const transitions: Partial<Record<LeadStatus, LeadStatus>> = {
        "À rappeler": "Phoning",
      };
      const preferred = transitions[lead.status] ?? lead.status;
      if (statusOptions.some((status) => status.value === preferred)) {
        return preferred;
      }
      if (statusOptions.some((status) => status.value === lead.status)) {
        return lead.status as LeadStatus;
      }
    }

    return defaultStatus;
  }, [snapshot.next_status, lead.status, statusOptions, defaultStatus]);

  const form = useForm<PhoningFormValues>({
    resolver: zodResolver(phoningSchema),
    defaultValues: {
      contact_result: snapshot.contact_result ?? "Éligible",
      recontact_date: snapshot.recontact_date ?? "",
      recontact_time: snapshot.recontact_time ?? "",
      site_address: snapshot.site_address ?? "",
      headquarters_address: snapshot.headquarters_address ?? "",
      estimated_area: snapshot.estimated_area ?? "",
      previsit_date: snapshot.previsit_date ?? "",
      previsit_time: snapshot.previsit_time ?? "",
      notes: snapshot.notes ?? "",
      next_status: initialNextStatus,
    },
  });

  const watchContactResult = form.watch("contact_result");
  const watchPrevisitDate = form.watch("previsit_date");

  useEffect(() => {
    if (!open) {
      form.setValue("next_status", initialNextStatus);
    }
  }, [initialNextStatus, form, open]);

  useEffect(() => {
    if (!open) return;

    const prevDate = snapshot.recontact_date ? new Date(snapshot.recontact_date) : undefined;
    const prevPrevisitDate = snapshot.previsit_date ? new Date(snapshot.previsit_date) : undefined;
    
    setRecontactDate(prevDate);
    setPrevisitDate(prevPrevisitDate);

    form.reset({
      contact_result: snapshot.contact_result ?? "Éligible",
      recontact_date: snapshot.recontact_date ?? "",
      recontact_time: snapshot.recontact_time ?? "",
      site_address: snapshot.site_address ?? "",
      headquarters_address: snapshot.headquarters_address ?? "",
      estimated_area: snapshot.estimated_area ?? "",
      previsit_date: snapshot.previsit_date ?? "",
      previsit_time: snapshot.previsit_time ?? "",
      notes: snapshot.notes ?? "",
      next_status: initialNextStatus,
    });
  }, [open, form, snapshot, initialNextStatus]);

  // Auto-update status when pre-visit is scheduled
  useEffect(() => {
    if (watchPrevisitDate && watchPrevisitDate.length > 0) {
      const previsitStatus = statusOptions.find(
        (status) => status.value === "Programmer pré-visite"
      );
      if (previsitStatus) {
        form.setValue("next_status", previsitStatus.value);
      }
    }
  }, [watchPrevisitDate, form, statusOptions]);

  const onSubmit = async (values: PhoningFormValues) => {
    const phoningPayload: PhoningSnapshot = {
      contact_result: values.contact_result,
      recontact_date: sanitizeText(values.recontact_date),
      recontact_time: sanitizeText(values.recontact_time),
      site_address: sanitizeText(values.site_address),
      headquarters_address: sanitizeText(values.headquarters_address),
      estimated_area: sanitizeText(values.estimated_area),
      previsit_date: sanitizeText(values.previsit_date),
      previsit_time: sanitizeText(values.previsit_time),
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
        title: "Phoning enregistré",
        description: "Les informations ont été sauvegardées.",
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
          Phoning Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Phoning Lead</DialogTitle>
          <DialogDescription>
            Enregistrez le résultat du contact et planifiez les prochaines étapes.
          </DialogDescription>
        </DialogHeader>

        {lastUpdatedLabel ? (
          <p className="text-xs text-muted-foreground">
            Dernière mise à jour : {lastUpdatedLabel}
          </p>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-6">
            <FormField
              control={form.control}
              name="contact_result"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Résultat du contact *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      {CONTACT_RESULT_OPTIONS.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`contact-${option}`} />
                          <Label htmlFor={`contact-${option}`} className="cursor-pointer font-normal">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional recontact date/time picker */}
            {watchContactResult === "À recontacter" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <h4 className="font-semibold text-sm">Planifier le recontact</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="recontact_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date de recontact</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {recontactDate ? (
                                  format(recontactDate, "PPP", { locale: fr })
                                ) : (
                                  <span>Choisir une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={recontactDate}
                              onSelect={(date) => {
                                setRecontactDate(date);
                                field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                              }}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recontact_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heure de recontact</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Address and Area Fields */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="site_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse chantier</FormLabel>
                    <FormControl>
                      <Input placeholder="Adresse du site de travaux" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="headquarters_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse siège social</FormLabel>
                    <FormControl>
                      <Input placeholder="Adresse administrative" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface estimée (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Surface en m²" {...field} />
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
                  <FormControl>
                    <Textarea rows={3} placeholder="Informations additionnelles" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pre-visit Scheduling Section */}
            <div className="space-y-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <h4 className="font-semibold">Programmer une pré-visite</h4>
              <p className="text-sm text-muted-foreground">
                Planifier une pré-visite changera automatiquement le statut du lead
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="previsit_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date de pré-visite</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {previsitDate ? (
                                format(previsitDate, "PPP", { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={previsitDate}
                            onSelect={(date) => {
                              setPrevisitDate(date);
                              field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="previsit_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heure de pré-visite</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="next_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut après le phoning</FormLabel>
                  <FormDescription>
                    {watchPrevisitDate && watchPrevisitDate.length > 0 
                      ? "Statut mis à jour automatiquement lors de la planification d'une pré-visite"
                      : "Sélectionnez le statut du lead après ce phoning"
                    }
                  </FormDescription>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={updateLead.isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateLead.isPending}>
                {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
