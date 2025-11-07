import type { Tables } from "@/integrations/supabase/types";
import type { ProjectFormValues } from "@/components/projects/AddProjectDialog";

type Project = Tables<"projects">;
type ProjectProduct = Pick<
  Tables<"project_products">,
  "product_id" | "quantity" | "dynamic_params"
>;

type Delegate = Pick<Tables<"delegates">, "id">;

type ProjectWithDelegate = {
  delegate?: Delegate | null;
};

type ProjectWithProducts = {
  project_products?: ProjectProduct[] | null;
};

type ProjectWithFormFields = Project & ProjectWithDelegate & ProjectWithProducts;

export type ProjectWithRelationsForForm = ProjectWithFormFields;

export const buildProjectFormInitialValues = (
  project: ProjectWithRelationsForForm,
): Partial<ProjectFormValues> => {
  const projectProductsForForm = (project.project_products ?? []).map((item) => ({
    product_id: item.product_id ?? "",
    quantity:
      typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? item.quantity
        : 1,
    dynamic_params: (item.dynamic_params ?? {}) as Record<string, unknown>,
  }));

  return {
    client_first_name: project.client_first_name ?? "",
    client_last_name: project.client_last_name ?? "",
    company: project.company ?? "",
    phone: project.phone ?? "",
    hq_address: project.hq_address ?? "",
    hq_city: project.hq_city ?? "",
    hq_postal_code: project.hq_postal_code ?? "",
    same_address: project.same_address ?? false,
    address: (project as Project & { address?: string | null }).address ?? "",
    city: project.city ?? "",
    postal_code: project.postal_code ?? "",
    siren: project.siren ?? "",
    external_reference: project.external_reference ?? "",
    products: projectProductsForForm.length > 0 ? projectProductsForForm : undefined,
    building_type: project.building_type ?? "",
    usage: project.usage ?? "",
    delegate_id: project.delegate_id ?? project.delegate?.id ?? undefined,
    signatory_name: project.signatory_name ?? "",
    signatory_title: project.signatory_title ?? "",
    surface_batiment_m2: project.surface_batiment_m2 ?? undefined,
    status: project.status ?? "",
    assigned_to: project.assigned_to ?? "",
    source: project.source ?? "",
    date_debut_prevue: project.date_debut_prevue ?? undefined,
    date_fin_prevue: project.date_fin_prevue ?? undefined,
    estimated_value: project.estimated_value ?? undefined,
    lead_id: project.lead_id ?? undefined,
  };
};
