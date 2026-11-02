"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { createUserSchema } from "@/lib/validation/users";
import { passwordSchema } from "@/lib/validation/auth";
import { ROLES } from "@/lib/roles";
import type { UserListItem } from "@/server/services/users";

const fmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const date = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "Never");

// One form for create + edit. Password is required on create, optional on edit.
const formSchema = createUserSchema.extend({
  password: z.union([z.literal(""), passwordSchema]),
});
type FormValues = z.infer<typeof formSchema>;

export default function UsersClient({ users, canWrite, currentUserId, hasFilters }: {
  users: UserListItem[]; canWrite: boolean; currentUserId: string; hasFilters: boolean;
}) {
  const [editing, setEditing] = useState<UserListItem | "new" | null>(null);

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setEditing("new")}>Add user</Button>
        </div>
      )}
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {users.length === 0 ? (
          <EmptyState title={hasFilters ? "No users match your filters" : "No users yet"}
            description={hasFilters ? "Try a different search or role." : "Add the first user to get started."} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Users</caption>
            <thead>
              <tr>
                <th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th>
                <th scope="col">Status</th><th scope="col">Last login</th>
                {canWrite && <th scope="col"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
                  <td className="text-muted">{u.email}</td>
                  <td><span className="badge-primary capitalize">{u.role}</span></td>
                  <td><span className={u.isActive ? "badge-success" : "badge-muted"}>{u.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="whitespace-nowrap text-muted">{date(u.lastLoginAt)}</td>
                  {canWrite && (
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>Edit</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add user" : "Edit user"}>
        {editing && <UserForm key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing}
          isSelf={editing !== "new" && editing.id === currentUserId} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function UserForm({ user, isSelf, onDone }: { user: UserListItem | null; isSelf: boolean; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(user ? formSchema : createUserSchema.extend({ password: passwordSchema })),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "editor", password: "" },
  });
  const [active, setActive] = useState(user?.isActive ?? true);

  async function onSubmit(v: FormValues) {
    setFormError(null);
    try {
      if (user) {
        await api.patch(`/admin/users/${user.id}`, {
          name: v.name,
          ...(isSelf ? {} : { role: v.role, isActive: active }),
          ...(v.password ? { password: v.password } : {}),
        });
        toast("User updated");
      } else {
        await api.post("/admin/users", v);
        toast("User created");
      }
      onDone();
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof FormValues, { message: m });
        setFormError(e.message);
      } else setFormError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && <p role="alert" className="alert-error">{formError}</p>}
      <Input label="Name" autoComplete="off" error={errors.name?.message} {...register("name")} />
      <Input label="Email" type="email" autoComplete="off" disabled={!!user} error={errors.email?.message} {...register("email")} />
      <Select label="Role" disabled={isSelf} error={errors.role?.message}
        {...register("role")}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </Select>
      {user && !isSelf && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-saffron-600" />
          Account active
        </label>
      )}
      {isSelf && <p className="text-xs text-muted">You cannot change your own role or deactivate your own account.</p>}
      <Input label={user ? "New password" : "Password"} type="password" autoComplete="new-password"
        hint={user ? "Leave blank to keep the current password. Changing it signs the user out everywhere." : "At least 10 characters with a letter and a number."}
        error={errors.password?.message} {...register("password")} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{user ? "Save changes" : "Create user"}</Button>
      </div>
    </form>
  );
}
