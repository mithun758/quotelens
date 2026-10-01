// Pass or fail per questionnaire question, decided by code from what the model read.
// Evidence questions need a document: a valid ISO 9001 certificate, an OEM letter.
import type { Extraction, QuestionKey } from "@/lib/ai/extraction/schema";
import { QUESTION_KEYS } from "@/lib/ai/extraction/schema";
import type { PassFail } from "@/lib/db/types";
import { isIsoDate } from "@/lib/normalise/dates";

export type DocExtraction = { documentId: string; extraction: Extraction };
export type QuestionResult = { question_key: QuestionKey; pass_fail: PassFail; answer: string; evidence_document_id: string | null };

function answerFor(key: QuestionKey, docs: DocExtraction[]) {
  const answers = docs.flatMap((d) => d.extraction.questionnaire.filter((q) => q.question_key === key && q.answered).map((q) => ({ ...q, documentId: d.documentId })));
  return answers.find((a) => a.affirmative === true) ?? answers[0] ?? null;
}

export function evaluateQuestionnaire(docs: DocExtraction[], asOfDate: string): QuestionResult[] {
  return QUESTION_KEYS.map((key): QuestionResult => {
    if (key === "iso_9001") {
      const certs = docs
        .filter((d) => d.extraction.certificate && /9001/.test(d.extraction.certificate.standard))
        .map((d) => ({ documentId: d.documentId, validUntil: d.extraction.certificate!.valid_until }))
        .sort((a, b) => (b.validUntil ?? "").localeCompare(a.validUntil ?? ""));
      const best = certs[0];
      if (!best) return { question_key: key, pass_fail: "fail", answer: "No ISO 9001 certificate provided.", evidence_document_id: null };
      if (!isIsoDate(best.validUntil)) return { question_key: key, pass_fail: "fail", answer: "ISO 9001 certificate has no readable expiry date.", evidence_document_id: best.documentId };
      return best.validUntil >= asOfDate
        ? { question_key: key, pass_fail: "pass", answer: `ISO 9001 certificate valid until ${best.validUntil}.`, evidence_document_id: best.documentId }
        : { question_key: key, pass_fail: "fail", answer: `ISO 9001 certificate expired on ${best.validUntil}.`, evidence_document_id: best.documentId };
    }

    if (key === "oem_authorisation") {
      const letters = docs.filter((d) => d.extraction.authorisation);
      const valid = letters.find((d) => {
        const until = d.extraction.authorisation!.valid_until;
        return !isIsoDate(until) || until >= asOfDate;
      });
      if (valid) return { question_key: key, pass_fail: "pass", answer: `${valid.extraction.authorisation!.oem} authorisation letter provided.`, evidence_document_id: valid.documentId };
      const claimed = answerFor(key, docs);
      return {
        question_key: key,
        pass_fail: "fail",
        answer: letters.length ? "OEM authorisation letter has expired." : claimed ? `No authorisation letter attached. Supplier says: ${claimed.answer_text}` : "No OEM authorisation letter provided.",
        evidence_document_id: letters[0]?.documentId ?? null,
      };
    }

    const a = answerFor(key, docs);
    if (!a) return { question_key: key, pass_fail: "fail", answer: "Not answered.", evidence_document_id: null };
    return { question_key: key, pass_fail: a.affirmative ? "pass" : "fail", answer: a.answer_text, evidence_document_id: a.documentId };
  });
}
