"use client";

export default function PrintButton() {
  return <button type="button" className="btn-primary" onClick={() => window.print()}>Print or save as PDF</button>;
}
