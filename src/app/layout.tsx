import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { BasketDrawer } from "@/components/BasketDrawer";
import { getPublicProducts, getMemberProducts, toCatalogue } from "@/lib/products-store";
import { currentUserIsMember } from "@/lib/membership";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barking Raw | Natural Dog Food & Treats",
  description:
    "You've been lied to. Barking Raw is honest, single-ingredient natural dog treats, named in full and posted to your door. Free local delivery, free over £35.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Members see their early access drops in the basket; everyone else must not even
  // receive them in the page payload, since an unreleased product is the whole perk.
  const isMember = await currentUserIsMember();
  const catalogue = ((await (isMember ? getMemberProducts() : getPublicProducts())) ?? []).map(
    toCatalogue,
  );

  return (
    <html lang="en-GB" className={geistSans.variable}>
      <body id="top">
        <CartProvider catalogue={catalogue}>
          <Header />
          {children}
          <BasketDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
