import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDriveAuthUrl,
  exchangeDriveAuthCode,
  getDriveConnectionStatus,
  refreshDriveConnection,
  uploadFileToDrive,
  disconnectDrive,
  updateDriveSettings,
} from "./client";
import type {
  CreateAuthUrlParams,
  CreateAuthUrlResponse,
  DriveConnectionStatus,
  DriveUploadOptions,
  DriveUploadResult,
  ExchangeAuthCodePayload,
  UpdateDriveSettingsRequest,
} from "./types";

export const useDriveConnectionStatus = (orgId: string | null | undefined) =>
  useQuery<DriveConnectionStatus, Error>({
    queryKey: ["google-drive", "connection", orgId],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation inconnue");
      }
      return await getDriveConnectionStatus(orgId);
    },
    retry: (failureCount, error) => {
      if (error instanceof Error) {
        if (/credentials/i.test(error.message) || /serveur.*disponible/i.test(error.message)) {
          return false;
        }
      }
      return failureCount < 1;
    },
  });

export const useDriveAuthUrl = () =>
  useMutation<CreateAuthUrlResponse, Error, CreateAuthUrlParams>({
    mutationFn: async (params) => await createDriveAuthUrl(params),
  });

export const useDriveAuthExchange = () => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, ExchangeAuthCodePayload>({
    mutationFn: async (payload) => await exchangeDriveAuthCode(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["google-drive", "connection", data.orgId] });
    },
  });
};

export const useDriveConnectionRefresh = (accessToken?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, string>({
    mutationFn: async (orgId) => await refreshDriveConnection({ orgId, accessToken }),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive", "connection", data.orgId], data);
    },
  });
};

export const useDriveUpload = (accessToken?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<DriveUploadResult, Error, DriveUploadOptions>({
    mutationFn: async (options) => await uploadFileToDrive({ ...options, accessToken }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["google-drive", "connection", variables.orgId] });
    },
  });
};

export const useDriveDisconnect = (accessToken?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, string>({
    mutationFn: async (orgId) => await disconnectDrive({ orgId, accessToken }),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive", "connection", data.orgId], data);
    },
  });
};

export const useDriveSettingsUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, UpdateDriveSettingsRequest>({
    mutationFn: async (payload) => await updateDriveSettings(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["google-drive", "connection", data.orgId] });
    },
  });
};
