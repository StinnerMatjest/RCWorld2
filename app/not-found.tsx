import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center bg-[#0f172a]">
      <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">
        Error 404
      </p>
      <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
        This ride is <span className="text-brand">closed</span>
      </h1>
      <p className="text-slate-400 text-base max-w-md mb-8">
        The page you are looking for does not exist or has been moved. Maybe the
        coaster got relocated.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-light text-white font-bold shadow-lg shadow-orange-900/20 transition-colors"
        >
          Back to the front page
        </Link>
        <Link
          href="/parks"
          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold transition-colors"
        >
          Browse park rankings
        </Link>
      </div>
    </div>
  );
}
