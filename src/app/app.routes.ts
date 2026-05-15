import { Routes } from '@angular/router';
import { EmptyView } from './components/empty-view/empty-view';
import { OrderView } from './components/order-view/order-view';

/**
 * App routes.
 * - `/`            empty view ("No Order Selected").
 * - `/orders/:id`  order detail view; the `:id` segment is mapped onto
 *                  `OrderView.orderID` via `withComponentInputBinding()`.
 */
export const routes: Routes = [
  { path: '', component: EmptyView },
  { path: 'orders/:orderID', component: OrderView },
  { path: '**', redirectTo: '' },
];
