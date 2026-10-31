// Shapes of the JSON our API returns, used by the screens.
import type { Folio } from "./pricing";
import type { PayoutSummary } from "./payouts";
import type { ShiftSummary } from "./shift-report";

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
  gstRate: number | null; // GST % on the room chosen for this booking; null = the default from Settings
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
  otaReference: string | null;
  payoutAmount: number | null;
  payoutCommission: number;
  payoutCommissionGst: number;
  payoutTcs: number;
  payoutTds: number;
  payoutReceivedOn: string | null;
  payoutBankRef: string | null;
  /** What the booking site pays after its deductions; null until entered. */
  payout: PayoutSummary | null;
  flags: { arrivingToday: boolean; lateArrival: boolean; leavingToday: boolean; overstay: boolean };
  message?: string;
  /** Only when asked for with ?checkout=1: the bill if the guest checks out today. */
  checkout?: { today: string; stayed: Folio; booked: Folio };
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
  staffShifts: boolean;
  ownerWhatsapp: string | null;
  seasonalRates?: Array<{ id: string; name: string; startDate: string; endDate: string; roomType: string | null; percent: number }>;
}

export type BookingDetailDTO = BookingDTO & { guest: GuestDTO & { documents: DocumentDTO[] }; settings: SettingsDTO };

export interface ShiftDTO {
  id: string;
  staffId: string | null;
  staffName: string;
  startedAt: string;
  startNote: string | null;
  endedAt: string | null;
  handoverNote: string | null;
  endedBy: string | null;
  endReason: string | null;
  reportText: string | null;
  ownerSeenAt: string | null;
  open: boolean;
  summary: ShiftSummary;
}

export interface HandoverDTO {
  id: string;
  staffName: string;
  endedAt: string;
  handoverNote: string;
  endedBy: string | null;
}

export interface CurrentShiftDTO {
  required: boolean;
  shift: ShiftDTO | null;
  handovers: HandoverDTO[];
  ownerWhatsapp: string | null;
  unread?: number;
  onDuty?: number;
}

