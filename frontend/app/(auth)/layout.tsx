export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh w-full flex items-center justify-center bg-slate-950 text-slate-50 relative overflow-hidden p-4 md:p-8">
      {/* Background Ambient Lights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl relative z-10">{children}</div>
    </div>
  );
}
