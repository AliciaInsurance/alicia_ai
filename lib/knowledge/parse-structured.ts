import type { StructuredDataPayload } from "@/lib/types/database";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvBuffer(buffer: Buffer): StructuredDataPayload {
  const raw = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV moet een headerrij en minimaal één datarij bevatten.");
  }

  const headers = parseCsvLine(lines[0]!).map((h, i) => h || `kolom_${i + 1}`);
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Geen datarijen gevonden in CSV.");
  }

  return { format: "csv", headers, rows };
}

export function parseJsonBuffer(buffer: Buffer): StructuredDataPayload {
  const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("JSON moet een niet-lege array van objecten zijn.");
  }
  const headers = Object.keys(parsed[0] as Record<string, unknown>);
  const rows = parsed.map((entry) => {
    const obj = entry as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const h of headers) {
      row[h] = obj[h] == null ? "" : String(obj[h]);
    }
    return row;
  });
  return { format: "json", headers, rows };
}

export function structuredDataToSearchText(data: StructuredDataPayload): string {
  const parts: string[] = [`Structured data (${data.format})`, `Columns: ${data.headers.join(", ")}`];
  for (const row of data.rows.slice(0, 500)) {
    parts.push(
      data.headers.map((h) => `${h}: ${row[h] ?? ""}`).join(" | "),
    );
  }
  if (data.rows.length > 500) {
    parts.push(`… ${data.rows.length - 500} extra rijen niet in preview-tekst.`);
  }
  return parts.join("\n");
}
