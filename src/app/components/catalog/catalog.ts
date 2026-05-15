import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CatalogCard } from '../catalog-card/catalog-card';
import { OrderStore } from '../../services/order-store';
import { ICard } from '../../models/types';

/**
 * Right-side catalog. Lists every card from the Cards API and delegates
 * "Add to Order" clicks to the {@link OrderStore} for the selected order.
 */
@Component({
  selector: 'cb-catalog',
  imports: [CatalogCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
})
export class Catalog {
  private readonly store = inject(OrderStore);

  protected readonly cards = this.store.cards;
  protected readonly selectedOrder = this.store.selectedOrder;
  protected readonly disabled = computed(() => this.selectedOrder() === null);

  /** Add the clicked card to the currently selected order. No-op when none. */
  protected onAdd(card: ICard): void {
    const order = this.selectedOrder();
    if (order === null) {
      return;
    }
    this.store.addCardToOrder(order.orderID, card);
  }
}
