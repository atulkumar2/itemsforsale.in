function neutralizeFormula(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const escaped = neutralizeFormula(value).replace(/"/g, '""');
  return `"${escaped}"`;
}
