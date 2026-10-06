import "@/app/globals.css";

import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import Analytics from "@/components/analytics";
import BackgroundLines from "@/components/ui/background-lines";
import { inter } from "@/lib/fonts";
import { shareMetadata } from "@/lib/metadata";

import { siteConfig } from "../config/site";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Built by physicians, powered by collaboration`,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: [
    "MurmurMD",
    "physician community",
    "interventional cardiology",
    "medical cases",
    "physician sentiment",
  ],
  authors: [
    {
      name: "MurmurMD",
      url: siteConfig.url,
    },
  ],
  creator: "MurmurMD",
  ...shareMetadata(),
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} bg-background font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Analytics />
          <BackgroundLines />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
