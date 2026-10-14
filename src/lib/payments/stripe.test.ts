import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleStripeEvent, verifyStripeSignature, type StripeEventDeps } from "./stripe";

const SECRET = "whsec_test";
const sign = (payload: string, t: number, secret = SECRET) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

describe("verifyStripeSignature", () => {
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000_000;
  const t = Math.floor(now / 1000);

  it("accepts a correctly signed, recent payload", () => {
    expect(verifyStripeSignature(payload, sign(payload, t), SECRET, now)).toBe(true);
  });

  it("accepts when any of several v1 signatures matches (secret rotation)", () => {
    const header = `t=${t},v1=${"0".repeat(64)},${sign(payload, t).split(",")[1]}`;
    expect(verifyStripeSignature(payload, header, SECRET, now)).toBe(true);
  });

  it("rejects a tampered payload, wrong secret, old timestamp or junk header", () => {
    expect(verifyStripeSignature('{"id":"evt_2"}', sign(payload, t), SECRET, now)).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, t, "whsec_other"), SECRET, now)).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, t - 600), SECRET, now)).toBe(false);
    expect(verifyStripeSignature(payload, "nonsense", SECRET, now)).toBe(false);
    expect(verifyStripeSignature(payload, "", SECRET, now)).toBe(false);
  });
});

describe("handleStripeEvent", () => {
  const deps = () => ({
    alreadyProcessed: vi.fn<StripeEventDeps["alreadyProcessed"]>(async () => false),
    markProcessed: vi.fn<StripeEventDeps["markProcessed"]>(async () => {}),
    grant: vi.fn<StripeEventDeps["grant"]>(async () => {}),
    revokeBySubscription: vi.fn<StripeEventDeps["revokeBySubscription"]>(async () => {}),
  });

  it("grants access when a checkout completes and is paid", async () => {
    const d = deps();
    await handleStripeEvent(
      {
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            client_reference_id: "00000000-0000-4000-8000-00000000000a",
            payment_status: "paid",
            customer: "cus_1",
            subscription: null,
          },
        },
      },
      d,
    );
    expect(d.grant).toHaveBeenCalledWith("00000000-0000-4000-8000-00000000000a", {
      customer: "cus_1",
      session: "cs_1",
      subscription: null,
    });
    expect(d.markProcessed).toHaveBeenCalledWith("evt_1", "checkout.session.completed");
  });

  it("does not grant for unpaid sessions or sessions without a valid user", async () => {
    const d = deps();
    const base = { id: "cs", customer: null, subscription: null };
    await handleStripeEvent({ id: "e1", type: "checkout.session.completed", data: { object: { ...base, client_reference_id: "00000000-0000-4000-8000-00000000000a", payment_status: "unpaid" } } }, d);
    await handleStripeEvent({ id: "e2", type: "checkout.session.completed", data: { object: { ...base, client_reference_id: "not-a-uuid", payment_status: "paid" } } }, d);
    expect(d.grant).not.toHaveBeenCalled();
  });

  it("revokes when a subscription ends", async () => {
    const d = deps();
    await handleStripeEvent({ id: "e3", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } }, d);
    expect(d.revokeBySubscription).toHaveBeenCalledWith("sub_1");
  });

  it("ignores events it has already processed", async () => {
    const d = { ...deps(), alreadyProcessed: vi.fn<StripeEventDeps["alreadyProcessed"]>(async () => true) };
    await handleStripeEvent({ id: "evt_1", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } }, d);
    expect(d.revokeBySubscription).not.toHaveBeenCalled();
    expect(d.markProcessed).not.toHaveBeenCalled();
  });
});
