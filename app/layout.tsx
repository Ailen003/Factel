// This root layout is intentionally minimal.
// The actual root layout with <html>, <body>, and providers
// lives in app/[locale]/layout.tsx to support next-intl.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
