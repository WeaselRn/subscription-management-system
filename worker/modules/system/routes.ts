/**
 * Platform endpoints: health check and the signed-in user's notifications (outbox).
 * Owner: Person 1 (core backend).
 */
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { currentUser, requireAuth, requirePermission } from "../../lib/auth";
import { nowISO, schema } from "../../lib/db";

export const systemRoutes = new Hono<AppEnv>()
  .get("/health", async (c) => {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({ status: "ok", database: row?.ok === 1 ? "ok" : "unavailable", time: new Date().toISOString() });
  })

  /** In-app notifications for the signed-in user, plus emails addressed to them (simulated outbox). */
  .get("/notifications", requireAuth, async (c) => {
    const user = currentUser(c);
    const { notifications: n } = schema;
    const mine = or(eq(n.userId, user.id), and(eq(n.channel, "email"), eq(n.recipient, user.email)));
    const [rows, unread] = await Promise.all([
      c.get("db").select().from(n).where(mine).orderBy(desc(n.createdAt)).limit(100),
      c.get("db").select({ n: count() }).from(n).where(and(mine, isNull(n.readAt))).get(),
    ]);
    return c.json({ data: rows, unread: unread?.n ?? 0 });
  })

  .get("/notifications/unread-count", requireAuth, async (c) => {
    const user = currentUser(c);
    const { notifications: n } = schema;
    const row = await c
      .get("db")
      .select({ n: count() })
      .from(n)
      .where(and(or(eq(n.userId, user.id), and(eq(n.channel, "email"), eq(n.recipient, user.email))), isNull(n.readAt)))
      .get();
    return c.json({ unread: row?.n ?? 0 });
  })

  /** Mark one notification (or all with id "all") as read. Only the user's own notifications change. */
  .post("/notifications/:id/read", requireAuth, async (c) => {
    const user = currentUser(c);
    const { notifications: n } = schema;
    const mine = or(eq(n.userId, user.id), and(eq(n.channel, "email"), eq(n.recipient, user.email)));
    const id = c.req.param("id");
    await c
      .get("db")
      .update(n)
      .set({ readAt: nowISO() })
      .where(and(mine, isNull(n.readAt), id === "all" ? undefined : eq(n.id, id)));
    return c.json({ ok: true });
  })

  /** Simulated email outbox for demos: admins and staff can read every message. */
  .get("/outbox", requirePermission("customer:read"), async (c) => {
    const { notifications: n } = schema;
    const rows = await c.get("db").select().from(n).where(eq(n.channel, "email")).orderBy(desc(n.createdAt)).limit(100);
    return c.json({ data: rows });
  });
