import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Member } from "@/features/members/api";
import { useOrg } from "@/features/organizations/OrgContext";
import { useAuth } from "@/hooks/useAuth";

const scheduleSchema = z.object({
  appointmentTypeId: z.string({ required_error: "Le type de RDV est requis" }).min(1, "Sélectionnez un type de RDV"),
  appointmentDate: z.string({ required_error: "La date du RDV est requise" }).min(1, "La date du RDV est requise"),
  appointmentTime: z.string({ required_error: "L'heure du RDV est requise" }).min(1, "L'heure du RDV est requise"),
  assigneeId: z.string({ required_error: "L'assignation est requise" }).min(1, "Sélectionnez un assigné"),
  notes: z.string().max(2000, "La note est trop longue").optional(),
});

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const getDefaultAppointmentTime = () => {
  const date = new Date();
  const remainder = date.getMinutes() % 15;
  if (remainder !== 0) {
    date.setMinutes(date.getMinutes() + (15 - remainder));
  }
  date.setSeconds(0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const resolveMemberLabel = (member: Member) => {
  const raw = member.profiles?.full_name?.trim();
  if (raw && raw.length > 0) {
    return raw;
  }
  return "Utilisateur";
};

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

type AppointmentType = Pick<Tables<"appointment_types">, "id" | "name">;

type ProjectScheduleDialogProps = {
  projectId: string;
  members: Member[];
  isLoadingMembers?: boolean;
  onScheduled?: () => void | Promise<void>;
};

export const ProjectScheduleDialog = ({ projectId, members, isLoadingMembers = false, onScheduled }: ProjectScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const { user } = useAuth();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      appointmentTypeId: "",
      appointmentDate: getTodayDateString(),
      appointmentTime: getDefaultAppointmentTime(),
      assigneeId: "",
      notes: "",
    },
  });

  const memberOptions = useMemo(() => {
    return members
      .map((member) => ({ value: member.user_id, label: resolveMemberLabel(member) }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
  }, [members]);

  const defaultAssigneeId = useMemo(() => {
    if (memberOptions.length === 0) {
      return "";
    }

    const currentUserId = user?.id ?? null;
    if (currentUserId) {
      const match = memberOptions.find((option) => option.value === currentUserId);
      if (match) {
        return match.value;
      }
    }

    return memberOptions[0]?.value ?? "";
  }, [memberOptions, user?.id]);

  const { data: appointmentTypes = [], isLoading: appointmentTypesLoading } = useQuery<AppointmentType[]>({
    queryKey: ["appointmentTypes", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];

      const { data, error } = await supabase
        .from("appointment_types")
        .select("id, name, is_active")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((item) => ({ id: item.id, name: item.name }));
    },
    enabled: Boolean(currentOrgId && open),
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      appointmentTypeId: appointmentTypes[0]?.id ?? "",
      appointmentDate: getTodayDateString(),
      appointmentTime: getDefaultAppointmentTime(),
      assigneeId: defaultAssigneeId,
      notes: "",
    });
  }, [open, appointmentTypes, defaultAssigneeId, form]);

  const scheduleMutation = useMutation({
    mutationFn: async (values: ScheduleFormValues) => {
      if (!currentOrgId) {
        throw new Error("Organisation introuvable");
      }

      if (!user?.id) {
        throw new Error("Utilisateur non authentifié");
      }

      const payload = {
        project_id: projectId,
        org_id: currentOrgId,
        appointment_type_id: values.appointmentTypeId || null,
        appointment_date: values.appointmentDate,
        appointment_time: values.appointmentTime,
        assignee_id: values.assigneeId || null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        created_by: user.id,
        status: "scheduled" as const,
      };

      const { error } = await supabase.from("project_appointments").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({
        title: "RDV planifié",
        description: "Le rendez-vous a été enregistré avec succès.",
      });
      setOpen(false);
      await onScheduled?.();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
      toast({
        title: "Impossible de planifier le RDV",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await scheduleMutation.mutateAsync(values);
  });

  const hasSchedulingPrerequisites = appointmentTypes.length > 0 && memberOptions.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={isLoadingMembers}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          Planifier RDV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planifier un rendez-vous</DialogTitle>
          <DialogDescription>
            Confirmez le type de rendez-vous, la date et l'équipe assignée au projet.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="appointmentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de RDV *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={appointmentTypesLoading || appointmentTypes.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {appointmentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
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
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigné *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={memberOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {memberOptions.map((member) => (
                          <SelectItem key={member.value} value={member.value}>
                            {member.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure *</FormLabel>
                    <FormControl>
                      <Input type="time" step={900} {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informations complémentaires, contexte, points d'attention..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!hasSchedulingPrerequisites ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">
                Configurez au moins un type de RDV actif et un membre assignable pour planifier un rendez-vous.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={scheduleMutation.isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={!hasSchedulingPrerequisites || scheduleMutation.isPending}>
                {scheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer le RDV
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
