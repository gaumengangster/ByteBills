/**
 * Per-user global cost sequence counter.
 *
 * Counts all cost documents across every cost collection for a given user
 * and returns the next sequence number as a zero-padded 3-digit string.
 * e.g. if the user already has 7 costs → returns "008".
 *
 * Note: not atomic (two simultaneous saves could get the same number) but
 * acceptable for a single-user bookkeeping app.
 */

import { collection, getCountFromServer, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

const COUNTED_COLLECTIONS = [
  "cost_invoice",
  "cost_partial_business_use",
  "cost_pauschale",
  "cost_afa",
] as const

export async function fetchNextCostSequenceNumber(userId: string): Promise<string> {
  const counts = await Promise.all(
    COUNTED_COLLECTIONS.map((col) =>
      getCountFromServer(query(collection(db, col), where("userId", "==", userId))).then(
        (snap) => snap.data().count,
      ),
    ),
  )
  const total = counts.reduce((sum, c) => sum + c, 0)
  return String(total + 1).padStart(3, "0")
}
