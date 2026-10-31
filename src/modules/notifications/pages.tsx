/**
 * Notifications centre for every role, plus the simulated email outbox for staff.
 * Owner: Person 1.
 */
import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, Mail } from "lucide-react";
import type { Notification } from "@shared/types";
import { Badge, Button, Card, EmptyState, Page, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useCan, useSession } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { cn, dateTime } from "@/lib/utils";

type Tab = "mine" | "unread" | "outbox";

/** Where a notification links to, by entity and role. */
function linkFor(n: Notification, portal: boolean): string | null {
  if (n.entity === "invoice" && n.entityId) return portal ? `/portal/invoices/${n.entityId}` : `/invoices/${n.entityId}`;
  if (portal) return n.entity === "subscription" && n.entityId ? `/portal/subscriptions/${n.entityId}` : null;
  if (n.entity === "subscription" && n.entityId) return `/subscriptions/${n.entityId}`;
  if (n.entity === "renewal") return "/renewals";
  if (n.entity === "retention") return "/retention";
  return null;
}

export function NotificationsPage() {
  const { user } = useSession();
  const portal = user?.role === "customer";
  const canOutbox = useCan("customer:read");
  const [tab, setTab] = useState<Tab>("mine");
  const mine = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<{ data: Notification[]; unread: number }>("/notifications") });
  const outbox = useQuery({ queryKey: ["notifications", "outbox"], queryFn: () => api.get<{ data: Notification[] }>("/outbox"), enabled: tab === "outbox" });
  const read = useAction((id: string) => api.post(`/notifications/${id}/read`), { invalidate: [["notifications"]] });

  const rows = tab === "outbox" ? outbox.data?.data : tab === "unread" ? mine.data?.data.filter((n) => !n.readAt) : mine.data?.data;
  const loading = tab === "outbox" ? outbox.isLoading : mine.isLoading;

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description={portal ? "Invoices, reminders and account messages sent to you." : "Alerts for you, such as escalated overdue invoices and renewals that need a decision."}
        actions={
          tab !== "outbox" && !!mine.data?.unread && (
            <Button variant="secondary" onClick={() => read.mutate("all")} loading={read.isPending && read.variables === "all"}>
              <CheckCheck /> Mark all read
            </Button>
          )
        }
      />
      <Card>
        <Tabs
          value={tab}
          onChange={setTab}
          className="px-4"
          items={[
            { value: "mine", label: "All" },
            { value: "unread", label: "Unread", count: mine.data?.unread },
            ...(canOutbox ? [{ value: "outbox" as const, label: "Email outbox (all customers)" }] : []),
          ]}
        />
        {tab === "outbox" && (
          <p className="border-b border-line bg-accent-soft/50 px-4 py-2 text-[12px] text-accent-ink">
            Demo mode: emails are simulated. They are stored here and never delivered.
          </p>
        )}
        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : rows?.length ? (
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const href = linkFor(n, portal);
              const unread = !n.readAt && tab !== "outbox";
              return (
                <li key={n.id} className={cn("flex gap-3 px-4 py-3", unread && "bg-primary-soft/40")}>
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", n.channel === "email" ? "bg-accent-soft text-accent-ink" : "bg-primary-soft text-primary")}>
                    {n.channel === "email" ? <Mail /> : <Bell />}
                  </span>
                  <div className="min-w-0 flex-1 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-ink", unread && "font-semibold")}>{n.subject}</span>
                      {n.status === "simulated" && <Badge tone="accent">Simulated email</Badge>}
                    </div>
                    {tab === "outbox" && <div className="text-[12px] text-muted">To {n.recipient}</div>}
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-body">{n.body}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-muted">
                      {dateTime(n.createdAt)}
                      {href && <Link to={href} className="font-medium text-primary hover:underline" onClick={() => unread && read.mutate(n.id)}>Open</Link>}
                      {unread && <button className="font-medium text-primary hover:underline" onClick={() => read.mutate(n.id)}>Mark read</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Bell />} title={tab === "unread" ? "You're all caught up" : "No notifications yet"} />
        )}
      </Card>
    </Page>
  );
}

/** Bell with unread count for the top bar; polls every 60 s. */
export function NotificationBell({ portal }: { portal?: boolean }) {
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ unread: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
  const n = unread.data?.unread ?? 0;
  return (
    <Link
      to={portal ? "/portal/notifications" : "/notifications"}
      aria-label={`Notifications${n ? `, ${n} unread` : ""}`}
      className="relative grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
    >
      <Bell className="size-4" />
      {n > 0 && (
        <span className="tabular absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
