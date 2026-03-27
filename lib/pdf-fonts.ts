import jsPDF from "jspdf"



let regularBase64: string | null = null

let boldBase64: string | null = null



async function fetchFontAsBase64(url: string): Promise<string> {

    const response = await fetch(url)

    const buffer = await response.arrayBuffer()

    const bytes = new Uint8Array(buffer)

    let binary = ""

    for (let i = 0; i < bytes.length; i++) {

        binary += String.fromCharCode(bytes[i])

    }

    return btoa(binary)

}



export async function registerFonts(pdf: jsPDF): Promise<void> {

    if (!regularBase64 || !boldBase64) {

        const [regular, bold] = await Promise.all([

            fetchFontAsBase64("/fonts/Roboto-Regular.ttf"),

            fetchFontAsBase64("/fonts/Roboto-Bold.ttf"),

        ])

        regularBase64 = regular

        boldBase64 = bold

    }



    pdf.addFileToVFS("Roboto-Regular.ttf", regularBase64)

    pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal")



    pdf.addFileToVFS("Roboto-Bold.ttf", boldBase64)

    pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold")



    pdf.setFont("Roboto", "normal")

}