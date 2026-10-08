// Shapes of the JSON our API returns, used by the screens.
import type { Folio } from "./pricing";

export interface GuestDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationality: string;
  address: string | null;
  idType: string | null;
  idNumber: string | null;
  company: string | null;
  gstin: string | null;
  dateOfBirth: string | null;
  passportNo: string | null;
  visaNo: string | null;
  notes: string | null;
  vip: boolean;
  blacklisted: boolean;
  createdAt: string;
  documents?: DocumentDTO[];
}

export interface DocumentDTO {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  createdAt: string;
}

export interface RoomDTO {
  id: string;
  roomNumber: string;
  type: string;
  floor: string | null;
  capacity: number;
  pricePerNight: number;
  description: string | null;
  amenities: string[];
  status: string;
  housekeeping: string;
  houseKeeperName: string | null;
  housekeepingNotes: string | null;
  currentGuest?: { bookingId: string; name: string; checkOut: string } | null;
  nextBooking?: { bookingId: string; name: string; checkIn: string } | null;
}

export interface PaymentDTO {
  id: string;
  amount: number;
  method: string;
  type: string;
  status: string;
  reference: string | null;
  notes: string | null;
  receivedBy: string | null;
  paidAt: string;
}

export interface ChargeDTO {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
  createdAt: string;
}

export interface BookingDTO {
  id: string;
  number: number;
  publicToken: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  ratePerNight: number;
  fixedRate: boolean;
  discount: number;
  adults: number;
  children: number;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  guestName: string;
  guest: GuestDTO;
  room: RoomDTO & { amenities: string };
  payments: PaymentDTO[];
  charges: ChargeDTO[];
  bill: {
    id: string;
    invoiceNumber: string | null;
    generatedAt: string;
    totalAmount: number;
  } | null;
  folio: Folio;
  flags: { arrivingToday: boolean; lateArrival: boolean; leavingToday: boolean; overstay: boolean };
  message?: string;
}

export interface SettingsDTO {
  hotelName: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  currency: string;
  timezone: string;
  taxMode: string;
  taxRate: number;
  gstSlabs: Array<{ upTo: number | null; rate: number }>;
  extrasTaxRate: number;
  weekendSurcharge: number;
  checkInTime: string;
  checkOutTime: string;
  invoicePrefix: string;
  bookingTerms: string | null;
  websiteEnabled: boolean;
  websiteAbout: string | null;
  seasonalRates?: Array<{ id: string; name: string; startDate: string; endDate: string; roomType: string | null; percent: number }>;
}

export type BookingDetailDTO = BookingDTO & { guest: GuestDTO & { documents: DocumentDTO[] }; settings: SettingsDTO };
