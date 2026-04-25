const QEEMA_SITE = 'https://www.qeematech.net/';

export function DashboardFooter() {
  return (
    <footer
      className="shrink-0 border-t border-gray-200 bg-white text-gray-500 transition-colors"
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-6 py-3 lg:px-8">
        {/* Left: Copyright */}
        <p className="order-2 text-center text-xs font-medium tracking-wide text-gray-500 sm:order-1 sm:text-left">
          Copyright © {new Date().getFullYear()} · All Rights Reserved
        </p>

        {/* Center: Brand pill */}
        <a
          href={QEEMA_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="order-1 flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:order-2"
          aria-label="Qeema Tech - قيمة تك"
        >
          <img
            src="/qeema-logo.svg"
            alt=""
            className="h-7 w-auto object-contain"
          />
          <span className="text-sm font-semibold tracking-tight text-gray-700">
            Qeema Tech
          </span>
        </a>

        {/* Right: Tagline */}
        <p className="order-3 hidden text-right text-xs font-medium tracking-wide text-gray-500 sm:block">
          Powered by <span className="text-gray-700">قيمة تك</span>
        </p>
      </div>
    </footer>
  );
}
