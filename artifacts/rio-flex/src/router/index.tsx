import { Route, Switch } from 'wouter';
import LandingPage from '@/pages/landing';
import AuthPage from '@/pages/auth';
import OnboardingPage from '@/pages/onboarding';
import HomePage from '@/pages/home';
import MapPage from '@/pages/map';
import SessionPage from '@/pages/session';
import ReceiptPage from '@/pages/receipt';
import WalletPage from '@/pages/wallet';
import ProfilePage from '@/pages/profile';
import NotFound from '@/pages/not-found';

export function AppRouter() {
  return (
    <Switch>
      {/* Autenticação & Onboarding */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={() => <AuthPage />} />
      <Route path="/signup" component={() => <AuthPage signup />} />
      <Route path="/onboarding" component={OnboardingPage} />

      {/* 5 Telas Principais da Jornada do Usuário */}
      <Route path="/app" component={HomePage} />
      <Route path="/app/home" component={HomePage} />
      <Route path="/app/map" component={MapPage} />
      <Route path="/app/session" component={SessionPage} />
      <Route path="/app/receipt" component={ReceiptPage} />
      <Route path="/app/wallet" component={WalletPage} />
      <Route path="/app/profile" component={ProfilePage} />

      {/* Redirecionamentos amigáveis */}
      <Route path="/app/rewards" component={WalletPage} />
      <Route path="/app/history" component={WalletPage} />
      <Route path="/app/monitoring" component={WalletPage} />
      <Route path="/app/planner" component={MapPage} />

      {/* Fallback 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}
