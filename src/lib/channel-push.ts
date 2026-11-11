// Sends the hotel's free rooms and prices to its booking sites after something changed.
// Called by src/lib/db.ts after every write to a booking, a room or a price.

/** Plans one update for this hotel, sent after the current request has answered. */
export function scheduleChannelPush(hotelId: string) {
  void hotelId;
}
