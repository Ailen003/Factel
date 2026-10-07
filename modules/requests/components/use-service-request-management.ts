"use client";

import { useCallback, useState } from "react";
import type { ServiceRequest, ServiceRequestStatus } from "../lib/types/service-request.types";

export interface ServiceRequestStatusSelection {
  request: ServiceRequest;
  targetStatus: ServiceRequestStatus;
}

export function useServiceRequestManagement() {
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [statusSelection, setStatusSelection] = useState<ServiceRequestStatusSelection | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<ServiceRequest | null>(null);

  const closeView = useCallback(() => setViewingRequestId(null), []);
  const closeEdit = useCallback(() => setEditingRequestId(null), []);
  const closeStatus = useCallback(() => setStatusSelection(null), []);
  const closeDelete = useCallback(() => setDeletingRequest(null), []);
  const view = useCallback((request: ServiceRequest) => setViewingRequestId(request.id), []);
  const edit = useCallback((request: ServiceRequest) => setEditingRequestId(request.id), []);
  const changeStatus = useCallback((request: ServiceRequest, targetStatus: ServiceRequestStatus) =>
    setStatusSelection({ request, targetStatus }), []);
  const remove = useCallback((request: ServiceRequest) => setDeletingRequest(request), []);

  return {
    viewingRequestId,
    editingRequestId,
    statusSelection,
    deletingRequest,
    view,
    edit,
    changeStatus,
    remove,
    closeView,
    closeEdit,
    closeStatus,
    closeDelete,
  };
}

export type ServiceRequestManagement = ReturnType<typeof useServiceRequestManagement>;
