import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revenue Leakage Agent",
  description: "Investigate billing anomalies and apply corrective actions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
