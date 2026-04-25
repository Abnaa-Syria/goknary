const QEEMA_SITE = 'https://www.qeematech.net/';

export function DashboardFooter() {
  return (
    <footer
      className="shrink-0 border-t border-gray-200 bg-white text-gray-500 transition-colors"
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-8">

        <p className="text-xs font-medium tracking-wide text-gray-400">
          Copyright &copy; {new Date().getFullYear()} &middot; All Rights Reserved
        </p>

        <a href={QEEMA_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Qeema Tech"
        >
          <QeemaLogo />
          <span>Qeema Tech</span>
        </a>

        <p className="hidden text-xs font-medium tracking-wide text-gray-400 sm:block">
          Powered by <span className="text-gray-600">قيمة تك</span>
        </p>

      </div>
    </footer>
  );
}

function QeemaLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="22" height="22" rx="6" fill="#2563EB" />
      <circle cx="11" cy="11" r="5" stroke="white" strokeWidth="1.5" />
      <path
        d="M11 8v3l2 1.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}