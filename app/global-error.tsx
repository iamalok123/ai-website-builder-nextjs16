"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#08090e] text-white flex flex-col items-center justify-center p-4 text-center font-sans antialiased">
        <div className="max-w-md space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl font-bold shadow-lg shadow-amber-500/10">
            !
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Something went wrong</h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            {error?.digest
              ? `An unexpected error occurred (Ref: ${error.digest.slice(0, 8)}). Please try reloading.`
              : "An unexpected error occurred. Please try reloading the application."}
          </p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-linear-to-r from-amber-500 via-orange-500 to-red-500 text-white font-semibold text-xs rounded-xl hover:brightness-110 transition shadow-lg shadow-orange-500/20 cursor-pointer active:scale-95"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
