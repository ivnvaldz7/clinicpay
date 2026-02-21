/**
 * Exports an array of rows to a CSV file download.
 *
 * @param {string} filename
 * @param {object[]} rows
 * @param {{ label: string, getValue: (row: object) => string|number|null }[]} columns
 */
export function exportToCsv(filename, rows, columns) {
  const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(c.getValue(row))).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
