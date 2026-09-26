import type { ComponentType } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { RequireRole } from '@/components/common/ui';
import LandingPage from '@/pages/landing';
import AuthPage from '@/pages/auth';
import ManagerLoginPage from '@/pages/auth/ManagerLogin';
import OnboardingPage from '@/pages/onboarding';
import HomePage from '@/pages/home';
import MapPage from '@/pages/map';
import PricesPage from '@/pages/prices';
import AlertsPage from '@/pages/alerts';
import SessionPage from '@/pages/session';
import ReceiptPage from '@/pages/receipt';
import WalletPage from '@/pages/wallet';
import ProfilePage from '@/pages/profile';
import ManagerOverviewPage from '@/pages/manager/Overview';
import ManagerGridPage from '@/pages/manager/Grid';
import ManagerSignalsPage from '@/pages/manager/Signals';
import FlexiaPage from '@/pages/manager/Flexia';
import RegulationPage from '@/pages/manager/Regulation';
import NotFound from '@/pages/not-found';

const consumer = (Page: ComponentType) => () => <RequireRole role="consumer"><Page /></RequireRole>;
const manager = (Page: ComponentType) => () => <RequireRole role="manager"><Page /></RequireRole>;

// Envolvidos uma única vez (identidade estável — evita remontar páginas).
const ConsumerOnboardingPage = consumer(OnboardingPage);
const ConsumerHomePage = consumer(HomePage);
const ConsumerMapPage = consumer(MapPage);
const ConsumerPricesPage = consumer(PricesPage);
const ConsumerAlertsPage = consumer(AlertsPage);
const ConsumerSessionPage = consumer(SessionPage);
const ConsumerReceiptPage = consumer(ReceiptPage);
const ConsumerWalletPage = consumer(WalletPage);
const ConsumerProfilePage = consumer(ProfilePage);
const ManagerManagerOverviewPage = manager(ManagerOverviewPage);
const ManagerManagerGridPage = manager(ManagerGridPage);
const ManagerManagerSignalsPage = manager(ManagerSignalsPage);
const ManagerFlexiaPage = manager(FlexiaPage);
const ManagerRegulationPage = manager(RegulationPage);

export function AppRouter() {
  return (
    <Switch>
      {/* Público */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={() => <AuthPage />} />
      <Route path="/signup" component={() => <AuthPage signup />} />
      <Route path="/gestor/login" component={ManagerLoginPage} />

      {/* Consumidor (motorista) */}
      <Route path="/onboarding" component={ConsumerOnboardingPage} />
      <Route path="/app" component={ConsumerHomePage} />
      <Route path="/app/home" component={ConsumerHomePage} />
      <Route path="/app/map" component={ConsumerMapPage} />
      <Route path="/app/prices" component={ConsumerPricesPage} />
      <Route path="/app/alerts" component={ConsumerAlertsPage} />
      <Route path="/app/session" component={ConsumerSessionPage} />
      <Route path="/app/receipt/:id" component={ConsumerReceiptPage} />
      <Route path="/app/wallet" component={ConsumerWalletPage} />
      <Route path="/app/profile" component={ConsumerProfilePage} />
      <Route path="/app/history">{() => <Redirect to="/app/wallet" />}</Route>

      {/* Gestor */}
      <Route path="/gestor" component={ManagerManagerOverviewPage} />
      <Route path="/gestor/rede" component={ManagerManagerGridPage} />
      <Route path="/gestor/sinais" component={ManagerManagerSignalsPage} />
      <Route path="/gestor/flexia" component={ManagerFlexiaPage} />
      <Route path="/gestor/regulacao" component={ManagerRegulationPage} />

      <Route component={NotFound} />
    </Switch>
  );
}
