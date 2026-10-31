/**
 * Account card for every role: edit display name and change password.
 * Owner: Person 1 (shared by staff profile and customer portal profile).
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { changePasswordSchema } from "@shared/schemas";
import type { SessionUser } from "@shared/types";
import { Alert, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { applyServerErrors, useZodForm } from "@/lib/forms";
import { useAction } from "@/lib/hooks";
import { PasswordChecklist } from "@/modules/auth/pages";

export function AccountSettings({ showName = true }: { showName?: boolean }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const saveName = useAction(() => api.patch<{ user: SessionUser }>("/auth/me", { name }), {
    success: "Name updated",
    onSuccess: (r) => qc.setQueryData(["session"], r.user),
  });

  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(changePasswordSchema, { defaultValues: { currentPassword: "", newPassword: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    setDone(null);
    try {
      const r = await api.post<{ message: string }>("/auth/change-password", v);
      setDone(r.message);
      form.reset();
    } catch (err) {
      setError(applyServerErrors(form, err));
    }
  });

  return (
    <div className="space-y-6">
      {showName && (
        <Card>
          <CardHeader title="Account" description={user?.email} />
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <Field label="Display name" htmlFor="acc-name" className="flex-1">
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button variant="secondary" onClick={() => saveName.mutate(undefined)} loading={saveName.isPending} disabled={!name.trim() || name === user?.name}>
              Save name
            </Button>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Change password" description="Other devices are signed out after a change." />
        <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="success">{done}</Alert>}
          <Field label="Current password" htmlFor="acc-cur" error={errors.currentPassword?.message}>
            <Input id="acc-cur" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...form.register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="acc-new" error={errors.newPassword?.message}>
            <Input id="acc-new" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...form.register("newPassword")} />
            <PasswordChecklist value={form.watch("newPassword") ?? ""} />
          </Field>
          <Button type="submit" loading={isSubmitting}>Update password</Button>
        </form>
      </Card>
    </div>
  );
}
