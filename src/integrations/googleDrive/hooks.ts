import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDriveAuthUrl,
  exchangeDriveAuthCode,
  getDriveConnectionStatus,
  refreshDriveConnection,
  uploadFileToDrive,
  disconnectDrive,
} from "./client";
import type {
  CreateAuthUrlParams,
  DriveConnectionStatus,
  DriveUploadOptions,
  DriveUploadResult,
  ExchangeAuthCodePayload,
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
  useMutation<{ url: string }, Error, CreateAuthUrlParams>({
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

export const useDriveConnectionRefresh = () => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, string>({
    mutationFn: async (orgId) => await refreshDriveConnection(orgId),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive", "connection", data.orgId], data);
    },
  });
};

export const useDriveUpload = () => {
  const queryClient = useQueryClient();
  return useMutation<DriveUploadResult, Error, DriveUploadOptions>({
    mutationFn: async (options) => await uploadFileToDrive(options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["google-drive", "connection", variables.orgId] });
    },
  });
};

export const useDriveDisconnect = () => {
  const queryClient = useQueryClient();
  return useMutation<DriveConnectionStatus, Error, string>({
    mutationFn: async (orgId) => await disconnectDrive(orgId),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive", "connection", data.orgId], data);
    },
  });
};
