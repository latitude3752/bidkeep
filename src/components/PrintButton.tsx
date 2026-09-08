"use client";

export default function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-900 print:hidden"
    >
      {label}
    </button>
  );
}
