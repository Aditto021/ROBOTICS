export interface ReportLink {
  href: string;
  label: string;
  note: string;
}

/** Project documents served from public/report. */
export const REPORTS: ReportLink[] = [
  {
    href: "/report/ResQBot_Final_Report.pdf",
    label: "Final Report",
    note: "IEEE format · CSE-426",
  },
  {
    href: "/report/ResQBot_Springer_Paper.pdf",
    label: "Springer Paper",
    note: "Springer LNCS format",
  },
];
