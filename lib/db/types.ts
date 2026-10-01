// Row types mirroring supabase/migrations. Keep in step with the SQL.
// These are `type` aliases, not interfaces: supabase-js needs index-compatible types.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RfxStatus = "draft" | "sent" | "evaluating" | "awarded";
export type ResponseStatus = "received" | "processing" | "extracted" | "failed";
export type ConfidenceState = "extracted" | "inferred" | "missing";
export type ExtractedValueStatus = "auto_accepted" | "needs_review" | "confirmed" | "corrected";
export type SubstituteStatus = "pending" | "approved" | "rejected";
export type NormalisationKind = "fx" | "uom" | "pack_size" | "gst" | "discount" | "freight" | "bundle";
export type Severity = "low" | "medium" | "high";
export type FlagStatus = "open" | "resolved" | "overridden";
export type ClarificationStatus = "awaiting" | "answered";
export type PassFail = "pass" | "fail";
export type Scenario =
  | "best_quote"
  | "best_supplier"
  | "incumbent"
  | "best_quote_without_incumbent"
  | "custom";
export type AwardStatus = "draft" | "blocked" | "ready" | "exported";
export type Actor = "priya" | "arjun" | "system" | "model";

export type RfxTerms = {
  validity_required: boolean;
  requested_validity_days: number;
  gst_basis: string;
  delivery_hubs: string[];
  delivery_basis: string;
  delivery_days: number;
  warranty: string;
  payment: string;
  currency: string;
};

export type QuestionnaireQuestion = {
  key: string;
  text: string;
  evidence_required: boolean;
};

export type RfxRow = {
  id: string;
  title: string;
  category: string;
  need_by_date: string;
  approval_days: number;
  sent_at: string | null;
  terms: RfxTerms;
  questionnaire: QuestionnaireQuestion[];
  status: RfxStatus;
  created_at: string;
};

export type LineItemRow = {
  id: string;
  rfx_id: string;
  line_no: number;
  description: string;
  category: string;
  spec: Record<string, string | number | boolean>;
  quantity: number;
  uom: string;
  acceptable_equivalents: string | null;
  last_cycle_price_inr: number | null;
  memory_exposed: boolean;
  created_at: string;
};

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  gstin: string | null;
  state: string | null;
  default_currency: string;
  is_incumbent: boolean;
  created_at: string;
};

export type ResponseRow = {
  id: string;
  rfx_id: string;
  supplier_id: string;
  received_at: string;
  channel: string;
  body_text: string | null;
  status: ResponseStatus;
  coverage_count: number | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  response_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  page_count: number | null;
  created_at: string;
};

export type SourceLocator = {
  page?: number;
  sheet?: string;
  cell?: string;
  paragraph?: number;
  line?: number;
  bbox?: [number, number, number, number];
  span?: [number, number];
};

export type SubstituteCheck = {
  attribute: string;
  required: string | number | boolean;
  offered: string | number | boolean | null;
  result: "meets" | "exceeds" | "deviates";
}[];

export type ExtractedValueRow = {
  id: string;
  response_id: string;
  line_item_id: string | null;
  field: string;
  raw_value: string | null;
  raw_unit: string | null;
  raw_currency: string | null;
  normalised_value_inr: number | null;
  confidence_state: ConfidenceState;
  reason: string | null;
  source_document_id: string | null;
  source_locator: SourceLocator | null;
  source_snippet: string | null;
  match_reason: string | null;
  substitute_check: SubstituteCheck | null;
  substitute_status: SubstituteStatus | null;
  status: ExtractedValueStatus;
  created_at: string;
};

export type NormalisationStepRow = {
  id: string;
  extracted_value_id: string;
  step_order: number;
  kind: NormalisationKind;
  input: number;
  output: number;
  rate: number | null;
  rate_source: string | null;
  rate_date: string | null;
  created_at: string;
};

export type QuoteTermsRow = {
  id: string;
  response_id: string;
  quote_date: string | null;
  valid_until: string | null;
  gst_treatment: string | null;
  freight_terms: string | null;
  warranty: string | null;
  payment_terms: string | null;
  delivery_days: number | null;
  references_prior_pricing: boolean;
  discounts: QuoteDiscount[];
  created_at: string;
};

export type QuoteDiscount = { percent: number; threshold_inr: number | null; condition: string | null; applies_to_lines: number[]; description: string };

export type FlagRow = {
  id: string;
  extracted_value_id: string | null;
  response_id: string | null;
  type: string;
  severity: Severity;
  message: string;
  status: FlagStatus;
  created_at: string;
};

export type ClarificationRow = {
  id: string;
  flag_id: string;
  supplier_id: string;
  question: string;
  reply_text: string | null;
  status: ClarificationStatus;
  line_item_id: string | null;
  field: string | null;
  target_flag_type: string | null;
  answered_at: string | null;
  created_at: string;
};

export type QuestionnaireAnswerRow = {
  id: string;
  supplier_id: string;
  question_key: string;
  answer: string | null;
  pass_fail: PassFail | null;
  evidence_document_id: string | null;
  created_at: string;
};

export type AwardRow = {
  id: string;
  rfx_id: string;
  scenario: Scenario;
  allocations: Json;
  total_inr: number | null;
  savings_vs_l1: number | null;
  savings_vs_last_cycle: number | null;
  memo_markdown: string | null;
  status: AwardStatus;
  created_at: string;
};

export type AuditEventRow = {
  id: string;
  actor: Actor;
  action: string;
  target: string | null;
  before: Json | null;
  after: Json | null;
  reason: string | null;
  created_at: string;
};

export type BenchmarkSeriesRow = {
  id: string;
  series_key: string;
  label: string;
  observed_on: string;
  value: number;
  unit: string;
  source: string;
  is_illustrative: boolean;
  created_at: string;
};

export type FxRateRow = {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate_date: string;
  rate: number;
  source: string;
  is_illustrative: boolean;
  created_at: string;
};

export type RunStatus = "running" | "succeeded" | "partial" | "failed";
export type RunSnapshot = Record<string, Record<string, { value: number | null; confidence: ConfidenceState }>>;

export type ExtractionRunRow = {
  id: string;
  scope: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  snapshot: RunSnapshot | null;
  errors: Json | null;
  created_at: string;
};

export type ModelCallRow = {
  id: string;
  run_id: string | null;
  purpose: string;
  supplier_code: string | null;
  document_name: string | null;
  model: string;
  attempt: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
};

// Columns the database fills in; optional on insert. Nullable columns are optional too.
type OptionalOnInsert<R> = Extract<keyof R, "id" | "created_at"> | { [K in keyof R]: null extends R[K] ? K : never }[keyof R];
type Insertable<R> = Omit<R, OptionalOnInsert<R>> & Partial<Pick<R, OptionalOnInsert<R>>>;

type TableDef<R, Defaults extends keyof R = never> = {
  Row: R;
  Insert: Omit<Insertable<R>, Defaults> & Partial<Pick<R, Defaults>>;
  Update: Partial<R>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      rfx: TableDef<RfxRow, "approval_days" | "terms" | "questionnaire" | "status">;
      line_item: TableDef<LineItemRow, "spec" | "memory_exposed">;
      supplier: TableDef<SupplierRow, "default_currency" | "is_incumbent">;
      response: TableDef<ResponseRow, "channel" | "status">;
      document: TableDef<DocumentRow>;
      extracted_value: TableDef<ExtractedValueRow, "status">;
      normalisation_step: TableDef<NormalisationStepRow>;
      quote_terms: TableDef<QuoteTermsRow, "references_prior_pricing" | "discounts">;
      flag: TableDef<FlagRow, "status">;
      clarification: TableDef<ClarificationRow, "status">;
      questionnaire_answer: TableDef<QuestionnaireAnswerRow>;
      award: TableDef<AwardRow, "allocations" | "status">;
      audit_event: TableDef<AuditEventRow>;
      benchmark_series: TableDef<BenchmarkSeriesRow, "is_illustrative">;
      fx_rate: TableDef<FxRateRow, "is_illustrative">;
      extraction_run: TableDef<ExtractionRunRow, "status" | "started_at">;
      model_call: TableDef<ModelCallRow, "attempt" | "cache_read_input_tokens" | "cache_creation_input_tokens">;
    };
    Views: Record<string, never>;
    Functions: {
      reset_demo_data: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];

export const TABLE_NAMES = [
  "rfx",
  "line_item",
  "supplier",
  "response",
  "document",
  "extracted_value",
  "normalisation_step",
  "quote_terms",
  "flag",
  "clarification",
  "questionnaire_answer",
  "award",
  "audit_event",
  "benchmark_series",
  "fx_rate",
] as const satisfies readonly TableName[];

// Operational history: not demo data, so "Reset demo" leaves these alone.
export const OPS_TABLE_NAMES = ["extraction_run", "model_call"] as const satisfies readonly TableName[];
