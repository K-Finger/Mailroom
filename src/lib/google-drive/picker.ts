// Client-side Google Picker API loader
// Requires the user to have signed in with Google (provider_token stored in users table)

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

// Supported Drive MIME types → local file extensions
export const DRIVE_SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "application/vnd.google-apps.spreadsheet", // exported as xlsx
];

let _pickerLoaded: Promise<void> | null = null;

export function loadPickerApi(): Promise<void> {
  if (_pickerLoaded) return _pickerLoaded;
  _pickerLoaded = (async () => {
    if (typeof window.gapi === "undefined") {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google API script"));
        document.head.appendChild(script);
      });
    }
    await new Promise<void>((resolve) => window.gapi.load("picker", resolve));
  })();
  return _pickerLoaded;
}

/** Opens the Google Picker for folder selection. Returns the selected folder or null if cancelled. */
export function openFolderPicker(token: string): Promise<DriveFolder | null> {
  return new Promise((resolve) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    const builder = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes("application/vnd.google-apps.folder"),
      )
      .setOAuthToken(token)
      .setCallback((data: any) => {
        if (data.action === "picked") {
          resolve({ id: data.docs[0].id, name: data.docs[0].name });
        } else if (data.action === "cancel") {
          resolve(null);
        }
      });

    if (apiKey) builder.setDeveloperKey(apiKey);

    builder.build().setVisible(true);
  });
}

export interface SpreadsheetTarget {
  id: string;
  name: string;
}

/** Opens the Google Picker for spreadsheet selection. Returns the selected sheet or null if cancelled. */
export function openSheetPicker(token: string): Promise<SpreadsheetTarget | null> {
  return new Promise((resolve) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    const builder = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS))
      .setOAuthToken(token)
      .setCallback((data: any) => {
        if (data.action === "picked") {
          resolve({ id: data.docs[0].id, name: data.docs[0].name });
        } else if (data.action === "cancel") {
          resolve(null);
        }
      });

    if (apiKey) builder.setDeveloperKey(apiKey);

    builder.build().setVisible(true);
  });
}

/** Lists supported files inside a Drive folder. */
export async function listFolderFiles(folderId: string, token: string): Promise<DriveFile[]> {
  const mimeFilter = DRIVE_SUPPORTED_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
  const q = encodeURIComponent(
    `(${mimeFilter}) and '${folderId}' in parents and trashed=false`,
  );

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error("Failed to list Drive folder contents");
  const { files } = await res.json();
  return files ?? [];
}

/** Downloads a Drive file as a browser File object. Google Docs/Sheets are exported to xlsx. */
export async function downloadDriveFile(file: DriveFile, token: string): Promise<File> {
  let url: string;
  let filename = file.name;

  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    const exportMime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`;
    filename = file.name.endsWith(".xlsx") ? file.name : `${file.name}.xlsx`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to download "${file.name}"`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || file.mimeType });
}
