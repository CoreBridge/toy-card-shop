import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ItemView } from '../item-view/item-view';
import { OrderStore } from '../../services/order-store';

/**
 * Main content view for a selected order. Binds the order header fields
 * (`orderName`, `customerName`), renders the items list with totals,
 * surfaces the financial summary, and owns the Save Changes action.
 */
@Component({
  selector: 'cb-order-view',
  imports: [FormsModule, CurrencyPipe, ItemView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-view.html',
  styleUrl: './order-view.css',
})
export class OrderView {
  private readonly store = inject(OrderStore);
  private readonly router = inject(Router);

  /** Route-bound order ID. Coerced from the URL segment. */
  readonly orderID = input.required({ transform: numberAttribute });

  protected readonly order = this.store.selectedOrder;
  protected readonly saving = this.store.saving;
  protected readonly saveError = this.store.saveError;

  /**
   * Sync the route's `orderID` into the store. Done in an effect so the
   * route can drive selection without an explicit subscription, satisfying
   * the bonus "URL contains the OrderID" requirement.
   */
  private readonly _selectionSync = effect(() => {
    const id = this.orderID();
    this.store.selectOrder(Number.isFinite(id) ? id : null);
  });

  /** True when the URL points at an order ID that no longer exists. */
  protected readonly notFound = computed(() => {
    return this.order() === null && this.orderID() !== null;
  });

  /** Push an invoice (orderName) edit into the store. */
  protected onOrderNameChange(value: string): void {
    const o = this.order();
    if (o === null) {
      return;
    }
    this.store.updateOrderName(o.orderID, value);
  }

  /** Push a customerName edit into the store. */
  protected onCustomerNameChange(value: string): void {
    const o = this.order();
    if (o === null) {
      return;
    }
    this.store.updateCustomerName(o.orderID, value);
  }

  /** Persist current state via the npoint POST. */
  protected save(): void {
    this.store.save();
  }

  /** Send the user back to the empty view when the URL is bogus. */
  protected goHome(): void {
    this.router.navigate(['/']);
  }
}
