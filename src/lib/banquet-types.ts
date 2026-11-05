// What the banquet API sends to the screens (dates as text).
import type { BanquetBill } from "./banquet-bill";

export interface BanquetHallDTO {
  id: string;
  name: string;
  capacity: number;
  rent: number;
  notes: string | null;
  active: boolean;
}

export interface BanquetMenuDTO {
  id: string;
  name: string;
  foodType: string;
  pricePerPlate: number;
  items: string | null;
  active: boolean;
}

export interface BanquetDefaults {
  foodGst: number;
  hallGst: number;
  itemGst: number;
  prefix: string;
  terms: string | null;
}

export interface BanquetSetup {
  halls: BanquetHallDTO[];
  menus: BanquetMenuDTO[];
  defaults: BanquetDefaults;
}

export interface BanquetItemDTO {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstRate: number;
}

export interface BanquetPaymentDTO {
  id: string;
  amount: number;
  method: string;
  type: string;
  reference: string | null;
  notes: string | null;
  receivedBy: string | null;
  paidAt: string;
}

export interface BanquetDTO {
  id: string;
  number: number;
  status: string;
  customerName: string;
  phone: string;
  email: string | null;
  company: string | null;
  gstin: string | null;
  address: string | null;
  eventType: string;
  eventName: string | null;
  hallId: string;
  hall: BanquetHallDTO;
  eventDate: string;
  session: string;
  startTime: string;
  endTime: string;
  expectedPax: number;
  guaranteedPax: number;
  actualPax: number | null;
  seating: string | null;
  menuName: string | null;
  foodType: string;
  menuItems: string | null;
  platePrice: number;
  foodGst: number;
  hallRent: number;
  hallGst: number;
  discount: number;
  requirements: string | null;
  notes: string | null;
  followUpOn: string | null;
  invoiceNumber: string | null;
  billedAt: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdByName: string | null;
  createdAt: string;
  items: BanquetItemDTO[];
  payments: BanquetPaymentDTO[];
  bill: BanquetBill;
}

export interface HallClash {
  id: string;
  number: number;
  customerName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}
