"use client";

import { useState, useCallback, useEffect } from "react";
import { getUserByIdAction } from "../actions/user.actions";
import { UserDetails } from "../types/user.types";

interface Props {
  userId: string;
  onSuccess?: (user: UserDetails) => void;
}

export function useUser({ userId, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetails | null>(null);

  const getUser = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getUserByIdAction(userId);

      if (!response.success) {
        setError(response.error.message);
      } else {
        setUser(response.data);
        onSuccess?.(response.data);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get user";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, onSuccess]);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setUser(null);
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void getUser();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [getUser]);

  return {
    getUser,
    isLoading,
    error,
    user,
    reset,
  };
}
