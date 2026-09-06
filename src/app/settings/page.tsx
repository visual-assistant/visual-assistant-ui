"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cpu,
  ExternalLink,
  FileText,
  Hash,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import AppShell from "../../components/AppShell";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const buildUrl = (
  path: string,
  params?: URLSearchParams | Record<string, string | undefined>
) => {
  const url = new URL(path, API_BASE);
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => url.searchParams.set(k, v));
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
};

type CatalogValue = string | { code?: string | null; label?: string | null };

type ProductDocumentCatalog = {
  document_types?: CatalogValue[];
  statuses?: CatalogValue[];
  indexing_statuses?: CatalogValue[];
  source_kinds?: CatalogValue[];
  suggested_tags?: CatalogValue[];
};

type ProductDocument = {
  document_id?: string | null;
  id?: string | null;
  product_code?: string | null;
  product_label?: string | null;
  product?: string | null;
  title?: string | null;
  document_type?: string | null;
  version?: string | null;
  status?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  source?: {
    url?: string | null;
    kind?: string | null;
    filename?: string | null;
    file_name?: string | null;
    storage_key?: string | null;
    mime_type?: string | null;
    size?: number | string | null;
  } | null;
  indexing?: {
    status?: string | null;
    updated_at?: number | string | null;
    last_indexed_at?: number | string | null;
    index_version?: string | null;
    last_error?: string | null;
  } | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
};

type ProductDocumentIndex = {
  schema_version?: string | null;
  index_version?: string | null;
  document_id?: string | null;
  product_code?: string | null;
  product_label?: string | null;
  document_title?: string | null;
  document_type?: string | null;
  source?: {
    url?: string | null;
    storage_key?: string | null;
    filename?: string | null;
  } | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  stats?: {
    page_count?: number | null;
    indexed_page_count?: number | null;
    section_count?: number | null;
    anchor_count?: number | null;
    page_image_count?: number | null;
    text_char_count?: number | null;
  } | null;
  pages?: IndexPage[] | null;
  sections?: IndexSection[] | null;
  anchors?: IndexAnchor[] | null;
  page_images?: PageImage[] | null;
  section_images?: PageImage[] | null;
  anchor_images?: PageImage[] | null;
  outline_meta?: OutlineMeta | null;
  outline_candidates?: unknown[] | null;
};

type BulkReviewStatus = "READY" | "CHECK" | "DUPLICATE" | "IGNORED" | "EXCLUDED";
type BulkPipelineStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
type BulkItemStatus = "PENDING" | "RUNNING" | "INDEXED" | "FAILED" | "IGNORED" | "SKIPPED";
type BulkStep = "SCAN" | "SUMMARY" | "REVIEW" | "PIPELINE" | "DONE";

type TechnicalKnowledgeSummary = {
  created_technical_knowledge?: number | string | null;
  rejected_candidates?: number | string | null;
  batch_errors?: number | string | unknown[] | null;
  [key: string]: unknown;
};

type BulkManifestFile = {
  client_file_id: string;
  filename: string;
  relative_path: string;
  size: number;
  last_modified: number;
  mime_type: string;
  sha256?: string;
};

type BulkFolderSummary = {
  path?: string | null;
  pdf_count?: number | null;
  ignored_count?: number | null;
};

type BulkImportItem = {
  item_id: string;
  source_file?: BulkManifestFile | null;
  review_status?: BulkReviewStatus | string | null;
  review_reasons?: string[] | null;
  duplicate_matches?: unknown[] | null;
  metadata?: {
    product_code?: string | null;
    product_label?: string | null;
    title?: string | null;
    document_type?: string | null;
    version?: string | null;
    tags?: string[] | null;
  } | null;
  pipeline?: {
    upload_status?: BulkPipelineStatus | string | null;
    metadata_status?: BulkPipelineStatus | string | null;
    index_status?: BulkPipelineStatus | string | null;
    technical_knowledge_status?: BulkPipelineStatus | string | null;
    last_error?: string | null;
    attempt_count?: number | null;
    started_at?: number | string | null;
    completed_at?: number | string | null;
  } | null;
  technical_knowledge_summary?: TechnicalKnowledgeSummary | null;
  status?: BulkItemStatus | string | null;
  last_error?: string | null;
};

type BulkImportBatch = {
  batch_id?: string | null;
  id?: string | null;
  root_name?: string | null;
  step?: BulkStep | string | null;
  counts?: {
    total?: number | null;
    ready?: number | null;
    check?: number | null;
    duplicate?: number | null;
    ignored?: number | null;
    excluded?: number | null;
    accepted?: number | null;
    indexed?: number | null;
    failed?: number | null;
    running?: number | null;
    pending?: number | null;
  } | null;
  progress?: {
    accepted_count?: number | null;
    completed_count?: number | null;
    percent?: number | null;
  } | null;
  folders?: BulkFolderSummary[] | null;
  items?: BulkImportItem[] | null;
};

type BulkImportResponse = {
  ok?: boolean;
  batch?: BulkImportBatch;
  item?: BulkImportItem;
  retry_mode?: "index" | "upload" | string;
  requires_file_upload?: boolean;
  next_endpoint?: string;
  accepted_item_ids?: string[];
  skipped_item_ids?: string[];
  not_found_item_ids?: string[];
  ignored_item_ids?: string[];
  duplicate_item_ids?: string[];
  invalid_status_item_ids?: string[];
  accepted_count?: number;
  skipped_count?: number;
  detail?: string;
  message?: string;
  error?: string;
};

type ResetCorpusResponse = {
  ok?: boolean;
  dry_run?: boolean;
  summary?: Record<string, unknown> | null;
  counts?: Record<string, unknown> | null;
  would_delete?: Record<string, unknown> | null;
  deleted?: Record<string, unknown> | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
  [key: string]: unknown;
};

type TechnicalKnowledgeExtractionLatest = {
  extraction_id?: string | null;
  status?: string | null;
  model?: string | null;
  extraction_version?: string | null;
  created_technical_knowledge?: number | string | null;
  rejected_candidates?: number | string | null;
  batch_errors?: number | string | null;
  batch_error_items?: unknown[] | null;
  completed_batch_count?: number | string | null;
  batch_count?: number | string | null;
  remaining_batch_count?: number | string | null;
  progress_percent?: number | string | null;
  created_at?: number | string | null;
  resumed_at?: number | string | null;
  completed_at?: number | string | null;
  interrupted_at?: number | string | null;
  interrupt_reason?: string | null;
  resume_count?: number | string | null;
};

type TechnicalKnowledgeExtractionsResponse = {
  ok?: boolean;
  document_id?: string | null;
  count?: number | string | null;
  latest?: TechnicalKnowledgeExtractionLatest | null;
  items?: unknown[] | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
};

type IndexPage = {
  page?: number | null;
  text?: string | null;
  char_count?: number | null;
};

type VisualRef = {
  kind?: string | null;
  page?: number | null;
  url?: string | null;
  relative_path?: string | null;
};

type IndexSection = {
  section_id?: string | null;
  id?: string | null;
  title?: string | null;
  code?: string | null;
  level?: number | null;
  parent_section_id?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  text?: string | null;
  char_count?: number | null;
  visual_refs?: VisualRef[] | null;
};

type IndexAnchor = {
  anchor_id?: string | null;
  section_id?: string | null;
  id?: string | null;
  kind?: string | null;
  title?: string | null;
  code?: string | null;
  level?: number | null;
  parent_section_id?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  text?: string | null;
  char_count?: number | null;
  visual_refs?: VisualRef[] | null;
};

type PageImage = {
  page?: number | null;
  kind?: string | null;
  source?: string | null;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  url?: string | null;
  relative_path?: string | null;
};

type OutlineMeta = {
  used_ai?: boolean | null;
  model?: string | null;
  fallback?: string | null;
  error?: string | null;
  [key: string]: unknown;
};

type DocumentFormState = {
  product: string;
  title: string;
  document_type: string;
  version: string;
  status: string;
  tags: string[];
  notes: string;
};

type SelectedOutlineItem =
  | { type: "section"; item: IndexSection }
  | { type: "anchor"; item: IndexAnchor };

const EMPTY_FORM: DocumentFormState = {
  product: "",
  title: "",
  document_type: "",
  version: "",
  status: "",
  tags: [],
  notes: "",
};

const FALLBACK_PRODUCTS = [
  { code: "pac_hybride", label: "PAC hybride" },
  { code: "pac", label: "PAC" },
  { code: "optipellet", label: "OptiPellet" },
  { code: "optitherm_biofioul", label: "Optitherm biofioul" },
  { code: "opticondens", label: "OptiCondens" },
  { code: "optiduo", label: "OptiDuo" },
  { code: "mc_classique", label: "MC Classique" },
  { code: "mc_ci", label: "MC CI" },
  { code: "gfi", label: "GFI" },
  { code: "bruleur_f100", label: "Brûleur F100" },
  { code: "rc7", label: "Régulation RC7" },
  { code: "mr32", label: "MR32" },
];

const anchorKindLabel: Record<string, string> = {
  subsection: "Sous-section",
  operation: "Opération",
  schema: "Schéma",
  table: "Tableau",
  safety: "Sécurité",
  configuration: "Configuration",
  troubleshooting: "Dépannage",
  component: "Composant",
  reference: "Référence",
};

const bulkReviewLabels: Record<BulkReviewStatus, string> = {
  READY: "Prêt",
  CHECK: "À vérifier",
  DUPLICATE: "Doublon",
  IGNORED: "Ignoré auto",
  EXCLUDED: "Exclu",
};

const bulkReviewClasses: Record<BulkReviewStatus, string> = {
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CHECK: "border-amber-200 bg-amber-50 text-amber-700",
  DUPLICATE: "border-orange-200 bg-orange-50 text-orange-700",
  IGNORED: "border-slate-200 bg-slate-100 text-slate-500",
  EXCLUDED: "border-slate-300 bg-slate-100 text-slate-500",
};

const bulkPipelineSteps = [
  { key: "upload_status", label: "Upload" },
  { key: "metadata_status", label: "Métadonnées" },
  { key: "index_status", label: "Indexation" },
  { key: "technical_knowledge_status", label: "Connaissances TK" },
] as const;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeStr(v: unknown, fallback = "") {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function docId(doc?: ProductDocument | null) {
  return safeStr(doc?.document_id || doc?.id);
}

function itemId(item: IndexSection | IndexAnchor) {
  return safeStr(
    "anchor_id" in item
      ? item.anchor_id || item.section_id || item.id
      : item.section_id || item.id
  );
}

function optionCode(value: CatalogValue) {
  return typeof value === "string" ? value : safeStr(value.code || value.label);
}

function optionLabel(value: CatalogValue) {
  if (typeof value === "string") return humanLabel(value);
  return safeStr(value.label || value.code);
}

function normalizeOptions(values?: CatalogValue[]) {
  const seen = new Set<string>();
  const options: Array<{ code: string; label: string }> = [];

  for (const value of values || []) {
    const code = optionCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    options.push({ code, label: optionLabel(value) || code });
  }

  return options;
}

function humanLabel(value?: string | null) {
  const raw = safeStr(value);
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function productLabel(code?: string | null) {
  const raw = safeStr(code);
  return FALLBACK_PRODUCTS.find((p) => p.code === raw)?.label || humanLabel(raw);
}

function docProductCode(doc: ProductDocument) {
  return safeStr(doc.product_code || doc.product);
}

function docProductLabel(doc: ProductDocument) {
  return safeStr(doc.product_label) || productLabel(docProductCode(doc));
}

function unwrapDocumentResponse(data: unknown): ProductDocument | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.document && typeof record.document === "object") {
    return record.document as ProductDocument;
  }
  return record as ProductDocument;
}

function unwrapIndexResponse(data: unknown): ProductDocumentIndex | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.index && typeof record.index === "object") {
    return record.index as ProductDocumentIndex;
  }
  return record as ProductDocumentIndex;
}

function unwrapBulkBatch(data: unknown): BulkImportBatch | null {
  if (!data || typeof data !== "object") return null;
  const record = data as BulkImportResponse;
  return record.batch || (record as BulkImportBatch);
}

function bulkBatchId(batch?: BulkImportBatch | null) {
  return safeStr(batch?.batch_id || batch?.id);
}

function bulkReviewStatus(value?: string | null): BulkReviewStatus {
  const status = safeStr(value).toUpperCase();
  if (status === "CHECK" || status === "DUPLICATE" || status === "IGNORED" || status === "EXCLUDED") return status;
  return "READY";
}

function bulkPipelineStatus(value?: string | null): BulkPipelineStatus {
  const status = safeStr(value).toUpperCase();
  if (status === "RUNNING" || status === "DONE" || status === "FAILED") return status;
  return "PENDING";
}

function bulkItemFilename(item: BulkImportItem) {
  return safeStr(item.source_file?.filename, "Fichier");
}

function bulkItemPath(item: BulkImportItem) {
  return safeStr(item.source_file?.relative_path || item.source_file?.filename);
}

function bulkItemCanBeSelected(item: BulkImportItem) {
  return bulkReviewStatus(item.review_status) !== "IGNORED";
}

function bulkItemDefaultSelected(item: BulkImportItem) {
  const status = bulkReviewStatus(item.review_status);
  return status === "READY" || status === "CHECK";
}

function bulkReincludeStatus(item: BulkImportItem): BulkReviewStatus {
  const metadata = item.metadata || {};
  return metadata.product_code && metadata.document_type ? "READY" : "CHECK";
}

function uniqStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const s = value.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function formatDateTime(value?: number | string | null) {
  const n = safeNum(value);
  const date =
    n !== null
      ? new Date(n * 1000)
      : typeof value === "string" && value.trim()
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPages(start?: number | null, end?: number | null) {
  if (!start && !end) return "page inconnue";
  if (start && end && start !== end) return `p. ${start}-${end}`;
  return `p. ${start || end}`;
}

function shortText(text?: string | null, max = 420) {
  const raw = safeStr(text).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.length > max ? `${raw.slice(0, max).trim()}...` : raw;
}

function indexingStatus(doc?: ProductDocument | null) {
  return safeStr(doc?.indexing?.status, "NOT_INDEXED").toUpperCase();
}

function isIndexed(doc?: ProductDocument | null) {
  return indexingStatus(doc) === "INDEXED";
}

function indexSummary(index?: ProductDocumentIndex | null) {
  if (!index?.stats) return "";
  const pages = index.stats.page_count ?? null;
  const sections = index.stats.section_count ?? null;
  const anchors = index.stats.anchor_count ?? null;
  const parts = [];
  if (pages !== null && pages !== undefined) parts.push(`${pages} pages`);
  if (sections !== null && sections !== undefined) parts.push(`${sections} sections`);
  if (anchors !== null && anchors !== undefined) parts.push(`${anchors} repères`);
  return parts.join(" · ");
}

function documentToForm(doc: ProductDocument): DocumentFormState {
  return {
    product: docProductCode(doc),
    title: safeStr(doc.title),
    document_type: safeStr(doc.document_type),
    version: safeStr(doc.version),
    status: safeStr(doc.status),
    tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    notes: safeStr(doc.notes),
  };
}

function formPayload(form: DocumentFormState) {
  return {
    product_code: form.product.trim(),
    product_label: productLabel(form.product),
    title: form.title.trim(),
    document_type: form.document_type.trim(),
    version: form.version.trim() || null,
    status: form.status.trim() || null,
    tags: uniqStrings(form.tags),
    notes: form.notes.trim() || null,
  };
}

function indexingBadgeClass(status?: string | null) {
  const s = safeStr(status).toUpperCase();
  if (s === "INDEXED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "FAILED") return "bg-red-50 text-red-700 ring-red-200";
  if (s === "INDEXING" || s === "PROCESSING") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusBadgeClass(status?: string | null) {
  const s = safeStr(status).toLowerCase();
  if (["active", "actif", "published", "reference"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["obsolete", "obsolète", "obsoletee", "archived"].includes(s)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (["draft", "a_verifier", "à vérifier", "to_check"].includes(s)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        className
      )}
    >
      {children}
    </span>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

function BulkPipelineStepIcon({ status }: { status?: string | null }) {
  const normalized = bulkPipelineStatus(status);
  if (normalized === "DONE") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (normalized === "RUNNING") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
  if (normalized === "FAILED") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  return <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />;
}

function technicalKnowledgeCreatedCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const summary =
    record.technical_knowledge_summary && typeof record.technical_knowledge_summary === "object"
      ? (record.technical_knowledge_summary as Record<string, unknown>)
      : record.summary && typeof record.summary === "object"
        ? (record.summary as Record<string, unknown>)
        : null;

  return (
    safeNum(record.created_technical_knowledge) ??
    safeNum(summary?.created_technical_knowledge) ??
    safeNum(record.created_count) ??
    safeNum(record.count)
  );
}

function shortDebugId(value?: string | null) {
  const id = safeStr(value);
  if (!id) return "—";
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
}

function tkExtractionStatusMeta(status?: string | null, count?: number | null) {
  const normalized = safeStr(status).toUpperCase();
  if (!count) {
    return {
      label: "Aucune extraction",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (normalized === "RUNNING") {
    return {
      label: "Extraction TK en cours",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (normalized === "PAUSED" || normalized === "INTERRUPTED") {
    return {
      label: "Extraction TK incomplète",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (normalized === "DONE_WITH_ERRORS") {
    return {
      label: "Extraction TK terminée avec erreurs",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  if (normalized === "DONE") {
    return {
      label: "Extraction TK terminée",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    label: normalized || "Statut inconnu",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function canResumeTkExtraction(status?: string | null) {
  return ["PAUSED", "INTERRUPTED", "DONE_WITH_ERRORS"].includes(
    safeStr(status).toUpperCase()
  );
}

function formatPercent(value?: number | string | null) {
  const num = safeNum(value);
  if (num === null) return "—";
  return `${Math.round(num)} %`;
}

function batchErrorCount(value: TechnicalKnowledgeSummary["batch_errors"]) {
  if (Array.isArray(value)) return value.length;
  return safeNum(value);
}

function technicalKnowledgeSummaryParts(summary?: TechnicalKnowledgeSummary | null) {
  if (!summary) return [];

  const created = safeNum(summary.created_technical_knowledge);
  const rejected = safeNum(summary.rejected_candidates);
  const errors = batchErrorCount(summary.batch_errors);
  const parts: string[] = [];

  if (created !== null) parts.push(`${created} TK créée${created > 1 ? "s" : ""}`);
  if (rejected !== null) parts.push(`${rejected} candidat${rejected > 1 ? "s" : ""} rejeté${rejected > 1 ? "s" : ""}`);
  if (errors !== null) parts.push(`${errors} erreur${errors > 1 ? "s" : ""} batch`);

  return parts;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resetCorpusErrorMessage(status: number, payload: ResetCorpusResponse | null) {
  if (status === 401 || status === 403) return "Action non autorisée.";

  const detail = safeStr(payload?.detail) || safeStr(payload?.message) || safeStr(payload?.error);
  if (status === 400) {
    const lower = detail.toLowerCase();
    if (lower.includes("confirmation")) {
      return "Confirmation manquante. Saisissez exactement RESET_PRODUCT_DOCUMENT_CORPUS.";
    }
  }
  return detail || `Erreur reset corpus (${status}).`;
}

function resetCorpusSummaryValue(result: ResetCorpusResponse | null, keys: string[]) {
  const containers = [
    objectValue(result?.summary),
    objectValue(result?.counts),
    objectValue(result?.would_delete),
    objectValue(result?.deleted),
    objectValue(result),
  ].filter(Boolean) as Array<Record<string, unknown>>;

  for (const container of containers) {
    for (const key of keys) {
      const raw = container[key];
      const nested = objectValue(raw);
      const value = safeNum(raw) ?? safeNum(nested?.count) ?? safeNum(nested?.total);
      if (value !== null) return value;
    }
  }
  return null;
}

function resetCorpusSummaryEntries(result: ResetCorpusResponse | null) {
  return [
    {
      label: "Documents produits",
      value: resetCorpusSummaryValue(result, ["product_documents", "product_document_count", "documents", "document_count"]),
    },
    {
      label: "Indexations",
      value: resetCorpusSummaryValue(result, ["product_document_indexes", "product_document_index_count", "indexes", "index_count"]),
    },
    {
      label: "Assets / anchors",
      value: resetCorpusSummaryValue(result, ["product_document_assets", "product_document_asset_count", "product_document_anchors", "assets", "anchors", "asset_count", "anchor_count"]),
    },
    {
      label: "TechnicalKnowledge",
      value: resetCorpusSummaryValue(result, ["technical_knowledge", "technical_knowledge_count", "technical_knowledges", "tk_count"]),
    },
    {
      label: "Extractions TK",
      value: resetCorpusSummaryValue(result, ["technical_knowledge_extractions", "technical_knowledge_extraction_count", "tk_extractions", "extraction_count"]),
    },
    {
      label: "Bulk imports",
      value: resetCorpusSummaryValue(result, ["product_document_bulk_imports", "product_document_bulk_import_count", "bulk_imports", "bulk_import_count"]),
    },
    {
      label: "Guides chantier",
      value: resetCorpusSummaryValue(result, ["guides", "guide_count", "guides_count", "guide_chantier_count"]),
    },
  ];
}

function bulkOverallLabel(item: BulkImportItem) {
  const status = safeStr(item.status).toUpperCase();
  const pipeline = item.pipeline || {};
  if (
    status === "FAILED" ||
    bulkPipelineStatus(pipeline.upload_status) === "FAILED" ||
    bulkPipelineStatus(pipeline.metadata_status) === "FAILED" ||
    bulkPipelineStatus(pipeline.index_status) === "FAILED" ||
    bulkPipelineStatus(pipeline.technical_knowledge_status) === "FAILED"
  ) {
    return { label: "Échec", cls: "border-red-200 bg-red-50 text-red-700" };
  }
  if (status === "IGNORED" || status === "SKIPPED") {
    return { label: "Ignoré", cls: "border-slate-200 bg-slate-100 text-slate-500" };
  }
  if (
    (status === "INDEXED" || bulkPipelineStatus(pipeline.index_status) === "DONE") &&
    bulkPipelineStatus(pipeline.technical_knowledge_status) === "DONE"
  ) {
    return { label: "Indexé + TK", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (
    status === "RUNNING" ||
    bulkPipelineStatus(pipeline.upload_status) === "RUNNING" ||
    bulkPipelineStatus(pipeline.metadata_status) === "RUNNING" ||
    bulkPipelineStatus(pipeline.index_status) === "RUNNING" ||
    bulkPipelineStatus(pipeline.technical_knowledge_status) === "RUNNING" ||
    bulkPipelineStatus(pipeline.upload_status) === "DONE" ||
    bulkPipelineStatus(pipeline.metadata_status) === "DONE"
  ) {
    return { label: "En cours", cls: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (status === "INDEXED" || bulkPipelineStatus(pipeline.index_status) === "DONE") {
    return { label: "Indexé", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  return { label: "En attente", cls: "border-slate-200 bg-white text-slate-500" };
}

function getItemVisualRefs(item?: SelectedOutlineItem | null) {
  if (!item) return [];
  const refs = item.item.visual_refs;
  return Array.isArray(refs) ? refs : [];
}

function normalizeAssetUrl(value?: string | null) {
  const raw = safeStr(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return buildUrl(raw);
  return buildUrl(`/${raw}`);
}

function findPageImage(index: ProductDocumentIndex | null, page: number) {
  const images = Array.isArray(index?.page_images) ? index.page_images : [];
  return images.find((img) => safeNum(img.page) === page) || null;
}

function pageImageUrl(image?: PageImage | null) {
  return normalizeAssetUrl(image?.url);
}

function preferredVisualRefs(item?: SelectedOutlineItem | null) {
  const refs = getItemVisualRefs(item);
  const preferredKind =
    item?.type === "section" ? "section_crop" : item?.type === "anchor" ? "anchor_crop" : "";
  const preferred = refs.filter((ref) => safeStr(ref.kind) === preferredKind);
  if (preferred.length) return preferred;
  return refs.filter((ref) => safeStr(ref.kind) === "page_snapshot");
}

function visualRefUrl(ref: VisualRef, index: ProductDocumentIndex | null) {
  const direct = normalizeAssetUrl(ref.url);
  if (direct) return direct;

  if (safeStr(ref.kind) === "page_snapshot") {
    const page = safeNum(ref.page);
    if (!page) return "";
    return pageImageUrl(findPageImage(index, page));
  }

  return "";
}

function pdfPageUrl(doc?: ProductDocument | null, page?: number | null) {
  const url = safeStr(doc?.source?.url);
  if (!url) return "";
  if (!page) return url;
  return `${url}#page=${page}`;
}

function groupAnchorsBySection(anchors: IndexAnchor[]) {
  const map = new Map<string, IndexAnchor[]>();
  for (const anchor of anchors) {
    const parent = safeStr(anchor.parent_section_id || anchor.section_id, "__orphan__");
    map.set(parent, [...(map.get(parent) || []), anchor]);
  }
  return map;
}

function DiagnosticPanel({
  doc,
  index,
  tkExtractions,
  tkLoading,
  tkActionBusy,
  tkActionMessage,
  tkError,
  onExtractTk,
  onResumeTk,
}: {
  doc: ProductDocument | null;
  index: ProductDocumentIndex | null;
  tkExtractions: TechnicalKnowledgeExtractionsResponse | null;
  tkLoading: boolean;
  tkActionBusy: boolean;
  tkActionMessage: string | null;
  tkError: string | null;
  onExtractTk: () => void;
  onResumeTk: (extractionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = index?.outline_meta || {};
  const candidateCount = Array.isArray(index?.outline_candidates)
    ? index.outline_candidates.length
    : 0;
  const latestTkExtraction = tkExtractions?.latest || null;
  const extractionCount = safeNum(tkExtractions?.count) ?? (latestTkExtraction ? 1 : 0);
  const tkStatusMeta = tkExtractionStatusMeta(latestTkExtraction?.status, extractionCount);
  const completedBatchCount = safeNum(latestTkExtraction?.completed_batch_count);
  const batchCount = safeNum(latestTkExtraction?.batch_count);
  const createdTkCount = safeNum(latestTkExtraction?.created_technical_knowledge);
  const rejectedCandidateCount = safeNum(latestTkExtraction?.rejected_candidates);
  const tkBatchErrorCount =
    safeNum(latestTkExtraction?.batch_errors) ??
    (Array.isArray(latestTkExtraction?.batch_error_items)
      ? latestTkExtraction.batch_error_items.length
      : null);
  const tkExtractionId = safeStr(latestTkExtraction?.extraction_id);
  const canResume = tkExtractionId && canResumeTkExtraction(latestTkExtraction?.status);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Cpu className="h-4 w-4 text-slate-400" />
          Diagnostic indexation & extraction
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open ? (
        <div className="space-y-2 px-5 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">IA utilisée</span>
            <span className="font-medium text-slate-900">
              {meta.used_ai ? "Oui" : "Non"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Modèle</span>
            <span className="font-mono text-xs text-slate-900">
              {safeStr(meta.model, "—")}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Version index</span>
            <span className="font-mono text-xs text-slate-900">
              {safeStr(index?.index_version || doc?.indexing?.index_version, "—")}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Candidats bruts</span>
            <span className="font-medium text-slate-900">{candidateCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Fallback</span>
            <span className="font-mono text-xs text-slate-900">
              {safeStr(meta.fallback, "—")}
            </span>
          </div>
          {safeStr(meta.error || doc?.indexing?.last_error) ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {safeStr(meta.error || doc?.indexing?.last_error)}
            </div>
          ) : null}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Connaissances techniques
              </span>
              <span
                className={cx(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  tkStatusMeta.className
                )}
              >
                {tkStatusMeta.label}
              </span>
            </div>

            {tkLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des extractions TK
              </div>
            ) : !extractionCount ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Aucune extraction TK lancée pour ce document.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Statut</span>
                  <span className="font-medium text-slate-900">
                    {safeStr(latestTkExtraction?.status, "—")}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Lots traités</span>
                  <span className="font-medium text-slate-900">
                    {completedBatchCount !== null || batchCount !== null
                      ? `${completedBatchCount ?? 0} / ${batchCount ?? "—"}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Progression</span>
                  <span className="font-medium text-slate-900">
                    {formatPercent(latestTkExtraction?.progress_percent)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">TK créées</span>
                  <span className="font-medium text-slate-900">
                    {createdTkCount ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Candidats rejetés</span>
                  <span className="font-medium text-slate-900">
                    {rejectedCandidateCount ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Erreurs batch</span>
                  <span className="font-medium text-slate-900">
                    {tkBatchErrorCount ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Modèle TK</span>
                  <span className="font-mono text-xs text-slate-900">
                    {safeStr(latestTkExtraction?.model, "—")}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Version extraction</span>
                  <span className="font-mono text-xs text-slate-900">
                    {safeStr(latestTkExtraction?.extraction_version, "—")}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Extraction</span>
                  <span className="font-mono text-xs text-slate-900">
                    {shortDebugId(latestTkExtraction?.extraction_id)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Dernière date</span>
                  <span className="font-medium text-slate-900">
                    {formatDateTime(
                      latestTkExtraction?.completed_at || latestTkExtraction?.created_at
                    ) || "—"}
                  </span>
                </div>

                {tkBatchErrorCount ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                    Voir détail backend si nécessaire. {tkBatchErrorCount} erreur
                    {tkBatchErrorCount > 1 ? "s" : ""} batch détectée
                    {tkBatchErrorCount > 1 ? "s" : ""}.
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!extractionCount ? (
                <button
                  type="button"
                  onClick={onExtractTk}
                  disabled={tkActionBusy || tkLoading || !docId(doc)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tkActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Extraire les connaissances techniques
                </button>
              ) : null}
              {canResume ? (
                <button
                  type="button"
                  onClick={() => onResumeTk(tkExtractionId)}
                  disabled={tkActionBusy || tkLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tkActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Reprendre l’extraction
                </button>
              ) : null}
            </div>

            {tkActionMessage ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {tkActionMessage}
              </div>
            ) : null}
            {tkError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {tkError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdvancedAdminPanel({ onRefresh }: { onRefresh: () => void }) {
  const [deleteGuides, setDeleteGuides] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"dry-run" | "reset" | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ResetCorpusResponse | null>(null);
  const [resetResult, setResetResult] = useState<ResetCorpusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReset = confirmation === "RESET_PRODUCT_DOCUMENT_CORPUS" && !!dryRunResult && busy === null;
  const displayedResult = resetResult || dryRunResult;
  const summaryEntries = resetCorpusSummaryEntries(displayedResult);

  const callResetEndpoint = async (dryRun: boolean) => {
    const res = await fetch(buildUrl("/admin/product-documents/reset-corpus"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        dryRun
          ? { dry_run: true, delete_guides: deleteGuides }
          : {
              dry_run: false,
              confirmation: "RESET_PRODUCT_DOCUMENT_CORPUS",
              delete_guides: deleteGuides,
            }
      ),
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => null)) as ResetCorpusResponse | null;
    if (!res.ok) throw new Error(resetCorpusErrorMessage(res.status, payload));
    return payload || ({ ok: true, dry_run: dryRun } as ResetCorpusResponse);
  };

  const runDryRun = async () => {
    setBusy("dry-run");
    setError(null);
    setResetResult(null);
    setConfirmation("");
    try {
      setDryRunResult(await callResetEndpoint(true));
    } catch (err) {
      setDryRunResult(null);
      setError(err instanceof Error ? err.message : "Impossible d'analyser le reset.");
    } finally {
      setBusy(null);
    }
  };

  const runReset = async () => {
    if (!canReset) return;
    setBusy("reset");
    setError(null);
    try {
      const result = await callResetEndpoint(false);
      setResetResult(result);
      setDryRunResult(result);
      setConfirmation("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le corpus documentaire.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="border-t border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
        Administration avancée
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Reset corpus documentaire</p>
              <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
                <p>Action destructive.</p>
                <p>Les documents, indexations, anchors/assets et TechnicalKnowledge seront supprimés.</p>
                <p>Les questions Atelier Q/R et les chantiers ne sont pas supprimés.</p>
                <p>Les anciennes réponses Atelier peuvent conserver un historique de sources qui ne correspond plus au nouveau corpus.</p>
              </div>
            </div>
          </div>

          <label className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={deleteGuides}
              onChange={(event) => {
                setDeleteGuides(event.target.checked);
                setDryRunResult(null);
                setResetResult(null);
                setConfirmation("");
              }}
              className="mt-0.5 rounded accent-orange-600"
            />
            <span>Supprimer aussi les guides chantier existants</span>
          </label>

          <button
            type="button"
            onClick={() => void runDryRun()}
            disabled={busy !== null}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "dry-run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Analyser le reset
          </button>

          {displayedResult ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {resetResult ? (
                <p className="mb-2 text-sm font-semibold text-emerald-700">Corpus documentaire supprimé.</p>
              ) : (
                <p className="mb-2 text-sm font-semibold text-slate-700">Éléments concernés par le reset</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {summaryEntries.map((entry) => (
                  <div key={entry.label} className="rounded-lg bg-white px-3 py-2">
                    <p className="text-[11px] text-slate-400">{entry.label}</p>
                    <p className="mt-0.5 text-base font-semibold text-slate-900">
                      {entry.value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {dryRunResult && !resetResult ? (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Confirmation
                </span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  placeholder="RESET_PRODUCT_DOCUMENT_CORPUS"
                />
              </label>
              <button
                type="button"
                onClick={() => void runReset()}
                disabled={!canReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer le corpus documentaire
              </button>
            </div>
          ) : null}

          {resetResult ? (
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Rafraîchir la liste
            </button>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function PlanTree({
  index,
  selected,
  onSelect,
}: {
  index: ProductDocumentIndex | null;
  selected: SelectedOutlineItem | null;
  onSelect: (item: SelectedOutlineItem) => void;
}) {
  const sections = useMemo(
    () => (Array.isArray(index?.sections) ? index.sections : []),
    [index]
  );
  const anchors = useMemo(
    () => (Array.isArray(index?.anchors) ? index.anchors : []),
    [index]
  );
  const anchorsBySection = useMemo(() => groupAnchorsBySection(anchors), [anchors]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  if (!sections.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          Aucun plan détecté pour ce document.
        </p>
      </div>
    );
  }

  const selectedId = selected ? itemId(selected.item) : "";

  return (
    <div className="space-y-1">
      {sections.map((section) => {
        const sectionId = itemId(section);
        const sectionAnchors = anchorsBySection.get(sectionId) || [];
        const isOpen = openSections[sectionId] ?? true;
        const isSelected = selected?.type === "section" && selectedId === sectionId;

        return (
          <div key={sectionId || safeStr(section.title)} className="space-y-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setOpenSections((prev) => ({
                    ...prev,
                    [sectionId]: !isOpen,
                  }))
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title={isOpen ? "Replier" : "Déplier"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelect({ type: "section", item: section })}
                className={cx(
                  "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                  isSelected
                    ? "bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                    : "hover:bg-slate-50"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Layers className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-sm font-semibold">
                    {safeStr(section.title, "Section sans titre")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatPages(section.page_start, section.page_end)}
                </span>
              </button>
            </div>

            {isOpen ? (
              <div className="ml-10 space-y-1 border-l border-slate-200 pl-3">
                {sectionAnchors.length ? (
                  sectionAnchors.map((anchor) => {
                    const anchorId = itemId(anchor);
                    const anchorSelected =
                      selected?.type === "anchor" && selectedId === anchorId;
                    return (
                      <button
                        key={anchorId || safeStr(anchor.title)}
                        type="button"
                        onClick={() => onSelect({ type: "anchor", item: anchor })}
                        className={cx(
                          "flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                          anchorSelected
                            ? "bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Hash className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          <span className="truncate text-sm text-slate-700">
                            {safeStr(anchor.title, "Repère sans titre")}
                          </span>
                          {safeStr(anchor.kind) ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                              {anchorKindLabel[safeStr(anchor.kind)] || humanLabel(anchor.kind)}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatPages(anchor.page_start, anchor.page_end)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    Aucun repère rattaché.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BulkImportMode({
  files,
  rootName,
  productOptions,
  documentTypeOptions,
  onClose,
  onDone,
}: {
  files: File[];
  rootName: string;
  productOptions: Array<{ code: string; label: string }>;
  documentTypeOptions: Array<{ code: string; label: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"scan" | "summary" | "review" | "pipeline" | "done">("scan");
  const [batch, setBatch] = useState<BulkImportBatch | null>(null);
  const [scanLines, setScanLines] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<BulkReviewStatus | "ALL">("ALL");
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [launchedItemIds, setLaunchedItemIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkProduct, setBulkProduct] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const manifest = useMemo<BulkManifestFile[]>(
    () =>
      files.map((file, index) => {
        const relativePath = safeStr((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
        return {
          client_file_id: `file_${index}_${relativePath}_${file.size}_${file.lastModified}`,
          filename: file.name,
          relative_path: relativePath,
          size: file.size,
          last_modified: file.lastModified,
          mime_type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        };
      }),
    [files],
  );

  const fileByClientId = useMemo(() => {
    const map = new Map<string, File>();
    manifest.forEach((file, index) => {
      map.set(file.client_file_id, files[index]);
    });
    return map;
  }, [files, manifest]);

  const batchId = bulkBatchId(batch);
  const items = batch?.items || [];
  const counts = batch?.counts || {};
  const reviewImportItems = items.filter((item) => importSelected.has(item.item_id));
  const pipelineItems = launchedItemIds.size
    ? items.filter((item) => launchedItemIds.has(item.item_id))
    : items.filter((item) => {
      const status = bulkReviewStatus(item.review_status);
      return status === "READY" || status === "CHECK";
    });
  const filteredItems = items.filter((item) =>
    activeFilter === "ALL"
      ? bulkReviewStatus(item.review_status) !== "IGNORED"
      : bulkReviewStatus(item.review_status) === activeFilter,
  );
  const visibleSelectableItems = filteredItems.filter((item) => {
    const status = bulkReviewStatus(item.review_status);
    return status !== "IGNORED" && status !== "EXCLUDED";
  });
  const allVisibleSelected = visibleSelectableItems.length > 0 && visibleSelectableItems.every((item) => importSelected.has(item.item_id));
  const someVisibleSelected = visibleSelectableItems.some((item) => importSelected.has(item.item_id));
  const doneCountFallback = pipelineItems.filter((item) => {
    const status = safeStr(item.status).toUpperCase();
    return status === "INDEXED" || status === "FAILED";
  }).length;
  const acceptedCount = safeNum(batch?.progress?.accepted_count) ?? (launchedItemIds.size || pipelineItems.length);
  const doneCount = safeNum(batch?.progress?.completed_count) ?? doneCountFallback;
  const progress = safeNum(batch?.progress?.percent) ?? (acceptedCount ? Math.round((doneCount / acceptedCount) * 100) : 0);

  const refreshBatch = useCallback(async (showError = true) => {
    if (!batchId) return null;
    try {
      const res = await fetch(buildUrl(`/product-documents/bulk-imports/${encodeURIComponent(batchId)}`), { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail || payload?.message || `Batch indisponible (${res.status})`);
      const nextBatch = unwrapBulkBatch(payload);
      if (!nextBatch) throw new Error("Réponse bulk invalide : batch absent.");
      setBatch(nextBatch);
      return nextBatch;
    } catch (err) {
      if (showError) setError(err instanceof Error ? err.message : "Impossible de rafraîchir le batch.");
      return null;
    }
  }, [batchId]);

  useEffect(() => {
    const folders = new Map<string, { pdf: number; ignored: number }>();
    manifest.forEach((file) => {
      const parts = file.relative_path.split("/");
      const folder = parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "/";
      const entry = folders.get(folder) || { pdf: 0, ignored: 0 };
      if (file.filename.toLowerCase().endsWith(".pdf")) entry.pdf += 1;
      else entry.ignored += 1;
      if (folder.includes("Archives/") || folder.includes("_temp/")) entry.ignored += 1;
      folders.set(folder, entry);
    });

    const lines = Array.from(folders.entries()).map(
      ([folder, value]) =>
        `${folder} → ${value.pdf} PDF${value.pdf > 1 ? "s" : ""}${value.ignored ? ` · ${value.ignored} ignoré${value.ignored > 1 ? "s" : ""}` : ""}`,
    );
    lines.forEach((line, index) => {
      window.setTimeout(() => setScanLines((current) => (current.includes(line) ? current : [...current, line])), 160 + index * 180);
    });

    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(buildUrl("/product-documents/bulk-imports"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root_name: rootName, files: manifest }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.detail || payload?.message || `Création batch impossible (${res.status})`);
        const createdBatch = unwrapBulkBatch(payload);
        if (!createdBatch) throw new Error("Réponse bulk invalide : batch absent.");
        setBatch(createdBatch);
        setImportSelected(new Set((createdBatch.items || []).filter(bulkItemDefaultSelected).map((item) => item.item_id)));
        setStep("summary");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue pendant la création du batch.");
      } finally {
        setBusy(false);
      }
    }, Math.max(900, lines.length * 180 + 500));

    return () => window.clearTimeout(timer);
  }, [manifest, rootName]);

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    if (step !== "pipeline" || !batchId) return;
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      void refreshBatch(false);
    }, 1600);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [step, batchId, refreshBatch]);

  useEffect(() => {
    if (step !== "pipeline" || !batch) return;
    if (safeStr(batch.step).toUpperCase() === "DONE" || (acceptedCount > 0 && doneCount >= acceptedCount)) {
      setStep("done");
    }
  }, [acceptedCount, batch, doneCount, step]);

  const patchItems = async (patches: Array<Record<string, unknown> & { item_id: string }>) => {
    if (!batchId || !patches.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(`/product-documents/bulk-imports/${encodeURIComponent(batchId)}/items`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: patches }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail || payload?.message || `Mise à jour impossible (${res.status})`);
      const nextBatch = unwrapBulkBatch(payload);
      if (nextBatch) setBatch(nextBatch);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant la mise à jour.");
    } finally {
      setBusy(false);
    }
  };

  const uploadItemFile = async (item: BulkImportItem, targetBatchId = batchId) => {
    const file = fileByClientId.get(safeStr(item.source_file?.client_file_id));
    if (!targetBatchId || !file) return;
    setUploadingIds((current) => new Set(current).add(item.item_id));
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch(
        buildUrl(`/product-documents/bulk-imports/${encodeURIComponent(targetBatchId)}/items/${encodeURIComponent(item.item_id)}/file`),
        { method: "POST", body: form },
      );
      const payload = (await res.json().catch(() => null)) as BulkImportResponse | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.detail || payload?.message || payload?.error || `Upload impossible (${res.status})`);
      }
      if (payload?.batch) setBatch(payload.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Upload échoué pour ${bulkItemFilename(item)}.`);
    } finally {
      setUploadingIds((current) => {
        const next = new Set(current);
        next.delete(item.item_id);
        return next;
      });
    }
  };

  const launchPipeline = async () => {
    const selectedItemIds = Array.from(importSelected);
    if (!batchId || selectedItemIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(`/product-documents/bulk-imports/${encodeURIComponent(batchId)}/launch`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_item_ids: selectedItemIds }),
      });
      const payload = (await res.json().catch(() => null)) as BulkImportResponse | null;
      if (!res.ok) throw new Error(payload?.detail || payload?.message || `Lancement impossible (${res.status})`);
      const launchedBatch = unwrapBulkBatch(payload);
      if (!launchedBatch) throw new Error("Réponse bulk invalide : batch absent.");
      setBatch(launchedBatch);
      setStep("pipeline");
      const launchId = bulkBatchId(launchedBatch) || batchId;
      const acceptedIds = new Set(payload?.accepted_item_ids || []);
      setLaunchedItemIds(acceptedIds);
      const toUpload = (launchedBatch.items || []).filter((item) => {
        return acceptedIds.has(item.item_id) && fileByClientId.has(safeStr(item.source_file?.client_file_id));
      });
      await Promise.all(toUpload.map((item) => uploadItemFile(item, launchId)));
      void refreshBatch(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant le lancement.");
    } finally {
      setBusy(false);
    }
  };

  const retryItem = async (item: BulkImportItem) => {
    if (!batchId) return;
    setError(null);
    try {
      const res = await fetch(
        buildUrl(`/product-documents/bulk-imports/${encodeURIComponent(batchId)}/items/${encodeURIComponent(item.item_id)}/retry`),
        { method: "POST" },
      );
      const payload = (await res.json().catch(() => null)) as BulkImportResponse | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.detail || payload?.message || payload?.error || `Relance impossible (${res.status})`);
      }
      if (payload?.batch) setBatch(payload.batch);
      if (payload?.requires_file_upload) await uploadItemFile(item);
      void refreshBatch(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant la relance.");
    }
  };

  const toggleImportSelected = (itemId: string) => {
    const item = items.find((candidate) => candidate.item_id === itemId);
    if (!item || !bulkItemCanBeSelected(item)) return;
    setImportSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectVisibleForImport = () => {
    setImportSelected((current) => new Set([...current, ...visibleSelectableItems.map((item) => item.item_id)]));
  };

  const deselectVisibleForImport = () => {
    setImportSelected((current) => {
      const next = new Set(current);
      visibleSelectableItems.forEach((item) => next.delete(item.item_id));
      return next;
    });
  };

  const excludeSelectedFromImport = async () => {
    const targetItems = items.filter((item) => importSelected.has(item.item_id) && bulkReviewStatus(item.review_status) !== "IGNORED");
    setImportSelected((current) => {
      const next = new Set(current);
      targetItems.forEach((item) => next.delete(item.item_id));
      return next;
    });
    await patchItems(targetItems.map((item) => ({ item_id: item.item_id, review_status: "EXCLUDED" })));
  };

  const reincludeItem = async (item: BulkImportItem) => {
    const nextStatus = bulkReincludeStatus(item);
    setImportSelected((current) => new Set(current).add(item.item_id));
    await patchItems([{ item_id: item.item_id, review_status: nextStatus }]);
  };

  if (step === "scan") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-slate-50 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
          <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-900">Analyse du dossier en cours...</p>
          <p className="mt-1 text-sm text-slate-500">Scan récursif · Manifest documentaire · Préparation review</p>
        </div>
        <div className="flex max-h-52 min-w-[360px] flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-500">
          {scanLines.length ? scanLines.map((line) => (
            <p key={line} className="flex items-center gap-2">
              <Check className="h-3 w-3 shrink-0 text-emerald-500" />
              {line}
            </p>
          )) : <p className="text-slate-400">Lecture du dossier...</p>}
        </div>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {busy ? <p className="text-xs text-slate-400">Création de la session de vérification...</p> : null}
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-slate-50 p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-900">{counts.total ?? items.length} fichiers détectés</p>
          <p className="mt-1 text-sm text-slate-500">Dossier : <span className="font-mono text-slate-700">{batch?.root_name || rootName}</span></p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-sm">
          {[
            [counts.ready ?? 0, "Prêts", "border-emerald-200 bg-emerald-50 text-emerald-700"],
            [counts.check ?? 0, "À vérifier", "border-amber-200 bg-amber-50 text-amber-700"],
            [counts.duplicate ?? 0, "Doublons", "border-orange-200 bg-orange-50 text-orange-700"],
            [counts.ignored ?? 0, "Ignorés", "border-slate-200 bg-slate-100 text-slate-500"],
          ].map(([value, label, cls]) => (
            <div key={String(label)} className={cx("rounded-xl border px-5 py-3 font-semibold", String(cls))}>
              <p className="text-xl font-bold">{String(value)}</p>
              <p className="mt-0.5 text-xs">{String(label)}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Annuler</button>
          <button type="button" onClick={() => setStep("review")} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">
            Vérifier les fichiers →
          </button>
        </div>
      </div>
    );
  }

  if (step === "pipeline" || step === "done") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">{step === "done" ? "Import terminé" : "Import en cours..."}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {counts.indexed ?? 0} indexé{(counts.indexed ?? 0) > 1 ? "s" : ""} · {counts.running ?? 0} en cours · {counts.failed ?? 0} échec{(counts.failed ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
            {step === "done" ? (
              <button type="button" onClick={onDone} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                <Check className="h-4 w-4" />
                Terminer
              </button>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-slate-400">
            <span>{progress}%</span>
            <span>{doneCount} / {acceptedCount} traités</span>
          </div>
          {error ? <div className="mt-3"><ErrorBox>{error}</ErrorBox></div> : null}
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-white">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fichier</th>
                {bulkPipelineSteps.map((s) => <th key={s.key} className="w-36 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</th>)}
                <th className="w-32 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Résultat</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipelineItems.map((item) => {
                const label = bulkOverallLabel(item);
                const failed = label.label === "Échec";
                const tkSummaryParts = technicalKnowledgeSummaryParts(item.technical_knowledge_summary);
                return (
                  <tr key={item.item_id} className={cx("bg-white", failed && "bg-red-50/40")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div>
                          <p className="text-xs font-medium text-slate-900">{bulkItemFilename(item)}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{bulkItemPath(item)}</p>
                          {tkSummaryParts.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {tkSummaryParts.map((part) => (
                                <span key={part} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                  {part}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {bulkPipelineSteps.map((s) => {
                      const status = bulkPipelineStatus(item.pipeline?.[s.key]);
                      return (
                        <td key={s.key} className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <BulkPipelineStepIcon status={status} />
                            <span className={cx("text-xs", status === "DONE" && "text-emerald-600", status === "FAILED" && "text-red-600", status === "RUNNING" && "text-blue-600", status === "PENDING" && "text-slate-400")}>
                              {status === "DONE" ? "OK" : status === "RUNNING" ? "..." : status === "FAILED" ? "Échec" : "-"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", label.cls)}>{label.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {failed ? (
                        <button type="button" onClick={() => void retryItem(item)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                          <RotateCcw className="h-3 w-3" />
                          Relancer
                        </button>
                      ) : uploadingIds.has(item.item_id) ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: BulkReviewStatus | "ALL"; label: string; count: number; color: string }> = [
    { id: "ALL", label: "Tous", count: items.filter((i) => bulkReviewStatus(i.review_status) !== "IGNORED").length, color: "text-slate-600" },
    { id: "READY", label: "Prêts", count: counts.ready ?? 0, color: "text-emerald-700" },
    { id: "CHECK", label: "À vérifier", count: counts.check ?? 0, color: "text-amber-700" },
    { id: "DUPLICATE", label: "Doublons", count: counts.duplicate ?? 0, color: "text-orange-700" },
    { id: "EXCLUDED", label: "Exclus", count: counts.excluded ?? items.filter((i) => bulkReviewStatus(i.review_status) === "EXCLUDED").length, color: "text-slate-500" },
    { id: "IGNORED", label: "Ignorés auto", count: counts.ignored ?? 0, color: "text-slate-400" },
  ];
  const selectedItems = items.filter((item) => importSelected.has(item.item_id));
  const hasImportSelection = importSelected.size > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><ChevronRight className="h-4 w-4 rotate-180" /></button>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">Vérification avant import</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{counts.total ?? items.length} fichiers détectés</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Dossier : <span className="font-mono text-slate-700">{batch?.root_name || rootName}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cx("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold", hasImportSelection ? "border-orange-200 bg-orange-50 text-orange-800" : "border-slate-200 bg-slate-100 text-slate-400")}>
            <Check className={cx("h-3.5 w-3.5", hasImportSelection ? "text-orange-600" : "text-slate-300")} />
            {reviewImportItems.length} fichier{reviewImportItems.length > 1 ? "s" : ""} sélectionné{reviewImportItems.length > 1 ? "s" : ""} pour import
          </div>
          <button type="button" onClick={() => void launchPipeline()} disabled={busy || !hasImportSelection} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:bg-slate-300">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Lancer l&apos;import ({reviewImportItems.length})
          </button>
        </div>
      </div>

      {importSelected.size > 0 ? (
        <div className="flex items-center gap-4 bg-slate-900 px-6 py-3 text-white">
          <span className="text-sm font-semibold">{importSelected.size} fichier{importSelected.size > 1 ? "s" : ""} sélectionné{importSelected.size > 1 ? "s" : ""}</span>
          <select value={bulkProduct} onChange={(e) => setBulkProduct(e.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white">
            <option value="">Produit...</option>
            {productOptions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
          <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white">
            <option value="">Type...</option>
            {documentTypeOptions.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <button type="button" onClick={() => {
            void patchItems(selectedItems.map((item) => ({ item_id: item.item_id, ...(bulkProduct ? { product_code: bulkProduct } : {}), ...(bulkType ? { document_type: bulkType } : {}) })));
            setBulkProduct("");
            setBulkType("");
          }} disabled={!bulkProduct && !bulkType} className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold hover:bg-orange-400 disabled:opacity-50">Appliquer</button>
          <span className="h-5 w-px bg-white/20" />
          <button type="button" onClick={() => void excludeSelectedFromImport()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-3.5 w-3.5" />
            Exclure de l&apos;import
          </button>
          <button type="button" onClick={() => setImportSelected(new Set())} className="ml-auto text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-slate-200 bg-white px-6">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveFilter(tab.id)} className={cx("flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium", activeFilter === tab.id ? "border-orange-500 text-orange-700" : `border-transparent ${tab.color} hover:text-slate-700`)}>
            {tab.label}
            <span className={cx("rounded-full px-1.5 py-0.5 text-xs font-bold", activeFilter === tab.id ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500")}>{tab.count}</span>
          </button>
        ))}
      </div>

      {error ? <div className="px-6 py-3"><ErrorBox>{error}</ErrorBox></div> : null}

      <div className="flex-1 overflow-auto bg-slate-50">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white">
            <tr>
              <th className="w-10 px-4 py-3">
                <input ref={headerCheckboxRef} type="checkbox" onChange={(e) => e.target.checked ? selectVisibleForImport() : deselectVisibleForImport()} checked={allVisibleSelected} disabled={visibleSelectableItems.length === 0} className="rounded accent-orange-600 disabled:opacity-30" title="Sélectionner / désélectionner les fichiers visibles" />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fichier</th>
              <th className="w-44 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Produit</th>
              <th className="w-40 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="w-28 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Version</th>
              <th className="w-32 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const selected = importSelected.has(item.item_id);
              const editing = editingId === item.item_id;
              const review = bulkReviewStatus(item.review_status);
              const metadata = item.metadata || {};
              const ignored = review === "IGNORED";
              const excluded = review === "EXCLUDED";
              const dimmed = ignored || excluded;
              return (
                <tr key={item.item_id} className={cx("bg-white hover:bg-slate-50/80", selected && "bg-orange-50/50", dimmed && "bg-slate-50/70")}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected} disabled={ignored} onChange={() => excluded ? void reincludeItem(item) : toggleImportSelected(item.item_id)} className="rounded accent-orange-600 disabled:opacity-30" title={ignored ? "Fichier ignoré automatiquement" : excluded ? "Réinclure" : undefined} /></td>
                  <td className="px-3 py-3">
                    <div className={cx("flex items-start gap-2", dimmed && "opacity-50")}>
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className={cx("text-xs font-medium leading-snug", excluded ? "text-slate-400 line-through" : "text-slate-900")}>{bulkItemFilename(item)}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{bulkItemPath(item)}</p>
                        {metadata.tags?.length ? <div className="mt-1 flex flex-wrap gap-1">{metadata.tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{tag}</span>)}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className={cx("px-3 py-3", dimmed && "opacity-40")}>{editing && !dimmed ? <select value={safeStr(metadata.product_code)} onChange={(e) => void patchItems([{ item_id: item.item_id, product_code: e.target.value }])} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs"><option value="">—</option>{productOptions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}</select> : <span className={cx("text-xs font-semibold", metadata.product_code ? "text-orange-700" : "text-slate-300 italic")}>{metadata.product_label || (metadata.product_code ? productLabel(metadata.product_code) : "—")}</span>}</td>
                  <td className={cx("px-3 py-3", dimmed && "opacity-40")}>{editing && !dimmed ? <select value={safeStr(metadata.document_type)} onChange={(e) => void patchItems([{ item_id: item.item_id, document_type: e.target.value }])} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs"><option value="">—</option>{documentTypeOptions.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select> : <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{humanLabel(metadata.document_type)}</span>}</td>
                  <td className={cx("px-3 py-3", dimmed && "opacity-40")}>{editing && !dimmed ? <input defaultValue={safeStr(metadata.version)} onBlur={(e) => void patchItems([{ item_id: item.item_id, version: e.target.value }])} className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-xs" /> : <span className="font-mono text-xs text-slate-500">{metadata.version || "—"}</span>}</td>
                  <td className="px-3 py-3">{editing && !dimmed ? <select value={review} onChange={(e) => void patchItems([{ item_id: item.item_id, review_status: e.target.value }])} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">{Object.entries(bulkReviewLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select> : <span className={cx("inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold", bulkReviewClasses[review])}>{bulkReviewLabels[review]}</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {excluded ? (
                        <button type="button" onClick={() => void reincludeItem(item)} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-500 hover:text-orange-600">
                          <RotateCcw className="h-3 w-3" />
                          Réinclure
                        </button>
                      ) : !ignored ? (
                        <button type="button" onClick={() => setEditingId(editing ? null : item.item_id)} className={cx("rounded p-1.5", editing ? "bg-orange-100 text-orange-700" : "text-slate-400 hover:bg-slate-100")}><Save className="h-3.5 w-3.5" /></button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [catalog, setCatalog] = useState<ProductDocumentCatalog | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [productFilter, setProductFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedOutlineItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [indexByDocId, setIndexByDocId] = useState<Record<string, ProductDocumentIndex | null>>({});
  const [indexLoadingId, setIndexLoadingId] = useState<string | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [indexingPhaseLabel, setIndexingPhaseLabel] = useState("");
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexSuccess, setIndexSuccess] = useState<string | null>(null);
  const [technicalKnowledgeExtractionsByDocId, setTechnicalKnowledgeExtractionsByDocId] =
    useState<Record<string, TechnicalKnowledgeExtractionsResponse | null>>({});
  const [technicalKnowledgeExtractionLoadingId, setTechnicalKnowledgeExtractionLoadingId] =
    useState<string | null>(null);
  const [technicalKnowledgeExtractionBusyId, setTechnicalKnowledgeExtractionBusyId] =
    useState<string | null>(null);
  const [technicalKnowledgeExtractionError, setTechnicalKnowledgeExtractionError] =
    useState<string | null>(null);
  const [technicalKnowledgeExtractionMessage, setTechnicalKnowledgeExtractionMessage] =
    useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<DocumentFormState>(EMPTY_FORM);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [partialUploadError, setPartialUploadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<DocumentFormState>(EMPTY_FORM);
  const [editTagDraft, setEditTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkRootName, setBulkRootName] = useState("");
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const documentTypeOptions = useMemo(
    () => normalizeOptions(catalog?.document_types),
    [catalog]
  );
  const statusOptions = useMemo(
    () => normalizeOptions(catalog?.statuses),
    [catalog]
  );
  const suggestedTags = useMemo(
    () => normalizeOptions(catalog?.suggested_tags).map((t) => t.code),
    [catalog]
  );

  const productOptions = useMemo(() => {
    const fromDocs = documents
      .map((doc) => docProductCode(doc))
      .filter(Boolean)
      .map((code) => ({ code, label: productLabel(code) }));

    const merged = [...FALLBACK_PRODUCTS, ...fromDocs];
    const seen = new Set<string>();
    return merged.filter((p) => {
      if (!p.code || seen.has(p.code)) return false;
      seen.add(p.code);
      return true;
    });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (productFilter && docProductCode(doc) !== productFilter) return false;
      if (!q) return true;
      const haystack = [
        safeStr(doc.title),
        docProductLabel(doc),
        safeStr(doc.document_type),
        ...(doc.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [documents, productFilter, search]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => docId(doc) === selectedDocId) || null,
    [documents, selectedDocId]
  );

  const selectedIndex = selectedDocId ? indexByDocId[selectedDocId] || null : null;
  const selectedTechnicalKnowledgeExtractions = selectedDocId
    ? technicalKnowledgeExtractionsByDocId[selectedDocId] || null
    : null;
  const selectedStats = selectedIndex?.stats || null;
  const selectedPdfUrl = safeStr(selectedDoc?.source?.url);
  const selectedItemText = shortText(selectedItem?.item.text, 1200);
  const selectedVisualRefs = preferredVisualRefs(selectedItem);

  const fetchCatalog = async () => {
    const res = await fetch(buildUrl("/product-documents/catalog"), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Erreur lors du chargement du catalogue.");
    return (await res.json()) as ProductDocumentCatalog;
  };

  const fetchDocuments = async (product = productFilter) => {
    const res = await fetch(
      buildUrl("/product-documents", product ? { product } : undefined),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Erreur lors du chargement des documents.");
    const data = await res.json();
    if (Array.isArray(data)) return data as ProductDocument[];
    if (Array.isArray(data?.documents)) return data.documents as ProductDocument[];
    if (Array.isArray(data?.items)) return data.items as ProductDocument[];
    return [];
  };

  const fetchIndex = async (documentId: string, silent = false) => {
    if (!documentId) return null;
    if (!silent) {
      setIndexLoadingId(documentId);
      setIndexError(null);
    }
    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(documentId)}/index`),
        { cache: "no-store" }
      );
      if (res.status === 404) {
        setIndexByDocId((prev) => ({ ...prev, [documentId]: null }));
        return null;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text && text.length < 240
            ? `Erreur index: ${text}`
            : "Erreur lors du chargement de l’index."
        );
      }
      const index = unwrapIndexResponse(await res.json());
      setIndexByDocId((prev) => ({ ...prev, [documentId]: index }));
      return index;
    } catch (e) {
      console.error("fetch document index error", e);
      if (!silent) {
        setIndexError(e instanceof Error ? e.message : "Erreur réseau index.");
      }
      return null;
    } finally {
      if (!silent) setIndexLoadingId(null);
    }
  };

  const fetchTechnicalKnowledgeExtractions = async (documentId: string, silent = false) => {
    if (!documentId) return null;
    if (!silent) {
      setTechnicalKnowledgeExtractionLoadingId(documentId);
      setTechnicalKnowledgeExtractionError(null);
    }
    try {
      const res = await fetch(
        buildUrl(
          `/product-documents/${encodeURIComponent(documentId)}/technical-knowledge/extractions`
        ),
        { cache: "no-store" }
      );
      if (res.status === 404) {
        const empty = {
          ok: true,
          document_id: documentId,
          count: 0,
          latest: null,
          items: [],
        } satisfies TechnicalKnowledgeExtractionsResponse;
        setTechnicalKnowledgeExtractionsByDocId((prev) => ({ ...prev, [documentId]: empty }));
        return empty;
      }
      const payload = (await res.json().catch(() => null)) as
        | TechnicalKnowledgeExtractionsResponse
        | null;
      if (!res.ok) {
        const detail = safeStr(payload?.detail || payload?.message || payload?.error);
        throw new Error(
          detail && detail.length < 260
            ? `Erreur diagnostic TK: ${detail}`
            : "Erreur lors du chargement du diagnostic TK."
        );
      }
      const value =
        payload ||
        ({
          ok: true,
          document_id: documentId,
          count: 0,
          latest: null,
          items: [],
        } satisfies TechnicalKnowledgeExtractionsResponse);
      setTechnicalKnowledgeExtractionsByDocId((prev) => ({ ...prev, [documentId]: value }));
      return value;
    } catch (e) {
      console.error("fetch technical knowledge extractions error", e);
      if (!silent) {
        setTechnicalKnowledgeExtractionError(
          e instanceof Error ? e.message : "Erreur réseau diagnostic TK."
        );
      }
      return null;
    } finally {
      if (!silent) setTechnicalKnowledgeExtractionLoadingId(null);
    }
  };

  const refresh = async (initial = false) => {
    setError(null);
    if (initial) setLoading(true);
    else setRefreshing(true);

    try {
      const [catalogData, docsData] = await Promise.all([
        fetchCatalog(),
        fetchDocuments(),
      ]);
      setCatalog(catalogData);
      setDocuments(docsData);
      const firstDocId = docsData[0] ? docId(docsData[0]) : null;
      setSelectedDocId((current) => {
        if (current && docsData.some((doc) => docId(doc) === current)) return current;
        return firstDocId;
      });
    } catch (e) {
      console.error("product documents refresh error", e);
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    void fetchIndex(selectedDocId, true);
    void fetchTechnicalKnowledgeExtractions(selectedDocId, true);
    setSelectedItem(null);
    setEditOpen(false);
    setActionError(null);
    setIndexError(null);
    setIndexSuccess(null);
    setIndexingPhaseLabel("");
    setTechnicalKnowledgeExtractionError(null);
    setTechnicalKnowledgeExtractionMessage(null);
  }, [selectedDocId]);

  useEffect(() => {
    setAddForm((prev) => ({
      ...prev,
      document_type: prev.document_type || documentTypeOptions[0]?.code || "",
      status: prev.status || statusOptions[0]?.code || "",
    }));
  }, [documentTypeOptions, statusOptions]);

  const addTag = (
    value: string,
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>
  ) => {
    const tag = value.trim();
    if (!tag) return;
    setForm({ ...form, tags: uniqStrings([...form.tags, tag]) });
  };

  const removeTag = (
    tag: string,
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>
  ) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const resetAdd = () => {
    setAddForm({
      ...EMPTY_FORM,
      document_type: documentTypeOptions[0]?.code || "",
      status: statusOptions[0]?.code || "",
      product: productFilter || "",
    });
    setAddFile(null);
    setTagDraft("");
    setAddError(null);
    setPartialUploadError(null);
  };

  const openAdd = () => {
    resetAdd();
    setAddOpen(true);
  };

  const openBulkFolderPicker = () => {
    if (folderInputRef.current) folderInputRef.current.value = "";
    folderInputRef.current?.click();
  };

  const handleBulkFolderSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const firstPath = safeStr((selectedFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath || selectedFiles[0].name);
    setBulkRootName(firstPath.includes("/") ? firstPath.split("/")[0] : "Dossier sélectionné");
    setBulkFiles(selectedFiles);
    setBulkOpen(true);
  };

  const closeBulkImport = () => {
    setBulkOpen(false);
    setBulkFiles([]);
    setBulkRootName("");
  };

  const finishBulkImport = () => {
    closeBulkImport();
    void refresh();
  };

  const openEdit = () => {
    if (!selectedDoc) return;
    setEditForm(documentToForm(selectedDoc));
    setEditTagDraft("");
    setEditOpen(true);
    setActionError(null);
  };

  const submitAdd = async () => {
    setAddError(null);
    setPartialUploadError(null);

    if (!addForm.product.trim() || !addForm.title.trim() || !addForm.document_type.trim()) {
      setAddError("Produit, titre et type de document sont obligatoires.");
      return;
    }
    if (!addFile) {
      setAddError("Sélectionne un PDF avant d’ajouter le document.");
      return;
    }

    setAdding(true);
    try {
      const metaRes = await fetch(buildUrl("/product-documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(addForm)),
        cache: "no-store",
      });

      if (!metaRes.ok) {
        const text = await metaRes.text().catch(() => "");
        setAddError(
          text && text.length < 260
            ? `Erreur création metadata: ${text}`
            : "Erreur lors de la création de la metadata."
        );
        return;
      }

      const created = unwrapDocumentResponse(await metaRes.json());
      const createdId = created ? docId(created) : "";
      if (!createdId) {
        setPartialUploadError(
          "Metadata créée, mais la réponse ne contient pas d’identifiant exploitable. Upload PDF impossible depuis l’UI."
        );
        await refresh();
        return;
      }

      const fd = new FormData();
      fd.append("file", addFile);
      const fileRes = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(createdId)}/file`),
        { method: "POST", body: fd, cache: "no-store" }
      );

      if (!fileRes.ok) {
        const text = await fileRes.text().catch(() => "");
        setPartialUploadError(
          text && text.length < 260
            ? `Metadata créée (${createdId}), mais upload PDF échoué: ${text}`
            : `Metadata créée (${createdId}), mais upload PDF échoué.`
        );
        await refresh();
        setSelectedDocId(createdId);
        return;
      }

      setAddOpen(false);
      resetAdd();
      await refresh();
      setSelectedDocId(createdId);
    } catch (e) {
      console.error("product document add error", e);
      setAddError("Erreur réseau lors de l’ajout du document.");
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedDocId) return;
    setSaving(true);
    setActionError(null);

    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(selectedDocId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title.trim(),
            document_type: editForm.document_type.trim(),
            version: editForm.version.trim() || null,
            status: editForm.status.trim() || null,
            tags: uniqStrings(editForm.tags),
            notes: editForm.notes.trim() || null,
          }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setActionError(
          text && text.length < 260
            ? `Erreur modification: ${text}`
            : "Erreur lors de la modification du document."
        );
        return;
      }

      setEditOpen(false);
      await refresh();
    } catch (e) {
      console.error("product document edit error", e);
      setActionError("Erreur réseau lors de la modification du document.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedDocument = async () => {
    if (!selectedDoc || !selectedDocId) return;
    const ok = window.confirm(
      `Supprimer la fiche document "${safeStr(selectedDoc.title, selectedDocId)}" ?`
    );
    if (!ok) return;

    setDeletingId(selectedDocId);
    setActionError(null);
    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(selectedDocId)}`),
        { method: "DELETE", cache: "no-store" }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setActionError(
          text && text.length < 260
            ? `Erreur suppression: ${text}`
            : "Erreur lors de la suppression du document."
        );
        return;
      }

      const remaining = documents.filter((doc) => docId(doc) !== selectedDocId);
      setSelectedDocId(remaining[0] ? docId(remaining[0]) : null);
      setSelectedItem(null);
      await refresh();
    } catch (e) {
      console.error("product document delete error", e);
      setActionError("Erreur réseau lors de la suppression du document.");
    } finally {
      setDeletingId(null);
    }
  };

  const extractTechnicalKnowledge = async (documentId: string) => {
    if (!documentId) return;
    setTechnicalKnowledgeExtractionBusyId(documentId);
    setTechnicalKnowledgeExtractionError(null);
    setTechnicalKnowledgeExtractionMessage(null);
    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(documentId)}/technical-knowledge/extract`),
        { method: "POST", cache: "no-store" }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = safeStr(payload?.detail || payload?.message || payload?.error);
        throw new Error(
          detail && detail.length < 260
            ? `Erreur extraction TK: ${detail}`
            : "Erreur lors de l’extraction des connaissances techniques."
        );
      }
      const createdCount = technicalKnowledgeCreatedCount(payload);
      setTechnicalKnowledgeExtractionMessage(
        createdCount !== null
          ? `${createdCount} connaissance${createdCount > 1 ? "s" : ""} technique${createdCount > 1 ? "s" : ""} créée${createdCount > 1 ? "s" : ""}.`
          : "Extraction des connaissances techniques lancée."
      );
      await fetchTechnicalKnowledgeExtractions(documentId, true);
      await refresh();
      setSelectedDocId(documentId);
    } catch (e) {
      console.error("technical knowledge extract error", e);
      setTechnicalKnowledgeExtractionError(
        e instanceof Error ? e.message : "Erreur réseau lors de l’extraction TK."
      );
    } finally {
      setTechnicalKnowledgeExtractionBusyId(null);
    }
  };

  const resumeTechnicalKnowledgeExtraction = async (documentId: string, extractionId: string) => {
    if (!documentId || !extractionId) return;
    setTechnicalKnowledgeExtractionBusyId(documentId);
    setTechnicalKnowledgeExtractionError(null);
    setTechnicalKnowledgeExtractionMessage(null);
    try {
      const res = await fetch(
        buildUrl(`/technical-knowledge/extractions/${encodeURIComponent(extractionId)}/resume`),
        { method: "POST", cache: "no-store" }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = safeStr(payload?.detail || payload?.message || payload?.error);
        throw new Error(
          detail && detail.length < 260
            ? `Erreur reprise TK: ${detail}`
            : "Erreur lors de la reprise de l’extraction TK."
        );
      }
      const createdCount = technicalKnowledgeCreatedCount(payload);
      setTechnicalKnowledgeExtractionMessage(
        createdCount !== null
          ? `Reprise terminée. ${createdCount} connaissance${createdCount > 1 ? "s" : ""} technique${createdCount > 1 ? "s" : ""} créée${createdCount > 1 ? "s" : ""}.`
          : "Reprise de l’extraction TK lancée."
      );
      await fetchTechnicalKnowledgeExtractions(documentId, true);
      await refresh();
      setSelectedDocId(documentId);
    } catch (e) {
      console.error("technical knowledge resume error", e);
      setTechnicalKnowledgeExtractionError(
        e instanceof Error ? e.message : "Erreur réseau lors de la reprise TK."
      );
    } finally {
      setTechnicalKnowledgeExtractionBusyId(null);
    }
  };

  const runIndexation = async (doc: ProductDocument) => {
    const id = docId(doc);
    if (!id) return;
    setIndexingId(id);
    setIndexingPhaseLabel("Indexation PDF...");
    setIndexError(null);
    setIndexSuccess(null);
    setActionError(null);

    setDocuments((prev) =>
      prev.map((d) =>
        docId(d) === id
          ? {
              ...d,
              indexing: {
                ...(d.indexing || {}),
                status: "INDEXING",
              },
            }
          : d
      )
    );

    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(id)}/index`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extract_technical_knowledge: false }),
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setIndexError(
          text && text.length < 260
            ? `Erreur indexation: ${text}`
            : "Erreur lors de l’indexation du document."
        );
        await refresh();
        return;
      }

      const payload = await res.json().catch(() => null);
      const index = unwrapIndexResponse(payload);
      if (index) {
        setIndexByDocId((prev) => ({ ...prev, [id]: index }));
      } else {
        await fetchIndex(id);
      }

      setIndexingPhaseLabel("Extraction des connaissances techniques...");
      const tkRes = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(id)}/technical-knowledge/extract`),
        { method: "POST", cache: "no-store" }
      );
      const tkPayload = await tkRes.json().catch(() => null);
      if (!tkRes.ok) {
        const text = tkPayload?.detail || tkPayload?.message || tkPayload?.error || "";
        setIndexError(
          text && String(text).length < 260
            ? `Indexation PDF terminée, mais extraction TK échouée: ${text}`
            : "Indexation PDF terminée, mais extraction des connaissances techniques échouée."
        );
        await refresh();
        return;
      }

      const createdCount = technicalKnowledgeCreatedCount(tkPayload);
      setIndexSuccess(
        createdCount !== null
          ? `${createdCount} connaissance${createdCount > 1 ? "s" : ""} technique${createdCount > 1 ? "s" : ""} créée${createdCount > 1 ? "s" : ""}.`
          : "Extraction des connaissances techniques terminée."
      );
      await fetchTechnicalKnowledgeExtractions(id, true);
      await refresh();
      setSelectedDocId(id);
    } catch (e) {
      console.error("product document index error", e);
      setIndexError("Erreur réseau lors de l’indexation.");
      await refresh();
    } finally {
      setIndexingId(null);
      setIndexingPhaseLabel("");
    }
  };

  const renderTagEditor = (
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>,
    draft: string,
    setDraft: React.Dispatch<React.SetStateAction<string>>
  ) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {form.tags.length ? (
          form.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            >
              {tag}
              <button
                type="button"
                className="text-slate-400 hover:text-slate-900"
                onClick={() => removeTag(tag, form, setForm)}
                aria-label={`Retirer ${tag}`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Aucun tag.
          </div>
        )}
      </div>

      {suggestedTags.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestedTags.map((tag) => {
            const active = form.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  active
                    ? removeTag(tag, form, setForm)
                    : addTag(tag, form, setForm)
                }
                className={cx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          placeholder="Ajouter un tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft, form, setForm);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={() => {
            addTag(draft, form, setForm);
            setDraft("");
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );

  const indexedCount = documents.filter((doc) => indexingStatus(doc) === "INDEXED").length;
  const failedCount = documents.filter((doc) => indexingStatus(doc) === "FAILED").length;
  const notIndexedCount = documents.filter((doc) => indexingStatus(doc) === "NOT_INDEXED").length;

  return (
    <AppShell>
      <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-950">
        <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Documentation produits
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Gérer, indexer et vérifier le plan détecté des PDF produits PRIA.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleBulkFolderSelected}
                {...{ webkitdirectory: "", directory: "" }}
              />
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} />
              </button>

              <button
                type="button"
                onClick={openBulkFolderPicker}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Importer un dossier
              </button>

              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un document
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Chargement des documents...
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorBox>{error}</ErrorBox>
          </div>
        ) : bulkOpen && bulkFiles.length ? (
          <BulkImportMode
            files={bulkFiles}
            rootName={bulkRootName}
            productOptions={productOptions}
            documentTypeOptions={documentTypeOptions}
            onClose={closeBulkImport}
            onDone={finishBulkImport}
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[330px_minmax(0,1fr)_360px] overflow-hidden">
            <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
              <div className="space-y-3 border-b border-slate-200 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    placeholder="Rechercher un document..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  <option value="">Tous les produits</option>
                  {productOptions.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700 ring-1 ring-emerald-100">
                    <div className="text-base font-bold">{indexedCount}</div>
                    Indexés
                  </div>
                  <div className="rounded-xl bg-slate-50 px-2 py-2 text-slate-600 ring-1 ring-slate-200">
                    <div className="text-base font-bold">{notIndexedCount}</div>
                    À faire
                  </div>
                  <div className="rounded-xl bg-red-50 px-2 py-2 text-red-700 ring-1 ring-red-100">
                    <div className="text-base font-bold">{failedCount}</div>
                    Échecs
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto py-2">
                {filteredDocuments.length ? (
                  filteredDocuments.map((doc) => {
                    const id = docId(doc);
                    const active = selectedDocId === id;
                    const status = indexingId === id ? "INDEXING" : indexingStatus(doc);
                    const cachedSummary = indexSummary(indexByDocId[id]);
                    const dateLabel = formatDateTime(doc.indexing?.last_indexed_at);

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedDocId(id)}
                        className={cx(
                          "w-full border-l-2 px-4 py-4 text-left transition",
                          active
                            ? "border-l-orange-600 bg-orange-50"
                            : "border-l-transparent hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-950">
                              {safeStr(doc.title, "Sans titre")}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {docProductLabel(doc)}
                            </div>
                          </div>
                          <Badge className={indexingBadgeClass(status)}>
                            {status}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                            {humanLabel(doc.document_type)}
                          </Badge>
                          {doc.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          {cachedSummary ||
                            (dateLabel ? `Indexé le ${dateLabel}` : "Aucun résumé d’index chargé")}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Aucun document.
                  </div>
                )}

                <AdvancedAdminPanel onRefresh={() => void refresh()} />
              </div>
            </aside>

            <section className="min-h-0 overflow-auto border-r border-slate-200 bg-slate-50 p-6">
              {selectedDoc ? (
                <div className="mx-auto max-w-5xl space-y-5">
                  {actionError ? <ErrorBox>{actionError}</ErrorBox> : null}
                  {indexError ? <ErrorBox>{indexError}</ErrorBox> : null}
                  {indexSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      {indexSuccess}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                            {humanLabel(selectedDoc.document_type)}
                          </Badge>
                          <Badge className={statusBadgeClass(selectedDoc.status)}>
                            {humanLabel(selectedDoc.status)}
                          </Badge>
                          <Badge className={indexingBadgeClass(indexingId === selectedDocId ? "INDEXING" : indexingStatus(selectedDoc))}>
                            {indexingId === selectedDocId ? "INDEXING" : indexingStatus(selectedDoc)}
                          </Badge>
                        </div>

                        <h2 className="text-xl font-semibold text-slate-950">
                          {safeStr(selectedDoc.title, "Sans titre")}
                        </h2>
                        <div className="mt-1 text-sm text-slate-500">
                          {docProductLabel(selectedDoc)}
                          {selectedDoc.version ? ` · ${selectedDoc.version}` : ""}
                          {selectedDoc.source?.filename ? ` · ${selectedDoc.source.filename}` : ""}
                        </div>

                        {selectedDoc.tags?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedDoc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                              >
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void runIndexation(selectedDoc)}
                          disabled={indexingId === selectedDocId || !selectedPdfUrl}
                          className={cx(
                            "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
                            isIndexed(selectedDoc)
                              ? "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                              : "bg-orange-600 text-white hover:bg-orange-700"
                          )}
                        >
                          {indexingId === selectedDocId ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {indexingPhaseLabel || "Indexation..."}
                            </>
                          ) : isIndexed(selectedDoc) ? (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              Réindexer
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Indexer
                            </>
                          )}
                        </button>

                        {selectedPdfUrl ? (
                          <a
                            href={selectedPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                            PDF source
                          </a>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                            PDF absent
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={openEdit}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteSelectedDocument()}
                            disabled={deletingId === selectedDocId}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                            title="Supprimer"
                          >
                            {deletingId === selectedDocId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {[
                        { label: "Pages", value: selectedStats?.page_count ?? "—" },
                        { label: "Sections", value: selectedStats?.section_count ?? "—" },
                        { label: "Repères", value: selectedStats?.anchor_count ?? "—" },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center"
                        >
                          <div className="text-2xl font-bold text-slate-950">
                            {metric.value}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {metric.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span>
                        Dernière indexation :{" "}
                        {formatDateTime(selectedDoc.indexing?.last_indexed_at) || "—"}
                      </span>
                      <span className="font-mono">
                        {safeStr(selectedDoc.indexing?.index_version, "version inconnue")}
                      </span>
                    </div>

                    {selectedDoc.indexing?.last_error ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {selectedDoc.indexing.last_error}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          Plan détecté
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Sections principales et repères précis rattachés au document.
                        </p>
                      </div>
                      {indexLoadingId === selectedDocId ? (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement
                        </span>
                      ) : selectedIndex ? (
                        <span className="text-sm text-slate-500">
                          {indexSummary(selectedIndex)}
                        </span>
                      ) : null}
                    </div>

                    {selectedIndex ? (
                      <PlanTree
                        index={selectedIndex}
                        selected={selectedItem}
                        onSelect={setSelectedItem}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                        <BookOpen className="mx-auto h-9 w-9 text-slate-300" />
                        <div className="mt-3 font-semibold text-slate-800">
                          Index non disponible
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Clique sur Indexer pour générer le plan détecté.
                        </p>
                      </div>
                    )}
                  </div>

                  <DiagnosticPanel
                    doc={selectedDoc}
                    index={selectedIndex}
                    tkExtractions={selectedTechnicalKnowledgeExtractions}
                    tkLoading={technicalKnowledgeExtractionLoadingId === selectedDocId}
                    tkActionBusy={technicalKnowledgeExtractionBusyId === selectedDocId}
                    tkActionMessage={technicalKnowledgeExtractionMessage}
                    tkError={technicalKnowledgeExtractionError}
                    onExtractTk={() => {
                      if (selectedDocId) void extractTechnicalKnowledge(selectedDocId);
                    }}
                    onResumeTk={(extractionId) => {
                      if (selectedDocId) {
                        void resumeTechnicalKnowledgeExtraction(selectedDocId, extractionId);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-slate-500">
                  <div>
                    <FileText className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-medium">Sélectionne un document.</p>
                  </div>
                </div>
              )}
            </section>

            <aside className="min-h-0 overflow-auto bg-white">
              {selectedItem ? (
                <div className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge
                        className={
                          selectedItem.type === "section"
                            ? "bg-blue-50 text-blue-700 ring-blue-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                        }
                      >
                        {selectedItem.type === "section" ? "Section" : "Repère"}
                      </Badge>
                      {selectedItem.type === "anchor" && safeStr(selectedItem.item.kind) ? (
                        <Badge className="ml-2 bg-orange-50 text-orange-700 ring-orange-200">
                          {anchorKindLabel[safeStr(selectedItem.item.kind)] ||
                            humanLabel(selectedItem.item.kind)}
                        </Badge>
                      ) : null}
                      <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-950">
                        {safeStr(selectedItem.item.title, "Sans titre")}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatPages(selectedItem.item.page_start, selectedItem.item.page_end)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      title="Fermer l’aperçu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <section>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Texte extrait
                    </div>
                    <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                      {selectedItemText || (
                        <span className="text-slate-400">Aucun extrait texte disponible.</span>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pages visuelles associées
                    </div>
                    {selectedVisualRefs.length ? (
                      <div className="space-y-3">
                        {selectedVisualRefs
                          .slice()
                          .sort((a, b) => (safeNum(a.page) || 0) - (safeNum(b.page) || 0))
                          .slice(0, 6)
                          .map((ref, idx) => {
                          const page = safeNum(ref.page);
                          const imgUrl = visualRefUrl(ref, selectedIndex);
                          const pdfUrl = pdfPageUrl(selectedDoc, page);
                          return (
                            <div
                              key={`${safeStr(ref.kind)}-${page || "x"}-${idx}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {page ? `Page ${page}` : "Visuel"}
                                  </span>
                                  <Badge className="bg-white text-slate-600 ring-slate-200">
                                    {safeStr(ref.kind) === "section_crop"
                                      ? "Crop section"
                                      : safeStr(ref.kind) === "anchor_crop"
                                        ? "Crop repère"
                                        : "Page complète"}
                                  </Badge>
                                </div>
                                {pdfUrl ? (
                                  <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline"
                                  >
                                    Ouvrir PDF
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : null}
                              </div>

                              {imgUrl ? (
                                <a href={imgUrl} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgUrl}
                                    alt={`${safeStr(ref.kind, "visuel")} page ${page || ""}`}
                                    className="max-h-96 w-full rounded-xl border border-slate-200 bg-white object-contain"
                                  />
                                </a>
                              ) : (
                                <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
                                  Visuel référencé mais URL non disponible.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Aucun repère visuel associé.
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <Hash className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Sélectionner une section ou un repère
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    L’extrait texte et les pages associées apparaîtront ici.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}

        {editOpen && selectedDoc ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Modifier la fiche document
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Le PDF source et l’index ne sont pas modifiés ici.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                  title="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-auto px-6 py-5">
                <DocumentForm
                  form={editForm}
                  setForm={setEditForm}
                  productOptions={productOptions}
                  documentTypeOptions={documentTypeOptions}
                  statusOptions={statusOptions}
                  tagEditor={renderTagEditor(editForm, setEditForm, editTagDraft, setEditTagDraft)}
                  disableProduct
                />
                {actionError ? <div className="mt-4"><ErrorBox>{actionError}</ErrorBox></div> : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {addOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Ajouter un document produit
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Création de la metadata puis upload du PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                  title="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(92vh-150px)] overflow-auto px-6 py-5">
                <DocumentForm
                  form={addForm}
                  setForm={setAddForm}
                  productOptions={productOptions}
                  documentTypeOptions={documentTypeOptions}
                  statusOptions={statusOptions}
                  tagEditor={renderTagEditor(addForm, setAddForm, tagDraft, setTagDraft)}
                />

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    PDF <span className="text-red-500">*</span>
                  </div>
                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center hover:border-orange-300 hover:bg-orange-50">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="mt-3 text-sm font-medium text-slate-800">
                      {addFile ? addFile.name : "Sélectionner un PDF"}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      Upload via ImageKit côté backend
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {addError ? <div className="mt-4"><ErrorBox>{addError}</ErrorBox></div> : null}
                {partialUploadError ? (
                  <div className="mt-4">
                    <InfoBox>{partialUploadError}</InfoBox>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void submitAdd()}
                  disabled={adding}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Ajouter document
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function DocumentForm({
  form,
  setForm,
  productOptions,
  documentTypeOptions,
  statusOptions,
  tagEditor,
  disableProduct = false,
}: {
  form: DocumentFormState;
  setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>;
  productOptions: Array<{ code: string; label: string }>;
  documentTypeOptions: Array<{ code: string; label: string }>;
  statusOptions: Array<{ code: string; label: string }>;
  tagEditor: React.ReactNode;
  disableProduct?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Produit <span className="text-red-500">*</span>
          </span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-500"
            value={form.product}
            disabled={disableProduct}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
          >
            <option value="">Sélectionner un produit</option>
            {productOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Type <span className="text-red-500">*</span>
          </span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            value={form.document_type}
            onChange={(e) => setForm({ ...form, document_type: e.target.value })}
          >
            {documentTypeOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Titre <span className="text-red-500">*</span>
          </span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            placeholder="Ex : Notice installation PAC hybride"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Version</span>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            placeholder="Ex : v3.2"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Statut</span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {statusOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">Tags</div>
        {tagEditor}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
    </div>
  );
}
