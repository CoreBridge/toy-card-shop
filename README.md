# CoreBridge Card Store Order Form

Toy ordering form for a collectible trading-card store, built from the
`Pair Programming Interview.pdf` spec.

## Stack

| Layer        | Version |
| ------------ | ------- |
| Angular      | 21.2    |
| TypeScript   | 5.9     |
| Build tool   | `@angular/build` (Vite/esbuild) |
| Change det.  | Zoneless (signals) |
| Forms        | Template-driven (`ngModel`) |
| Routing      | Standalone routes + component input binding |
| HTTP         | `HttpClient` with `withFetch()` |

## Run it

```bash
npm install
npm start           # ng serve at http://localhost:4200
npm run build       # production build
```

## Layout

```
src/app/
  models/types.ts            # IItem, IOrder, ICard, API URLs, factory functions
  services/
    api.ts                   # GET orders, GET cards, POST orders
    order-store.ts           # Signal store; sole owner of order/item mutations
  components/
    nav/                     # Left rail: New Order + existing order links
    empty-view/              # "No Order Selected" boot view
    order-view/              # Main detail view; route-bound by orderID
    item-view/               # Single line-item editor
    catalog/                 # Right-side card catalog
    catalog-card/            # One catalog tile
  app.ts                     # Shell: <cb-nav> | <router-outlet> | <cb-catalog>
  app.routes.ts              # /, /orders/:orderID
  app.config.ts              # zoneless + router + HttpClient providers
```

## Spec coverage

### Required

- Boot view says **"No Order Selected"**.
- Left rail: **New Order** button + a link per existing order using
  `order.orderName`.
- Order view binds:
  - **Invoice** ↔ `order.orderName`
  - **Customer** ↔ `order.customerName`
  - **Total** displays `order.totalPrice` with `$`.
- Item list renders:
  - `item.description` in a `<textarea>`.
  - **Card Price** ↔ `item.unitPrice`.
  - **Qty** ↔ `item.quantity`.
  - **Total** = `qty * card price`.
- Financial summary: `# of Cards` (sum of quantities), `Average Card Price`,
  and total.
- Catalog on the right with bold card name, description, bold catalog price,
  and an **Add to Order** button.
- **Save Changes** POSTs the orders array to the npoint Orders endpoint with
  `Content-Type: application/json`.
- Totals stay in sync with the item list on every keystroke
  (`OrderStore.withDerivedTotals` runs on every mutation).

### Bonus

- **Card API**: `Api.loadCards()` populates the catalog from
  `CARDS_API_URL`, with `MOST_POPULAR_CARD` as the offline fallback.
- **Divide-by-zero**: `averageCardPrice = cardCount > 0 ? total / cardCount : 0`.
- **Routing**: `/orders/:orderID` is the order detail URL. Component
  input binding maps the param onto `OrderView.orderID`.
- **Unique IDs**: `OrderStore.createOrder()` and `addCardToOrder()` compute
  `max(existing) + 1` for orderID / itemID respectively.
- **Remove item**: each `cb-item-view` has a Remove button wired to
  `OrderStore.removeItem`.
- **State sync**: `OrderStore` recomputes `totalPrice`, `cardCount`, and
  `averageCardPrice` on add, edit, and remove. The on-disk shape stored in
  `IOrder` always matches the rendered totals.

## Test cases from the spec

| Scenario | Expected total | Expected avg |
| --- | --- | --- |
| Joe Blue, 3x Golden Ring | $30.00 | $10.00 |
| ORD-12345, wizard qty 10 + slugger qty 1 | $65.00 | $5.91 |
| Jane Deer, Golden Ring qty 20 + Golden Ring qty 0 | $200.00 | $10.00 |

All three pass with the current totals logic.

## Notes on conventions

- Standalone components only; no NgModules.
- New control flow (`@if`, `@for`, `@empty`) everywhere; no `*ngIf` / `*ngFor`.
- `input()` / `output()` signal-based component API; no `@Input` / `@Output` decorators.
- `inject()` over constructor injection.
- `ChangeDetectionStrategy.OnPush` on every component.
