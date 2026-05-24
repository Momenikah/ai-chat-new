import type {
  InteractiveKind,
  InteractivePayload,
} from "@aichat/shared";

export interface InteractiveStarter {
  key: string;
  emoji: string;
  title: string;
  description: string;
  name: string;
  kind: InteractiveKind;
  payload: InteractivePayload;
}

export const INTERACTIVE_STARTERS: InteractiveStarter[] = [
  {
    key: "main_menu",
    emoji: "📲",
    title: "Menu utama",
    description: "3 tombol untuk arahkan pelanggan ke alur utama.",
    name: "menu_utama",
    kind: "reply_buttons",
    payload: {
      body: "Halo! Ada yang bisa kami bantu? Pilih salah satu:",
      buttons: [
        { id: "order", title: "Pesan produk" },
        { id: "track", title: "Lacak pesanan" },
        { id: "cs", title: "Bicara dengan CS" },
      ],
    },
  },
  {
    key: "satisfaction",
    emoji: "⭐",
    title: "Rating kepuasan",
    description: "Tombol cepat untuk feedback layanan.",
    name: "rating_kepuasan",
    kind: "reply_buttons",
    payload: {
      body: "Bagaimana pengalaman Anda dengan layanan kami?",
      buttons: [
        { id: "good", title: "👍 Puas" },
        { id: "ok", title: "😐 Biasa" },
        { id: "bad", title: "👎 Kurang" },
      ],
    },
  },
  {
    key: "category_list",
    emoji: "🗂️",
    title: "Pilih kategori",
    description: "List selector dengan beberapa section.",
    name: "pilih_kategori",
    kind: "list",
    payload: {
      body: "Silakan pilih kategori produk yang Anda cari:",
      button_text: "Lihat kategori",
      sections: [
        {
          title: "Populer",
          rows: [
            { id: "fashion", title: "Fashion", description: "Pakaian & aksesoris" },
            { id: "elektronik", title: "Elektronik", description: "Gadget & gawai" },
          ],
        },
        {
          title: "Lainnya",
          rows: [
            { id: "rumah", title: "Rumah tangga" },
            { id: "olahraga", title: "Olahraga" },
          ],
        },
      ],
    },
  },
  {
    key: "product_carousel",
    emoji: "🛍️",
    title: "Katalog carousel",
    description: "Kartu produk swipable dengan tombol beli.",
    name: "katalog_produk",
    kind: "carousel",
    payload: {
      cards: [
        {
          image_url: "https://placehold.co/600x400?text=Produk+1",
          title: "Produk Unggulan A",
          subtitle: "Rp149.000 · stok terbatas",
          button: { type: "url", text: "Beli sekarang", url: "https://example.com/a" },
        },
        {
          image_url: "https://placehold.co/600x400?text=Produk+2",
          title: "Produk Unggulan B",
          subtitle: "Rp199.000 · best seller",
          button: { type: "url", text: "Beli sekarang", url: "https://example.com/b" },
        },
      ],
    },
  },
];

export function findInteractiveStarter(key: string): InteractiveStarter | null {
  return INTERACTIVE_STARTERS.find((s) => s.key === key) ?? null;
}
