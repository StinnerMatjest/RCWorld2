import Link from "next/link";

const INSTAGRAM_URL = "https://www.instagram.com/"; // TODO: replace with your real URL
const FACEBOOK_URL = "https://www.facebook.com/"; // TODO: replace with your real URL

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white pt-4 dark:border-white/10 dark:bg-[#0f172a] md:pt-6">
      <div className="mx-auto w-full max-w-7xl px-4 pb-3 md:px-6 md:pb-8">
        <div className="grid gap-8 text-center md:grid-cols-2 md:items-start md:text-left">
          {/* Left: Contact + CVR */}
          <div className="space-y-2">
            {/* Brand */}
            <div className="font-extrabold tracking-tight leading-none text-slate-900 dark:text-slate-100 text-lg sm:text-xl">
              Parkrating
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300">
              CVR: <span className="font-medium">46141822</span>
            </div>

            <a
              href="mailto:info@parkrating.com"
              className="inline-flex items-center justify-center gap-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white md:justify-start"
            >
              <MailIcon className="h-4 w-4" />
              info@parkrating.com
            </a>
          </div>

          {/* Right: Social */}
          <div className="space-y-3 md:text-right">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Follow Us
            </div>

            <div className="flex justify-center gap-3 md:justify-end">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>

              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
              >
                <FacebookIcon className="h-5 w-5" />
              </a>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Parkrating
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Icons (inline SVG, no deps) ---------------- */

function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6.75h16A1.25 1.25 0 0 1 21.25 8v8A1.25 1.25 0 0 1 20 17.25H4A1.25 1.25 0 0 1 2.75 16V8A1.25 1.25 0 0 1 4 6.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.25 12 13.25l7.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 2.75h10A4.25 4.25 0 0 1 21.25 7v10A4.25 4.25 0 0 1 17 21.25H7A4.25 4.25 0 0 1 2.75 17V7A4.25 4.25 0 0 1 7 2.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 16.25A4.25 4.25 0 1 0 12 7.75a4.25 4.25 0 0 0 0 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M17.5 6.6h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.2c0-.9.25-1.5 1.55-1.5H16.5V5.05c-.35-.05-1.55-.15-2.95-.15-2.9 0-4.9 1.75-4.9 4.95V11H6.4v3h2.25v7h4.85Z" />
    </svg>
  );
}
