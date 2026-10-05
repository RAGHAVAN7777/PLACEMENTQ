import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from './components/layout/AppLayout';

// Lazy-load pages
const Landing = lazy(() => import('./features/landing/LandingPage'));
const Interview = lazy(() => import('./features/interview/InterviewPage'));
const PlacementAssessment = lazy(() => import('./features/assessment/AssessmentPage'));
const Reports = lazy(() => import('./features/reports/ReportsPage'));
const Overview = lazy(() => import('./features/overview/OverviewPage'));
const Skills = lazy(() => import('./features/skills/SkillsPage'));
const Scenarios = lazy(() => import('./features/scenarios/ScenariosPage'));
const Plan = lazy(() => import('./features/plan/PlanPage'));
const Progress = lazy(() => import('./features/progress/ProgressPage'));
const ModelLab = lazy(() => import('./features/model-lab/ModelLabPage'));
const Profile = lazy(() => import('./features/profile/ProfilePage'));
const NotFound = lazy(() => import('./features/not-found/NotFoundPage'));
const Readiness = lazy(() => import('./features/readiness/ReadinessPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loading-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/model-lab" element={<Navigate to="/app/model-lab" replace />} />
          <Route path="/assessment" element={<Interview />} />
          <Route path="/placement-assessment" element={<PlacementAssessment />} />
          <Route path="/app" element={<AppLayout />}>
            <Route path="readiness" element={<Readiness />} />
            <Route path="overview" element={<Overview />} />
            <Route path="skills" element={<Skills />} />
            <Route path="scenarios" element={<Scenarios />} />
            <Route path="plan" element={<Plan />} />
            <Route path="progress" element={<Progress />} />
            <Route path="interviews" element={<Reports />} />
            <Route path="faculty" element={<Reports faculty />} />
            <Route path="model-lab" element={<ModelLab />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
