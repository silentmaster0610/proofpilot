import type { Metadata } from "next";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = {
  title: "ProofPilot — Your life admin, with receipts",
  description: "Your personal workspace for claims, evidence, approvals and follow-ups.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("proofpilot-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{}`}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
