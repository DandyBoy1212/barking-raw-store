import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { BasketDrawer } from "@/components/BasketDrawer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barking Raw | Natural Dog Food & Treats",
  description:
    "You've been lied to. Barking Raw is honest, single-ingredient natural dog treats, named in full and posted to your door. Free local delivery, free over £35.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={geistSans.variable}>
      <body id="top">
        <CartProvider>
          <Header />
          {children}
          <BasketDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
