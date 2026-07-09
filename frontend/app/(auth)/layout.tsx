export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="from-muted/40 flex min-h-svh items-center justify-center bg-gradient-to-b to-transparent p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
