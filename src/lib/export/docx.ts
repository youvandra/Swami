// Word export for proposals. Loaded on demand so the docx library stays out of the main bundle.

import type { Artifact } from "../agent/types";
import { templateOf } from "../proposal";

type Proposal = Extract<Artifact, { type: "proposal" }>;

const NAVY = "0B1622";
const MUTED = "586874";
const TEAL = "0E3A45";

export async function proposalDocx(a: Proposal): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");

  const serif = "Georgia";
  const sans = "Arial";
  const headline = a.headline ?? `${a.picks[0].name} for ${a.show.headliner}`;
  const rule = { style: BorderStyle.SINGLE, size: 4, color: "D9DEE2" };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const para = (text: string, opts: { size?: number; color?: string; bold?: boolean; font?: string; after?: number; before?: number } = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 300 },
      children: [new TextRun({ text, size: opts.size ?? 22, color: opts.color ?? NAVY, bold: opts.bold, font: opts.font ?? sans })],
    });

  const meta = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: rule, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          ["To", a.to],
          ["From", a.from],
          ["Date", a.date],
        ].map(
          ([k, v]) =>
            new TableCell({
              margins: { bottom: 200 },
              children: [para(k, { size: 16, color: MUTED, after: 40 }), para(v, { size: 20, bold: true })],
            }),
        ),
      }),
    ],
  });

  const sections = a.sections.flatMap((sec, i) => [
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({ text: `${String(i + 1).padStart(2, "0")}  `, font: serif, size: 22, color: "9AA6B0" }),
        new TextRun({ text: sec.heading, font: sans, size: 24, bold: true, color: NAVY }),
      ],
    }),
    ...sec.body.split(/\n+/).filter(Boolean).map((line) => para(line, { color: "2B3A46" })),
  ]);

  const picks = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: rule, bottom: rule, left: none, right: none, insideHorizontal: rule, insideVertical: none },
    rows: a.picks.map(
      (p, i) =>
        new TableRow({
          children: [
            new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, margins: { top: 120, bottom: 120 }, children: [para(String(i + 1), { font: serif, size: 28, color: TEAL })] }),
            new TableCell({ margins: { top: 120, bottom: 120 }, children: [para(p.name, { bold: true, after: 40 }), para(p.why, { size: 19, color: MUTED })] }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: p.score.toFixed(2), font: serif, size: 28, color: NAVY })] })],
            }),
          ],
        }),
    ),
  });

  const doc = new Document({
    creator: "Swami",
    title: a.title,
    styles: { default: { document: { run: { font: sans, size: 22, color: NAVY } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        children: [
          para(templateOf(a.template).kicker.toUpperCase(), { size: 16, bold: true, color: TEAL, after: 160 }),
          para(headline, { font: serif, size: 56, after: 120 }),
          para(`${a.show.venue}, ${a.show.city} · ${a.show.date} · ${a.show.capacity.toLocaleString("en-US")} capacity`, { size: 20, color: MUTED, after: 280 }),
          meta,
          ...sections,
          new Paragraph({
            spacing: { before: 360, after: 160 },
            children: [
              new TextRun({ text: `${String(a.sections.length + 1).padStart(2, "0")}  `, font: serif, size: 22, color: "9AA6B0" }),
              new TextRun({ text: "Ranked picks", size: 24, bold: true }),
            ],
          }),
          picks,
          para("Scores show audience affinity from the Qloo taste graph. Prepared with Swami.", { size: 16, color: MUTED, before: 360 }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
