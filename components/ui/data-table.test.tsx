import type { ColumnDef } from "@tanstack/react-table";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

interface Row {
  name: string;
  email: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
];

beforeEach(() => {
  window.localStorage.setItem(
    "table-column-visibility-regression-table",
    JSON.stringify({ email: false }),
  );
});

describe("DataTable visibility persistence", () => {
  it("keeps stored visibility across rerenders with unstable object identity", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const data = [{ name: "Acme", email: "alice@acme.test" }];

    const { rerender } = render(
      <DataTable
        columns={columns}
        data={data}
        initialVisibilityState={{ email: true }}
        showColumnToggle={false}
        showHeader={false}
        showPagination={false}
        tableId="regression-table"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Email")).toBeNull());
    const writesBeforeEquivalentRerender = setItem.mock.calls.length;

    rerender(
      <DataTable
        columns={columns}
        data={data}
        initialVisibilityState={{ email: true }}
        showColumnToggle={false}
        showHeader={false}
        showPagination={false}
        tableId="regression-table"
      />,
    );

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("table-column-visibility-regression-table") ?? "{}"))
        .toEqual({ email: false });
    });
    expect(setItem).toHaveBeenCalledTimes(writesBeforeEquivalentRerender);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Maximum update depth");
  });
});
