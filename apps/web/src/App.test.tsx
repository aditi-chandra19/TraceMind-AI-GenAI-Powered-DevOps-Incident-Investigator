import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api", async () => {
  const { demoIncidents } = await import("./data/demo");
  return { getIncidents: async () => ({ data: demoIncidents, mode: "demo" }) };
});

describe("TraceMind dashboard", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  it("shows seeded incidents and the demo-mode label", async () => {
    render(<App />);
    expect(await screen.findByText("DEMO DATA")).toBeInTheDocument();
    expect(screen.getByText("Recent incidents")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("INC-2847")).toBeInTheDocument();
  });

  it("filters incident rows by search text", async () => {
    render(<App />);
    const search = await screen.findByRole("textbox", { name: "Search incidents" });
    fireEvent.change(search, { target: { value: "payment" } });
    const table = screen.getByRole("table");
    await waitFor(() => expect(within(table).getByText("INC-2846")).toBeInTheDocument());
    expect(within(table).queryByText("INC-2847")).not.toBeInTheDocument();
  });

  it("filters incidents by severity", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Filter/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by severity" }), { target: { value: "critical" } });
    const table = screen.getByRole("table");
    await waitFor(() => expect(within(table).getByText("INC-2847")).toBeInTheDocument());
    expect(within(table).queryByText("INC-2846")).not.toBeInTheDocument();
  });
});
