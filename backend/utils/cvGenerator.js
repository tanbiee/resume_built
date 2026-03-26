const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Color palette
const C = {
  black:    '#1a1a2e',
  accent:   '#4f46e5',
  accent2:  '#06b6d4',
  white:    '#ffffff',
  gray:     '#6b7280',
  lightgray:'#f3f4f6',
  border:   '#e5e7eb',
  text:     '#374151',
};

const FONTS = {
  regular: 'Helvetica',
  bold:    'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
};

const MARGIN = 45;
const PAGE_W = 595.28; // A4
const CONTENT_W = PAGE_W - MARGIN * 2;

/**
 * Generate a formatted PDF from structured CV data
 * @param {object} cv - Structured CV object from Groq
 * @param {string} outputPath - File path to save PDF
 */
const generateCVPdf = (cv, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: `${cv.contact?.name || 'Resume'} - CV` } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    let y = MARGIN;

    // ── HEADER ────────────────────────────────────────────────────────────────
    // Name
    doc.font(FONTS.bold).fontSize(24).fillColor(C.black)
       .text(cv.contact?.name || 'Candidate', MARGIN, y, { width: CONTENT_W });
    y = doc.y + 4;

    // Contact line
    const contactParts = [
      cv.contact?.email,
      cv.contact?.phone,
      cv.contact?.linkedin,
      cv.contact?.github,
      cv.contact?.location,
    ].filter(Boolean);

    doc.font(FONTS.regular).fontSize(8.5).fillColor(C.gray)
       .text(contactParts.join('  •  '), MARGIN, y, { width: CONTENT_W });
    y = doc.y + 4;

    // Rule under header
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
       .lineWidth(2).strokeColor(C.accent).stroke();
    y += 10;

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    if (cv.summary) {
      y = sectionTitle(doc, 'SUMMARY', y);
      doc.font(FONTS.regular).fontSize(9.5).fillColor(C.text)
         .text(cv.summary, MARGIN, y, { width: CONTENT_W, align: 'justify' });
      y = doc.y + 10;
    }

    // ── SKILLS ────────────────────────────────────────────────────────────────
    if (cv.skills) {
      y = sectionTitle(doc, 'SKILLS', y);
      const skillRows = [
        ['Languages',  cv.skills.languages],
        ['Frameworks', cv.skills.frameworks],
        ['Tools',      cv.skills.tools],
        ['Soft Skills',cv.skills.soft_skills],
      ].filter(([, v]) => v);

      for (const [label, value] of skillRows) {
        doc.font(FONTS.bold).fontSize(9).fillColor(C.black).text(`${label}: `, MARGIN, y, { continued: true, width: CONTENT_W });
        doc.font(FONTS.regular).fontSize(9).fillColor(C.text).text(value, { width: CONTENT_W });
        y = doc.y + 3;
      }
      y += 6;
    }

    // ── EXPERIENCE ────────────────────────────────────────────────────────────
    if (cv.experience?.length) {
      y = sectionTitle(doc, 'EXPERIENCE', y);
      for (const exp of cv.experience) {
        y = entryHeader(doc, exp.title, exp.company, exp.duration, y);
        for (const b of (exp.bullets || [])) {
          y = bullet(doc, b, y);
        }
        y += 6;
      }
    }

    // ── PROJECTS ──────────────────────────────────────────────────────────────
    if (cv.projects?.length) {
      y = sectionTitle(doc, 'PROJECTS', y);
      for (const proj of cv.projects) {
        const headerLabel = proj.tech ? `${proj.name} | ${proj.tech}` : proj.name;
        y = entryHeader(doc, headerLabel, '', proj.duration, y);
        for (const b of (proj.bullets || [])) {
          y = bullet(doc, b, y);
        }
        y += 6;
      }
    }

    // ── EDUCATION ─────────────────────────────────────────────────────────────
    if (cv.education?.length) {
      y = sectionTitle(doc, 'EDUCATION', y);
      for (const edu of cv.education) {
        const detail = edu.gpa ? `${edu.institution}  •  GPA: ${edu.gpa}` : edu.institution;
        y = entryHeader(doc, edu.degree, detail, edu.duration, y);
        y += 4;
      }
    }

    // ── CERTIFICATIONS ────────────────────────────────────────────────────────
    if (cv.certifications?.length) {
      y = sectionTitle(doc, 'CERTIFICATIONS', y);
      for (const cert of cv.certifications) {
        y = bullet(doc, cert, y);
      }
      y += 6;
    }

    // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
    if (cv.achievements?.length) {
      y = sectionTitle(doc, 'ACHIEVEMENTS', y);
      for (const ach of cv.achievements) {
        y = bullet(doc, ach, y);
      }
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function sectionTitle(doc, label, y) {
  if (y > 720) { doc.addPage(); y = MARGIN; }
  doc.font(FONTS.bold).fontSize(10).fillColor(C.accent)
     .text(label, MARGIN, y, { width: CONTENT_W });
  const lineY = doc.y + 2;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_W - MARGIN, lineY)
     .lineWidth(0.5).strokeColor(C.border).stroke();
  return lineY + 6;
}

function entryHeader(doc, title, subtitle, duration, y) {
  if (y > 710) { doc.addPage(); y = MARGIN; }
  // Title (left) + Duration (right) on same line
  const durationW = duration ? doc.font(FONTS.regular).fontSize(9).widthOfString(duration) + 4 : 0;
  const titleW = CONTENT_W - durationW;

  doc.font(FONTS.bold).fontSize(10).fillColor(C.black)
     .text(title, MARGIN, y, { width: titleW, continued: duration ? false : false });

  if (duration) {
    doc.font(FONTS.regular).fontSize(8.5).fillColor(C.gray)
       .text(duration, PAGE_W - MARGIN - durationW, y, { width: durationW, align: 'right' });
  }

  y = doc.y;

  if (subtitle) {
    doc.font(FONTS.oblique).fontSize(9).fillColor(C.gray)
       .text(subtitle, MARGIN, y, { width: CONTENT_W });
    y = doc.y;
  }
  return y + 2;
}

function bullet(doc, text, y) {
  if (y > 720) { doc.addPage(); y = MARGIN; }
  const bulletX = MARGIN + 10;
  const textX = MARGIN + 18;
  doc.font(FONTS.regular).fontSize(9).fillColor(C.text)
     .text('•', MARGIN, y, { width: 10, continued: false });
  doc.font(FONTS.regular).fontSize(9).fillColor(C.text)
     .text(text, textX, y, { width: CONTENT_W - 18 });
  return doc.y + 2;
}

module.exports = { generateCVPdf };
