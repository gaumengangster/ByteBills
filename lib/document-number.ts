import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "./firebase"

const PREFIXES: Record<string, string> = {
    invoices: "INV",
    receipts: "RCT",
    deliveryNotes: "DN",
}

const NUMBER_FIELDS: Record<string, string> = {
    invoices: "invoiceNumber",
    receipts: "receiptNumber",
    deliveryNotes: "deliveryNoteNumber",
}

export async function generateNextDocumentNumber(
    userId: string,
    collectionName: "invoices" | "receipts" | "deliveryNotes"
): Promise<string> {
    const prefix = PREFIXES[collectionName]
    const year = new Date().getFullYear()
    const yearPrefix = `${prefix}-${year}-`
    const numberField = NUMBER_FIELDS[collectionName]

    try {
        const q = query(
            collection(db, collectionName),
            where("userId", "==", userId)
        )
        const snapshot = await getDocs(q)

        let maxSeq = 0
        snapshot.docs.forEach((doc) => {
            const num: string = doc.data()[numberField] || ""
            if (num.startsWith(yearPrefix)) {
                const seq = parseInt(num.replace(yearPrefix, ""), 10)
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq
                }
            }
        })

        const nextSeq = (maxSeq + 1).toString().padStart(4, "0")
        return `${yearPrefix}${nextSeq}`
    } catch (error) {
        console.error(`Error generating ${collectionName} number:`, error)
        const fallback = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
        return `${yearPrefix}${fallback}`
    }
}
