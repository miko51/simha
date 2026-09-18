import type { Metadata } from "next";
import { Figtree, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";
import { ChatProvider } from "@/components/chat/ChatProvider";
import RabbiChat from "@/components/chat/RabbiChat";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const frank = Frank_Ruhl_Libre({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-frank" });

export const metadata: Metadata = {
  title: "Simha — bar & bat mitzvah",
  description: "Organisez gratuitement la bar ou bat mitzvah de votre enfant : budget, invités, calendrier juif, assistant IA et annuaire de prestataires.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${figtree.variable} ${frank.variable} antialiased min-h-screen`}>
        <ChatProvider>
          {children}
          <RabbiChat />
        </ChatProvider>
      </body>
    </html>
  );
}
