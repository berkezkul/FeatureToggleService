import { Route, Routes, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { PromotionPage } from './pages/PromotionPage';

export const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/promotion" element={<PromotionPage />} />
        <Route path="*" element={<Navigate to="/features" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;


