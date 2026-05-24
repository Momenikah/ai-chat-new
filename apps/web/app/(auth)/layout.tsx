import Link from "next/link";
import { MessagesSquare } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-zinc-950 p-12 text-zinc-100 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
            <MessagesSquare className="h-5 w-5 text-zinc-950" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            AI Chat
          </span>
        </Link>

        <div className="space-y-5">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Satu inbox untuk semua percakapan pelanggan.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">
            WhatsApp Business API, Instagram DM, Facebook Messenger, AI
            chatbot, broadcast, dan CRM — semua dalam satu dashboard
            omnichannel.
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} AI Chat. Omnichannel CRM Platform.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
