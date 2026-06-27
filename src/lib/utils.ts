import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function parseAmenities(amenities: string): string[] {
  try {
    const parsed = JSON.parse(amenities);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return amenities ? amenities.split(",").map((a) => a.trim()) : [];
  }
}

export function stringifyAmenities(amenities: string[]): string {
  return JSON.stringify(amenities);
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getPaymentStatus(totalAmount: number, paidAmount: number): "pending" | "partial" | "paid" {
  if (paidAmount <= 0) return "pending";
  if (paidAmount >= totalAmount) return "paid";
  return "partial";
}

export const ROOM_TYPES = ["single", "double", "suite", "deluxe", "family"] as const;
export const ROOM_STATUSES = ["available", "occupied", "maintenance", "reserved"] as const;
export const DOCUMENT_TYPES = ["aadhar", "pan", "passport"] as const;
export const PAYMENT_METHODS = ["cash", "card", "upi", "bank_transfer", "other"] as const;
export const BOOKING_STATUSES = ["reserved", "checked_in", "checked_out", "cancelled"] as const;

export type RoomType = (typeof ROOM_TYPES)[number];
export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
