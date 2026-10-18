import { config } from './config.mjs';
import { HttpError, cleanText } from './security.mjs';
import { pageText } from './resume-layout.mjs';

const allowed = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']
]);

export async function extractResume({ fileName, mimeType, contentBase64, pastedText }) {
  if (typeof pastedText === 'string' && pastedText.trim()) {
    return { fileName: fileName || 'Pasted resume text', mimeType: 'text/plain', method: 'pasted-text', text: cleanText(pastedText, config.maxResumeTextChars, 'Resume text'), warnings: [] };
  }
  if (typeof contentBase64 !== 'string' || !contentBase64) throw new HttpError(400, 'Choose a PDF or DOCX, or paste the resume text.', 'resume_required');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64) || contentBase64.length % 4 === 1) throw new HttpError(400, 'The uploaded file could not be decoded.', 'invalid_upload');
  const extension = String(fileName || '').toLowerCase().split('.').pop();
  const kind = allowed.get(mimeType) || (extension === 'pdf' ? 'pdf' : extension === 'docx' ? 'docx' : null);
  if (!kind) throw new HttpError(415, 'Only PDF and DOCX resumes are supported. You can also paste text.', 'unsupported_resume_type');
  let buffer;
  try { buffer = Buffer.from(contentBase64, 'base64'); } catch { throw new HttpError(400, 'The uploaded file could not be decoded.', 'invalid_upload'); }
  if (!buffer.length || buffer.length > config.maxResumeBytes) throw new HttpError(413, `Resume files must be between 1 byte and ${config.maxResumeBytes / 1024 / 1024} MB.`, 'resume_too_large');

  let text = '';
  const warnings = [];
  try {
    if (kind === 'pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
      const document = await loadingTask.promise;
      const pages = [];
      try {
        const pageLimit = Math.min(document.numPages, 40);
        if (document.numPages > pageLimit) warnings.push(`Only the first ${pageLimit} PDF pages were inspected.`);
        for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(pageText(content.items, page.getViewport({ scale: 1 }).width));
          page.cleanup();
        }
      } finally {
        await document.cleanup();
        await loadingTask.destroy();
      }
      text = pages.join('\n');
    } else {
      const mammoth = await import('mammoth');
      const result = await (mammoth.default || mammoth).extractRawText({ buffer });
      text = result.value || '';
    }
  } catch (error) {
    throw new HttpError(422, `The ${kind.toUpperCase()} could not be read locally. Try the paste-text option.`, 'resume_parse_failed');
  }
  text = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > config.maxResumeTextChars) warnings.push(`Extracted text was limited to ${config.maxResumeTextChars.toLocaleString()} characters.`);
  text = text.slice(0, config.maxResumeTextChars);
  if (text.length < 40) {
    throw new HttpError(422, 'Almost no text was found. This may be a scanned PDF; OCR is not included, so please paste the resume text.', 'scanned_pdf_or_empty');
  }
  return { fileName: String(fileName).slice(0, 180), mimeType: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', method: `${kind}-local-extraction`, text, warnings };
}
