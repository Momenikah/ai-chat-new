import type { TemplateEditorValues } from "@/components/templates/template-editor";

export interface StarterTemplate {
  key: string;
  title: string;
  description: string;
  emoji: string;
  values: TemplateEditorValues;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "welcome",
    title: "Welcome message",
    description: "Sapa pelanggan baru dengan ringkas, sertakan CTA.",
    emoji: "👋",
    values: {
      name: "welcome_message",
      category: "marketing",
      language: "id",
      body:
        "Halo {{name}}, selamat datang di {{brand}}!\n\nKami siap membantu pertanyaan Anda seputar produk & promo terbaru.",
      footer: "Tim Customer Care",
      buttons: [
        { type: "reply", text: "Lihat katalog" },
        { type: "reply", text: "Chat agent" },
      ],
      variables: [
        { name: "name", sample_value: "Andi" },
        { name: "brand", sample_value: "Toko Maju" },
      ],
    },
  },
  {
    key: "order_confirmation",
    title: "Order confirmation",
    description: "Konfirmasi pesanan lengkap dengan nomor invoice dan total.",
    emoji: "🧾",
    values: {
      name: "order_confirmation",
      category: "utility",
      language: "id",
      body:
        "Hai {{name}}, pesanan #{{order_id}} sebesar Rp{{total}} sudah kami terima.\n\nStatus saat ini: {{status}}. Terima kasih sudah berbelanja!",
      footer: "Pesanan akan diproses 1×24 jam.",
      buttons: [
        { type: "reply", text: "Cek status" },
        { type: "url", text: "Lacak pengiriman", url: "https://example.com/track/{{order_id}}" },
      ],
      variables: [
        { name: "name", sample_value: "Budi" },
        { name: "order_id", sample_value: "INV-00231" },
        { name: "total", sample_value: "245.000" },
        { name: "status", sample_value: "Sedang dikemas" },
      ],
    },
  },
  {
    key: "promo",
    title: "Promo / diskon",
    description: "Umumkan promo dengan tombol langsung ke landing page.",
    emoji: "🎉",
    values: {
      name: "promo_diskon",
      category: "marketing",
      language: "id",
      body:
        "🎉 Diskon spesial {{discount}}% buat {{name}}!\n\nKode: *{{code}}* — berlaku sampai {{expiry}}. Klaim sekarang sebelum kehabisan.",
      footer: "Berlaku kelipatan minimum Rp100.000.",
      buttons: [
        { type: "url", text: "Belanja sekarang", url: "https://example.com/promo" },
      ],
      variables: [
        { name: "name", sample_value: "Sinta" },
        { name: "discount", sample_value: "20" },
        { name: "code", sample_value: "HEMAT20" },
        { name: "expiry", sample_value: "31 Mei" },
      ],
    },
  },
  {
    key: "otp",
    title: "OTP verification",
    description: "Kode OTP untuk verifikasi login / transaksi.",
    emoji: "🔒",
    values: {
      name: "otp_verification",
      category: "authentication",
      language: "id",
      body:
        "Kode verifikasi Anda: *{{code}}*\n\nJangan bagikan kode ini ke siapapun. Berlaku {{minutes}} menit.",
      footer: "Tim Keamanan",
      buttons: [],
      variables: [
        { name: "code", sample_value: "238104" },
        { name: "minutes", sample_value: "5" },
      ],
    },
  },
];

export function findStarter(key: string): StarterTemplate | null {
  return STARTER_TEMPLATES.find((s) => s.key === key) ?? null;
}
