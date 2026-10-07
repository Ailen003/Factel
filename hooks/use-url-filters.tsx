"use client";
import { debounce } from "lodash";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

interface Props {
  scroll?: boolean;
}

export default function useUrlFilters({ scroll = false }: Props) {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const searchParamsKey = searchParams.toString();

  const debouncedUpdateRef = useRef(
    debounce(
      (
        updatedFilters: object,
        currentSearchParams: URLSearchParams,
        currentPathname: string,
        routerReplace: typeof replace,
        scrollOption: boolean,
      ) => {
        const searchUrl = new URLSearchParams(currentSearchParams);
        Object.entries(updatedFilters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (typeof value === "number") searchUrl.set(key, value.toString());
            else if (typeof value === "boolean")
              searchUrl.set(key, value ? "true" : "false");
            else if (Array.isArray(value)) {
              searchUrl.delete(key);
              value.forEach((item) => {
                searchUrl.append(key, item);
              });
            } else searchUrl.set(key, value);
          } else searchUrl.delete(key);
        });
        routerReplace(`${currentPathname}?${searchUrl.toString()}`, {
          scroll: scrollOption,
        });
      },
      300,
    ),
  );

  useEffect(() => {
    const pendingUpdate = debouncedUpdateRef.current;
    return () => pendingUpdate.cancel();
  }, [pathname, searchParamsKey]);

  const updateFiltersInUrl = useCallback(
    (updatedFilters: object) => {
      debouncedUpdateRef.current(
        updatedFilters,
        searchParams,
        pathname,
        replace,
        scroll,
      );
    },
    [searchParams, pathname, replace, scroll],
  );

  return { updateFiltersInUrl };
}
