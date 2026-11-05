import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import TerrainPage from './pages/TerrainPage';
import SciencePage from './pages/SciencePage';
import PlannerPage from './pages/PlannerPage';
import EnvironmentPage from './pages/EnvironmentPage';
import FieldGuidePage from './pages/FieldGuidePage';
import DataPage from './pages/DataPage';

/** HashRouter keeps deep links working on any static host (GitHub Pages, S3, file shares). */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="terrain" element={<TerrainPage />} />
          <Route path="science" element={<SciencePage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="environment" element={<EnvironmentPage />} />
          <Route path="field-guide" element={<FieldGuidePage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
