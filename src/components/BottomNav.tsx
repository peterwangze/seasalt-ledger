import { useRoute, navigate } from '../store/router';
import { Icon } from './Icon';

const TABS = [
  { path: '/', label: '明细', icon: 'receipt' },
  { path: '/stats', label: '统计', icon: 'chart-pie' },
  { path: '/search', label: '搜索', icon: 'search' },
  { path: '/settings', label: '我的', icon: 'user-round' },
];

export function BottomNav() {
  const route = useRoute();

  return (
    <nav className="bottom-nav" aria-label="主要导航">
      <div className="bottom-nav-inner">
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.path} tab={tab} active={route.path === tab.path} />
        ))}
        <div className="fab-slot">
          <button
            type="button"
            className="record-fab"
            onClick={() => navigate('/record')}
            aria-label="记一笔"
          >
            <span className="fab-halo" aria-hidden="true" />
            <Icon name="plus" size={26} strokeWidth={2.2} />
          </button>
        </div>
        {TABS.slice(2).map((tab) => (
          <NavItem key={tab.path} tab={tab} active={route.path === tab.path} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  tab,
  active,
}: {
  tab: { path: string; label: string; icon: string };
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => navigate(tab.path)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-icon"><Icon name={tab.icon} size={21} strokeWidth={active ? 2.15 : 1.8} /></span>
      <span>{tab.label}</span>
    </button>
  );
}
