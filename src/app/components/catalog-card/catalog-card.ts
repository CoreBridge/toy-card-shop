import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ICard } from '../../models/types';

/**
 * Read-only catalog tile. Emits {@link add} when the user clicks
 * "Add to Order"; the parent decides which order receives the item.
 */
@Component({
  selector: 'cb-catalog-card',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog-card.html',
  styleUrl: './catalog-card.css',
})
export class CatalogCard {
  /** The card to render. Required input. */
  readonly card = input.required<ICard>();
  /** True when no order is open; the add button is disabled. */
  readonly disabled = input(false);
  /** Emits the card when the user clicks Add to Order. */
  readonly add = output<ICard>();

  protected onAdd(): void {
    this.add.emit(this.card());
  }
}
