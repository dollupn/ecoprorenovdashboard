import { supabase } from "@/integrations/supabase/client";

export interface CreateNotificationParams {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export const createNotification = async (params: CreateNotificationParams) => {
  const { error } = await supabase.from("notifications").insert({
    org_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link || null,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error("Error creating notification:", error);
  }
};

export const createNewLeadNotification = async (
  orgId: string,
  userId: string,
  leadName: string,
  leadId: string
) => {
  await createNotification({
    orgId,
    userId,
    type: "new_lead",
    title: "Nouveau lead",
    message: `Un nouveau lead a été créé : ${leadName}`,
    link: `/leads`,
    metadata: { leadId },
  });
};

export const createQuoteExpiringNotification = async (
  orgId: string,
  userId: string,
  quoteRef: string,
  clientName: string,
  daysLeft: number,
  quoteId: string
) => {
  await createNotification({
    orgId,
    userId,
    type: "quote_expiring",
    title: "Devis à expirer",
    message: `Le devis ${quoteRef} pour ${clientName} expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
    link: `/quotes`,
    metadata: { quoteId, daysLeft },
  });
};

export const createQuoteCreatedNotification = async (
  orgId: string,
  userId: string,
  quoteRef: string,
  clientName: string,
  quoteId: string
) => {
  await createNotification({
    orgId,
    userId,
    type: "quote_created",
    title: "Nouveau devis créé",
    message: `Le devis ${quoteRef} a été créé pour ${clientName}`,
    link: `/quotes`,
    metadata: { quoteId },
  });
};

export const createProjectUpdateNotification = async (
  orgId: string,
  userId: string,
  projectRef: string,
  updateMessage: string,
  projectId: string
) => {
  await createNotification({
    orgId,
    userId,
    type: "project_update",
    title: "Mise à jour projet",
    message: `Projet ${projectRef}: ${updateMessage}`,
    link: `/projects/${projectId}`,
    metadata: { projectId },
  });
};
