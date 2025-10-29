import { supabase } from "@/integrations/supabase/client";

export type ExportFormat = "csv" | "pdf";

type ExportResult = {
  success: boolean;
  message: string;
  downloadUrl?: string;
};

const invokeSupabaseExport = async (
  functionName: string,
  payload: Record<string, unknown>,
  typeLabel: string,
  format: ExportFormat,
): Promise<ExportResult> => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });

    if (error) {
      throw error;
    }

    if (data?.downloadUrl) {
      return {
        success: true,
        message: `Export ${typeLabel} disponible via Supabase`,
        downloadUrl: data.downloadUrl as string,
      };
    }

    return {
      success: true,
      message: data?.message ?? `Export ${typeLabel} généré via Supabase`,
    };
  } catch (error) {
    console.warn(`[accounting] Supabase function ${functionName} unavailable`, error);

    return {
      success: true,
      message: `Export ${typeLabel} ${format.toUpperCase()} simulé. Connectez la fonction Supabase "${functionName}" pour générer le fichier réel.`,
    };
  }
};

export const generateFECExport = async (format: ExportFormat = "csv"): Promise<ExportResult> => {
  return invokeSupabaseExport(
    "generate-fec",
    { format },
    "FEC",
    format,
  );
};

export const generateBalanceExport = async (format: ExportFormat = "csv"): Promise<ExportResult> => {
  return invokeSupabaseExport(
    "generate-balance",
    { format },
    "balance",
    format,
  );
};

export const generateJournalExport = async (format: ExportFormat = "csv"): Promise<ExportResult> => {
  return invokeSupabaseExport(
    "generate-journal",
    { format },
    "journal",
    format,
  );
};
