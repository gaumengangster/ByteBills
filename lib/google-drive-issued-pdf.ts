import { uploadFileToGoogleDrive } from "@/lib/google-drive-upload-client"

/** Upload a generated PDF (invoice / receipt) using the same naming as downloads. */
export async function uploadIssuedPdfToGoogleDrive(
  pdfBlob: Blob,
  displayName: string,
): Promise<{ fileId: string }> {
  const safeName = displayName.toLowerCase().endsWith(".pdf") ? displayName : `${displayName}.pdf`
  const file = new File([pdfBlob], safeName, { type: "application/pdf" })
  return uploadFileToGoogleDrive(file, safeName)
}

/** True if this document should not be uploaded again (explicit flag or legacy Drive file id). */
export function isIssuedPdfOnDrive(doc: {
  uploadedToDrive?: boolean
  drivePdfFileId?: string | null
}): boolean {
  return doc.uploadedToDrive === true || !!doc.drivePdfFileId
}
