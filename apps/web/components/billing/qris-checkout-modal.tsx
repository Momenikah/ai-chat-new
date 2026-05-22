"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, ShieldCheck, X } from "lucide-react";
import type { SaasPlan } from "@aichat/shared";

const WA_NUMBER = "6289685350650";
const QR_IMAGE =
  "https://adpublish.id/wp-content/uploads/2026/03/QRStatis-indigit.jpg";

function formatIDR(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function QrisCheckoutModal({
  plan,
  open,
  onClose,
}: {
  plan: SaasPlan | null;
  open: boolean;
  onClose: () => void;
}) {
  // Generate a stable order id + unique 3-digit transfer code per checkout
  // session so the payment can be matched manually on confirmation.
  const checkout = useMemo(() => {
    if (!plan) return null;
    const orderId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const uniqueCode = Math.floor(100 + Math.random() * 900);
    const total = plan.price_idr + uniqueCode;
    return { orderId, total };
  }, [plan]);

  if (!plan || !checkout) return null;

  const waMessage = `Halo Admin, saya ingin konfirmasi pembayaran:
Order ID: ${checkout.orderId}
Paket: ${plan.name}
Total: ${formatIDR(checkout.total)}

Saya sudah transfer via QRIS. Mohon diaktifkan. Terima kasih.`;
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-zinc-50/60 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4 text-emerald-600" />
                Secure Payment
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="text-center">
                <h2 className="text-lg font-bold tracking-tight">
                  Checkout {plan.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Order ID: {checkout.orderId}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-800">
                Selesaikan pembayaran sekarang agar pesanan masuk batch aktivasi
                cepat hari ini.
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-600">Total Pembayaran</span>
                  <span className="text-2xl font-bold tracking-tight text-blue-600">
                    {formatIDR(checkout.total)}
                  </span>
                </div>
                <p className="mt-1 w-fit rounded bg-blue-100/70 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  *Mohon transfer tepat hingga 3 digit terakhir
                </p>
              </div>

              <div className="mt-5 flex flex-col items-center text-center">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                    QRIS
                  </span>
                  <span className="text-base font-medium">Scan untuk bayar</span>
                </div>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Scan QR code di bawah ini menggunakan aplikasi E-Wallet atau
                  Mobile Banking Anda.
                </p>

                <div className="mt-3 rounded-xl border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={QR_IMAGE}
                    alt={`QRIS ${plan.name}`}
                    className="h-56 w-56 object-contain"
                  />
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] italic text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  Pembayaran QRIS terenkripsi & aman
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-2 border-t border-border px-5 py-4">
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                Konfirmasi Pembayaran via WhatsApp
                <WhatsAppIcon className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-1 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
