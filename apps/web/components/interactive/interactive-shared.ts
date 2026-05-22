import { List, MousePointerClick, Sparkles, type LucideIcon } from "lucide-react";
import type {
  CarouselPayload,
  InteractiveKind,
  InteractivePayload,
  ListPayload,
  ReplyButtonsPayload,
} from "@aichat/shared";

export const KIND_META: Record<
  InteractiveKind,
  { label: string; description: string; icon: LucideIcon }
> = {
  reply_buttons: {
    label: "Reply buttons",
    description: "Hingga 3 tombol balasan cepat.",
    icon: MousePointerClick,
  },
  list: {
    label: "List selector",
    description: "Menu pilihan dengan section + row.",
    icon: List,
  },
  carousel: {
    label: "Media carousel",
    description: "Kartu gambar + judul + tombol, swipable.",
    icon: Sparkles,
  },
};

export function emptyPayload(kind: InteractiveKind): InteractivePayload {
  switch (kind) {
    case "reply_buttons":
      return {
        body: "",
        buttons: [{ id: "btn_1", title: "" }],
      } satisfies ReplyButtonsPayload;
    case "list":
      return {
        body: "",
        button_text: "Pilih",
        sections: [
          { title: "Section 1", rows: [{ id: "row_1", title: "" }] },
        ],
      } satisfies ListPayload;
    case "carousel":
      return {
        cards: [{ image_url: "", title: "", subtitle: "" }],
      } satisfies CarouselPayload;
  }
}
