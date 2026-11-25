"use strict";
/**
 * Reliable PDF text extraction for the document -> game feature (no AI, no OCR).
 * Uses the `pdf-parse` package (add it with: npm i pdf-parse@1.1.1).
 * Returns null when it cannot read real text, so the caller can fall back or explain.
 */

let parser = null;
function loadParser() {
  if (parser !== null) return parser;
  try {
    // Import the library file directly - the package index runs a debug read of a test PDF.
    parser = require("pdf-parse/lib/pdf-parse.js");
  } catch {
    parser = false;
  }
  return parser;
}

/** true when the text looks like normal words (not "B u s i n e s s" or symbol soup) */
function looksReadable(text) {
  const t = String(text || "");
  if (t.replace(/\s+/g, "").length < 40) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const single = tokens.filter((w) => w.length === 1 && /[A-Za-z]/.test(w)).length;
  if (single / tokens.length > 0.3) return false;
  const letters = (t.match(/\p{L}/gu) || []).length;
  return letters / t.length > 0.5;
}

async function extractPdfText(buffer) {
  const parse = loadParser();
  if (!parse) return null;
  try {
    const out = await parse(buffer);
    const text = String(out?.text || "").replace(/\u0000/g, " ").replace(/[ \t]+\n/g, "\n");
    return looksReadable(text) ? text : null;
  } catch {
    return null;
  }
}

function isAvailable() {
  return !!loadParser();
}

module.exports = { extractPdfText, looksReadable, isAvailable };
