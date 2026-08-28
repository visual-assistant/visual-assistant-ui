"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Check,
  Clock3,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Maximize2,
  MessageSquare,
  Monitor,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API?.replace(/\/+$/, "") ||
  "http://localhost:8001";

const buildUrl = (path: string, params?: Record<string, string | undefined>) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, API_BASE);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

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

const statusLabel: Record<string, string> = {
  ANSWERED: "Réponse prête",
  NEEDS_PRODUCT: "Produit à préciser",
  FAILED: "Échec",
  DRAFT: "Brouillon",
};

const shareChannelLabel: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

const shareStatusLabel: Record<string, string> = {
  SENT: "Envoyé",
  FAILED: "Échec",
  PENDING: "En attente",
  PREPARED: "Préparé",
};

const visualKindLabel: Record<string, string> = {
  anchor_crop: "Repère",
  section_crop: "Section",
  page_snapshot: "Page",
};

type VisualRef = {
  visual_ref_id?: string | null;
  id?: string | null;
  kind?: string | null;
  page?: number | null;
  url?: string | null;
  relative_path?: string | null;
  bbox?: number[] | null;
  width?: number | null;
  height?: number | null;
  included?: boolean | null;
  local_path?: string | null;
};

type ExpandedVisual = {
  imageUrl: string;
  sourceUrl: string;
  title: string;
  meta: string;
};

type AtelierAnswerBlock = {
  block_id?: string | null;
  type?: string | null;
  title?: string | null;
  text?: string | null;
  source_ids?: string[] | null;
  visual_ref_ids?: string[] | null;
  confidence?: string | null;
  reason?: string | null;
  order?: number | null;
};

type AtelierBlock = {
  block_id?: string | null;
  id?: string | null;
  kind?: string | null;
  title?: string | null;
  text?: string | null;
  visual_ref_ids?: string[] | null;
  source_ids?: string[] | null;
};

type AtelierSource = {
  source_id?: string | null;
  source_type?: string | null;
  document_id?: string | null;
  document_title?: string | null;
  result_type?: string | null;
  section_title?: string | null;
  anchor_title?: string | null;
  anchor_kind?: string | null;
  pages?: number[] | null;
  score?: number | null;
  text?: string | null;
  visual_refs?: VisualRef[] | null;
  source_url?: string | null;
};

type AtelierDraft = {
  title?: string | null;
  answer_text?: string | null;
  answer_blocks?: AtelierAnswerBlock[] | null;
  supplementary_source_ids?: string[] | null;
  supplementary_visual_ref_ids?: string[] | null;
  composition_status?: string | null;
  composition_reason?: string | null;
  blocks?: AtelierBlock[] | null;
  visual_refs?: VisualRef[] | null;
  included_visual_ref_ids?: string[] | null;
  is_modified?: boolean | null;
  updated_at?: string | number | null;
  updated_by?: string | null;
};

type AtelierRecipient = {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
};

type AtelierSharePreview = {
  previews?: {
    web?: {
      public_url?: string | null;
      title?: string | null;
      visual_count?: number | null;
    } | null;
    whatsapp?: {
      to?: string | null;
      body?: string | null;
    } | null;
    email?: {
      to?: string | null;
      subject?: string | null;
      body?: string | null;
    } | null;
  } | null;
};

type AtelierSendResponse = {
  ok?: boolean;
  error?: string | null;
  question?: AtelierQuestion;
  public_url?: string | null;
  slug?: string | null;
  send?: AtelierSend | null;
  detail?: string;
  message?: string;
};

type AtelierPublication = {
  publication_id?: string | null;
  slug?: string | null;
  public_url?: string | null;
  status?: string | null;
  title?: string | null;
  created_at?: string | number | null;
  expires_at?: string | number | null;
  revoked_at?: string | number | null;
};

type AtelierSend = {
  send_id?: string | null;
  channel?: "WHATSAPP" | "EMAIL" | string | null;
  recipient?: AtelierRecipient | null;
  status?: string | null;
  error?: string | null;
  public_url?: string | null;
  slug?: string | null;
  created_at?: string | number | null;
  sent_at?: string | number | null;
};

type AtelierShareSummary = {
  has_been_shared?: boolean | null;
  has_publication?: boolean | null;
  publication_count?: number | null;
  active_publication_count?: number | null;
  send_count?: number | null;
  sent_count?: number | null;
  failed_send_count?: number | null;
  last_channel?: "WHATSAPP" | "EMAIL" | string | null;
  last_recipient?: string | null;
  last_recipient_name?: string | null;
  last_recipient_company?: string | null;
  last_status?: string | null;
  last_send_status?: string | null;
  last_error?: string | null;
  last_public_url?: string | null;
  last_shared_at?: string | number | null;
  last_sent_at?: string | number | null;
  draft_is_modified?: boolean | null;
  included_visual_count?: number | null;
};

type AtelierProduct = {
  product_code: string;
  product_label?: string | null;
  indexed_document_count?: number | null;
  indexed_document_ids?: string[] | null;
  document_titles?: string[] | null;
  last_indexed_at?: string | number | null;
};

type AtelierProductsResponse =
  | AtelierProduct[]
  | {
      items?: AtelierProduct[];
      data?: AtelierProduct[];
      products?: AtelierProduct[];
    };

type GuidePreparationMode = "existing" | "new";
type GuidePreparationStep = "setup" | "confirm" | "generating";

type GuideChantierContext = {
  reference_chantier?: string | null;
  produit?: string | null;
  configuration_text?: string | null;
  installateur?: {
    source?: string | null;
    company?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

type GuideChantierDetail = {
  chantier_id?: string | null;
  id?: string | null;
  title?: string | null;
  context?: GuideChantierContext | null;
};

type GuideCreationResponse = {
  ok?: boolean;
  guide?: {
    guide_id?: string | null;
    chantier_id?: string | null;
    status?: string | null;
    configuration_snapshot?: {
      configuration_text?: string | null;
    } | null;
  } | null;
  points_generation?: {
    requested?: boolean | null;
    ok?: boolean | null;
    count?: number | null;
    error?: string | null;
  } | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
};

type GuidePreparationForm = {
  chantierId: string;
  reference: string;
  installerCompany: string;
  installerName: string;
  installerPhone: string;
  installerEmail: string;
  product: string;
  configurationText: string;
};

type AtelierQuestion = {
  question_id: string;
  status?: string | null;
  question?: string | null;
  detected_product?: string | null;
  detected_components?: string[] | null;
  product?: string | null;
  components?: string[] | null;
  classification_source?: string | null;
  answer_text?: string | null;
  sources?: AtelierSource[] | null;
  visual_refs?: VisualRef[] | null;
  blocks?: AtelierBlock[] | null;
  draft?: AtelierDraft | null;
  publications?: AtelierPublication[] | null;
  sends?: AtelierSend[] | null;
  share_summary?: AtelierShareSummary | null;
  meta?: {
    revision_count?: number | null;
    previous_questions?: Array<{
      question?: string | null;
      updated_at?: string | number | null;
    }> | null;
    confidence?: string | null;
    missing_information?: string[] | null;
    available_products?: AtelierProduct[] | null;
    retrieval?: {
      error?: string | null;
      searched_index_count?: number | null;
      source_count?: number | null;
      [key: string]: unknown;
    } | null;
    classification?: {
      detected_product_supported?: boolean | null;
      unsupported_detected_product?: string | null;
      meta?: {
        unsupported_detected_product_filtered?: string | null;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    } | null;
  } | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
};

type QuestionsListResponse =
  | AtelierQuestion[]
  | {
      questions?: AtelierQuestion[];
      items?: AtelierQuestion[];
      data?: AtelierQuestion[];
    };

type ShareChannel = "WHATSAPP" | "EMAIL";

type RenderAnswerBlock = {
  block_id: string;
  type?: string | null;
  title?: string | null;
  text?: string | null;
  source_ids: string[];
  visual_ref_ids: string[];
  confidence?: string | null;
  reason?: string | null;
  order: number;
};

function formatDateTime(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "";

  const date =
    typeof value === "number"
      ? new Date(value < 10_000_000_000 ? value * 1000 : value)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeStr(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

function normalizeAssetUrl(value?: string | null) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || raw.includes("\\") || /^[a-zA-Z]:/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return buildUrl(raw);
  return buildUrl(`/${raw}`);
}

function selectVisualRefs(refs?: VisualRef[] | null) {
  const seen = new Set<string>();
  const usableRefs = (refs || []).filter((ref) => {
    const url = normalizeAssetUrl(ref.url);
    if (!url) return false;

    const key = visualRefDedupeKey(ref);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const anchorCrops = usableRefs.filter((ref) => ref.kind === "anchor_crop");
  if (anchorCrops.length) return anchorCrops;

  const sectionCrops = usableRefs.filter((ref) => ref.kind === "section_crop");
  if (sectionCrops.length) return sectionCrops;

  const pageSnapshots = usableRefs.filter((ref) => ref.kind === "page_snapshot");
  if (pageSnapshots.length) return pageSnapshots;

  return [];
}

function visualRefsUsedByAnswerBlocks(question: AtelierQuestion, fallbackRefs: VisualRef[]) {
  const sourceRefs = question.draft?.visual_refs?.length
    ? question.draft.visual_refs
    : fallbackRefs;
  const refsById = new Map(
    sourceRefs
      .map((ref, index) => [visualRefId(ref, index), ref] as const)
      .filter(([id]) => Boolean(id)),
  );
  const usedIds = new Set(
    (question.draft?.answer_blocks || [])
      .flatMap((block) => block.visual_ref_ids || [])
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const usedRefs = Array.from(usedIds)
    .map((id) => refsById.get(id))
    .filter((ref): ref is VisualRef => Boolean(ref))
    .filter((ref) => normalizeAssetUrl(ref.url))
    .filter((ref) => {
      const key = visualRefDedupeKey(ref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (usedRefs.length) return usedRefs;

  return dedupeVisualRefs(sourceRefs.filter((ref) => normalizeAssetUrl(ref.url)));
}

function visualRefId(ref: VisualRef, index: number) {
  return (
    safeStr(ref.visual_ref_id) ||
    safeStr(ref.id) ||
    [safeStr(ref.kind, "visual_ref"), ref.page ?? index + 1, index].join("_")
  );
}

function visualRefDedupeKey(ref: VisualRef) {
  return [
    safeStr(ref.kind, "visual_ref"),
    ref.page ?? "",
    normalizeAssetUrl(ref.url) || safeStr(ref.relative_path),
  ].join("|");
}

function buildSourcesById(question?: AtelierQuestion | null) {
  const entries = (question?.sources || [])
    .filter((source) => safeStr(source.source_id))
    .map((source) => [safeStr(source.source_id), source] as const);
  return new Map(entries);
}

function buildVisualRefsById(question?: AtelierQuestion | null) {
  const refs = question?.draft?.visual_refs?.length
    ? question.draft.visual_refs
    : question?.visual_refs || [];
  const entries = refs
    .map((ref, index) => [visualRefId(ref, index), ref] as const)
    .filter(([id]) => Boolean(id));
  return new Map(entries);
}

function getPrimaryAnswerBlocks(question?: AtelierQuestion | null): RenderAnswerBlock[] {
  const answerBlocks = question?.draft?.answer_blocks || [];
  if (answerBlocks.length) {
    return answerBlocks
      .map((block, index) => ({
        block_id: safeStr(block.block_id, `answer_block_${index}`),
        type: block.type,
        title: block.title,
        text: block.text,
        source_ids: (block.source_ids || []).filter(Boolean),
        visual_ref_ids: (block.visual_ref_ids || []).filter(Boolean),
        confidence: block.confidence,
        reason: block.reason,
        order: block.order ?? index,
      }))
      .sort((a, b) => a.order - b.order);
  }

  const legacyBlocks = question?.draft?.blocks || [];
  if (legacyBlocks.length) {
    return legacyBlocks.map((block, index) => ({
      block_id: safeStr(block.block_id || block.id, `legacy_block_${index}`),
      type: block.kind || "legacy",
      title: block.title,
      text: block.text,
      source_ids: (block.source_ids || []).filter(Boolean),
      visual_ref_ids: (block.visual_ref_ids || []).filter(Boolean),
      confidence: null,
      reason: null,
      order: index,
    }));
  }

  const fallbackText = question?.draft?.answer_text || question?.answer_text || "";
  if (!fallbackText.trim()) return [];

  return [
    {
      block_id: "fallback_answer",
      type: "answer",
      title: null,
      text: fallbackText,
      source_ids: [],
      visual_ref_ids: [],
      confidence: null,
      reason: null,
      order: 0,
    },
  ];
}

function getSupplementaryVisualRefs(question: AtelierQuestion | null | undefined, usedVisualRefIds: Set<string>) {
  const visualRefsById = buildVisualRefsById(question);
  const seen = new Set<string>();
  return (question?.draft?.supplementary_visual_ref_ids || [])
    .filter((id) => !usedVisualRefIds.has(id))
    .map((id) => visualRefsById.get(id))
    .filter((ref): ref is VisualRef => Boolean(ref))
    .filter((ref, index) => {
      const key = visualRefId(ref, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function dedupeVisualRefs(refs: VisualRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = visualRefDedupeKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function apiErrorMessage(status: number, fallback?: string | null) {
  if (fallback) return fallback;
  if (status === 400) return "Champ destinataire manquant ou invalide.";
  if (status === 404) return "Question ou publication introuvable.";
  if (status === 410) return "Lien public expiré ou révoqué.";
  return `Erreur backend (${status}).`;
}

function compactPagesLabel(pages?: number[] | null) {
  if (!pages?.length) return "p. -";
  return `p. ${pages.join(", ")}`;
}

function sourceKind(source: AtelierSource) {
  if (source.anchor_kind) return anchorKindLabel[source.anchor_kind] || source.anchor_kind;
  return source.result_type === "anchor" ? "Repère" : "Section";
}

function sourceCompactLabel(source: AtelierSource) {
  return [
    source.document_title || "Document produit",
    source.section_title,
    source.anchor_title,
  ]
    .filter(Boolean)
    .join(" - ");
}

function visualCaption(ref: VisualRef) {
  const kind = visualKindLabel[safeStr(ref.kind)] || safeStr(ref.kind, "Visuel");
  return ref.page ? `${kind} - page ${ref.page}` : kind;
}

function answerBlocksToText(blocks: RenderAnswerBlock[]) {
  return blocks
    .map((block) => [safeStr(block.title), safeStr(block.text)].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function expandedVisualTitle(ref: VisualRef, source?: AtelierSource | null) {
  const sourceTitle = source?.document_title || "Extrait notice";
  return ref.page ? `${sourceTitle} - page ${ref.page}` : sourceTitle;
}

function shareRecipientLabel(summary?: AtelierShareSummary | null) {
  if (!summary) return "";
  return (
    summary.last_recipient_name ||
    summary.last_recipient_company ||
    summary.last_recipient ||
    ""
  );
}

function shareSummaryDate(summary?: AtelierShareSummary | null) {
  const value = summary?.last_shared_at || summary?.last_sent_at;
  return value ? formatDateTime(value) : "";
}

function questionListFromResponse(payload: QuestionsListResponse) {
  if (Array.isArray(payload)) return payload;
  return payload.questions || payload.items || payload.data || [];
}

function productListFromResponse(payload: AtelierProductsResponse | null) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.products || payload.data || [];
}

function questionFromResponse(payload: unknown): AtelierQuestion | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    question?: AtelierQuestion;
    item?: AtelierQuestion;
    data?: AtelierQuestion;
    question_id?: string;
  };

  if (candidate.question?.question_id) return candidate.question;
  if (candidate.item?.question_id) return candidate.item;
  if (candidate.data?.question_id) return candidate.data;
  if (candidate.question_id) return candidate as AtelierQuestion;

  return null;
}

function productLabel(product: AtelierProduct) {
  return safeStr(product.product_label || product.product_code);
}

function indexedNoticeLabel(count?: number | null) {
  const value = count ?? 0;
  return `${value} notice${value > 1 ? "s" : ""}`;
}

function unsupportedDetectedProduct(question?: AtelierQuestion | null) {
  return (
    safeStr(question?.meta?.classification?.unsupported_detected_product) ||
    safeStr(question?.meta?.classification?.meta?.unsupported_detected_product_filtered) ||
    safeStr(question?.detected_product)
  );
}

function needsProductCorrection(question?: AtelierQuestion | null) {
  if (!question) return false;
  const retrievalError = safeStr(question.meta?.retrieval?.error);
  return (
    question.status === "NEEDS_PRODUCT" ||
    !safeStr(question.product) ||
    retrievalError === "product_not_indexed" ||
    retrievalError === "product_required"
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || "DRAFT";
  const tone =
    value === "ANSWERED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "FAILED"
        ? "border-red-200 bg-red-50 text-red-700"
        : value === "NEEDS_PRODUCT"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {statusLabel[value] || value}
    </span>
  );
}

function AnswerNoticeVisualCard({
  refData,
  index,
  source,
  onExpand,
  compact = false,
}: {
  refData: VisualRef;
  index: number;
  source?: AtelierSource | null;
  onExpand: (visual: ExpandedVisual) => void;
  compact?: boolean;
}) {
  const imageUrl = normalizeAssetUrl(refData.url);
  if (!imageUrl) return null;

  const sourceUrl = normalizeAssetUrl(source?.source_url) || imageUrl;
  const title = source?.document_title || "Document produit";
  const kind = visualKindLabel[safeStr(refData.kind)] || safeStr(refData.kind, "Visuel");
  const expandedVisual = {
    imageUrl,
    sourceUrl,
    title: expandedVisualTitle(refData, source),
    meta: visualCaption(refData),
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {refData.page ? <span className="font-mono text-xs text-slate-400">p. {refData.page}</span> : null}
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {kind}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onExpand(expandedVisual)}
        className={`block w-full bg-white text-left transition-colors hover:bg-orange-50/40 ${compact ? "p-3" : "p-4"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`Extrait visuel page ${refData.page || index + 1}`}
          className={`w-full rounded border border-slate-100 object-contain ${compact ? "max-h-44" : "max-h-72"}`}
        />
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2">
        <span className="min-w-0 truncate text-xs italic text-slate-500">{visualCaption(refData)}</span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onExpand(expandedVisual)}
            className="inline-flex w-[72px] items-center justify-center gap-1 text-xs text-slate-400 transition-colors hover:text-orange-600"
          >
            <Maximize2 className="h-3 w-3" />
            Agrandir
          </button>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-[72px] items-center justify-center gap-1 text-xs text-slate-400 transition-colors hover:text-orange-600"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        </div>
      </div>
    </div>
  );
}

function SharePanel({
  question,
  visualRefs,
  onQuestionUpdated,
  onClose,
}: {
  question: AtelierQuestion;
  visualRefs: VisualRef[];
  onQuestionUpdated: (question: AtelierQuestion) => void;
  onClose: () => void;
}) {
  const draftVisualRefs = visualRefsUsedByAnswerBlocks(question, visualRefs);
  const initialIncludedIds = Array.isArray(question.draft?.included_visual_ref_ids)
    ? question.draft.included_visual_ref_ids.filter(Boolean)
    : draftVisualRefs
        .filter((ref) => ref.included !== false)
        .map((ref, index) => visualRefId(ref, index));

  const [channel, setChannel] = useState<ShareChannel>("WHATSAPP");
  const [recipient, setRecipient] = useState<AtelierRecipient>({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState<AtelierSharePreview | null>(null);

  const updateRecipient = (key: keyof AtelierRecipient, value: string) => {
    setRecipient((current) => ({ ...current, [key]: value }));
  };

  const selectChannel = (nextChannel: ShareChannel) => {
    setChannel(nextChannel);
  };

  const prepareSharePreview = async () => {
    setIsPreparingPreview(true);
    setPreviewError(null);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(question.question_id)}/share-preview`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient,
            actor: "service-technique",
            ttl_days: 30,
          }),
        },
      );

      const payload = (await res.json().catch(() => null)) as AtelierSharePreview & {
        detail?: string;
        message?: string;
      } | null;
      if (!res.ok || !payload?.previews) {
        throw new Error(apiErrorMessage(res.status, payload?.detail || payload?.message));
      }

      setSharePreview(payload);
      return payload;
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Erreur inconnue pendant la prévisualisation.");
      return null;
    } finally {
      setIsPreparingPreview(false);
    }
  };

  const fetchQuestionDetailForShare = async () => {
    const res = await fetch(buildUrl(`/atelier/questions/${encodeURIComponent(question.question_id)}`), {
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(res.status, payload?.detail || payload?.message));
    const detailQuestion = questionFromResponse(payload);
    if (!detailQuestion) throw new Error("Détail Atelier invalide : question absente.");
    return detailQuestion;
  };

  const sendShare = async () => {
    setIsSendingShare(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const preview = sharePreview || (await prepareSharePreview());
      if (!preview?.previews) {
        throw new Error("Prévisualisation requise avant l'envoi.");
      }

      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(question.question_id)}/send`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            recipient,
            actor: "service-technique",
            ttl_days: 30,
          }),
        },
      );

      const payload = (await res.json().catch(() => null)) as AtelierSendResponse | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(apiErrorMessage(res.status, payload?.error || payload?.detail || payload?.message));
      }

      const updatedQuestion = payload?.question || (await fetchQuestionDetailForShare());
      onQuestionUpdated(updatedQuestion);
      const recipientLabel = recipient.name || recipient.company || recipient.email || recipient.phone || "destinataire";
      setSendSuccess(`Réponse envoyée à ${recipientLabel} par ${shareChannelLabel[channel] || channel}.`);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur inconnue pendant l'envoi.");
    } finally {
      setIsSendingShare(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-[440px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Partager la réponse</h2>
              <p className="text-xs text-slate-500">Préparation du message destinataire</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer le panneau de partage"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Réponse sélectionnée</p>
              <p className="mt-2 line-clamp-3 text-sm font-medium text-slate-900">
                {question.question || "Question sans titre"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{question.sources?.length || 0} source{question.sources?.length && question.sources.length > 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{draftVisualRefs.length} visuel{draftVisualRefs.length > 1 ? "s" : ""}</span>
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Canal</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectChannel("WHATSAPP")}
                  className={[
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition",
                    channel === "WHATSAPP"
                      ? "border-orange-500 bg-orange-50 font-semibold text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  ].join(" ")}
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => selectChannel("EMAIL")}
                  className={[
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition",
                    channel === "EMAIL"
                      ? "border-orange-500 bg-orange-50 font-semibold text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  ].join(" ")}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destinataire</p>
              <input
                value={recipient.name || ""}
                onChange={(event) => updateRecipient("name", event.target.value)}
                placeholder="Nom du destinataire"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <input
                value={recipient.company || ""}
                onChange={(event) => updateRecipient("company", event.target.value)}
                placeholder="Entreprise (optionnel)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <input
                value={recipient.phone || ""}
                onChange={(event) => updateRecipient("phone", event.target.value)}
                placeholder="Téléphone WhatsApp"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <input
                value={recipient.email || ""}
                onChange={(event) => updateRecipient("email", event.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contenu partagé</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <p className="text-lg font-semibold text-slate-950">{question.draft?.answer_blocks?.length || 0}</p>
                  <p className="text-xs text-slate-500">blocs</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <p className="text-lg font-semibold text-slate-950">{question.sources?.length || 0}</p>
                  <p className="text-xs text-slate-500">sources</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <p className="text-lg font-semibold text-slate-950">{initialIncludedIds.length}</p>
                  <p className="text-xs text-slate-500">visuels</p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visuels inclus dans la page</p>
                <span className="text-xs text-slate-400">
                  {initialIncludedIds.length}/{draftVisualRefs.length}
                </span>
              </div>
              {draftVisualRefs.length ? (
                <div className="space-y-2">
                  {draftVisualRefs.map((ref, index) => {
                    const id = visualRefId(ref, index);
                    const imageUrl = normalizeAssetUrl(ref.url);
                    const checked = initialIncludedIds.includes(id);

                    return (
                      <div
                        key={id}
                        className={[
                          "flex gap-3 rounded-xl border p-3",
                          checked ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-1 h-3 w-3 rounded-full",
                            checked ? "bg-emerald-500" : "bg-slate-300",
                          ].join(" ")}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{ref.kind || "visual_ref"}</span>
                            {ref.page ? <span>Page {ref.page}</span> : null}
                          </div>
                          {imageUrl ? (
                            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt={`Visuel partage page ${ref.page || index + 1}`}
                                className="h-auto max-h-40 w-full object-contain"
                              />
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400">Image indisponible</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Aucun visuel sélectionnable pour cette réponse.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Prévisualisation</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Le lien public reprend la réponse sauvegardée dans l&apos;écran principal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void prepareSharePreview()}
                  disabled={isPreparingPreview}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isPreparingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isPreparingPreview ? "Préparation..." : "Prévisualiser"}
                </button>
              </div>

              {previewError ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {previewError}
                </div>
              ) : null}

              {sharePreview?.previews ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page web</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {sharePreview.previews.web?.title || "Réponse Atelier"}
                    </p>
                    {sharePreview.previews.web?.public_url ? (
                      <a
                        href={sharePreview.previews.web.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex max-w-full items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sharePreview.previews.web.public_url}</span>
                      </a>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {sharePreview.previews.web?.visual_count ?? initialIncludedIds.length} visuel
                      {(sharePreview.previews.web?.visual_count ?? initialIncludedIds.length) > 1 ? "s" : ""} inclus
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Message {channel === "EMAIL" ? "email" : "WhatsApp"} généré
                    </p>
                    {channel === "EMAIL" ? (
                      <>
                        <p className="mt-3 text-xs text-slate-500">
                          Pour : {sharePreview.previews.email?.to || recipient.email || "email non renseigné"}
                        </p>
                        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                          {sharePreview.previews.email?.subject || "Réponse technique PERGE"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        Vers : {sharePreview.previews.whatsapp?.to || recipient.phone || "téléphone non renseigné"}
                      </p>
                    )}
                    <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                      <p className="whitespace-pre-wrap">
                        {channel === "EMAIL"
                          ? sharePreview.previews.email?.body || ""
                          : sharePreview.previews.whatsapp?.body || ""}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Renseignez le destinataire, puis cliquez sur Prévisualiser.
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          {sharePreview?.previews && !sendError && !sendSuccess ? (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Prévisualisation prête. Vous pouvez envoyer la réponse.
            </div>
          ) : null}
          {sendError ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {sendError}
            </div>
          ) : null}
          {sendSuccess ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {sendSuccess}
            </div>
          ) : null}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => void sendShare()}
              disabled={isPreparingPreview || isSendingShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSendingShare || isPreparingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSendingShare
                ? "Envoi en cours..."
                : isPreparingPreview
                  ? "Préparation..."
                  : `Envoyer par ${shareChannelLabel[channel] || channel}`}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function chantierIdFromReference(reference: string) {
  const normalized = reference
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `CHANTIER_${Date.now()}`;
}

function productCodeForGuide(product: string, indexedProducts: AtelierProduct[]) {
  const value = safeStr(product);
  if (!value) return "";
  const exact = indexedProducts.find(
    (item) =>
      item.product_code.toLowerCase() === value.toLowerCase() ||
      safeStr(item.product_label).toLowerCase() === value.toLowerCase(),
  );
  return exact?.product_code || value;
}

function guideBackendError(status: number, payload: GuideCreationResponse | null, fallback: string) {
  const message = safeStr(payload?.detail || payload?.message || payload?.error);
  if (message) return message;
  if (status === 404) return "Chantier introuvable.";
  if (status === 400) return "Champs requis manquants ou invalides.";
  return fallback;
}

function GuidePreparationPanel({
  indexedProducts,
  onOpenGuideReview,
}: {
  indexedProducts: AtelierProduct[];
  onOpenGuideReview: (chantierId: string) => void;
}) {
  const [mode, setMode] = useState<GuidePreparationMode>("existing");
  const [step, setStep] = useState<GuidePreparationStep>("setup");
  const [form, setForm] = useState<GuidePreparationForm>({
    chantierId: "",
    reference: "",
    installerCompany: "",
    installerName: "",
    installerPhone: "",
    installerEmail: "",
    product: "",
    configurationText: "",
  });
  const [existingSearch, setExistingSearch] = useState("");
  const [selectedChantier, setSelectedChantier] = useState<GuideChantierDetail | null>(null);
  const [isLoadingChantier, setIsLoadingChantier] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const updateForm = (patch: Partial<GuidePreparationForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const resetForMode = (nextMode: GuidePreparationMode) => {
    setMode(nextMode);
    setStep("setup");
    setError(null);
    setWarning(null);
    setSelectedChantier(null);
    setExistingSearch("");
    setForm({
      chantierId: "",
      reference: "",
      installerCompany: "",
      installerName: "",
      installerPhone: "",
      installerEmail: "",
      product: "",
      configurationText: "",
    });
  };

  const hydrateFromChantier = (chantier: GuideChantierDetail, chantierId: string) => {
    const context = chantier.context || {};
    const installer = context.installateur || {};
    updateForm({
      chantierId: safeStr(chantier.chantier_id || chantier.id, chantierId),
      reference: safeStr(context.reference_chantier) || safeStr(chantier.title) || chantierId,
      product: safeStr(context.produit),
      installerCompany: safeStr(installer.company),
      installerName: safeStr(installer.name),
      installerPhone: safeStr(installer.phone),
      installerEmail: safeStr(installer.email),
      configurationText: safeStr(context.configuration_text),
    });
  };

  const loadExistingChantier = async () => {
    const chantierId = existingSearch.trim();
    if (!chantierId || isLoadingChantier) return;

    setIsLoadingChantier(true);
    setError(null);
    setWarning(null);

    try {
      const res = await fetch(buildUrl(`/chantiers/${encodeURIComponent(chantierId)}`), {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as GuideChantierDetail & GuideCreationResponse | null;
      if (!res.ok || !payload) {
        throw new Error(guideBackendError(res.status, payload, "Impossible de charger ce chantier."));
      }
      setSelectedChantier(payload);
      hydrateFromChantier(payload, chantierId);
    } catch (err) {
      setSelectedChantier(null);
      setError(err instanceof Error ? err.message : "Impossible de charger ce chantier.");
    } finally {
      setIsLoadingChantier(false);
    }
  };

  const canAnalyze =
    safeStr(form.configurationText).length > 0 &&
    safeStr(form.product).length > 0 &&
    (mode === "existing" ? safeStr(form.chantierId).length > 0 : safeStr(form.reference).length > 0);

  const generationSteps = [
    "Création chantier",
    "Génération du guide",
    "Génération des points",
    "Ouverture de la revue",
  ];

  const generateGuide = async () => {
    if (!canAnalyze || isGeneratingGuide) return;

    setIsGeneratingGuide(true);
    setStep("generating");
    setProgressStep(0);
    setError(null);
    setWarning(null);

    try {
      const chantierId =
        mode === "existing"
          ? safeStr(form.chantierId)
          : chantierIdFromReference(form.reference);

      if (mode === "new") {
        const chantierRes = await fetch(buildUrl(`/chantiers/${encodeURIComponent(chantierId)}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: "Service technique",
            context: {
              reference_chantier: form.reference.trim(),
              produit: form.product.trim(),
              configuration_text: form.configurationText.trim(),
              installateur: {
                source: "manual",
                company: form.installerCompany.trim(),
                name: form.installerName.trim(),
                phone: form.installerPhone.trim(),
                email: form.installerEmail.trim(),
              },
            },
          }),
        });
        const chantierPayload = (await chantierRes.json().catch(() => null)) as GuideCreationResponse | null;
        if (!chantierRes.ok) {
          throw new Error(guideBackendError(chantierRes.status, chantierPayload, "Création chantier impossible."));
        }
      }

      setProgressStep(1);
      const product = productCodeForGuide(form.product, indexedProducts);
      const guideRes = await fetch(buildUrl("/guides"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chantier_id: chantierId,
          products: [product],
          configuration_text: form.configurationText.trim(),
          title: `Guide chantier ${form.reference.trim() || chantierId}`,
          actor: "Service technique",
          generate_points: true,
          guide_point_max_points: 25,
        }),
      });

      const guidePayload = (await guideRes.json().catch(() => null)) as GuideCreationResponse | null;
      if (!guideRes.ok || guidePayload?.ok === false) {
        throw new Error(guideBackendError(guideRes.status, guidePayload, "Génération du guide impossible."));
      }

      setProgressStep(2);
      if (guidePayload?.points_generation?.ok === false) {
        setWarning(
          safeStr(guidePayload.points_generation.error) ||
            "Le guide a été créé, mais la génération des points n'a pas abouti.",
        );
      }

      setProgressStep(3);
      onOpenGuideReview(safeStr(guidePayload?.guide?.chantier_id, chantierId));
    } catch (err) {
      setStep("setup");
      setError(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  if (step === "generating") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="flex flex-col items-center gap-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
            <Sparkles className="h-6 w-6 animate-pulse text-orange-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-950">Génération du guide en cours...</p>
            <p className="mt-1 text-sm text-slate-500">PRIA prépare le guide chantier et ses points de revue.</p>
          </div>
          <div className="w-full max-w-sm space-y-2">
            {generationSteps.map((label, index) => {
              const skipped = mode === "existing" && index === 0;
              const done = skipped || progressStep > index;
              const active = progressStep === index && !skipped;
              return (
                <div
                  key={label}
                  className={[
                    "flex items-center gap-3 rounded-lg border p-3 transition",
                    done
                      ? "border-emerald-200 bg-emerald-50"
                      : active
                        ? "border-orange-200 bg-orange-50"
                        : "border-slate-100 bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white">
                    {done ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={["text-sm font-medium", done ? "text-emerald-800" : active ? "text-orange-800" : "text-slate-400"].join(" ")}>
                      {label}
                    </p>
                    {skipped ? <p className="text-xs text-emerald-600">Chantier existant sélectionné</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {warning ? (
            <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warning}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Préparer un guide chantier</h2>
          <p className="mt-1 text-sm text-slate-500">Sélectionnez un chantier ou créez un contexte minimal avant génération.</p>
        </div>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          Guide draft
        </span>
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["existing", "Chantier existant", "Utiliser le contexte chantier déjà enregistré."],
              ["new", "Nouveau chantier", "Créer un chantier minimal avant génération."],
            ] as Array<[GuidePreparationMode, string, string]>).map(([key, title, description]) => (
              <button
                key={key}
                type="button"
                onClick={() => resetForMode(key)}
                className={[
                  "rounded-xl border p-4 text-left transition",
                  mode === key ? "border-orange-300 bg-orange-50" : "border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-slate-950">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {mode === "existing" ? (
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Sélectionner le chantier</p>
            <div className="flex gap-2">
              <input
                value={existingSearch}
                onChange={(event) => setExistingSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadExistingChantier();
                }}
                placeholder="Référence ou identifiant chantier"
                className="h-11 flex-1 rounded-lg border border-slate-200 px-3.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={() => void loadExistingChantier()}
                disabled={!existingSearch.trim() || isLoadingChantier}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isLoadingChantier ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Charger
              </button>
            </div>
            {selectedChantier ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                Chantier chargé : <span className="font-semibold">{form.reference || form.chantierId}</span>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Informations du chantier</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Référence / client</span>
                <input
                  value={form.reference}
                  onChange={(event) => updateForm({ reference: event.target.value })}
                  placeholder="Ex: DUPONT"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Installateur société</span>
                <input
                  value={form.installerCompany}
                  onChange={(event) => updateForm({ installerCompany: event.target.value })}
                  placeholder="Ex: Martin Chauffage"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Téléphone installateur</span>
                <input
                  value={form.installerPhone}
                  onChange={(event) => updateForm({ installerPhone: event.target.value })}
                  placeholder="Optionnel"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email installateur</span>
                <input
                  value={form.installerEmail}
                  onChange={(event) => updateForm({ installerEmail: event.target.value })}
                  placeholder="Optionnel"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Produit / famille produit</span>
              <input
                value={form.product}
                onChange={(event) => updateForm({ product: event.target.value })}
                list="atelier-guide-products"
                placeholder="Ex: PAC"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
              />
              <datalist id="atelier-guide-products">
                {indexedProducts.map((product) => (
                  <option key={product.product_code} value={product.product_code}>
                    {productLabel(product)}
                  </option>
                ))}
              </datalist>
            </label>
            {mode === "existing" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Installateur</span>
                <input
                  value={form.installerCompany || form.installerName}
                  onChange={(event) => updateForm({ installerCompany: event.target.value })}
                  placeholder="Installateur non renseigné"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Nom installateur</span>
                <input
                  value={form.installerName}
                  onChange={(event) => updateForm({ installerName: event.target.value })}
                  placeholder="Optionnel"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-500"
                />
              </label>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-900">Description de la configuration</span>
            <textarea
              rows={6}
              value={form.configurationText}
              onChange={(event) => updateForm({ configurationText: event.target.value })}
              placeholder="Décrire librement la configuration, les équipements, contraintes et points déjà connus."
              className="min-h-36 w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </section>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setWarning(null);
              setStep("confirm");
            }}
            disabled={!canAnalyze}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Zap className="h-4 w-4" />
            Analyser la configuration
          </button>
        </div>
      </div>

      {step === "confirm" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Analyser la configuration</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950">Vérification avant génération</h3>
              </div>
              <button
                type="button"
                onClick={() => setStep("setup")}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              {[
                ["Chantier", form.reference || form.chantierId],
                ["Produit", form.product],
                ["Installateur", form.installerCompany || form.installerName || "Installateur non renseigné"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">{label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{value}</p>
                </div>
              ))}
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-400">Configuration saisie</p>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{form.configurationText}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setStep("setup")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Corriger
              </button>
              <button
                type="button"
                onClick={() => void generateGuide()}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <Zap className="h-4 w-4" />
                Générer le guide
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AtelierPage() {
  const router = useRouter();
  const [atelierMode, setAtelierMode] = useState<"question" | "guide">("question");
  const [questionText, setQuestionText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<AtelierQuestion | null>(null);
  const [history, setHistory] = useState<AtelierQuestion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [isAnswerEditing, setIsAnswerEditing] = useState(false);
  const [editableAnswerBlocks, setEditableAnswerBlocks] = useState<RenderAnswerBlock[]>([]);
  const [isSavingAnswerDraft, setIsSavingAnswerDraft] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [editedQuestionText, setEditedQuestionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answerDraftError, setAnswerDraftError] = useState<string | null>(null);
  const [answerDraftSaved, setAnswerDraftSaved] = useState(false);
  const [isPreviewingPublicAnswer, setIsPreviewingPublicAnswer] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isVisualPanelOpen, setIsVisualPanelOpen] = useState(false);
  const [expandedVisual, setExpandedVisual] = useState<ExpandedVisual | null>(null);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [indexedProducts, setIndexedProducts] = useState<AtelierProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedCorrectionProduct, setSelectedCorrectionProduct] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [manualCorrectedProduct, setManualCorrectedProduct] = useState<string | null>(null);
  const [isProductCorrectionOpen, setIsProductCorrectionOpen] = useState(false);

  const visualRefs = useMemo(
    () => selectVisualRefs(currentQuestion?.visual_refs),
    [currentQuestion?.visual_refs],
  );

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(buildUrl("/atelier/questions"), { cache: "no-store" });
      if (!res.ok) throw new Error(`Historique indisponible (${res.status})`);
      const payload = (await res.json()) as QuestionsListResponse;
      setHistory(questionListFromResponse(payload));
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadIndexedProducts = async () => {
    setIsLoadingProducts(true);
    setProductsError(null);

    try {
      const res = await fetch(buildUrl("/atelier/products"), { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as AtelierProductsResponse | null;
      if (!res.ok) throw new Error(apiErrorMessage(res.status));
      setIndexedProducts(productListFromResponse(payload).filter((product) => safeStr(product.product_code)));
    } catch (err) {
      setIndexedProducts([]);
      setProductsError(err instanceof Error ? err.message : "Produits indexés indisponibles.");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    void loadIndexedProducts();
  }, []);

  useEffect(() => {
    if (!expandedVisual) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedVisual(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expandedVisual]);

  const startNewQuestion = () => {
    setCurrentQuestion(null);
    setQuestionText("");
    setEditedQuestionText("");
    setIsEditingQuestion(false);
    setIsSharePanelOpen(false);
    setIsVisualPanelOpen(false);
    setExpandedVisual(null);
    setIsAnswerEditing(false);
    setEditableAnswerBlocks([]);
    setError(null);
    setAnswerDraftError(null);
    setAnswerDraftSaved(false);
    setPreviewError(null);
    setSelectedCorrectionProduct("");
    setIsProductDropdownOpen(false);
    setManualCorrectedProduct(null);
    setIsProductCorrectionOpen(false);
  };

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = questionText.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(buildUrl("/atelier/questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          product: null,
          components: [],
          retrieval_limit: 8,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !payload?.question) {
        throw new Error(payload?.detail || payload?.message || `Question non traitée (${res.status})`);
      }

      const createdQuestion = questionFromResponse(payload);
      if (!createdQuestion) throw new Error("Réponse Atelier invalide : question absente.");

      setCurrentQuestion(createdQuestion);
      setEditedQuestionText(createdQuestion.question || "");
      setIsEditingQuestion(false);
      setIsAnswerEditing(false);
      setEditableAnswerBlocks([]);
      setAnswerDraftSaved(false);
      setSelectedCorrectionProduct("");
      setManualCorrectedProduct(null);
      setIsProductCorrectionOpen(false);
      setQuestionText("");
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadQuestionDetail = async (questionId: string, optimisticQuestion?: AtelierQuestion) => {
    if (optimisticQuestion) {
      setCurrentQuestion(optimisticQuestion);
      setEditedQuestionText(optimisticQuestion.question || "");
      setIsEditingQuestion(false);
      setIsAnswerEditing(false);
      setEditableAnswerBlocks([]);
      setAnswerDraftSaved(false);
      setSelectedCorrectionProduct("");
      setIsProductDropdownOpen(false);
      setIsProductCorrectionOpen(false);
      setManualCorrectedProduct(null);
    }
    setIsLoadingDetail(true);
    setError(null);

    try {
      const res = await fetch(buildUrl(`/atelier/questions/${encodeURIComponent(questionId)}`), {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail || `Question indisponible (${res.status})`);
      const detailQuestion = questionFromResponse(payload);
      if (!detailQuestion) throw new Error("Détail Atelier invalide : question absente.");
      setCurrentQuestion(detailQuestion);
      setEditedQuestionText(detailQuestion.question || "");
      setIsEditingQuestion(false);
      setIsAnswerEditing(false);
      setEditableAnswerBlocks([]);
      setAnswerDraftSaved(false);
      setSelectedCorrectionProduct("");
      setIsProductDropdownOpen(false);
      setIsProductCorrectionOpen(false);
      setManualCorrectedProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la question.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const applyQuestionUpdate = (updatedQuestion: AtelierQuestion) => {
    setCurrentQuestion(updatedQuestion);
    setEditedQuestionText(updatedQuestion.question || "");
    setIsAnswerEditing(false);
    setEditableAnswerBlocks([]);
    setHistory((items) => {
      const hasExistingItem = items.some((item) => item.question_id === updatedQuestion.question_id);
      if (!hasExistingItem) return items;

      return items.map((item) =>
        item.question_id === updatedQuestion.question_id ? updatedQuestion : item,
      );
    });
  };

  const regenerateQuestion = async () => {
    if (!currentQuestion?.question_id || isRegenerating) return;

    const trimmed = editedQuestionText.trim();
    const previousQuestion = currentQuestion.question?.trim() || "";
    if (!trimmed || trimmed === previousQuestion) {
      setIsEditingQuestion(false);
      setEditedQuestionText(currentQuestion.question || "");
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(currentQuestion.question_id)}/regenerate`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            retrieval_limit: 8,
          }),
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.detail || payload?.message || `Régénération impossible (${res.status})`);
      }

      const regeneratedQuestion = questionFromResponse(payload);
      if (!regeneratedQuestion) throw new Error("Réponse Atelier invalide : question absente.");

      applyQuestionUpdate(regeneratedQuestion);
      setEditedQuestionText(regeneratedQuestion.question || "");
      setIsEditingQuestion(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant la régénération.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const regenerateWithCorrectedProduct = async () => {
    if (!currentQuestion?.question_id || !selectedCorrectionProduct || isRegenerating) return;

    const question = safeStr(currentQuestion.question);
    if (!question) return;

    setIsRegenerating(true);
    setError(null);
    setSelectedCorrectionProduct(selectedCorrectionProduct);

    try {
      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(currentQuestion.question_id)}/regenerate`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            product: selectedCorrectionProduct,
            components,
            retrieval_limit: 8,
          }),
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.detail || payload?.message || `Régénération impossible (${res.status})`);
      }

      const regeneratedQuestion = questionFromResponse(payload);
      if (!regeneratedQuestion) throw new Error("Réponse Atelier invalide : question absente.");

      applyQuestionUpdate(regeneratedQuestion);
      setManualCorrectedProduct(selectedCorrectionProduct);
      setEditedQuestionText(regeneratedQuestion.question || "");
      setIsEditingQuestion(false);
      setIsProductDropdownOpen(false);
      setIsProductCorrectionOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant la régénération.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const startAnswerEdit = () => {
    if (!answerBlocks.length) return;
    setEditableAnswerBlocks(answerBlocks.map((block) => ({ ...block })));
    setIsAnswerEditing(true);
    setIsSharePanelOpen(false);
    setAnswerDraftError(null);
    setAnswerDraftSaved(false);
  };

  const cancelAnswerEdit = () => {
    setEditableAnswerBlocks([]);
    setIsAnswerEditing(false);
    setAnswerDraftError(null);
  };

  const updateEditableAnswerBlock = (
    blockId: string,
    field: "title" | "text",
    value: string,
  ) => {
    setEditableAnswerBlocks((blocks) =>
      blocks.map((block) =>
        block.block_id === blockId ? { ...block, [field]: value } : block,
      ),
    );
  };

  const saveAnswerDraft = async () => {
    if (!currentQuestion?.question_id || !editableAnswerBlocks.length || isSavingAnswerDraft) return;

    setIsSavingAnswerDraft(true);
    setAnswerDraftError(null);
    setAnswerDraftSaved(false);

    try {
      const normalizedBlocks = editableAnswerBlocks.map((block, index) => ({
        ...block,
        title: safeStr(block.title) || null,
        text: safeStr(block.text),
        source_ids: block.source_ids || [],
        visual_ref_ids: block.visual_ref_ids || [],
        order: block.order ?? index,
      }));

      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(currentQuestion.question_id)}/draft`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer_text: answerBlocksToText(normalizedBlocks),
            answer_blocks: normalizedBlocks,
            composition_status: "COMPOSED",
            composition_reason: "Réponse modifiée manuellement dans l'Atelier.",
            updated_by: "service-technique",
          }),
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, payload?.detail || payload?.message));
      }

      const updatedQuestion = questionFromResponse(payload);
      if (!updatedQuestion) throw new Error("Réponse Atelier invalide : question absente.");

      applyQuestionUpdate(updatedQuestion);
      setAnswerDraftSaved(true);
      void loadHistory();
    } catch (err) {
      setAnswerDraftError(err instanceof Error ? err.message : "Erreur inconnue pendant la sauvegarde.");
    } finally {
      setIsSavingAnswerDraft(false);
    }
  };

  const previewPublicAnswer = async () => {
    if (!currentQuestion?.question_id || isPreviewingPublicAnswer) return;

    setIsPreviewingPublicAnswer(true);
    setPreviewError(null);

    try {
      const res = await fetch(
        buildUrl(`/atelier/questions/${encodeURIComponent(currentQuestion.question_id)}/public-link`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: "service-technique",
            ttl_days: 30,
          }),
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, payload?.detail || payload?.message));
      }

      const publicUrl = safeStr(payload?.public_url || payload?.url || payload?.publication?.public_url);
      const slug = safeStr(payload?.slug || payload?.publication?.slug);
      const previewUrl = publicUrl || (slug ? `/atelier/r/${encodeURIComponent(slug)}` : "");

      if (!previewUrl) {
        throw new Error("Lien public indisponible dans la réponse backend.");
      }

      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Impossible de prévisualiser la réponse.");
    } finally {
      setIsPreviewingPublicAnswer(false);
    }
  };

  const product = currentQuestion?.product || currentQuestion?.detected_product;
  const components =
    currentQuestion?.components?.length
      ? currentQuestion.components
      : currentQuestion?.detected_components || [];
  const availableCorrectionProducts = currentQuestion?.meta?.available_products?.length
    ? currentQuestion.meta.available_products
    : indexedProducts;
  const requiresProductCorrection = needsProductCorrection(currentQuestion);
  const showProductCorrection = requiresProductCorrection || isProductCorrectionOpen;
  const unsupportedProduct = unsupportedDetectedProduct(currentQuestion);
  const selectedCorrectionProductLabel =
    availableCorrectionProducts.find((item) => item.product_code === selectedCorrectionProduct)?.product_label ||
    availableCorrectionProducts.find((item) => item.product_code === selectedCorrectionProduct)?.product_code ||
    "";
  const correctedProductLabel =
    availableCorrectionProducts.find((item) => item.product_code === manualCorrectedProduct)?.product_label ||
    availableCorrectionProducts.find((item) => item.product_code === manualCorrectedProduct)?.product_code ||
    currentQuestion?.product ||
    "";
  const isManualProduct = Boolean(manualCorrectedProduct) || currentQuestion?.classification_source === "manual_review";
  const revisionCount = currentQuestion?.meta?.revision_count || 0;
  const answerBlocks = useMemo(
    () => getPrimaryAnswerBlocks(currentQuestion),
    [currentQuestion],
  );
  const sourcesById = useMemo(
    () => buildSourcesById(currentQuestion),
    [currentQuestion],
  );
  const visualRefsById = useMemo(
    () => buildVisualRefsById(currentQuestion),
    [currentQuestion],
  );
  const usedAnswerVisualRefIds = useMemo(
    () => new Set(answerBlocks.flatMap((block) => block.visual_ref_ids)),
    [answerBlocks],
  );
  const supplementaryVisualRefs = useMemo(
    () => dedupeVisualRefs(getSupplementaryVisualRefs(currentQuestion, usedAnswerVisualRefIds)),
    [currentQuestion, usedAnswerVisualRefIds],
  );
  const answerBlockVisualsByBlockId = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, VisualRef[]>();

    answerBlocks.forEach((block) => {
      const refs = block.visual_ref_ids
        .map((id) => visualRefsById.get(id))
        .filter((ref): ref is VisualRef => Boolean(ref))
        .filter((ref) => normalizeAssetUrl(ref.url))
        .filter((ref) => {
          const key = visualRefDedupeKey(ref);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      map.set(block.block_id, refs);
    });

    return map;
  }, [answerBlocks, visualRefsById]);
  const responseVisualRefs = useMemo(
    () =>
      dedupeVisualRefs([...Array.from(answerBlockVisualsByBlockId.values()).flat(), ...supplementaryVisualRefs])
        .filter((ref) => normalizeAssetUrl(ref.url)),
    [answerBlockVisualsByBlockId, supplementaryVisualRefs],
  );
  const responseVisualSourcesByKey = useMemo(() => {
    const map = new Map<string, AtelierSource>();

    answerBlocks.forEach((block) => {
      const firstSource = block.source_ids
        .map((id) => sourcesById.get(id))
        .find((source): source is AtelierSource => Boolean(source));
      if (!firstSource) return;

      (answerBlockVisualsByBlockId.get(block.block_id) || []).forEach((ref) => {
        map.set(visualRefDedupeKey(ref), firstSource);
      });
    });

    return map;
  }, [answerBlocks, answerBlockVisualsByBlockId, sourcesById]);
  const visibleAnswerBlocks = isAnswerEditing ? editableAnswerBlocks : answerBlocks;

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-8 py-8">
          <section className="min-w-0 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Atelier PRIA
                </div>
                <h1 className="text-2xl font-semibold text-slate-950">
                  {atelierMode === "guide" ? "Préparer un guide chantier" : "Demander à l'Atelier"}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {atelierMode === "guide"
                    ? "Préparez la configuration puis ouvrez la vraie revue service technique du chantier."
                    : "Posez une question technique libre. L'Atelier répond avec les sources documentaires produit et les extraits visuels disponibles."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {atelierMode === "question" && currentQuestion ? (
                  <button
                    type="button"
                    onClick={startNewQuestion}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Nouvelle question
                  </button>
                ) : null}
                {atelierMode === "question" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistoryPanelOpen(true);
                      void loadHistory();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                    Historique
                    {history.length ? (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">
                        {history.length}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[
                ["question", "Question Atelier", Sparkles],
                ["guide", "Préparer un guide chantier", BookOpen],
              ].map(([mode, label, Icon]) => {
                const active = atelierMode === mode;
                return (
                  <button
                    key={mode as string}
                    type="button"
                    onClick={() => {
                      setAtelierMode(mode as "question" | "guide");
                      setError(null);
                      setIsHistoryPanelOpen(false);
                    }}
                    className={[
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      active ? "bg-orange-600 text-white" : "text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {label as string}
                  </button>
                );
              })}
            </div>

            {atelierMode === "guide" ? (
              <GuidePreparationPanel
                indexedProducts={indexedProducts}
                onOpenGuideReview={(chantierId) => {
                  router.push(`/sav/sessions/${encodeURIComponent(chantierId)}?tab=GUIDE`);
                }}
              />
            ) : !currentQuestion ? (
            <form onSubmit={submitQuestion} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label htmlFor="atelier-question" className="text-sm font-semibold text-slate-900">
                Posez une question technique
              </label>
              <div className="mb-3 mt-3 flex flex-wrap gap-2">
                {[
                  "Comment raccorder le transmetteur de pression sur une PAC hybride ?",
                  "Code défaut PAC hybride",
                  "Procédure purge OptiPellet",
                  "Raccordement bus RC7",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuestionText(suggestion)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-3">
                <textarea
                  id="atelier-question"
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Comment raccorder le transmetteur de pression sur une PAC hybride ?"
                  rows={3}
                  className="min-h-24 flex-1 resize-y rounded-lg border border-slate-200 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="submit"
                  disabled={!questionText.trim() || isSubmitting}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Interroger
                </button>
              </div>
              {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </form>
            ) : null}

            {atelierMode === "question" && currentQuestion ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Question posée</span>
                        <StatusBadge status={currentQuestion.status} />
                        {revisionCount > 0 ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                            Régénérée {revisionCount} fois
                          </span>
                        ) : null}
                      </div>
                      {isEditingQuestion ? (
                        <div className="mt-2 space-y-3">
                          <textarea
                            value={editedQuestionText}
                            onChange={(event) => setEditedQuestionText(event.target.value)}
                            rows={3}
                            className="min-h-24 w-full resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            disabled={isRegenerating}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void regenerateQuestion()}
                              disabled={
                                isRegenerating ||
                                !editedQuestionText.trim() ||
                                editedQuestionText.trim() === (currentQuestion.question?.trim() || "")
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isRegenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              {isRegenerating ? "Régénération..." : "Régénérer"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditedQuestionText(currentQuestion.question || "");
                                setIsEditingQuestion(false);
                              }}
                              disabled={isRegenerating}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-start gap-3">
                          <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-950">
                            {currentQuestion.question}
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              setEditedQuestionText(currentQuestion.question || "");
                              setIsEditingQuestion(true);
                            }}
                            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Modifier
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="space-y-5">
                    {showProductCorrection ? (
                      <div className="overflow-visible rounded-xl border border-amber-300 bg-white shadow-sm">
                        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-amber-900">
                              {unsupportedProduct ? "Produit détecté sans notice indexée" : "Produit à préciser"}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
                              {unsupportedProduct
                                ? `« ${unsupportedProduct} » a été détecté automatiquement mais aucune documentation n'est disponible pour ce produit. La recherche n'a retourné aucune source et la réponse ne peut pas être générée.`
                                : "Aucune documentation indexée n'a permis d'identifier un produit principal exploitable. Sélectionnez un produit couvert avant de relancer la recherche."}
                            </p>
                          </div>
                          {unsupportedProduct ? (
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 line-through opacity-60">
                                {unsupportedProduct}
                              </span>
                              <span className="text-xs font-medium text-amber-500">non indexé</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4 px-5 py-4">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Sélectionner le produit principal
                            </label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsProductDropdownOpen((value) => !value)}
                                disabled={Boolean(productsError) || isLoadingProducts || !availableCorrectionProducts.length}
                                className={[
                                  "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition",
                                  selectedCorrectionProduct
                                    ? "border-orange-400 bg-orange-50 font-medium text-orange-800"
                                    : "border-slate-200 bg-white text-slate-400 hover:border-slate-300",
                                  productsError || isLoadingProducts || !availableCorrectionProducts.length
                                    ? "cursor-not-allowed opacity-60"
                                    : "",
                                ].join(" ")}
                              >
                                <span className="truncate">
                                  {selectedCorrectionProductLabel || "— Choisir un produit avec notices indexées"}
                                </span>
                                {isLoadingProducts ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                                ) : (
                                  <ChevronDown
                                    className={[
                                      "h-4 w-4 shrink-0 transition-transform duration-150",
                                      isProductDropdownOpen ? "rotate-180" : "",
                                      selectedCorrectionProduct ? "text-orange-500" : "text-slate-400",
                                    ].join(" ")}
                                  />
                                )}
                              </button>

                              {isProductDropdownOpen && !productsError && availableCorrectionProducts.length ? (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setIsProductDropdownOpen(false)} />
                                  <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                                      <p className="text-xs text-slate-500">
                                        {availableCorrectionProducts.length} produit{availableCorrectionProducts.length > 1 ? "s" : ""} avec notices indexées
                                      </p>
                                    </div>
                                    {availableCorrectionProducts.map((item) => (
                                      <button
                                        key={item.product_code}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCorrectionProduct(item.product_code);
                                          setIsProductDropdownOpen(false);
                                        }}
                                        className={[
                                          "flex w-full items-center justify-between gap-3 border-b border-slate-50 px-4 py-2.5 text-left text-sm transition last:border-0 hover:bg-orange-50",
                                          selectedCorrectionProduct === item.product_code
                                            ? "bg-orange-50 font-semibold text-orange-800"
                                            : "text-slate-700",
                                        ].join(" ")}
                                      >
                                        <span className="truncate">{productLabel(item)}</span>
                                        <span className="flex shrink-0 items-center gap-1.5">
                                          <span className="text-xs font-medium text-emerald-600">
                                            {indexedNoticeLabel(item.indexed_document_count)}
                                          </span>
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        </span>
                                      </button>
                                    ))}
                                    {unsupportedProduct ? (
                                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                                        <p className="text-xs text-slate-400">
                                          « {unsupportedProduct} » — <span className="text-amber-600">aucune notice indexée</span>
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                </>
                              ) : null}
                            </div>
                            {productsError ? (
                              <p className="mt-2 text-xs text-red-600">
                                Produits indexés indisponibles. La correction produit est désactivée.
                              </p>
                            ) : null}
                          </div>

                          {components.length ? (
                            <div>
                              <p className="mb-1.5 text-xs text-slate-500">
                                Composants conservés de la détection automatique :
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {components.map((component) => (
                                  <span key={component} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {component}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => void regenerateWithCorrectedProduct()}
                              disabled={!selectedCorrectionProduct || isRegenerating || Boolean(productsError)}
                              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isRegenerating ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Régénération...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4" />
                                  Régénérer la réponse
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                        <span
                          className={[
                            "shrink-0 text-xs font-bold uppercase tracking-wide",
                            isManualProduct ? "text-orange-500" : "text-slate-400",
                          ].join(" ")}
                        >
                          {isManualProduct ? "Produit corrigé" : "Détection auto."}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                          {product || correctedProductLabel ? (
                            <span className="inline-flex max-w-full rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                              <span className="truncate">{correctedProductLabel || product}</span>
                            </span>
                          ) : null}
                          {components.length ? (
                            components.map((component) => (
                              <span
                                key={component}
                                className="inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                              >
                                <span className="truncate">{component}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Aucun composant détecté</span>
                          )}
                          {isManualProduct ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              <Edit2 className="h-2.5 w-2.5" />
                              Manuel
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCorrectionProduct(currentQuestion?.product || "");
                            setIsProductCorrectionOpen(true);
                          }}
                          className="shrink-0 text-xs text-slate-400 hover:text-orange-600"
                        >
                          {isManualProduct ? "Modifier" : "Corriger"}
                        </button>
                      </div>
                    )}

                    {showProductCorrection ? (
                      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                          <AlertCircle className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="mb-1 font-semibold text-slate-800">Réponse indisponible</p>
                        <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                          Aucune notice n&apos;a été trouvée pour le produit détecté. Sélectionnez un produit indexé dans la section ci-dessus et régénérez la réponse.
                        </p>
                        <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            0 source trouvée
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Génération non lancée
                          </span>
                        </div>
                      </div>
                    ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-950">Réponse</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          {isAnswerEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={cancelAnswerEdit}
                                disabled={isSavingAnswerDraft}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveAnswerDraft()}
                                disabled={isSavingAnswerDraft || !editableAnswerBlocks.length}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isSavingAnswerDraft ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                {isSavingAnswerDraft ? "Enregistrement..." : "Enregistrer"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={startAnswerEdit}
                                disabled={!answerBlocks.length || isRegenerating}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Edit2 className="h-4 w-4" />
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => void previewPublicAnswer()}
                                disabled={!answerBlocks.length || isRegenerating || isPreviewingPublicAnswer}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isPreviewingPublicAnswer ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Monitor className="h-4 w-4" />
                                )}
                                {isPreviewingPublicAnswer ? "Prévisualisation..." : "Prévisualiser"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsSharePanelOpen(true)}
                                disabled={!answerBlocks.length || isRegenerating}
                                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                <Send className="h-4 w-4" />
                                Partager
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {answerDraftError ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {answerDraftError}
                        </div>
                      ) : answerDraftSaved ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                          Réponse modifiée enregistrée.
                        </div>
                      ) : null}
                      {isAnswerEditing ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                          <AlertCircle className="h-4 w-4 shrink-0 text-orange-600" />
                          Mode modification - éditez les blocs visibles, puis enregistrez avant de partager.
                        </div>
                      ) : null}
                      {previewError ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {previewError}
                        </div>
                      ) : null}
                      {currentQuestion.status === "NEEDS_PRODUCT" ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          L&apos;Atelier a besoin d&apos;un produit plus précis avant de produire une réponse fiable.
                        </div>
                      ) : null}
                      {currentQuestion.status === "FAILED" ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          La génération de réponse a échoué côté backend.
                        </div>
                      ) : null}
                      {visibleAnswerBlocks.length ? (
                        <>
                          <div className="mt-4 divide-y divide-slate-100">
                            {visibleAnswerBlocks.map((block) => {
                              const blockSources = block.source_ids
                                .map((id) => sourcesById.get(id))
                                .filter((source): source is AtelierSource => Boolean(source));
                              const blockVisuals = answerBlockVisualsByBlockId.get(block.block_id) || [];
                              const primaryVisual = blockVisuals[0];
                              const primarySource = blockSources[0] || null;

                              return (
                                <article key={block.block_id} className="py-5 first:pt-0 last:pb-0">
                                  <div
                                    className={[
                                      "grid gap-5",
                                      primaryVisual ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "",
                                    ].join(" ")}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          {isAnswerEditing ? (
                                            <input
                                              value={safeStr(block.title)}
                                              onChange={(event) =>
                                                updateEditableAnswerBlock(block.block_id, "title", event.target.value)
                                              }
                                              placeholder="Titre du bloc"
                                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                                            />
                                          ) : block.title ? (
                                            <h4 className="text-sm font-semibold text-slate-950">{block.title}</h4>
                                          ) : null}
                                          {block.confidence ? (
                                            <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                                              Confiance {block.confidence}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>

                                      {isAnswerEditing ? (
                                        <textarea
                                          value={safeStr(block.text)}
                                          onChange={(event) =>
                                            updateEditableAnswerBlock(block.block_id, "text", event.target.value)
                                          }
                                          rows={Math.max(4, safeStr(block.text).split("\n").length + 2)}
                                          className="mt-3 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                                        />
                                      ) : block.text ? (
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                          {block.text}
                                        </p>
                                      ) : null}

                                      {blockSources.length ? (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          {blockSources.map((source, index) => (
                                            <span
                                              key={source.source_id || `${block.block_id}-source-${index}`}
                                              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                                            >
                                              <FileText className="h-3 w-3 shrink-0 text-slate-400" />
                                              <span className="truncate">
                                                {sourceKind(source)} - {sourceCompactLabel(source)}
                                              </span>
                                              <span className="shrink-0 font-mono text-slate-400">
                                                {compactPagesLabel(source.pages)}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>

                                    {primaryVisual ? (
                                      <AnswerNoticeVisualCard
                                        refData={primaryVisual}
                                        index={0}
                                        source={primarySource}
                                        onExpand={setExpandedVisual}
                                        compact
                                      />
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>

                          {responseVisualRefs.length ? (
                            <div className="mt-5 border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => setIsVisualPanelOpen((value) => !value)}
                                className="group flex w-full items-center justify-between px-1 py-3 text-left transition-colors hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-2">
                                  <Maximize2 className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-600" />
                                  <span className="text-xs font-medium text-slate-500 transition-colors group-hover:text-slate-700">
                                    {responseVisualRefs.length} extrait{responseVisualRefs.length > 1 ? "s" : ""} visuel{responseVisualRefs.length > 1 ? "s" : ""} utilisé{responseVisualRefs.length > 1 ? "s" : ""} dans cette réponse
                                  </span>
                                </span>
                                <ChevronDown
                                  className={[
                                    "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                                    isVisualPanelOpen ? "rotate-180" : "",
                                  ].join(" ")}
                                />
                              </button>

                              {isVisualPanelOpen ? (
                                <div className="grid gap-3 pb-5 sm:grid-cols-2">
                                  {responseVisualRefs.map((ref, index) => (
                                    <AnswerNoticeVisualCard
                                      key={`response-visual-${visualRefId(ref, index)}`}
                                      refData={ref}
                                      index={index}
                                      source={responseVisualSourcesByKey.get(visualRefDedupeKey(ref)) || currentQuestion.sources?.[0] || null}
                                      onExpand={setExpandedVisual}
                                      compact
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="-mx-5 -mb-5 mt-5 border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                              Sources documentaires
                            </p>
                            {currentQuestion.sources?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {currentQuestion.sources.map((source, index) => {
                                  const sourceUrl = normalizeAssetUrl(source.source_url);
                                  const content = (
                                    <>
                                      <FileText className="h-3 w-3 shrink-0 text-slate-400" />
                                      <span className="truncate">{sourceCompactLabel(source)}</span>
                                      <span className="shrink-0 font-mono text-slate-400">
                                        {compactPagesLabel(source.pages)}
                                      </span>
                                      {sourceUrl ? <ExternalLink className="ml-1 h-3 w-3 shrink-0 text-slate-300" /> : null}
                                    </>
                                  );
                                  const className =
                                    "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-orange-300";

                                  return sourceUrl ? (
                                    <a
                                      key={source.source_id || `${source.document_id}-${index}`}
                                      href={sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={className}
                                    >
                                      {content}
                                    </a>
                                  ) : (
                                    <span
                                      key={source.source_id || `${source.document_id}-${index}`}
                                      className={className}
                                    >
                                      {content}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Aucune source documentaire disponible.</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                          Aucune réponse texte disponible pour cette question.
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <Sparkles className="mx-auto h-8 w-8 text-orange-500" />
                <h2 className="mt-3 text-base font-semibold text-slate-950">Aucune question sélectionnée</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Posez une question ou ouvrez une entrée de l&apos;historique pour consulter la réponse et ses sources.
                </p>
              </div>
            )}
          </section>

          {currentQuestion && isSharePanelOpen ? (
            <SharePanel
              question={currentQuestion}
              visualRefs={visualRefs}
              onQuestionUpdated={applyQuestionUpdate}
              onClose={() => setIsSharePanelOpen(false)}
            />
          ) : null}

          {isHistoryPanelOpen ? (
            <>
              <div className="fixed inset-0 z-40 bg-slate-950/20" onClick={() => setIsHistoryPanelOpen(false)} />
              <aside className="fixed right-0 top-0 z-50 flex h-screen w-96 max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">Historique</h2>
                <div className="flex items-center gap-2">
                  {isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  <button
                    type="button"
                    onClick={() => setIsHistoryPanelOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Fermer l'historique"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {history.length ? (
                  <div className="space-y-1">
                    {history.map((item) => {
                      const active = currentQuestion?.question_id === item.question_id;
                      const itemProduct = item.product || item.detected_product;
                      const itemComponents = item.components?.length
                        ? item.components
                        : item.detected_components || [];
                      const shareSummary = item.share_summary;
                      const isShared = Boolean(
                        shareSummary?.has_been_shared ||
                        shareSummary?.send_count ||
                        shareSummary?.has_publication,
                      );
                      const shareChannel = shareSummary?.last_channel
                        ? shareChannelLabel[shareSummary.last_channel] || shareSummary.last_channel
                        : "";
                      const rawShareStatus = shareSummary?.last_status || shareSummary?.last_send_status;
                      const shareStatus = rawShareStatus
                        ? shareStatusLabel[rawShareStatus] || rawShareStatus
                        : "";
                      const shareRecipient = shareRecipientLabel(shareSummary);
                      const shareDate = shareSummaryDate(shareSummary);

                      return (
                        <button
                          key={item.question_id}
                          type="button"
                          onClick={() => {
                            setIsHistoryPanelOpen(false);
                            void loadQuestionDetail(item.question_id, item);
                          }}
                          className={[
                            "w-full rounded-lg px-3 py-3 text-left transition",
                            active ? "bg-orange-50" : "hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <StatusBadge status={item.status} />
                            <ArrowRight className="h-4 w-4 text-slate-300" />
                          </div>
                          <p className="line-clamp-2 text-sm font-medium text-slate-900">
                            {item.question || "Question sans titre"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {itemProduct ? (
                              <span className="inline-flex max-w-full rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                <span className="truncate">{itemProduct}</span>
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                Produit non identifié
                              </span>
                            )}
                            {itemComponents.slice(0, 3).map((component) => (
                              <span
                                key={component}
                                className="inline-flex max-w-full rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                              >
                                <span className="truncate">{component}</span>
                              </span>
                            ))}
                            {itemComponents.length > 3 ? (
                              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                                +{itemComponents.length - 3}
                              </span>
                            ) : null}
                          </div>
                          {isShared ? (
                            <div
                              className={[
                                "mt-2 rounded-lg border px-2.5 py-2 text-xs",
                                shareSummary?.last_status === "FAILED"
                                  || shareSummary?.last_send_status === "FAILED"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                <span>{shareStatus || "Partagé"}</span>
                                {shareChannel ? <span>· {shareChannel}</span> : null}
                                {shareRecipient ? <span>· {shareRecipient}</span> : null}
                              </div>
                              {shareSummary?.last_error ? (
                                <p className="mt-1 line-clamp-2 text-red-600">
                                  {shareSummary.last_error}
                                </p>
                              ) : shareDate ? (
                                <p className="mt-1 text-emerald-600">{shareDate}</p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {item.created_at || item.updated_at ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {formatDateTime(item.created_at || item.updated_at)}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-slate-500">
                    {isLoadingHistory ? "Chargement..." : "Aucune question enregistrée pour le moment."}
                  </p>
                )}
              </div>
              {isLoadingDetail ? (
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  Chargement de la question...
                </div>
              ) : null}
              </aside>
            </>
          ) : null}

          {expandedVisual ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-5"
              role="dialog"
              aria-modal="true"
              aria-label="Aperçu agrandi du visuel notice"
              onClick={() => setExpandedVisual(null)}
            >
              <div
                className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-950">{expandedVisual.title}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{expandedVisual.meta}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {expandedVisual.sourceUrl ? (
                      <a
                        href={expandedVisual.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpandedVisual(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Fermer l'aperçu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={expandedVisual.imageUrl}
                    alt={expandedVisual.title}
                    className="mx-auto max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-lg bg-white object-contain shadow-sm"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
