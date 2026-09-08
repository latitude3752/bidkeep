import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Array<Record<string, unknown>> = [];

function makeClient() {
  return {
    from(table: string) {
      if (table !== "subscriber_seats") throw new Error(table);
      return {
        select() {
          const q = {
            data: rows.filter((r) => new Date(String(r.active_until)).getTime() > Date.now()),
            error: null,
            eq(col: string, val: string) {
              const found = rows.find((r) => r[col] === val) ?? null;
              return {
                maybeSingle: async () => ({ data: found, error: null }),
              };
            },
            gt() {
              return q;
            },
          };
          return q;
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                single: async () => {
                  const row = { id: "seat-1", ...payload };
                  rows.push(row);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(col: string, val: string) {
              const row = rows.find((r) => r[col] === val);
              if (row) Object.assign(row, payload);
              return {
                error: null,
                select() {
                  return {
                    single: async () => ({ data: row ?? null, error: row ? null : { message: "not found" } }),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => makeClient(),
}));

describe("subscriber-seats", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("createSeat lowercases email and returns a one-time password", async () => {
    const { createSeat, getSeatByEmail } = await import("./subscriber-seats");
    const created = await createSeat({
      email: "Lead@Acme.test",
      name: "Pat",
      company: "Acme Facilities",
    });
    expect(created.password.length).toBeGreaterThanOrEqual(20);
    expect(created.email).toBe("lead@acme.test");
    expect(created.password_hash.includes(created.password)).toBe(false);
    const fetched = await getSeatByEmail("LEAD@acme.test");
    expect(fetched?.id).toBe(created.id);
  });

  it("allows a second company to sign up independently", async () => {
    const { createSeat } = await import("./subscriber-seats");
    await createSeat({ email: "a@acme.test", name: "A", company: "Acme Facilities" });
    const other = await createSeat({ email: "b@other.test", name: "B", company: "Other Co" });
    expect(other.company).toBe("Other Co");
  });

  it("caps seats per company, independently of other companies", async () => {
    const { createSeat } = await import("./subscriber-seats");
    for (let i = 0; i < 5; i++) {
      await createSeat({ email: `seat${i}@acme.test`, name: `Seat ${i}`, company: "Acme Facilities" });
    }
    await expect(
      createSeat({ email: "overflow@acme.test", name: "Overflow", company: "Acme Facilities" })
    ).rejects.toThrow(/Seat cap reached/);
    // A different company isn't affected by Acme's cap.
    await expect(
      createSeat({ email: "a@other.test", name: "A", company: "Other Co" })
    ).resolves.toBeTruthy();
  });

  it("re-provisions a revoked email instead of inserting a duplicate", async () => {
    const { createSeat, revokeSeat, getSeatByEmail } = await import("./subscriber-seats");
    const first = await createSeat({
      email: "Lead@Acme.test",
      name: "Pat",
      company: "Acme Facilities",
    });
    await revokeSeat(first.id);
    const reissued = await createSeat({
      email: "LEAD@acme.test",
      name: "Pat",
      company: "Acme Facilities",
    });
    expect(reissued.password.length).toBeGreaterThanOrEqual(20);
    expect(reissued.password).not.toBe(first.password);
    expect(reissued.id).toBe(first.id);
    expect(reissued.email).toBe("lead@acme.test");
    const fetched = await getSeatByEmail("LEAD@acme.test");
    expect(fetched?.id).toBe(first.id);
    expect(rows.filter((r) => r.email === "lead@acme.test")).toHaveLength(1);
  });

  it("extendSeatAccess updates the expiry without rotating the password hash", async () => {
    const { createSeat, extendSeatAccess, getSeatByEmail } = await import("./subscriber-seats");
    const created = await createSeat({
      email: "lead@acme.test",
      name: "Pat",
      company: "Acme Facilities",
    });
    const until = new Date("2030-01-15T00:00:00.000Z");
    const extended = await extendSeatAccess("LEAD@acme.test", until);
    expect(extended?.active_until).toBe(until.toISOString());
    expect(extended?.password_hash).toBe(created.password_hash);
    const fetched = await getSeatByEmail("lead@acme.test");
    expect(fetched?.active_until).toBe(until.toISOString());
  });

  it("extendSeatAccess returns null when the email has no seat", async () => {
    const { extendSeatAccess } = await import("./subscriber-seats");
    await expect(extendSeatAccess("nobody@acme.test", new Date())).resolves.toBeNull();
  });

  it("resetSeatPassword rotates the hash and returns a new password", async () => {
    const { createSeat, resetSeatPassword, getSeatByEmail } = await import(
      "./subscriber-seats"
    );
    const created = await createSeat({
      email: "lead@acme.test",
      name: "Pat",
      company: "Acme Facilities",
    });
    const reset = await resetSeatPassword("LEAD@acme.test");
    expect(reset?.password.length).toBeGreaterThanOrEqual(20);
    expect(reset?.password).not.toBe(created.password);
    const fetched = await getSeatByEmail("lead@acme.test");
    expect(fetched?.password_hash).not.toBe(created.password_hash);
  });

  it("resetSeatPassword returns null when the email has no seat", async () => {
    const { resetSeatPassword } = await import("./subscriber-seats");
    await expect(resetSeatPassword("nobody@acme.test")).resolves.toBeNull();
  });
});
