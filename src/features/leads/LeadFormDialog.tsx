import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  getLeadStatusLabel,
  LEAD_STATUSES,
  leadStatusEnum,
  type LeadStatus,
} from "@/components/leads/status";
import { DynamicFields } from "./DynamicFields";
import {
  getOrganizationMembers,
  getOrganizationProducts,
  useCreateLead,
} from "./api";
import type { TablesInsert } from "@/integrations/supabase/types";

const leadSchema = z.object({
  full_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  company: z.string().optional(),
  email: z.string().email("Email invalide"),
  phone_raw: z.string().min(6, "Numéro de téléphone invalide"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(4, "Code postal invalide"),
  product_type: z.string().min(1, "Le type de produit est requis"),
  utm_source: z.string().optional(),
  status: leadStatusEnum,
  commentaire: z.string().optional(),
  assigned_to: z.string().optional(),
  extra_fields: z.record(z.any()).default({}),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface LeadFormDialogProps {
  onCreated?: () => void | Promise<void>;
}

export const LeadFormDialog = ({ onCreated }: LeadFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const orgId = user?.id ?? null;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      full_name: "",
      company: "",
      email: "",
      phone_raw: "",
      city: "",
      postal_code: "",
      product_type: "",
      utm_source: "",
      status: "Nouveau",
      commentaire: "",
      assigned_to: user?.id ?? "",
      extra_fields: {},
    },
  });

  useEffect(() => {
    if (user?.id) {
      form.setValue("assigned_to", user.id);
    }
  }, [user?.id, form]);

  const { data: products } = useQueryOrganizationProducts(orgId);
  const { data: members } = useQueryOrganizationMembers(orgId);

  const currentMemberRole = useMemo(() => {
    if (!members || !user?.id) return null;
    return members.find((member) => member.user_id === user.id)?.role ?? null;
  }, [members, user?.id]);

  const canAssignOthers = currentMemberRole === "owner" || currentMemberRole === "admin";

  const productType = form.watch("product_type");

  useEffect(() => {
    if (!productType) return;
    form.setValue("extra_fields", {});
  }, [productType, form]);

  useEffect(() => {
    if (!form.getValues("product_type") && products?.length === 1) {
      form.setValue("product_type", products[0].name);
    }
  }, [products, form]);

  const createLead = useCreateLead(orgId);

  const isSubmitting = createLead.isPending;

  const onSubmit = async (values: LeadFormValues) => {
    if (!user?.id || !orgId) {
      toast({
        title: "Authentification requise",
        description: "Connectez-vous pour créer un lead",
        variant: "destructive",
      });
      return;
    }

    form.clearErrors();

    const selectedProduct = products?.find((product) => product.name === values.product_type);

    const payload = {
      full_name: values.full_name,
      email: values.email,
      phone_raw: values.phone_raw,
      city: values.city,
      postal_code: values.postal_code,
      status: values.status,
      company: values.company?.trim() ? values.company : null,
      product_name: selectedProduct?.label ?? values.product_type,
      utm_source: values.utm_source?.trim() ? values.utm_source : null,
      commentaire: values.commentaire?.trim() ? values.commentaire : null,
      user_id: user.id,
      org_id: orgId,
    } as TablesInsert<"leads">;

    try {
      await createLead.mutateAsync(payload);

      toast({
        title: "Lead créé",
        description: "Le lead a été ajouté avec succès",
      });

      form.reset({
        full_name: "",
        company: "",
        email: "",
        phone_raw: "",
        city: "",
        postal_code: "",
        product_type: products?.length === 1 ? products[0].name : "",
        utm_source: "",
        status: "Nouveau",
        commentaire: "",
        assigned_to: user.id,
        extra_fields: {},
      });

      setOpen(false);
      await onCreated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  };

  const assignedOptions = useMemo(() => {
    const base: { user_id: string; label: string; role: string }[] = (members ?? [])
      .map((member) => ({
        user_id: member.user_id,
        role: member.role,
        label: member.profile?.full_name ?? member.user_id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (user?.id && !base.some((member) => member.user_id === user.id)) {
      base.push({
        user_id: user.id,
        role: currentMemberRole ?? "member",
        label:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          user.id,
      });
    }

    return base;
  }, [members, user?.id, user?.email, user?.user_metadata, currentMemberRole]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      form.reset({
        full_name: "",
        company: "",
        email: "",
        phone_raw: "",
        city: "",
        postal_code: "",
        product_type: products?.length === 1 ? products[0].name : "",
        utm_source: "",
        status: "Nouveau",
        commentaire: "",
        assigned_to: user?.id ?? "",
        extra_fields: {},
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter un lead</DialogTitle>
          <DialogDescription>
            Renseignez les informations du prospect et les détails produit
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entreprise</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone_raw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de produit *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value}
                      disabled={isSubmitting || !products?.length}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un produit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(products ?? []).map((product) => (
                          <SelectItem key={product.id} value={product.name}>
                            {product.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!products?.length ? (
                      <p className="text-xs text-muted-foreground">
                        Aucun produit disponible. Ajoutez des produits dans le catalogue.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigné à</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value ?? ""}
                      disabled={!canAssignOthers || isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un membre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignedOptions.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.label}
                            {member.role === "owner" || member.role === "admin" ? " (Admin)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canAssignOthers ? (
                      <p className="text-xs text-muted-foreground">Assigné automatiquement à vous-même</p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="utm_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select
                      onValueChange={(value: LeadStatus) => field.onChange(value)}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
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
            </div>

            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentaire</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting || !products?.length}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer le lead"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

type ProductsResult = Awaited<ReturnType<typeof getOrganizationProducts>>;
type MembersResult = Awaited<ReturnType<typeof getOrganizationMembers>>;

const useQueryOrganizationProducts = (orgId: string | null) =>
  useQuery<ProductsResult, Error>({
    queryKey: ["products", orgId],
    queryFn: () => getOrganizationProducts(orgId as string),
    enabled: Boolean(orgId),
  });

const useQueryOrganizationMembers = (orgId: string | null) =>
  useQuery<MembersResult, Error>({
    queryKey: ["memberships", orgId],
    queryFn: () => getOrganizationMembers(orgId as string),
    enabled: Boolean(orgId),
  });
