/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { QueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppThemeProvider } from '../theme/ThemeContext';
import '../global.css';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Timey - Global Time Operations' },
      ],
      links: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap',
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="11" fill="%23155e59"/><circle cx="16" cy="16" r="8.5" stroke="white" stroke-width="1.5" opacity="0.92"/><path d="M7.5 16h17" stroke="white" stroke-width="1.4" opacity="0.92"/><path d="M16 7.5c2.6 2.2 3.8 5.2 3.8 8.5s-1.2 6.3-3.8 8.5c-2.6-2.2-3.8-5.2-3.8-8.5s1.2-6.3 3.8-8.5Z" stroke="white" stroke-width="1.4" opacity="0.92"/><path d="M16 11.5v4.8l3.4 2.1" stroke="%23f8f4ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
        },
      ],
    }),
    component: RootComponent,
  }
);

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppThemeProvider>
          <Outlet />
          <Toaster richColors closeButton position="top-right" />
        </AppThemeProvider>
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
