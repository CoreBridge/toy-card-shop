import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
import {
  CARDS_API_URL,
  CardsApiPayload,
  ICard,
  IOrder,
  MOST_POPULAR_CARD,
  ORDERS_API_URL,
  OrdersApiPayload,
} from '../models/types';

/**
 * Thin wrapper around the npoint Orders and Cards endpoints.
 * Cards fall back to {@link MOST_POPULAR_CARD} on failure so the catalog
 * is never empty.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  /** GET orders payload; empty list on failure so the UI can still render. */
  loadOrders(): Observable<IOrder[]> {
    return this.http.get<OrdersApiPayload>(ORDERS_API_URL).pipe(
      map((payload) => payload.orders ?? []),
      catchError(() => of<IOrder[]>([])),
    );
  }

  /** GET cards; on failure returns `[MOST_POPULAR_CARD]` so the catalog renders. */
  loadCards(): Observable<ICard[]> {
    return this.http.get<CardsApiPayload>(CARDS_API_URL).pipe(
      map((payload) => payload.cards ?? []),
      map((cards) => (cards.length > 0 ? cards : [MOST_POPULAR_CARD])),
      catchError(() => of<ICard[]>([MOST_POPULAR_CARD])),
    );
  }

  /** POST the full orders array as `{ orders: [...] }` per the endpoint contract. */
  saveOrders(orders: IOrder[]): Observable<unknown> {
    const body: OrdersApiPayload = { orders };
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(ORDERS_API_URL, body, { headers });
  }
}
