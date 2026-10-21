import { useEffect } from 'react';
import { useLedger } from './store/LedgerContext';
import { useRoute, navigate } from './store/router';
import { BottomNav } from './components/BottomNav';
import { BrandMark, Icon } from './components/Icon';
import { EmptyState } from './components/Common';
import { HomePage } from './pages/HomePage';
import { RecordPage } from './pages/RecordPage';
import { StatsPage } from './pages/StatsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AccountsPage } from './pages/AccountsPage';
import { CalendarPage } from './pages/CalendarPage';

const NAV_ROUTES = new Set(['/', '/stats', '/search', '/settings']);

function Splash() {
  return (
    <div className="splash-screen">
      <div className="splash-mark"><BrandMark size={62} /></div>
      <strong>海盐账本</strong>
      <span>正在打开你的账本</span>
      <div className="splash-line"><i /></div>
    </div>
  );
}

export default function App() {
  const { ready } = useLedger();
  const route = useRoute();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [route.hash]);

  if (!ready) return <Splash />;

  let page = <HomePage />;
  if (route.path === '/stats') page = <StatsPage />;
  else if (route.path === '/search') page = <SearchPage />;
  else if (route.path === '/settings') page = <SettingsPage />;
  else if (route.path === '/import') page = <ImportPage />;
  else if (route.path === '/categories') page = <CategoriesPage />;
  else if (route.path === '/accounts') page = <AccountsPage />;
  else if (route.path === '/calendar') page = <CalendarPage />;
  else if (route.path === '/record' || route.segments[0] === 'record') page = <RecordPage />;
  else if (route.path !== '/') {
    page = (
      <main className="page detail-page">
        <EmptyState
          title="这一页走丢了"
          description="可能是一个旧链接，回到账本继续看看吧。"
          icon="waves"
          action={<button type="button" className="button primary" onClick={() => navigate('/')}>回到明细</button>}
        />
      </main>
    );
  }

  const showNav = NAV_ROUTES.has(route.path);

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <aside className="desktop-aside" aria-hidden="true">
        <div className="desktop-aside-brand">
          <BrandMark size={30} />
          <span>SEA SALT LEDGER</span>
        </div>
        <h1>把每一笔，<br />过成生活。</h1>
        <p>一个安静、轻盈的本地记账本。<br />数据只属于你。</p>
        <div className="desktop-aside-meta">
          <span><Icon name="shield-check" size={14} /> 本地存储</span>
          <span><Icon name="fish" size={14} /> 支持鲨鱼账单导入</span>
        </div>
        <div className="desktop-waves">
          <svg viewBox="0 0 420 160" fill="none" aria-hidden="true">
            <path d="M-10 83C55 43 117 110 187 75C257 40 310 103 381 68C410 53 430 57 450 68" />
            <path d="M-10 111C62 75 124 131 198 101C272 71 334 123 407 95C424 88 440 90 458 97" />
            <path d="M-10 137C68 107 134 151 210 129C286 107 348 146 420 123C437 118 450 119 466 124" />
          </svg>
          <span className="desktop-sun" />
        </div>
      </aside>

      <div className={`app-frame ${showNav ? 'with-nav' : ''}`}>
        <div className="page-transition" key={route.hash}>
          {page}
        </div>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
