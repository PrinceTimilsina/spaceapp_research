import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAstra } from '../store/useAstra';
import { PROTOTYPE_NOTICE, SITE } from '../data/site';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/map', label: 'Map' },
  { to: '/terrain', label: 'Terrain' },
  { to: '/science', label: 'Science' },
  { to: '/planner', label: 'Planner' },
  { to: '/environment', label: 'Environment' },
  { to: '/field-guide', label: 'Field guide' },
  { to: '/data', label: 'Data & limits' },
];

export default function Layout() {
  const initTerrain = useAstra((s) => s.initTerrain);
  const terrain = useAstra((s) => s.terrain);
  const { pathname } = useLocation();

  useEffect(() => {
    void initTerrain();
  }, [initTerrain]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const simulated = terrain.grid?.source === 'simulated';

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="PROJECT ASTRA home">
            <img src={`${import.meta.env.BASE_URL}logomain.png`} alt="" className="h-7 w-7" />
            <span className="font-semibold tracking-[0.18em] text-ink">
              ASTRA
            </span>
          </Link>
          <nav aria-label="Primary" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive ? 'bg-rust/15 text-rust-soft' : 'text-mute hover:text-ink'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          {terrain.status === 'ready' && simulated && (
            <Link
              to="/data"
              title="Planner terrain is simulated. Click for details."
              className="hidden shrink-0 rounded border border-sim/50 bg-sim/10 px-2 py-1 text-xs font-medium text-sim sm:block"
            >
              SIMULATED TERRAIN
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {pathname !== '/map' && (
        <footer className="no-print border-t border-line px-4 py-6 text-xs text-mute">
          <div className="mx-auto max-w-[1500px] space-y-2">
            <p>{PROTOTYPE_NOTICE}</p>
            <p>
              {SITE.name} · {SITE.challenge}. Imagery courtesy NASA/JPL-Caltech/MSSS/University of Arizona via NASA
              Solar System Treks; geology by USGS Astrogeology. See <Link to="/data" className="text-rust-soft underline">Data &amp; limits</Link>.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
