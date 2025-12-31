import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export async function getGoogleAuth() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    // Private Key 처리: \n 문자열을 실제 개행문자로 변환
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
        throw new Error("Google Service Account credential is missing.");
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: SCOPES,
    });

    return auth;
}

export async function getSheetNames(spreadsheetId: string): Promise<string[]> {
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
    });

    const titles =
        response.data.sheets
            ?.map((sheet) => sheet.properties?.title)
            .filter((title): title is string => !!title) || [];

    return titles;
}

export async function getSheetValues(
    spreadsheetId: string,
    range: string
): Promise<string[][]> {
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    return response.data.values || [];
}
