import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { todayISO } from "../../shared/dates";
import { api, createUser, login } from "./helpers";

describe("account self-service", () => {
  it("lets any role rename themselves and change their password", async () => {
    await createUser("acct-staff@example.com", "staff");
    const cookie = await login("acct-staff@example.com");
    const renamed = await api("/auth/me", { method: "PATCH", cookie, body: JSON.stringify({ name: "Renamed" }) });
    expect(renamed.body.user.name).toBe("Renamed");

    const wrong = await api("/auth/change-password", { method: "POST", cookie, body: JSON.stringify({ currentPassword: "Nope!nope12", newPassword: "Another!Pass1" }) });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.fields.currentPassword).toBeTruthy();

    const other = await login("acct-staff@example.com");
    const ok = await api("/auth/change-password", { method: "POST", cookie, body: JSON.stringify({ currentPassword: "Password!23", newPassword: "Another!Pass1" }) });
    expect(ok.status).toBe(200);
    expect((await api("/auth/me", { cookie })).status).toBe(200); // this session stays
    expect((await api("/auth/me", { cookie: other })).status).toBe(401); // other sessions end
    await login("acct-staff@example.com", "Another!Pass1");
  });
});

describe("notifications", () => {
  it("shows only the user's own notifications and marks them read", async () => {
    const a = await createUser("notif-a@example.com", "staff");
    await createUser("notif-b@example.com", "staff");
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO notifications (id, channel, user_id, recipient, subject, body, status) VALUES ('n1','in_app',?1,'notif-a@example.com','A1','x','sent')`).bind(a),
      env.DB.prepare(`INSERT INTO notifications (id, channel, user_id, recipient, subject, body, status) VALUES ('n2','in_app',?1,'notif-a@example.com','A2','x','sent')`).bind(a),
    ]);
    const ca = await login("notif-a@example.com");
    const cb = await login("notif-b@example.com");
    expect((await api("/notifications/unread-count", { cookie: ca })).body.unread).toBe(2);
    expect((await api("/notifications", { cookie: cb })).body.data).toHaveLength(0);
    await api("/notifications/n1/read", { method: "POST", cookie: cb }); // not B's: no effect
    expect((await api("/notifications/unread-count", { cookie: ca })).body.unread).toBe(2);
    await api("/notifications/n1/read", { method: "POST", cookie: ca });
    expect((await api("/notifications/unread-count", { cookie: ca })).body.unread).toBe(1);
    await api("/notifications/all/read", { method: "POST", cookie: ca });
    expect((await api("/notifications/unread-count", { cookie: ca })).body.unread).toBe(0);
  });
});

describe("portal quotation decline", () => {
  it("closes the customer's own quotation and alerts staff", async () => {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO plans (id, name, price, billing_period, min_quantity, available_from) VALUES ('plan-d', 'Monthly D', 50000, 'monthly', 1, '2020-01-01')`),
    ]);
    const staffId = await createUser("decline-staff@example.com", "staff");
    const staff = await login("decline-staff@example.com");
    const signup = await api("/auth/signup", { method: "POST", body: JSON.stringify({ name: "Dee", email: "dee@example.com", password: "StrongPass!1" }) });
    const customerId = signup.body.user.customerId;
    const sub = (await api("/subscriptions", { method: "POST", cookie: staff, body: JSON.stringify({ customerId, planId: "plan-d", startDate: todayISO(), lines: [] }) })).body.data;
    expect((await api(`/portal/subscriptions/${sub.id}/decline`, { method: "POST", cookie: signup.cookie, body: "{}" })).status).toBe(409); // still a draft
    await api(`/subscriptions/${sub.id}/transition`, { method: "POST", cookie: staff, body: JSON.stringify({ to: "quotation" }) });

    const other = await api("/auth/signup", { method: "POST", body: JSON.stringify({ name: "Eve", email: "eve@example.com", password: "StrongPass!1" }) });
    expect((await api(`/portal/subscriptions/${sub.id}/decline`, { method: "POST", cookie: other.cookie, body: "{}" })).status).toBe(404);

    const declined = await api(`/portal/subscriptions/${sub.id}/decline`, { method: "POST", cookie: signup.cookie, body: JSON.stringify({ reason: "Too pricey" }) });
    expect(declined.body.data.status).toBe("closed");
    const alert = await env.DB.prepare(`SELECT subject FROM notifications WHERE user_id = ?1`).bind(staffId).first<{ subject: string }>();
    expect(alert?.subject).toContain("declined");
  });
});
