"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, MessagesSquare } from "lucide-react";
import { api, ApiException } from "@/lib/api";
import { storeTokens } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState("owner@demo.aichat.id");
  const [password, setPassword] = useState("Password123!");

  const mutation = useMutation({
    mutationFn: () => api.auth.login({ email, password }),
    onSuccess: (data) => {
      storeTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace(params.get("next") ?? "/dashboard");
      router.refresh();
    },
  });

  const errorMessage =
    mutation.error instanceof ApiException
      ? mutation.error.message
      : mutation.error
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
          Masuk ke AI Chat
        </h2>
        <p className="text-sm text-muted-foreground">
          Selamat datang kembali. Masukkan kredensial Anda.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {errorMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {errorMessage}
          </motion.p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Masuk
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>

      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs text-muted-foreground">
        Akun demo sudah terisi otomatis · jalankan seed terlebih dahulu
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
