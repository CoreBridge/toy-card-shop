/**
 * Item in an order. Bound to a card from the catalog; `unitPrice`, `cardID`,
 * and `description` are seeded from the card on add. `quantity * unitPrice`
 * is derived in the view.
 */
export interface IItem {
  itemID: number;
  orderID: number;
  unitPrice: number;
  quantity: number;
  cardID: number;
  description: string;
}

/**
 * Order owned by a customer. `totalPrice`, `cardCount`, and `averageCardPrice`
 * are derived from `items` and recomputed by the store on every mutation.
 */
export interface IOrder {
  orderID: number;
  orderName: string;
  customerName: string;
  totalPrice: number;
  cardCount: number;
  averageCardPrice: number;
  items: IItem[];
}

/** Catalog card. `catalogPrice` becomes the `unitPrice` when added to an order. */
export interface ICard {
  cardID: number;
  cardName: string;
  description: string;
  catalogPrice: number;
}

/** Wire shape returned by `ORDERS_API_URL`. */
export interface OrdersApiPayload {
  orders: IOrder[];
}

/** Wire shape returned by `CARDS_API_URL`. */
export interface CardsApiPayload {
  cards: ICard[];
}

/** npoint Orders endpoint: GET to load, POST (application/json) to persist. */
export const ORDERS_API_URL = 'https://api.npoint.io/e3fd4314dba3baa26d90';

/** npoint Cards endpoint: GET only, populates the catalog. */
export const CARDS_API_URL = 'https://api.npoint.io/24981ca2f9809bbef7d0';

/** Hardcoded fallback card; guarantees the catalog is non-empty offline. */
export const MOST_POPULAR_CARD: ICard = {
  cardID: 7,
  cardName: 'GOLDEN RING',
  description: 'A fantasy trading card of a famous magic item',
  catalogPrice: 10,
};

/**
 * Build a blank order. `lastOrderID` is the highest existing order ID;
 * the new order is assigned `lastOrderID + 1` to keep IDs unique.
 */
export function GenerateNewOrder(
  lastOrderID: number,
  randomInvoiceNumber: string,
): IOrder {
  return {
    orderID: lastOrderID + 1,
    orderName: randomInvoiceNumber,
    customerName: '',
    totalPrice: 0,
    cardCount: 0,
    averageCardPrice: 0,
    items: [],
  };
}

/**
 * Build an item from a catalog card. `lastItemID` is the highest existing
 * item ID across all orders; the new item is assigned `lastItemID + 1`.
 */
export function GenerateNewItem(
  parentOrderID: number,
  fromCard: ICard,
  lastItemID: number,
): IItem {
  return {
    itemID: lastItemID + 1,
    orderID: parentOrderID,
    unitPrice: fromCard.catalogPrice,
    quantity: 1,
    cardID: fromCard.cardID,
    description: `${fromCard.cardName}\n${fromCard.description}`,
  };
}
