import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { IItem } from '../../models/types';
import { OrderStore } from '../../services/order-store';

/**
 * Single line-item editor. Edits route back through {@link OrderStore} so
 * the parent order's totals stay in sync on every keystroke.
 */
@Component({
  selector: 'cb-item-view',
  imports: [FormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-view.html',
  styleUrl: './item-view.css',
})
export class ItemView {
  private readonly store = inject(OrderStore);

  /** The item to render. Required input. */
  readonly item = input.required<IItem>();

  /** `quantity * unitPrice`, redisplayed in the row. */
  protected readonly lineTotal = computed(() => {
    const i = this.item();
    return i.unitPrice * i.quantity;
  });

  /** Push a description edit into the store. */
  protected onDescriptionChange(value: string): void {
    const i = this.item();
    this.store.updateItemDescription(i.orderID, i.itemID, value);
  }

  /** Push a unit-price edit into the store. */
  protected onUnitPriceChange(value: number | string): void {
    const i = this.item();
    this.store.updateItemUnitPrice(i.orderID, i.itemID, Number(value));
  }

  /** Push a quantity edit into the store. */
  protected onQuantityChange(value: number | string): void {
    const i = this.item();
    this.store.updateItemQuantity(i.orderID, i.itemID, Number(value));
  }

  /** Remove this item from its parent order. */
  protected remove(): void {
    const i = this.item();
    this.store.removeItem(i.orderID, i.itemID);
  }
}
