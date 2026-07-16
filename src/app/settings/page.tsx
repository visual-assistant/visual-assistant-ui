"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
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
}: {
  doc: ProductDocument | null;
  index: ProductDocumentIndex | null;
}) {
  const [open, setOpen] = useState(false);
  const meta = index?.outline_meta || {};
  const candidateCount = Array.isArray(index?.outline_candidates)
    ? index.outline_candidates.length
    : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Cpu className="h-4 w-4 text-slate-400" />
          Diagnostic indexation
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
        </div>
      ) : null}
    </div>
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
  const [indexError, setIndexError] = useState<string | null>(null);

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
    setSelectedItem(null);
    setEditOpen(false);
    setActionError(null);
    setIndexError(null);
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

  const runIndexation = async (doc: ProductDocument) => {
    const id = docId(doc);
    if (!id) return;
    setIndexingId(id);
    setIndexError(null);
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
        { method: "POST", cache: "no-store" }
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
      await refresh();
      setSelectedDocId(id);
    } catch (e) {
      console.error("product document index error", e);
      setIndexError("Erreur réseau lors de l’indexation.");
      await refresh();
    } finally {
      setIndexingId(null);
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
              </div>
            </aside>

            <section className="min-h-0 overflow-auto border-r border-slate-200 bg-slate-50 p-6">
              {selectedDoc ? (
                <div className="mx-auto max-w-5xl space-y-5">
                  {actionError ? <ErrorBox>{actionError}</ErrorBox> : null}
                  {indexError ? <ErrorBox>{indexError}</ErrorBox> : null}

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
                              Indexation...
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

                  <DiagnosticPanel doc={selectedDoc} index={selectedIndex} />
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
