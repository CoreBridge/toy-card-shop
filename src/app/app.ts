import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Nav } from './components/nav/nav';
import { Catalog } from './components/catalog/catalog';
import { OrderStore } from './services/order-store';

/**
 * Root shell. Three-column layout: nav rail, routed content (empty or
 * order detail), and the catalog. Kicks off the initial data load on init.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Nav, Catalog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(OrderStore);

  ngOnInit(): void {
    this.store.init();
  }
}
