import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OrderStore } from '../../services/order-store';

/**
 * Placeholder shown when no order is selected (boot state). Clears the
 * store's selected-order id on mount so the catalog correctly disables
 * the Add to Order button after navigating away from an order.
 */
@Component({
  selector: 'cb-empty-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cb-empty-view">
      <h2>No Order Selected</h2>
      <p>Use the left rail to start a New Order or open an existing one.</p>
    </section>
  `,
})
export class EmptyView {
  private readonly store = inject(OrderStore);

  constructor() {
    this.store.selectOrder(null);
  }
}
