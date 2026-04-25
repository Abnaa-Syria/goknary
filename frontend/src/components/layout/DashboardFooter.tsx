import QeemaLogoSvg from './qeema letters.svg';

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

        <a
        href={QEEMA_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Qeema Tech"
        >
          <img src={QeemaLogoSvg} alt="Qeema Tech" className="h-6 w-auto" />
          <span>Qeema Tech</span>
        </a>




        <p className="hidden text-xs font-medium tracking-wide text-gray-400 sm:block">
          Powered by <span className="text-gray-600">قيمة تك</span>
        </p>

      </div>
    </footer>
  );
}