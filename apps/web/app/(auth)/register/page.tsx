"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, MessagesSquare } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { storeTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [form, setForm] = useState({
    workspace_name: "",
    name: "",
    email: "",
    password: "",
  });

  const update =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => api.auth.register(form),
    onSuccess: (data) => {
      storeTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace("/dashboard");
      router.refresh();
    },
  });

  const fieldError = (field: string) =>
    mutation.error instanceof ApiException
      ? mutation.error.details?.[field]
      : undefined;

  const generalError =
    mutation.error instanceof ApiException && !mutation.error.details
      ? mutation.error.message
      : mutation.error && !(mutation.error instanceof ApiException)
        ? "Tidak dapat terhubung ke server"
        : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="space-y-2 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950">
          <MessagesSquare className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          Buat workspace baru
        </h2>
        <p className="text-sm text-muted-foreground">
          Daftar sebagai OWNER dan undang tim Anda nanti.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Field
          id="workspace_name"
          label="Nama perusahaan / workspace"
          placeholder="PT Maju Jaya"
          value={form.workspace_name}
          onChange={update("workspace_name")}
          error={fieldError("workspace_name")}
        />
        <Field
          id="name"
          label="Nama lengkap"
          placeholder="Budi Santoso"
          value={form.name}
          onChange={update("name")}
          error={fieldError("name")}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="budi@perusahaan.com"
          value={form.email}
          onChange={update("email")}
          error={fieldError("email")}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          placeholder="Minimal 8 karakter"
          value={form.password}
          onChange={update("password")}
          error={fieldError("password")}
        />

        {generalError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {generalError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Buat akun
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </motion.div>
  );
}

function Field({
  id,
  label,
  error,
  type = "text",
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} required {...props} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
