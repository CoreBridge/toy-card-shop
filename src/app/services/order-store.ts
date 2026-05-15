import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map } from 'rxjs';
import { Api } from './api';
import { InvoiceNumberGenerator } from './invoice-number-generator';
import {
  GenerateNewItem,
  GenerateNewOrder,
  ICard,
  IItem,
  IOrder,
  MOST_POPULAR_CARD,
} from '../models/types';

/**
 * Single source of truth for orders, the catalog, and the selected-order id.
 * Holds signal-backed state so views update without manual subscriptions.
 * Mutations always go through methods on this store; views never edit
 * `IOrder`/`IItem` objects in place.
 */
@Injectable({ providedIn: 'root' })
export class OrderStore {
  private readonly api = inject(Api);
  private readonly invoiceGenerator = inject(InvoiceNumberGenerator);

  private readonly _orders = signal<IOrder[]>([]);
  private readonly _cards = signal<ICard[]>([MOST_POPULAR_CARD]);
  private readonly _selectedOrderID = signal<number | null>(null);
  private readonly _saving = signal(false);
  private readonly _saveError = signal<string | null>(null);
  private readonly _generatingOrder = signal(false);

  /** Read-only view of all orders. */
  readonly orders = this._orders.asReadonly();
  /** Read-only view of catalog cards. */
  readonly cards = this._cards.asReadonly();
  /** Currently selected order ID, or `null` when no order is open. */
  readonly selectedOrderID = this._selectedOrderID.asReadonly();
  /** True while an in-flight POST to the orders endpoint is pending. */
  readonly saving = this._saving.asReadonly();
  /** Latest save error message, or `null` on success / no attempt. */
  readonly saveError = this._saveError.asReadonly();
  /** True while {@link createOrder} is awaiting an invoice number. */
  readonly generatingOrder = this._generatingOrder.asReadonly();

  /** The order matching {@link selectedOrderID}, or `null`. */
  readonly selectedOrder = computed<IOrder | null>(() => {
    const id = this._selectedOrderID();
    if (id === null) {
      return null;
    }
    return this._orders().find((o) => o.orderID === id) ?? null;
  });

  /** Initial load: fetch orders and cards in parallel; safe to call once at app start. */
  init(): void {
    this.api.loadOrders().subscribe((orders) => {
      this._orders.set(orders.map((o) => this.withDerivedTotals(o)));
    });
    this.api.loadCards().subscribe((cards) => {
      this._cards.set(cards);
    });
  }

  /** Mark `orderID` as the open order. Pass `null` to return to the empty view. */
  selectOrder(orderID: number | null): void {
    this._selectedOrderID.set(orderID);
  }

  /**
   * Create a fresh order with a unique ID and an invoice number sourced
   * from {@link InvoiceNumberGenerator}. Returns an Observable that emits
   * once the (CPU loop + random.org) pipeline completes; the order is
   * appended on emission, so the caller can navigate from the `next`
   * callback. {@link generatingOrder} is set for the duration.
   */
  createOrder(): Observable<IOrder> {
    this._generatingOrder.set(true);
    return this.invoiceGenerator.generate().pipe(
      map((result) => {
        const lastOrderID = this._orders().reduce(
          (max, o) => (o.orderID > max ? o.orderID : max),
          0,
        );
        const order = GenerateNewOrder(lastOrderID, result.invoiceNumber);
        this._orders.update((orders) => [...orders, order]);
        return order;
      }),
      finalize(() => {
        this._generatingOrder.set(false);
      }),
    );
  }

  /** Update the invoice (`orderName`) on the given order. */
  updateOrderName(orderID: number, orderName: string): void {
    this._orders.update((orders) =>
      orders.map((o) => (o.orderID === orderID ? { ...o, orderName } : o)),
    );
  }

  /** Update the `customerName` on the given order. */
  updateCustomerName(orderID: number, customerName: string): void {
    this._orders.update((orders) =>
      orders.map((o) => (o.orderID === orderID ? { ...o, customerName } : o)),
    );
  }

  /** Add a catalog card to the given order as a new line item with a unique itemID. */
  addCardToOrder(orderID: number, card: ICard): void {
    const lastItemID = this._orders().reduce((max, o) => {
      const orderMax = o.items.reduce(
        (m, i) => (i.itemID > m ? i.itemID : m),
        0,
      );
      return orderMax > max ? orderMax : max;
    }, 0);
    const item = GenerateNewItem(orderID, card, lastItemID);
    this._orders.update((orders) =>
      orders.map((o) =>
        o.orderID === orderID
          ? this.withDerivedTotals({ ...o, items: [...o.items, item] })
          : o,
      ),
    );
  }

  /** Update an item's quantity. Negative values are clamped to 0. */
  updateItemQuantity(orderID: number, itemID: number, quantity: number): void {
    const safe = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
    this.updateItem(orderID, itemID, (item) => ({ ...item, quantity: safe }));
  }

  /** Update an item's unit price. Negative values are clamped to 0. */
  updateItemUnitPrice(orderID: number, itemID: number, unitPrice: number): void {
    const safe = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    this.updateItem(orderID, itemID, (item) => ({ ...item, unitPrice: safe }));
  }

  /** Update an item's free-text description. */
  updateItemDescription(orderID: number, itemID: number, description: string): void {
    this.updateItem(orderID, itemID, (item) => ({ ...item, description }));
  }

  /** Remove an item from the given order. */
  removeItem(orderID: number, itemID: number): void {
    this._orders.update((orders) =>
      orders.map((o) =>
        o.orderID === orderID
          ? this.withDerivedTotals({
              ...o,
              items: o.items.filter((i) => i.itemID !== itemID),
            })
          : o,
      ),
    );
  }

  /** POST current orders to the npoint endpoint. Toggles {@link saving} for the UI. */
  save(): void {
    this._saving.set(true);
    this._saveError.set(null);
    this.api.saveOrders(this._orders()).subscribe({
      next: () => {
        this._saving.set(false);
      },
      error: (err: unknown) => {
        this._saving.set(false);
        this._saveError.set(
          err instanceof Error ? err.message : 'Failed to save order',
        );
      },
    });
  }

  /** Apply a transform to a single item and refresh the order's derived totals. */
  private updateItem(
    orderID: number,
    itemID: number,
    transform: (item: IItem) => IItem,
  ): void {
    this._orders.update((orders) =>
      orders.map((o) => {
        if (o.orderID !== orderID) {
          return o;
        }
        const items = o.items.map((i) => (i.itemID === itemID ? transform(i) : i));
        return this.withDerivedTotals({ ...o, items });
      }),
    );
  }

  /**
   * Recompute `totalPrice`, `cardCount`, and `averageCardPrice` from the
   * order's items. `averageCardPrice` is `0` when there are no cards
   * (guards against divide-by-zero).
   */
  private withDerivedTotals(order: IOrder): IOrder {
    const totalPrice = order.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    const cardCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const averageCardPrice = cardCount > 0 ? totalPrice / cardCount : 0;
    return { ...order, totalPrice, cardCount, averageCardPrice };
  }
}
