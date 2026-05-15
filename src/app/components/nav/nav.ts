import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { OrderStore } from '../../services/order-store';

/**
 * Left rail. Renders a "New Order" action and a link per existing order
 * using `order.orderName` as the label. The New Order button shows a
 * "Generating..." state while {@link OrderStore.createOrder} is running
 * (it awaits the random.org + CPU entropy pipeline).
 */
@Component({
  selector: 'cb-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  private readonly store = inject(OrderStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Read-only view of all orders for the link list. */
  protected readonly orders = this.store.orders;
  /** Read-only flag bound to the button's disabled/label state. */
  protected readonly generating = this.store.generatingOrder;

  /**
   * Kick off invoice generation, then navigate to the new order's detail
   * route once the pipeline emits. Re-clicks are no-ops while a generation
   * is in flight.
   */
  protected newOrder(): void {
    if (this.generating()) {
      return;
    }
    this.store
      .createOrder()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((order) => {
        this.router.navigate(['/orders', order.orderID]);
      });
  }
}
