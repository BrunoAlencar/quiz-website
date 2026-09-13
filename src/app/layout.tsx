import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Quiz", description: "Live quiz game" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
