import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PwaProvider } from '@/context/PwaContext';
import { AppRouter } from '@/router';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PwaProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </WouterRouter>
        </PwaProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;