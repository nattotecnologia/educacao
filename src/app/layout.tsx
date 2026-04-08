import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { createClient } from "@/utils/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: settings } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
  
  return {
    title: "EduFlow AI Dashboard",
    description: "Plataforma Educacional Inteligente",
    icons: {
      icon: settings?.favicon_light_url || '/favicon.ico',
    }
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Configurações Globais Injetadas no Root
  const supabase = await createClient();
  const { data: settings } = await supabase.from('platform_settings').select('*').eq('id', 1).single();

  const primaryColor = settings?.primary_color || '#3b82f6';
  
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} style={{ '--accent-primary': primaryColor } as React.CSSProperties} suppressHydrationWarning>
      <body>
        <BrandingProvider settings={settings}>
          <ThemeProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
