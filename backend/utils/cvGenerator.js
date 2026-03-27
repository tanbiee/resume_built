const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;   // A4 width  (pts)
const PAGE_H    = 841.89;   // A4 height (pts)
const ML        = 48;       // left margin
const MR        = 48;       // right margin
const MT        = 48;       // top margin
const MB        = 48;       // bottom margin
const CW        = PAGE_W - ML - MR;  // content width
const BOTTOM    = PAGE_H - MB;       // y at which we must add a new page

// ── Colours ────────────────────────────────────────────────────────────────────
const COL = {
  name:     '#0f172a',
  accent:   '#4338ca',
  section:  '#4338ca',
  title:    '#1e293b',
  sub:      '#475569',
  body:     '#334155',
  rule:     '#cbd5e1',
  header_rule: '#4338ca',
};

// ── Font helpers ───────────────────────────────────────────────────────────────
const F = {
  bold:    'Helvetica-Bold',
  regular: 'Helvetica',
  italic:  'Helvetica-Oblique',
};

/**
 * Build a flat text line that honours the `continued` flag.
 * Returns the new y position after printing.
 */
function safePrint(doc, text, x, y, opts = {}) {
  if (y > BOTTOM - 20) { doc.addPage(); y = MT; }
  doc.text(text, x, y, opts);
  return doc.y;
}

/**
 * Draw a thin horizontal rule.
 */
function rule(doc, y, color = COL.rule, width = 0.4) {
  if (y > BOTTOM - 10) { doc.addPage(); y = MT; }
  doc.moveTo(ML, y)
     .lineTo(PAGE_W - MR, y)
     .lineWidth(width)
     .strokeColor(color)
     .stroke();
  return y + 5;
}

/**
 * Section heading (e.g. SKILLS, EXPERIENCE).
 * Returns new y after the rule.
 */
function sectionHead(doc, label, y) {
  if (y > BOTTOM - 30) { doc.addPage(); y = MT; }
  y += 6; // breathing room above section
  doc.font(F.bold).fontSize(9).fillColor(COL.section)
     .text(label.toUpperCase(), ML, y, { width: CW, characterSpacing: 1 });
  y = doc.y + 2;
  y = rule(doc, y, COL.rule, 0.5);
  return y + 2;
}

/**
 * Entry header for experience / projects / education.
 *   Line 1  →  [bold title]          [right-aligned date]
 *   Line 2  →  [italic subtitle]     (optional)
 *
 * We measure the title width. If title + date fit on one line → same line.
 * If not → title wraps freely, date goes on the subtitle line.
 */
function entryHeader(doc, { title, subtitle, date, titleSize = 10 }, y) {
  if (y > BOTTOM - 40) { doc.addPage(); y = MT; }

  const dateStr   = date || '';
  const dateW     = dateStr
    ? doc.font(F.regular).fontSize(8.5).widthOfString(dateStr) + 4
    : 0;
  const titleAvail = CW - dateW - (dateW ? 8 : 0);

  // Title (left) — allow wrap within available width
  doc.font(F.bold).fontSize(titleSize).fillColor(COL.title);
  const titleLineH = doc.currentLineHeight(true);
  const titleLines = Math.ceil(doc.font(F.bold).fontSize(titleSize).widthOfString(title) / titleAvail);

  doc.text(title, ML, y, { width: titleAvail, lineBreak: true });
  const afterTitle = doc.y;

  // Date — always right-aligned, pinned to the first line of the title
  if (dateStr) {
    doc.font(F.regular).fontSize(8.5).fillColor(COL.sub)
       .text(dateStr, ML, y, { width: CW, align: 'right' });
  }

  y = afterTitle;

  // Subtitle (italic, e.g. company name or tech stack)
  if (subtitle) {
    if (y > BOTTOM - 20) { doc.addPage(); y = MT; }
    doc.font(F.italic).fontSize(8.5).fillColor(COL.sub)
       .text(subtitle, ML, y, { width: CW, lineBreak: true });
    y = doc.y;
  }

  return y + 3;
}

/**
 * Bullet point — handles wrapping gracefully.
 */
function bullet(doc, text, y) {
  if (y > BOTTOM - 18) { doc.addPage(); y = MT; }
  const indent = 14;
  doc.font(F.regular).fontSize(9).fillColor(COL.body)
     .text('•', ML, y, { width: indent, lineBreak: false });
  doc.font(F.regular).fontSize(9).fillColor(COL.body)
     .text(text.trim(), ML + indent, y, { width: CW - indent, lineBreak: true, align: 'justify' });
  return doc.y + 2;
}

/**
 * Main entry point: generates a formatted A4 PDF from a structured CV object.
 */
const generateCVPdf = (cv, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size:    'A4',
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        info:    { Title: `${cv.contact?.name || 'Resume'}`, Author: cv.contact?.name || '' },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      let y = MT;

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.font(F.bold).fontSize(26).fillColor(COL.name)
         .text(cv.contact?.name || 'Candidate', ML, y, { width: CW });
      y = doc.y + 4;

      // Contact row
      const contactParts = [
        cv.contact?.email,
        cv.contact?.phone,
        cv.contact?.linkedin,
        cv.contact?.github,
        cv.contact?.location,
      ].filter(Boolean);

      if (contactParts.length) {
        doc.font(F.regular).fontSize(8.5).fillColor(COL.sub)
           .text(contactParts.join('   •   '), ML, y, { width: CW });
        y = doc.y + 5;
      }

      // Bold accent rule under name
      doc.moveTo(ML, y)
         .lineTo(PAGE_W - MR, y)
         .lineWidth(2)
         .strokeColor(COL.header_rule)
         .stroke();
      y += 10;

      // ── SUMMARY ─────────────────────────────────────────────────────────────
      if (cv.summary?.trim()) {
        y = sectionHead(doc, 'Summary', y);
        doc.font(F.regular).fontSize(9.5).fillColor(COL.body)
           .text(cv.summary.trim(), ML, y, { width: CW, align: 'justify', lineBreak: true });
        y = doc.y + 8;
      }

      // ── SKILLS ──────────────────────────────────────────────────────────────
      const skillRows = cv.skills
        ? [
            ['Languages',   cv.skills.languages],
            ['Frameworks',  cv.skills.frameworks],
            ['Tools',       cv.skills.tools],
            ['Soft Skills', cv.skills.soft_skills],
          ].filter(([, v]) => v && v.trim())
        : [];

      if (skillRows.length) {
        y = sectionHead(doc, 'Skills', y);
        for (const [label, value] of skillRows) {
          if (y > BOTTOM - 16) { doc.addPage(); y = MT; }
          doc.font(F.bold).fontSize(9).fillColor(COL.title)
             .text(`${label}: `, ML, y, { continued: true, width: CW });
          doc.font(F.regular).fontSize(9).fillColor(COL.body)
             .text(value.trim(), { width: CW });
          y = doc.y + 2;
        }
        y += 6;
      }

      // ── EXPERIENCE ──────────────────────────────────────────────────────────
      if (cv.experience?.length) {
        y = sectionHead(doc, 'Experience', y);
        for (const exp of cv.experience) {
          y = entryHeader(doc, {
            title:    exp.title,
            subtitle: exp.company,
            date:     exp.duration,
          }, y);
          for (const b of (exp.bullets || [])) {
            if (b?.trim()) y = bullet(doc, b, y);
          }
          y += 5;
        }
      }

      // ── PROJECTS ────────────────────────────────────────────────────────────
      if (cv.projects?.length) {
        y = sectionHead(doc, 'Projects', y);
        for (const proj of cv.projects) {
          // Project name as title, tech stack as subtitle (separate line — no collision!)
          y = entryHeader(doc, {
            title:    proj.name,
            subtitle: proj.tech ? `Tech: ${proj.tech}` : '',
            date:     proj.duration,
            titleSize: 9.5,
          }, y);
          for (const b of (proj.bullets || [])) {
            if (b?.trim()) y = bullet(doc, b, y);
          }
          y += 5;
        }
      }

      // ── EDUCATION ───────────────────────────────────────────────────────────
      if (cv.education?.length) {
        y = sectionHead(doc, 'Education', y);
        for (const edu of cv.education) {
          const sub = [edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join('   •   ');
          y = entryHeader(doc, {
            title:    edu.degree,
            subtitle: sub,
            date:     edu.duration,
          }, y);
          y += 3;
        }
      }

      // ── CERTIFICATIONS ──────────────────────────────────────────────────────
      if (cv.certifications?.filter(c => c?.trim()).length) {
        y = sectionHead(doc, 'Certifications', y);
        for (const cert of cv.certifications) {
          if (cert?.trim()) y = bullet(doc, cert, y);
        }
        y += 5;
      }

      // ── ACHIEVEMENTS ────────────────────────────────────────────────────────
      if (cv.achievements?.filter(a => a?.trim()).length) {
        y = sectionHead(doc, 'Achievements', y);
        for (const ach of cv.achievements) {
          if (ach?.trim()) y = bullet(doc, ach, y);
        }
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error',  reject);

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateCVPdf };
