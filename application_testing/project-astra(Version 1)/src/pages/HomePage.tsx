import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Layers, Map as MapIcon, Mountain, Route, ScrollText, Thermometer } from 'lucide-react';
import { DATASETS } from '../data/registry';
import { MISSION_OBJECTIVES, PROTOTYPE_NOTICE, SITE } from '../data/site';
import { useAstra } from '../store/useAstra';
import { Callout, ClassBadge, DATA_CLASS_INFO, IntegrationTag } from '../components/ui';
import type { DataClass } from '../types';

const FEATURES = [
  { to: '/map', icon: MapIcon, title: 'Jezero map', text: 'OpenLayers map in a Mars equirectangular projection with NASA Trek imagery, graticule, USGS footprint and layer provenance.' },
  { to: '/terrain', icon: Mountain, title: 'Terrain intelligence', text: 'Elevation and Horn-method slope of the planner grid, histograms and hover read-outs, with resolution and no-data stated.' },
  { to: '/science', icon: Compass, title: 'Science guide', text: 'Cited features of Jezero. Only features with a sourced coordinate are mapped; the rest are listed honestly without one.' },
  { to: '/planner', icon: Route, title: 'Mission planner', text: 'A* routes (shortest, terrain-conscious, science-focused), directed costs, waypoints and a re-planned return.' },
  { to: '/environment', icon: Thermometer, title: 'Mission context', text: 'What environmental data would be shown, how each is classified, and what is deliberately not claimed.' },
  { to: '/field-guide', icon: ScrollText, title: 'Field guide', text: 'A printable mission plan with route tables, schematic, sources and limitations.' },
  { to: '/data', icon: Layers, title: 'Data & limits', text: 'Provenance for every dataset, what was verified, and the limitations of the whole prototype.' },
];

export default function HomePage() {
  const terrain = useAstra((s) => s.terrain);
  const simulated = terrain.grid?.source === 'simulated';

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse at 75% 20%, #d9632b55, transparent 55%), radial-gradient(ellipse at 10% 90%, #8f3f1b44, transparent 50%)' }} />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="label mb-3">{SITE.challenge}</div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            PROJECT <span className="text-rust">ASTRA</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink/90">
            A Jezero Crater exploration guide that turns orbital data into mission decisions: read the terrain, find the
            science, compare routes, and plan the way home. {SITE.tagline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/planner" className="btn btn-primary px-4 py-2">
              Open the planner <ArrowRight size={16} />
            </Link>
            <Link to="/map" className="btn px-4 py-2">
              Explore the map
            </Link>
            <Link to="/data" className="btn px-4 py-2">
              What is real here?
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <Callout tone={simulated ? 'sim' : 'info'} title={simulated ? 'Current build: planner terrain is SIMULATED' : 'Planner terrain: real DEM loaded'}>
          {PROTOTYPE_NOTICE}{' '}
          {simulated
            ? 'No DEM file was found, so routes run on a synthetic surface and demonstrate the algorithm only. See the README to build a real DEM.'
            : terrain.note}
        </Callout>

        <section aria-label="Features">
          <h2 className="mb-4 text-xl font-semibold">What you can do</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.to}>
                <Link to={f.to} className="panel group block h-full p-4 transition-colors hover:border-rust">
                  <f.icon size={20} className="text-rust" />
                  <div className="mt-2 font-semibold group-hover:text-rust-soft">{f.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-mute">{f.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Data integrity">
          <h2 className="mb-2 text-xl font-semibold">Four kinds of information, never blurred</h2>
          <p className="mb-4 max-w-3xl text-sm text-mute">
            Every layer, route and number carries one of these labels, so a measurement is never confused with an
            interpretation or a simulation.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(DATA_CLASS_INFO) as DataClass[]).map((k) => (
              <li key={k} className="panel p-3 text-sm">
                <ClassBadge value={k} />
                <p className="mt-2 text-ink/90">{DATA_CLASS_INFO[k].meaning}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Status of data sources">
          <h2 className="mb-2 text-xl font-semibold">What is real in this build</h2>
          <p className="mb-4 max-w-3xl text-sm text-mute">
            A plain ledger of every dataset the app uses or references, and how far each is actually integrated.
          </p>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-mute">
                  <th className="px-3 py-2 font-medium">Dataset</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {DATASETS.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="px-3 py-2">{d.name}</td>
                    <td className="px-3 py-2"><ClassBadge value={d.dataClass} /></td>
                    <td className="px-3 py-2"><IntegrationTag value={d.integration} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Objectives">
          <h2 className="mb-3 text-xl font-semibold">Mission objectives</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/90">
            {MISSION_OBJECTIVES.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
