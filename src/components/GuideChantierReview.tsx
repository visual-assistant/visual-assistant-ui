"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Droplets,
  Edit2,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Monitor,
  Package,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Snowflake,
  User,
  Wifi,
  Wind,
  X,
  Zap,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_INTERNAL_API ||
  "http://localhost:8001";

const ACTOR = "Service technique";

type GuideStatus = "draft" | "approved" | "sent" | "archived" | string;
type PointPlacement = "main" | "secondary" | "hidden" | string;
type GuideTiming =
  | "before_work"
  | "during_work"
  | "startup_or_delivery"
  | "maintenance"
  | "troubleshooting"
  | string;
type DomainCategory =
  | "hydraulique"
  | "fumisterie"
  | "electrique"
  | "regulation_connectivite"
  | "manutention_implantation"
  | "refrigerant_securite"
  | string;

type VisualRef = {
  kind?: string | null;
  page?: number | null;
  url?: string | null;
  relative_path?: string | null;
  width?: number | null;
  height?: number | null;
};

type SourceRef = {
  document_id?: string | null;
  document_title?: string | null;
  knowledge_id?: string | null;
  item_type?: string | null;
  item_id?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  anchor_id?: string | null;
  anchor_title?: string | null;
  anchor_kind?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  excerpt?: string | null;
  visual_refs?: VisualRef[] | null;
};

type GuidePoint = {
  point_id: string;
  guide_id?: string | null;
  title?: string | null;
  content?: string | null;
  detail?: string | null;
  timing?: GuideTiming | null;
  domain_category?: DomainCategory | null;
  placement?: PointPlacement | null;
  knowledge_ids?: string[] | null;
  source_refs?: SourceRef[] | null;
  edited?: boolean | null;
  review?: {
    note?: string | null;
    updated_by?: string | null;
    updated_at?: number | string | null;
  } | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  badges?: string[] | null;
};

type PointsResponse = {
  ok?: boolean;
  guide_id?: string;
  points?: {
    schema_version?: string;
    items?: GuidePoint[];
    summary?: {
      count?: number;
      main_count?: number;
      secondary_count?: number;
      hidden_count?: number;
    };
  };
  placements?: string[];
};

type PointsSummary = NonNullable<NonNullable<PointsResponse["points"]>["summary"]>;

export type GuideDetail = {
  guide_id?: string | null;
  id?: string | null;
  title?: string | null;
  status?: GuideStatus | null;
  chantier_id?: string | null;
  products?: string[] | null;
  configuration_snapshot?: unknown;
  applicability?: unknown;
  points?: PointsResponse["points"] | GuidePoint[] | null;
  corrections?: unknown[] | null;
  review?: {
    required?: boolean | null;
    approved_by?: string | null;
    approved_at?: number | string | null;
    note?: string | null;
  } | null;
  delivery?: {
    status?: string | null;
    channel?: string | null;
    sent_at?: number | string | null;
    public_url?: string | null;
    public_slug?: string | null;
    recipient_phone?: string | null;
    recipient_name?: string | null;
    recipient_company?: string | null;
  } | null;
  usage_stats?: {
    view_count?: number | null;
    last_viewed_at?: number | string | null;
  } | null;
};

type ChantierDetail = {
  chantier_id?: string | null;
  id?: string | null;
  title?: string | null;
  context?: {
    reference_chantier?: string | null;
    nom_chantier?: string | null;
    produit?: string | null;
    installateur?: {
      company?: string | null;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

type InstallerPreviewPoint = Omit<GuidePoint, "review"> & {
  id?: string | null;
  placement?: Exclude<PointPlacement, "hidden"> | string | null;
  sources?: SourceRef[] | null;
  sourceRefs?: SourceRef[] | null;
};

type InstallerPreviewDomain = {
  domain_category?: DomainCategory | null;
  label?: string | null;
  point_count?: number | null;
  main_points?: InstallerPreviewPoint[] | null;
  secondary_points?: InstallerPreviewPoint[] | null;
};

type InstallerPreviewTiming = {
  timing?: GuideTiming | null;
  label?: string | null;
  point_count?: number | null;
  domains?: InstallerPreviewDomain[] | null;
};

type AdministrativeContact = {
  label?: string | null;
  role?: string | null;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type InstallerPreviewResponse = {
  ok?: boolean;
  schema_version?: string;
  guide?: {
    guide_id?: string | null;
    title?: string | null;
    status?: string | null;
    products?: string[] | null;
  } | null;
  chantier?: {
    chantier_id?: string | null;
    title?: string | null;
    reference?: string | null;
    product?: string | null;
    configuration_text?: string | null;
    installer?: {
      name?: string | null;
      company?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  } | null;
  summary?: {
    main_count?: number | null;
    secondary_count?: number | null;
    hidden_count?: number | null;
    visible_count?: number | null;
    timing_count?: number | null;
  } | null;
  timings?: InstallerPreviewTiming[] | null;
  administrative_contacts?: AdministrativeContact[] | null;
};

type GuideShareRecipient = {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
};

type GuideShareResponse = {
  ok?: boolean;
  guide?: GuideDetail | null;
  public_url?: string | null;
  public_slug?: string | null;
  created?: boolean | null;
  created_public_link?: boolean | null;
  prepared_message?: {
    channel?: string | null;
    to?: string | null;
    recipient?: GuideShareRecipient | null;
    body?: string | null;
    public_url?: string | null;
  } | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
  code?: string | null;
};

type EditablePoint = {
  title: string;
  content: string;
  detail: string;
  timing: string;
  domain_category: string;
  placement: string;
  review_note: string;
  reusable: boolean;
  raw_instruction: string;
};

type GuideChantierReviewProps = {
  guideId: string;
  embedded?: boolean;
};

const TIMINGS: Array<{ key: GuideTiming; label: string }> = [
  { key: "before_work", label: "Avant chantier" },
  { key: "during_work", label: "Installation" },
  { key: "startup_or_delivery", label: "Mise en service" },
  { key: "maintenance", label: "Maintenance" },
  { key: "troubleshooting", label: "Dépannage" },
];

const DOMAIN_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    Icon: React.ComponentType<{ className?: string }>;
    tone: string;
    iconTone: string;
  }
> = {
  hydraulique: {
    label: "Hydraulique",
    shortLabel: "Hydro",
    Icon: Droplets,
    tone: "bg-sky-50 text-sky-700 border-sky-100",
    iconTone: "bg-sky-100 text-sky-700",
  },
  fumisterie: {
    label: "Fumisterie",
    shortLabel: "Fumisterie",
    Icon: Wind,
    tone: "bg-slate-50 text-slate-700 border-slate-100",
    iconTone: "bg-slate-100 text-slate-700",
  },
  electrique: {
    label: "Électrique",
    shortLabel: "Élec",
    Icon: Zap,
    tone: "bg-yellow-50 text-yellow-700 border-yellow-100",
    iconTone: "bg-yellow-100 text-yellow-700",
  },
  regulation_connectivite: {
    label: "Régulation / connectivité",
    shortLabel: "Régulation",
    Icon: Wifi,
    tone: "bg-violet-50 text-violet-700 border-violet-100",
    iconTone: "bg-violet-100 text-violet-700",
  },
  manutention_implantation: {
    label: "Manutention / implantation",
    shortLabel: "Implantation",
    Icon: Package,
    tone: "bg-orange-50 text-orange-700 border-orange-100",
    iconTone: "bg-orange-100 text-orange-700",
  },
  refrigerant_securite: {
    label: "Réfrigérant / sécurité",
    shortLabel: "Sécurité",
    Icon: Snowflake,
    tone: "bg-red-50 text-red-700 border-red-100",
    iconTone: "bg-red-100 text-red-700",
  },
};

const PLACEMENTS: Array<{ key: PointPlacement; label: string }> = [
  { key: "main", label: "Principal" },
  { key: "secondary", label: "Secondaire" },
  { key: "hidden", label: "Masqué" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeStr(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function get(obj: unknown, path: string, fallback?: unknown) {
  try {
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const part of parts) {
      if (cur === null || cur === undefined || typeof cur !== "object") return fallback;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur === undefined ? fallback : cur;
  } catch {
    return fallback;
  }
}

function apiUrl(path: string) {
  return new URL(path, API_BASE).toString();
}

async function readJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur API ${res.status}`);
  }
  return (await res.json()) as T;
}

function responseDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  return safeStr(record.detail) || safeStr(record.message) || safeStr(record.error);
}

function shareErrorMessage(status: number, payload: unknown) {
  const detail = responseDetail(payload);
  const code =
    payload && typeof payload === "object"
      ? safeStr((payload as Record<string, unknown>).code) || detail
      : detail;

  if (status === 409 && code.includes("guide_not_approved")) {
    return "Validez le guide avant l’envoi WhatsApp.";
  }
  if (status === 400 && code.includes("missing_recipient_phone")) {
    return "Renseignez un numéro WhatsApp installateur.";
  }
  return detail || "";
}

function normalizeAssetUrl(url?: string | null) {
  const s = safeStr(url);
  if (!s) return "";
  if (/^[a-zA-Z]:\\/.test(s) || s.startsWith("\\\\")) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return new URL(s, API_BASE).toString();
  return new URL(`/${s}`, API_BASE).toString();
}

function timingLabel(value?: string | null) {
  return TIMINGS.find((item) => item.key === value)?.label || safeStr(value, "Non classé");
}

function domainMeta(value?: string | null) {
  const key = safeStr(value, "autre");
  return (
    DOMAIN_META[key] || {
      label: key || "Autre",
      shortLabel: key || "Autre",
      Icon: FileText,
      tone: "bg-slate-50 text-slate-700 border-slate-100",
      iconTone: "bg-slate-100 text-slate-700",
    }
  );
}

function statusConfig(status?: string | null) {
  const s = safeStr(status, "draft").toLowerCase();
  if (s === "approved" || s === "valide" || s === "validé") {
    return { label: "Validé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (s === "sent" || s === "envoye" || s === "envoyé") {
    return { label: "Envoyé", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (s === "archived" || s === "archive" || s === "archivé") {
    return { label: "Archivé", className: "border-slate-200 bg-slate-100 text-slate-600" };
  }
  return { label: "Brouillon", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const raw = typeof value === "number" ? value * 1000 : Number(value) * 1000;
  const date = Number.isFinite(raw) ? new Date(raw) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return safeStr(value);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractPointsFromGuide(guide: GuideDetail | null) {
  if (!guide?.points) return [];
  if (Array.isArray(guide.points)) return guide.points;
  return Array.isArray(guide.points.items) ? guide.points.items : [];
}

function pointSummary(points: GuidePoint[], apiSummary?: PointsSummary) {
  return {
    count: apiSummary?.count ?? points.length,
    main_count: apiSummary?.main_count ?? points.filter((p) => p.placement === "main").length,
    secondary_count:
      apiSummary?.secondary_count ?? points.filter((p) => p.placement === "secondary").length,
    hidden_count: apiSummary?.hidden_count ?? points.filter((p) => p.placement === "hidden").length,
  };
}

function pointToEditable(point: GuidePoint): EditablePoint {
  return {
    title: safeStr(point.title),
    content: safeStr(point.content),
    detail: safeStr(point.detail),
    timing: safeStr(point.timing, "before_work"),
    domain_category: safeStr(point.domain_category, "hydraulique"),
    placement: safeStr(point.placement, "main"),
    review_note: safeStr(point.review?.note),
    reusable: false,
    raw_instruction: "",
  };
}

function Lifecycle({ status }: { status?: string | null }) {
  const current = safeStr(status, "draft").toLowerCase();
  const steps = [
    { key: "draft", label: "Brouillon" },
    { key: "approved", label: "Validé" },
    { key: "sent", label: "Envoyé" },
    { key: "archived", label: "Archivé" },
  ];
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === current),
  );

  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;
        return (
          <div
            key={step.key}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2",
              isCurrent && "bg-orange-50",
            )}
          >
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                isCurrent ? "bg-orange-500" : isPast ? "bg-emerald-400" : "bg-slate-200",
              )}
            />
            <span
              className={cx(
                "text-xs font-medium",
                isCurrent ? "text-orange-700" : isPast ? "text-emerald-700" : "text-slate-400",
              )}
            >
              {step.label}
            </span>
            {isPast ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500" /> : null}
            {isCurrent ? <span className="ml-auto text-xs font-semibold text-orange-500">actuel</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function SourcePanel({
  point,
  onClose,
}: {
  point: GuidePoint;
  onClose: () => void;
}) {
  const sources = point.source_refs || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fermer" />
      <aside className="relative z-10 flex h-full w-[440px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sources du point</p>
            <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950">
              {point.title || "Point sans titre"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer les sources"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {sources.length ? (
            <div className="space-y-3">
              {sources.map((source, index) => {
                const visualUrl = normalizeAssetUrl(source.visual_refs?.[0]?.url);
                const title =
                  safeStr(source.anchor_title) ||
                  safeStr(source.section_title) ||
                  safeStr(source.document_title) ||
                  `Source ${index + 1}`;

                return (
                  <article key={`${source.knowledge_id || source.item_id || index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {safeStr(source.document_title, "Document non renseigné")}
                          {source.page_start ? ` · p. ${source.page_start}` : ""}
                        </p>
                      </div>
                      {source.anchor_kind ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {source.anchor_kind}
                        </span>
                      ) : null}
                    </div>

                    {source.excerpt ? (
                      <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-slate-600">
                        {source.excerpt}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {source.knowledge_id ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-slate-500">
                          {source.knowledge_id}
                        </span>
                      ) : null}
                      {visualUrl ? (
                        <a
                          href={visualUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 font-medium text-orange-700 hover:bg-orange-100"
                        >
                          Voir l&apos;extrait
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500">
                          Extrait visuel indisponible
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Aucune source exploitable n&apos;est rattachée à ce point.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ReviewPointCard({
  point,
  busy,
  onPlacementChange,
  onEdit,
  onShowSources,
}: {
  point: GuidePoint;
  busy: boolean;
  onPlacementChange: (placement: PointPlacement) => void;
  onEdit: () => void;
  onShowSources: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = domainMeta(point.domain_category);
  const Icon = meta.Icon;
  const placement = safeStr(point.placement, "main");

  return (
    <article
      className={cx(
        "overflow-hidden rounded-xl border bg-white shadow-sm transition",
        placement === "main" && "border-emerald-200",
        placement === "secondary" && "border-slate-200 bg-slate-50/70",
        placement === "hidden" && "border-slate-200 bg-slate-50 opacity-70",
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.iconTone)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-950">
                {point.title || "Point sans titre"}
              </h3>
              {point.edited ? (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                  Modifié
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {timingLabel(point.timing)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {meta.label}
              </span>
              {(point.badges || []).slice(0, 3).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {point.content ? (
          <p className={cx("mt-3 text-xs leading-relaxed text-slate-700", !expanded && "line-clamp-2")}>
            {point.content}
          </p>
        ) : (
          <p className="mt-3 text-xs italic text-slate-400">Contenu installateur vide.</p>
        )}
        {point.detail && expanded ? (
          <p className="mt-2 text-xs italic leading-relaxed text-slate-500">{point.detail}</p>
        ) : null}
        {point.content || point.detail ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            {expanded ? "Voir moins" : "Voir plus"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2.5">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-medium">
          {PLACEMENTS.map((item, index) => (
            <button
              key={item.key}
              type="button"
              disabled={busy || placement === item.key}
              onClick={() => onPlacementChange(item.key)}
              className={cx(
                "px-2.5 py-1.5 transition disabled:cursor-default",
                index > 0 && "border-l border-slate-200",
                placement === item.key
                  ? item.key === "main"
                    ? "bg-emerald-600 text-white"
                    : item.key === "secondary"
                      ? "bg-slate-600 text-white"
                      : "bg-slate-400 text-white"
                  : "text-slate-500 hover:bg-slate-50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onShowSources}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5" />
            Sources
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Ajuster
          </button>
        </div>

        {point.review?.note ? (
          <p className="w-full text-xs italic text-slate-500">
            <span className="font-medium">Note :</span> {point.review.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function previewPointId(point: InstallerPreviewPoint, fallback: string) {
  return safeStr(point.point_id) || safeStr(point.id) || fallback;
}

function previewPointTitle(point: InstallerPreviewPoint) {
  return safeStr(point.title, "Point sans titre");
}

function previewPointSources(
  point: InstallerPreviewPoint,
  fallbackSourcesByPointId?: Map<string, SourceRef[]>,
) {
  const directSources =
    (Array.isArray(point.source_refs) && point.source_refs) ||
    (Array.isArray(point.sources) && point.sources) ||
    (Array.isArray(point.sourceRefs) && point.sourceRefs) ||
    [];

  if (directSources.length) return directSources;

  const pointId = previewPointId(point, "");
  return pointId ? fallbackSourcesByPointId?.get(pointId) || [] : [];
}

function previewSourceTitle(source: SourceRef, index: number) {
  return (
    safeStr(source.anchor_title) ||
    safeStr(source.section_title) ||
    safeStr(source.document_title) ||
    `Source ${index + 1}`
  );
}

function InstallerSourceBlock({ sources }: { sources?: SourceRef[] | null }) {
  const sourceList = Array.isArray(sources) ? sources : [];

  if (!sourceList.length) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div>
          <p className="text-xs font-semibold text-slate-500">Source</p>
          <p className="mt-0.5 text-xs text-slate-400">Aucune source visible dans la preview.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
      {sourceList.slice(0, 3).map((source, index) => {
        const visualUrl = normalizeAssetUrl(source.visual_refs?.[0]?.url);
        return (
          <div key={`${source.knowledge_id || source.item_id || index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700">{previewSourceTitle(source, index)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {safeStr(source.document_title, "Document non renseigné")}
                  {source.page_start ? ` · p. ${source.page_start}` : ""}
                </p>
                {source.excerpt ? (
                  <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-600">{source.excerpt}</p>
                ) : null}
              </div>
            </div>
            {visualUrl ? (
              <a
                href={visualUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
              >
                Voir l&apos;extrait
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function InstallerPointRow({
  point,
  secondary,
  onOpen,
}: {
  point: InstallerPreviewPoint;
  secondary?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-slate-50",
        secondary && "opacity-75",
      )}
    >
      <span
        className={cx(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          secondary ? "bg-slate-300" : "bg-orange-500",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cx("block text-sm font-semibold leading-snug", secondary ? "text-slate-700" : "text-slate-950")}>
          {previewPointTitle(point)}
        </span>
        {point.content ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500">{point.content}</span>
        ) : null}
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}

function AdministrativeContactsBlock({ contacts }: { contacts?: AdministrativeContact[] | null }) {
  const items = Array.isArray(contacts) ? contacts : [];
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts PERGE</p>
      <div className="mt-3 space-y-2.5">
        {items.map((contact, index) => {
          const title =
            safeStr(contact.label) ||
            safeStr(contact.role) ||
            safeStr(contact.name) ||
            safeStr(contact.company) ||
            `Contact ${index + 1}`;
          const phone = safeStr(contact.phone);
          const email = safeStr(contact.email);
          return (
            <div key={`${title}-${index}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700">{title}</p>
                <p className="truncate text-xs text-slate-400">{phone || email || "Contact non renseigné"}</p>
              </div>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100"
                  aria-label={`Appeler ${title}`}
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InstallerPreviewWebapp({
  preview,
  fallbackSourcesByPointId,
}: {
  preview: InstallerPreviewResponse;
  fallbackSourcesByPointId?: Map<string, SourceRef[]>;
}) {
  const visibleTimings = useMemo(
    () => (preview.timings || []).filter((item) => (item.point_count ?? 0) > 0 || (item.domains || []).some((domain) => (domain.point_count ?? 0) > 0)),
    [preview.timings],
  );
  const [selectedTiming, setSelectedTiming] = useState<string>(() => safeStr(visibleTimings[0]?.timing, "before_work"));
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<InstallerPreviewPoint | null>(null);

  const activeTimingKey = visibleTimings.some((item) => safeStr(item.timing) === selectedTiming)
    ? selectedTiming
    : safeStr(visibleTimings[0]?.timing, "before_work");
  const activeTiming = visibleTimings.find((item) => safeStr(item.timing) === activeTimingKey) || visibleTimings[0] || null;
  const domains = (activeTiming?.domains || []).filter((domain) => {
    const main = domain.main_points || [];
    const secondary = domain.secondary_points || [];
    return main.length + secondary.length > 0;
  });
  const activeDomain = selectedDomain
    ? domains.find((domain) => safeStr(domain.domain_category) === selectedDomain) || null
    : null;

  const chantierTitle =
    safeStr(preview.chantier?.title) ||
    safeStr(preview.chantier?.reference) ||
    "Guide chantier";
  const product =
    safeStr(preview.chantier?.product) ||
    (preview.guide?.products || []).filter(Boolean).join(", ") ||
    "Produit non renseigné";
  const installer =
    safeStr(preview.chantier?.installer?.company) ||
    safeStr(preview.chantier?.installer?.name) ||
    "Installateur";

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-orange-600 px-5 pb-4 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white/20">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">PRIA · PERGE</span>
            </div>
            <span className="truncate text-xs text-orange-100">{installer}</span>
          </div>
          <h2 className="text-base font-bold leading-tight text-white">{preview.guide?.title || chantierTitle}</h2>
          <p className="mt-0.5 text-xs text-orange-100">{product}</p>

          {visibleTimings.length ? (
            <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
              {visibleTimings.map((item) => {
                const key = safeStr(item.timing);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTiming(key);
                      setSelectedDomain(null);
                      setSelectedPoint(null);
                    }}
                    className={cx(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      activeTimingKey === key ? "bg-white text-orange-700" : "bg-white/20 text-white hover:bg-white/30",
                    )}
                  >
                    {safeStr(item.label) || timingLabel(key)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative min-h-[440px] bg-white">
          {!visibleTimings.length ? (
            <div className="p-8 text-center text-sm text-slate-400">Aucun point visible dans la preview installateur.</div>
          ) : selectedPoint ? (
            <div>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedPoint(null)}
                  className="rounded p-1 transition hover:bg-slate-100"
                  aria-label="Retour au domaine"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-slate-950">{previewPointTitle(selectedPoint)}</p>
                  <p className="text-xs text-slate-400">{activeDomain?.label || domainMeta(selectedPoint.domain_category).label}</p>
                </div>
                {selectedPoint.placement === "secondary" ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Secondaire</span>
                ) : null}
              </div>

              <div className="space-y-4 p-5">
                {selectedPoint.content ? (
                  <p className="text-sm leading-relaxed text-slate-800">{selectedPoint.content}</p>
                ) : null}
                {selectedPoint.detail ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-1 text-xs font-semibold text-amber-700">À noter</p>
                    <p className="text-xs leading-relaxed text-amber-700">{selectedPoint.detail}</p>
                  </div>
                ) : null}

                <InstallerSourceBlock sources={previewPointSources(selectedPoint, fallbackSourcesByPointId)} />

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-400"
                  >
                    <Eye className="h-4 w-4 shrink-0 text-violet-300" />
                    Marquer comme vu
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-400"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    Question via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          ) : activeDomain ? (
            <div className="divide-y divide-slate-50">
              <div className={cx("flex items-center gap-3 px-5 py-4", domainMeta(activeDomain.domain_category).tone)}>
                <button
                  type="button"
                  onClick={() => setSelectedDomain(null)}
                  className="rounded p-1 transition hover:bg-black/10"
                  aria-label="Retour aux domaines"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                {(() => {
                  const meta = domainMeta(activeDomain.domain_category);
                  const Icon = meta.Icon;
                  return <Icon className="h-5 w-5" />;
                })()}
                <div>
                  <p className="text-sm font-semibold text-slate-950">{activeDomain.label || domainMeta(activeDomain.domain_category).label}</p>
                  <p className="text-xs text-slate-500">
                    {(activeDomain.main_points || []).length + (activeDomain.secondary_points || []).length} point
                    {(activeDomain.main_points || []).length + (activeDomain.secondary_points || []).length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {(activeDomain.main_points || []).map((point, index) => (
                <InstallerPointRow
                  key={previewPointId(point, `main-${index}`)}
                  point={point}
                  onOpen={() => setSelectedPoint(point)}
                />
              ))}

              {(activeDomain.secondary_points || []).length ? (
                <>
                  <div className="bg-slate-50 px-5 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">À garder en tête</p>
                  </div>
                  {(activeDomain.secondary_points || []).map((point, index) => (
                    <InstallerPointRow
                      key={previewPointId(point, `secondary-${index}`)}
                      point={point}
                      secondary
                      onOpen={() => setSelectedPoint(point)}
                    />
                  ))}
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {safeStr(activeTiming?.label) || timingLabel(activeTiming?.timing)} · {activeTiming?.point_count ?? 0} point
                {(activeTiming?.point_count ?? 0) > 1 ? "s" : ""}
              </p>

              {domains.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {domains.map((domain) => {
                    const meta = domainMeta(domain.domain_category);
                    const Icon = meta.Icon;
                    const count = (domain.main_points || []).length + (domain.secondary_points || []).length;
                    return (
                      <button
                        key={safeStr(domain.domain_category)}
                        type="button"
                        onClick={() => setSelectedDomain(safeStr(domain.domain_category))}
                        className={cx("min-h-[92px] rounded-2xl border p-3 text-left transition hover:shadow-sm", meta.tone)}
                      >
                        <Icon className="h-5 w-5" />
                        <p className="mt-2 text-xs font-bold leading-snug">{domain.label || meta.label}</p>
                        <p className="mt-1 text-xs opacity-70">
                          {count} point{count > 1 ? "s" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">Aucun point pour ce timing</p>
              )}

              <AdministrativeContactsBlock contacts={preview.administrative_contacts} />

              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white opacity-70"
              >
                <MessageSquare className="h-4 w-4" />
                Poser une question sur ce chantier
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InstallPreviewModal({
  preview,
  fallbackSourcesByPointId,
  loading,
  error,
  onClose,
  onRetry,
}: {
  preview: InstallerPreviewResponse | null;
  fallbackSourcesByPointId?: Map<string, SourceRef[]>;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const title =
    safeStr(preview?.chantier?.reference) ||
    safeStr(preview?.chantier?.title) ||
    safeStr(preview?.guide?.title) ||
    "Guide chantier";
  const product =
    safeStr(preview?.chantier?.product) ||
    (preview?.guide?.products || []).filter(Boolean).join(", ") ||
    "Produit non renseigné";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Fermer" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100">
              <Shield className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">Vue installateur · Guide chantier</p>
              <p className="truncate text-sm font-semibold text-slate-950">
                {title} · {product}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer l'aperçu installateur"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
          {loading ? (
            <div className="flex min-h-[520px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                Chargement de l&apos;aperçu installateur...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[520px] items-center justify-center p-6">
              <div className="rounded-2xl border border-red-200 bg-white p-5 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
                <p className="mt-3 text-sm font-semibold text-slate-950">Aperçu indisponible</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              </div>
            </div>
          ) : preview ? (
            <InstallerPreviewWebapp preview={preview} fallbackSourcesByPointId={fallbackSourcesByPointId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AjusterModal({
  point,
  saving,
  error,
  onClose,
  onSave,
}: {
  point: GuidePoint;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (editable: EditablePoint) => void;
}) {
  const [form, setForm] = useState<EditablePoint>(() => pointToEditable(point));
  const canSave = form.title.trim().length > 0 && !saving;

  const update = (patch: Partial<EditablePoint>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ajuster ce point</p>
            <h2 className="mt-1 truncate text-sm font-semibold text-slate-950">{point.title || "Point sans titre"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <section className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pour ce guide</p>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Titre</span>
                <input
                  value={form.title}
                  onChange={(event) => update({ title: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Contenu installateur</span>
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={(event) => update({ content: event.target.value })}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Détail / note complémentaire <span className="font-normal text-slate-400">(optionnel)</span>
                </span>
                <textarea
                  rows={3}
                  value={form.detail}
                  onChange={(event) => update({ detail: event.target.value })}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Timing</span>
                  <div className="space-y-1">
                    {TIMINGS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => update({ timing: item.key })}
                        className={cx(
                          "w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition",
                          form.timing === item.key
                            ? "bg-orange-100 text-orange-700"
                            : "text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Domaine</span>
                  <div className="space-y-1">
                    {Object.entries(DOMAIN_META).map(([key, meta]) => {
                      const Icon = meta.Icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update({ domain_category: key })}
                          className={cx(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition",
                            form.domain_category === key
                              ? "bg-orange-100 text-orange-700"
                              : "text-slate-600 hover:bg-slate-100",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Placement</span>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium">
                  {PLACEMENTS.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => update({ placement: item.key })}
                      className={cx(
                        "flex-1 py-2 transition",
                        index > 0 && "border-l border-slate-200",
                        form.placement === item.key
                          ? "bg-orange-600 text-white"
                          : "text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Note de revue</span>
                <textarea
                  rows={2}
                  value={form.review_note}
                  onChange={(event) => update({ review_note: event.target.value })}
                  placeholder="Note interne courte pour expliquer l'ajustement."
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.reusable}
                  onChange={(event) => update({ reusable: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Réutiliser cette correction pour les prochains guides
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    La correction sera proposée à PRIA en texte libre, sans choisir de type de mémoire.
                  </span>
                </span>
              </label>

              {form.reusable ? (
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Expliquez à PRIA ce qui doit changer à l&apos;avenir
                  </span>
                  <textarea
                    rows={4}
                    value={form.raw_instruction}
                    onChange={(event) => update({ raw_instruction: event.target.value })}
                    placeholder="Ex. Pour les prochains guides R32, ne pas utiliser une notice R290 comme source installateur."
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
              ) : null}
            </section>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={!canSave || (form.reusable && !form.raw_instruction.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuideChantierReview({ guideId, embedded = false }: GuideChantierReviewProps) {

  const [guide, setGuide] = useState<GuideDetail | null>(null);
  const [chantierDetail, setChantierDetail] = useState<ChantierDetail | null>(null);
  const [pointsResponse, setPointsResponse] = useState<PointsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<GuideTiming>("before_work");
  const [showHidden, setShowHidden] = useState(false);
  const [editingPoint, setEditingPoint] = useState<GuidePoint | null>(null);
  const [sourcePoint, setSourcePoint] = useState<GuidePoint | null>(null);
  const [savingPointId, setSavingPointId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [installerPreview, setInstallerPreview] = useState<InstallerPreviewResponse | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shareBusy, setShareBusy] = useState<"link" | "preview" | "send" | "copy" | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<string | null>(null);

  const loadGuide = useCallback(async () => {
    setError(null);
    const [guideData, pointsData] = await Promise.all([
      readJson<GuideDetail>(`/guides/${encodeURIComponent(guideId)}`),
      readJson<PointsResponse>(`/guides/${encodeURIComponent(guideId)}/points`),
    ]);
    setGuide(guideData);
    setPointsResponse(pointsData);

    const chantierId = safeStr(guideData.chantier_id);
    if (!chantierId) {
      setChantierDetail(null);
      return;
    }

    try {
      const chantierData = await readJson<ChantierDetail>(`/chantiers/${encodeURIComponent(chantierId)}`);
      setChantierDetail(chantierData);
    } catch {
      setChantierDetail(null);
    }
  }, [guideId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadGuide()
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Impossible de charger le guide chantier.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadGuide]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setActionMessage(null);
    try {
      await loadGuide();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rafraîchir le guide.");
    } finally {
      setRefreshing(false);
    }
  }, [loadGuide]);

  const points = useMemo(() => {
    const endpointPoints = pointsResponse?.points?.items;
    if (Array.isArray(endpointPoints)) return endpointPoints;
    return extractPointsFromGuide(guide);
  }, [guide, pointsResponse]);

  const summary = useMemo(() => pointSummary(points, pointsResponse?.points?.summary), [points, pointsResponse]);
  const visiblePoints = useMemo(() => points.filter((point) => point.placement !== "hidden"), [points]);
  const hiddenPoints = useMemo(() => points.filter((point) => point.placement === "hidden"), [points]);
  const sourcesByPointId = useMemo(() => {
    const map = new Map<string, SourceRef[]>();
    for (const point of points) {
      if (point.point_id && Array.isArray(point.source_refs) && point.source_refs.length) {
        map.set(point.point_id, point.source_refs);
      }
    }
    return map;
  }, [points]);

  const timingCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of visiblePoints) {
      const key = safeStr(item.timing, "before_work");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [visiblePoints]);

  const groups = useMemo(() => {
    const pointsForTiming = visiblePoints.filter((point) => safeStr(point.timing, "before_work") === timing);
    const byDomain = new Map<string, GuidePoint[]>();
    for (const point of pointsForTiming) {
      const key = safeStr(point.domain_category, "autre");
      byDomain.set(key, [...(byDomain.get(key) || []), point]);
    }
    return Array.from(byDomain.entries()).map(([domain, items]) => ({ domain, items }));
  }, [timing, visiblePoints]);

  const guideTitle =
    safeStr(guide?.title) ||
    safeStr(chantierDetail?.title) ||
    `Guide chantier ${guideId}`;
  const chantierTitle =
    safeStr(chantierDetail?.title) ||
    safeStr(chantierDetail?.context?.reference_chantier) ||
    safeStr(chantierDetail?.context?.nom_chantier) ||
    safeStr(guide?.chantier_id, "Chantier non renseigné");
  const installer =
    safeStr(chantierDetail?.context?.installateur?.company) ||
    safeStr(chantierDetail?.context?.installateur?.name) ||
    "Installateur non renseigné";
  const installerPhone = safeStr(chantierDetail?.context?.installateur?.phone);
  const installerEmail = safeStr(chantierDetail?.context?.installateur?.email);
  const configurationText =
    safeStr(get(guide?.configuration_snapshot, "configuration_text")) ||
    "Configuration non renseignée";
  const product =
    safeStr(chantierDetail?.context?.produit) ||
    (Array.isArray(guide?.products) ? guide?.products?.filter(Boolean).join(", ") : "") ||
    "Produit non renseigné";
  const status = statusConfig(guide?.status);
  const guideStatus = safeStr(guide?.status, "draft").toLowerCase();
  const canSendWhatsapp = guideStatus === "approved" || guideStatus === "sent";
  const sentAt = safeStr(guide?.delivery?.sent_at);
  const whatsappPreviewUrl = publicUrl || "Lien généré au moment de l’envoi";

  useEffect(() => {
    setPublicUrl(safeStr(guide?.delivery?.public_url));
  }, [guide?.delivery?.public_url]);

  useEffect(() => {
    setRecipientName(safeStr(chantierDetail?.context?.installateur?.name));
    setRecipientCompany(safeStr(chantierDetail?.context?.installateur?.company));
    setRecipientPhone(safeStr(chantierDetail?.context?.installateur?.phone));
  }, [
    chantierDetail?.context?.installateur?.company,
    chantierDetail?.context?.installateur?.name,
    chantierDetail?.context?.installateur?.phone,
  ]);

  const patchPoint = useCallback(
    async (pointId: string, payload: Record<string, unknown>) => {
      const res = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/points/${encodeURIComponent(pointId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actor: ACTOR }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erreur PATCH ${res.status}`);
      }
      return res.json().catch(() => null);
    },
    [guideId],
  );

  const updatePlacement = useCallback(
    async (point: GuidePoint, placement: PointPlacement) => {
      setSavingPointId(point.point_id);
      setSaveError(null);
      setActionMessage(null);
      try {
        await patchPoint(point.point_id, { placement });
        await loadGuide();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Impossible de modifier le placement.");
      } finally {
        setSavingPointId(null);
      }
    },
    [loadGuide, patchPoint],
  );

  const savePoint = useCallback(
    async (editable: EditablePoint) => {
      if (!editingPoint) return;
      setSavingPointId(editingPoint.point_id);
      setSaveError(null);
      setActionMessage(null);
      try {
        await patchPoint(editingPoint.point_id, {
          title: editable.title,
          content: editable.content,
          detail: editable.detail,
          timing: editable.timing,
          domain_category: editable.domain_category,
          placement: editable.placement,
          review_note: editable.review_note,
        });

        if (editable.reusable && editable.raw_instruction.trim()) {
          const correctionRes = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/corrections`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              point_id: editingPoint.point_id,
              raw_instruction: editable.raw_instruction.trim(),
              actor: ACTOR,
            }),
          });
          if (!correctionRes.ok) {
            const text = await correctionRes.text().catch(() => "");
            throw new Error(text || `Erreur correction ${correctionRes.status}`);
          }
        }

        setEditingPoint(null);
        setActionMessage(editable.reusable ? "Point ajusté et correction proposée." : "Point ajusté.");
        await loadGuide();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Impossible d'enregistrer l'ajustement.");
      } finally {
        setSavingPointId(null);
      }
    },
    [editingPoint, guideId, loadGuide, patchPoint],
  );

  const approveGuide = useCallback(async () => {
    setApproving(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/review/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: ACTOR }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erreur validation ${res.status}`);
      }
      setActionMessage("Guide validé.");
      await loadGuide();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de valider le guide.");
    } finally {
      setApproving(false);
    }
  }, [guideId, loadGuide]);

  const loadInstallerPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const preview = await readJson<InstallerPreviewResponse>(
        `/guides/${encodeURIComponent(guideId)}/installer-preview`,
      );
      setInstallerPreview(preview);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Impossible de charger l'aperçu installateur.");
    } finally {
      setPreviewLoading(false);
    }
  }, [guideId]);

  const openInstallerPreview = useCallback(() => {
    setPreviewOpen(true);
    void loadInstallerPreview();
  }, [loadInstallerPreview]);

  const shareRecipient = useMemo<GuideShareRecipient>(
    () => ({
      name: recipientName.trim() || null,
      company: recipientCompany.trim() || null,
      phone: recipientPhone.trim() || null,
    }),
    [recipientCompany, recipientName, recipientPhone],
  );

  const applyShareResponse = useCallback((payload: GuideShareResponse) => {
    if (payload.guide) {
      setGuide((current) => ({
        ...(current || {}),
        ...payload.guide,
        delivery: {
          ...(current?.delivery || {}),
          ...(payload.guide?.delivery || {}),
        },
      }));
    }
    const nextUrl =
      safeStr(payload.public_url) ||
      safeStr(payload.prepared_message?.public_url) ||
      safeStr(payload.guide?.delivery?.public_url);
    if (nextUrl) setPublicUrl(nextUrl);
  }, []);

  const createPublicLink = useCallback(async () => {
    setShareBusy("link");
    setShareError(null);
    setShareInfo(null);
    try {
      const res = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/public-link`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: ACTOR }),
      });
      const payload = (await res.json().catch(() => null)) as GuideShareResponse | null;
      if (!res.ok || !payload) throw new Error(shareErrorMessage(res.status, payload) || "Impossible de créer le lien public.");
      applyShareResponse(payload);
      setShareInfo(payload.created ? "Lien public créé." : "Lien public récupéré.");
      if (!payload.guide) await loadGuide();
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Impossible de créer le lien public.");
    } finally {
      setShareBusy(null);
    }
  }, [applyShareResponse, guideId, loadGuide]);

  const copyPublicLink = useCallback(async () => {
    if (!publicUrl) return;
    setShareBusy("copy");
    setShareError(null);
    setShareInfo(null);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setShareInfo("Lien copié.");
    } catch {
      setShareError("Copie impossible depuis ce navigateur.");
    } finally {
      setShareBusy(null);
    }
  }, [publicUrl]);

  const previewWhatsappMessage = useCallback(async () => {
    setShareBusy("preview");
    setShareError(null);
    setShareInfo(null);
    try {
      const res = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/share-preview`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: ACTOR,
          recipient: shareRecipient,
        }),
      });
      const payload = (await res.json().catch(() => null)) as GuideShareResponse | null;
      if (!res.ok || !payload) throw new Error(shareErrorMessage(res.status, payload) || "Impossible de préparer le message WhatsApp.");
      applyShareResponse(payload);
      setShareInfo("Message WhatsApp préparé.");
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Impossible de préparer le message WhatsApp.");
    } finally {
      setShareBusy(null);
    }
  }, [applyShareResponse, guideId, shareRecipient]);

  const sendWhatsappMessage = useCallback(async () => {
    setShareBusy("send");
    setShareError(null);
    setShareInfo(null);
    try {
      const res = await fetch(apiUrl(`/guides/${encodeURIComponent(guideId)}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: ACTOR,
          channel: "WHATSAPP",
          recipient: shareRecipient,
        }),
      });
      const payload = (await res.json().catch(() => null)) as GuideShareResponse | null;
      if (!res.ok || !payload) throw new Error(shareErrorMessage(res.status, payload) || "Impossible d'envoyer le WhatsApp.");
      applyShareResponse(payload);
      setShareInfo("Guide envoyé par WhatsApp.");
      if (!payload.guide) await loadGuide();
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Impossible d'envoyer le WhatsApp.");
    } finally {
      setShareBusy(null);
    }
  }, [applyShareResponse, guideId, loadGuide, shareRecipient]);

  return (
    <section className={embedded ? "space-y-5" : "min-h-screen bg-slate-50 px-6 py-6"}>
      <div className={embedded ? "mx-auto max-w-7xl" : "mx-auto max-w-7xl"}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-slate-950">Guide chantier</h1>
                  <span className={cx("rounded-full border px-3 py-1 text-xs font-semibold", status.className)}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">{guideTitle}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {chantierTitle} · {product} · {installer}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
                {summary.main_count} principaux · {summary.secondary_count} secondaires
              </span>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Rafraîchir
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {saveError && !editingPoint ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}

          {actionMessage ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {actionMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                Chargement du guide chantier...
              </div>
            </div>
          ) : points.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <BookOpen className="mx-auto h-9 w-9 text-slate-300" />
              <h2 className="mt-3 text-base font-semibold text-slate-950">Aucun guide chantier pour ce chantier</h2>
              <p className="mt-1 text-sm text-slate-500">
                Aucun point de guide n&apos;est disponible pour ce guide.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-5">
              <section className="space-y-4 lg:col-span-3">
                <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {TIMINGS.map((item) => {
                    const count = timingCounts.get(item.key) || 0;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTiming(item.key)}
                        className={cx(
                          "flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                          timing === item.key ? "bg-orange-600 text-white" : "text-slate-500 hover:bg-slate-100",
                        )}
                      >
                        {item.label}
                        {count ? (
                          <span
                            className={cx(
                              "rounded-full px-1.5 py-0.5 text-xs font-bold",
                              timing === item.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {groups.length ? (
                  groups.map(({ domain, items }) => {
                    const meta = domainMeta(domain);
                    const Icon = meta.Icon;
                    return (
                      <div key={domain} className="space-y-2">
                        <div className={cx("flex items-center gap-2 rounded-lg border px-3 py-2", meta.tone)}>
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                          <span className="ml-auto text-xs opacity-70">
                            {items.length} point{items.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {items.map((point) => (
                          <ReviewPointCard
                            key={point.point_id}
                            point={point}
                            busy={savingPointId === point.point_id}
                            onPlacementChange={(nextPlacement) => void updatePlacement(point, nextPlacement)}
                            onEdit={() => {
                              setSaveError(null);
                              setEditingPoint(point);
                            }}
                            onShowSources={() => setSourcePoint(point)}
                          />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    Aucun point visible pour ce timing.
                  </div>
                )}

                {hiddenPoints.length ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowHidden((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                    >
                      <span className="text-xs font-semibold text-slate-500">
                        Masqués pour ce guide ({hiddenPoints.length})
                      </span>
                      <ChevronDown className={cx("h-4 w-4 text-slate-400 transition", showHidden && "rotate-180")} />
                    </button>
                    {showHidden ? (
                      <div className="space-y-2 p-3">
                        {hiddenPoints.map((point) => (
                          <ReviewPointCard
                            key={point.point_id}
                            point={point}
                            busy={savingPointId === point.point_id}
                            onPlacementChange={(nextPlacement) => void updatePlacement(point, nextPlacement)}
                            onEdit={() => {
                              setSaveError(null);
                              setEditingPoint(point);
                            }}
                            onShowSources={() => setSourcePoint(point)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white py-3 text-sm font-medium text-slate-400"
                  title="Backend non disponible pour l'ajout manuel en V1"
                >
                  <FileText className="h-4 w-4" />
                  Ajouter un point manuel
                </button>

                {safeStr(guide?.status, "draft").toLowerCase() === "draft" ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">Revue service technique</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Vérifiez les points, ajustez les placements si besoin, puis validez le guide pour lever la revue.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={approveGuide}
                        disabled={approving}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Valider le guide
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-4 lg:col-span-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Cycle de vie</p>
                  <Lifecycle status={guide?.status} />
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Suivi installateur</p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Lien envoyé</span>
                      <span className="font-medium text-slate-400">
                        {safeStr(guide?.delivery?.sent_at) ? formatDateTime(guide?.delivery?.sent_at) : "Pas encore envoyé"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Guide consulté</span>
                      <span className="font-medium text-slate-500">{guide?.usage_stats?.view_count ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Dernière activité</span>
                      <span className="font-medium text-slate-400">
                        {guide?.usage_stats?.last_viewed_at ? formatDateTime(guide.usage_stats.last_viewed_at) : "—"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Actions</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={openInstallerPreview}
                      disabled={previewLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-wait disabled:bg-orange-300"
                    >
                      {previewLoading && previewOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
                      Aperçu installateur
                    </button>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Envoi installateur</p>
                    {sentAt ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Envoyé
                      </span>
                    ) : null}
                  </div>

                  {guideStatus === "draft" ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                      Validez le guide avant l&apos;envoi WhatsApp. Le lien public reste disponible en brouillon.
                    </div>
                  ) : null}

                  {sentAt ? (
                    <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      Envoyé le {formatDateTime(sentAt)}
                      {safeStr(guide?.delivery?.recipient_phone) ? ` à ${guide?.delivery?.recipient_phone}` : ""}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Lien public</label>
                      <div className="flex gap-2">
                        <input
                          value={publicUrl}
                          readOnly
                          placeholder="Aucun lien public créé"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void createPublicLink()}
                          disabled={shareBusy !== null}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          title="Créer ou récupérer le lien public"
                        >
                          {shareBusy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        </button>
                      </div>
                      {publicUrl ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void copyPublicLink()}
                            disabled={shareBusy !== null}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {shareBusy === "copy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                            Copier
                          </button>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ouvrir
                          </a>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Nom</span>
                        <input
                          value={recipientName}
                          onChange={(event) => setRecipientName(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                          placeholder="Nom installateur"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Société</span>
                        <input
                          value={recipientCompany}
                          onChange={(event) => setRecipientCompany(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                          placeholder="Société"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Numéro WhatsApp</span>
                      <input
                        value={recipientPhone}
                        onChange={(event) => setRecipientPhone(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                        placeholder="+33600000000"
                      />
                    </label>

                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Message</span>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                        <p>Bonjour, PERGE a préparé votre guide chantier pour l&apos;installation.</p>
                        <p className="mt-3">
                          Vous pouvez le consulter ici :{" "}
                          <span className={cx("font-medium", publicUrl ? "text-orange-700" : "text-slate-400")}>
                            {whatsappPreviewUrl}
                          </span>
                        </p>
                        <p className="mt-3">Le service technique PERGE reste disponible si besoin.</p>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        Message envoyé via template WhatsApp PERGE. Seul le lien du guide est personnalisé.
                      </p>
                    </div>

                    {shareError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {shareError}
                      </div>
                    ) : null}
                    {shareInfo ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                        {shareInfo}
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void previewWhatsappMessage()}
                        disabled={shareBusy !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {shareBusy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                        Prévisualiser
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendWhatsappMessage()}
                        disabled={shareBusy !== null || !canSendWhatsapp}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {shareBusy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {guideStatus === "sent" ? "Renvoyer WhatsApp" : "Envoyer WhatsApp"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Chantier</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{chantierTitle}</p>
                        <p className="text-xs text-slate-500">{guide?.chantier_id || chantierDetail?.chantier_id || chantierDetail?.id || "ID chantier indisponible"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{product}</p>
                        <p className="text-xs text-slate-500">
                          {configurationText}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{installer}</p>
                        <p className="text-xs text-slate-500">
                          {installerPhone || installerEmail || "Contact non renseigné"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Repères</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-400">Total</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{summary.count}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-400">Masqués</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{summary.hidden_count}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-400">Revue requise</p>
                      <p className="mt-1 font-semibold text-slate-950">{guide?.review?.required === false ? "Non" : "Oui"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-400">Approuvé</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {guide?.review?.approved_at ? formatDateTime(guide.review.approved_at) : "—"}
                      </p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}
      </div>

      {editingPoint ? (
        <AjusterModal
          point={editingPoint}
          saving={savingPointId === editingPoint.point_id}
          error={saveError}
          onClose={() => {
            if (!savingPointId) {
              setEditingPoint(null);
              setSaveError(null);
            }
          }}
          onSave={(editable) => void savePoint(editable)}
        />
      ) : null}

      {sourcePoint ? <SourcePanel point={sourcePoint} onClose={() => setSourcePoint(null)} /> : null}

      {previewOpen ? (
        <InstallPreviewModal
          preview={installerPreview}
          fallbackSourcesByPointId={sourcesByPointId}
          loading={previewLoading}
          error={previewError}
          onClose={() => setPreviewOpen(false)}
          onRetry={() => void loadInstallerPreview()}
        />
      ) : null}
    </section>
  );
}
