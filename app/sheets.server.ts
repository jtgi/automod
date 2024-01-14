import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const serviceAccountAuth = new JWT({
  email: process.env.G_EMAIL,
  key: process.env.G_PKEY!.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheet = new GoogleSpreadsheet(
  process.env.G_SHEET_ID!,
  serviceAccountAuth
);
