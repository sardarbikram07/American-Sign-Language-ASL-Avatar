import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import "@/ui/tailwind.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "ASL Sign Language Recognition",
  description: "Real-time ASL fingerspell to English translation with 3D signing simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://pro.fontawesome.com/releases/v5.15.1/css/all.css"
        />
      </head>
      <body className={`${spaceGrotesk.className} bg-black`}>{children}</body>
    </html>
  );
}
