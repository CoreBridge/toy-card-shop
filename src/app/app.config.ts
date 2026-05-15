import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

/**
 * Application bootstrap config.
 * - Zoneless change detection: the app is built on signals, so we opt out
 *   of Zone.js and let the framework schedule renders from signal updates.
 * - `withComponentInputBinding()`: forwards route params (`:orderID`) to
 *   matching component `input()`s.
 * - `withFetch()`: switches HttpClient to the modern Fetch backend.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
  ],
};
