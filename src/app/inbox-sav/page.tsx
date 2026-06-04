"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type InboxInstallateur = {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;

  // Détection CRM backend
  source?: string | null;
  crm_contact_id?: string | null;
  sender_phone_norm?: string | null;
  crm_match?: {
    matched?: boolean | null;
    method?: string | null;
    confidence?: number | null;
    candidate_count?: number | null;
  } | null;
};

type InboxOverviewCard = {
  inbox_item_id: string;
  channel: "EMAIL" | "WHATSAPP" | string;
  scope: "SAV_RELEVANT" | "OUT_OF_SCOPE" | string;
  sav_type?: "PANNE" | "MISE_EN_SERVICE" | "ASSISTANCE" | null;
  status: "NEW" | "EN_COURS" | "ATTACHED" | "IGNORED" | "ARCHIVED" | string;
  title?: string | null;
  sender_display?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  installateur?: InboxInstallateur | null;
  product?: string | null;
  photo_count?: number;
  received_at?: number | null;
  updated_at?: number | null;
  last_message_at?: number | null;
  snippet?: string | null;
  linked_session_ids?: string[];
  linked_chantier_id?: string | null;
  has_photos?: boolean;
};

type InboxPhoto = {
  photo_uid: string;
  url?: string | null;
  source_name?: string | null;
  mime_type?: string | null;
  created_at?: number | null;
};

type InboxReview = {
  installateur?: InboxInstallateur | null;
  product?: string | null;
  category?: string | null;
  sub_category?: string | null;
  components?: string[] | null;
  reviewed_by?: string | null;
  reviewed_at?: number | null;
};

type InboxDetected = {
  installateur?: InboxInstallateur | null;
  product?: string | null;
  category?: string | null;
  sub_category?: string | null;
  components?: string[] | null;
};

type InboxItemDetail = {
  inbox_item_id: string;
  channel: string;
  scope: string;
  sav_type?: string | null;
  status: string;
  title?: string | null;
  raw_content_text?: string | null;
  clean_content_text?: string | null;
  sender_display?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  linked_session_ids?: string[];
  linked_chantier_id?: string | null;
  review?: InboxReview | null;
  detected?: InboxDetected | null;
  photos?: InboxPhoto[];
  photo_count?: number;
  source?: Record<string, unknown> | null;
};

type InboxOverviewColumn = {
  key: "SAV_RELEVANT" | "OUT_OF_SCOPE" | string;
  label: string;
  count: number;
  items: InboxOverviewCard[];
};

type InboxOverviewResponse = {
  count: number;
  filters: {
    channel?: string | null;
    include_closed: boolean;
  };
  columns: InboxOverviewColumn[];
  other_count: number;
};

type ChannelFilter = "ALL" | "EMAIL" | "WHATSAPP";

type ProductOption = {
  code: string;
  label: string;
};

type CatalogOption = {
  code: string;
  label: string;
};

type CatalogClassification = {
  categories: CatalogOption[];
  sub_categories: CatalogOption[];
};

type CrmCandidate = {
  name: string;
  company: string;
  email: string;
  phone: string;
  display: string;
};

type AttachChantierResult = {
  group_key: string;
  chantier_id: string;
  chantier_label?: string | null;
  installateur?: string | null;
  status?: string | null;
  owner?: string | null;
  session_ids?: string[];
};

type SavOverviewResponse = {
  chantiers?: Record<string, any>[];
  unattached_groups?: Record<string, any>[];
};

type SavSessionLite = {
  sav_session_id: string;
  title?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
  status?: string | null;
};

const DEFAULT_SAV_SESSION_ID = "SAV-001";

function channelLabel(channel?: string | null) {
  const c = (channel || "").toUpperCase();
  if (c === "EMAIL") return "Email";
  if (c === "WHATSAPP") return "WhatsApp";
  return c || "Canal";
}

function statusLabel(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (s === "NEW") return "Nouveau";
  if (s === "EN_COURS") return "En cours";
  if (s === "ATTACHED") return "Rattaché";
  if (s === "IGNORED") return "Ignoré";
  if (s === "ARCHIVED") return "Archivé";
  return status || "—";
}

function statusPillClass(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (s === "EN_COURS") return "bg-amber-100 text-amber-800";
  if (s === "ATTACHED") return "bg-emerald-100 text-emerald-800";
  if (s === "IGNORED") return "bg-neutral-200 text-neutral-700";
  return "bg-neutral-100 text-neutral-700";
}

function channelPillClass(channel?: string | null) {
  const c = (channel || "").toUpperCase();
  if (c === "EMAIL") return "bg-sky-100 text-sky-800";
  if (c === "WHATSAPP") return "bg-emerald-100 text-emerald-800";
  return "bg-neutral-100 text-neutral-700";
}

function timeAgo(ts?: number | null) {
  if (!ts) return "—";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - ts));

  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

function pickDisplayName(item: InboxOverviewCard) {
  const company = item.installateur?.company?.trim();
  const name = item.installateur?.name?.trim();

  if (company) return company;
  if (name) return name;
  if (item.sender_display?.trim()) return item.sender_display.trim();
  if (item.sender_email?.trim()) return item.sender_email.trim();
  if (item.sender_phone?.trim()) return item.sender_phone.trim();

  return "Expéditeur inconnu";
}

function pickRelevantColumn(columns: InboxOverviewColumn[]) {
  return (
    columns.find((c) => (c.key || "").toUpperCase() === "SAV_RELEVANT") || {
      key: "SAV_RELEVANT",
      label: "SAV pertinent",
      count: 0,
      items: [],
    }
  );
}

function pickOutOfScopeColumn(columns: InboxOverviewColumn[]) {
  return (
    columns.find((c) => (c.key || "").toUpperCase() === "OUT_OF_SCOPE") || {
      key: "OUT_OF_SCOPE",
      label: "Hors périmètre",
      count: 0,
      items: [],
    }
  );
}

function safeStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}

function hasInstallateurValue(inst?: InboxInstallateur | null) {
  if (!inst) return false;

  return Boolean(
    safeStr(inst.name) ||
      safeStr(inst.company) ||
      safeStr(inst.email) ||
      safeStr(inst.phone)
  );
}

function firstNonEmpty(...values: unknown[]) {
  for (const v of values) {
    const s = safeStr(v);
    if (s) return s;
  }
  return "";
}

function getReviewPanelInstallateurSource(item?: InboxItemDetail | null) {
  const detected = item?.detected || {};
  const review = item?.review || {};

  const detectedInstallateur = detected.installateur || null;
  const reviewInstallateur = review.installateur || null;

  const hasReview = hasInstallateurValue(reviewInstallateur);
  const hasDetected = hasInstallateurValue(detectedInstallateur);

  const crmMatched = Boolean(detectedInstallateur?.crm_match?.matched);
  const source = safeStr(detectedInstallateur?.source);

  return {
    detectedInstallateur,
    reviewInstallateur,
    hasReview,
    hasDetected,
    crmMatched,
    source,
    matchMethod: safeStr(detectedInstallateur?.crm_match?.method),
    confidence: detectedInstallateur?.crm_match?.confidence ?? null,
    crmContactId: safeStr(detectedInstallateur?.crm_contact_id),
  };
}

function formatCrmConfidence(confidence?: number | null) {
  if (confidence === null || confidence === undefined) return "";
  if (Number.isNaN(Number(confidence))) return "";
  return `${Math.round(Number(confidence) * 100)}%`;
}

function crmMethodLabel(method?: string | null) {
  const m = safeStr(method);

  if (m === "email_exact") return "email exact";
  if (m === "phone_exact_normalized") return "téléphone exact";

  return m || "match CRM";
}

function uniqStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;

    const key = s.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(s);
  }

  return out;
}

function normalizeSearchStr(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

function chantierStatusLabel(status?: string | null) {
  const s = (status || "").toUpperCase();

  if (s === "A_TRAITER") return "À traiter";
  if (s === "EN_ATTENTE_INTERNE") return "En attente interne";
  if (s === "EN_ATTENTE_INSTALLATEUR") return "En attente installateur";
  if (s === "RESOLU") return "Résolu";

  return status || "—";
}

function formatTs(ts?: number | null) {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

function buildAttachChantierResultFromJson(c: Record<string, any>): AttachChantierResult | null {
  const chantierId = String(
    c?.chantier_id ??
      c?.id ??
      c?.reference ??
      c?.ref ??
      ""
  ).trim();

  if (!chantierId) return null;

  const context = c?.context || {};
  const links = c?.links || {};

  const chantierLabel = String(
    context?.reference_chantier ??
      c?.title ??
      c?.nom_chantier ??
      chantierId
  ).trim();

  const installateurCompany =
    context?.societe ??
    context?.installateur?.societe ??
    context?.installateur?.company ??
    context?.installateur?.company_name ??
    context?.installateur?.companyName ??
    null;

  const installateurName =
    context?.installateur?.nom ??
    context?.installateur?.name ??
    context?.installateur?.full_name ??
    context?.installateur?.fullName ??
    null;

  const savSessions = Array.isArray(c?.sav?.sav_sessions)
    ? c.sav.sav_sessions
    : [];

  const savStatuses = savSessions
    .map((s: any) => String(s?.status || "").trim().toUpperCase())
    .filter(Boolean);

  const derivedStatus =
    savStatuses.includes("A_TRAITER")
      ? "A_TRAITER"
      : savStatuses.includes("EN_ATTENTE_INTERNE")
      ? "EN_ATTENTE_INTERNE"
      : savStatuses.includes("EN_ATTENTE_INSTALLATEUR")
      ? "EN_ATTENTE_INSTALLATEUR"
      : savStatuses.length
      ? "RESOLU"
      : null;

  return {
    group_key: chantierId,
    chantier_id: chantierId,
    chantier_label: chantierLabel,
    installateur: installateurCompany
      ? String(installateurCompany).trim()
      : installateurName
      ? String(installateurName).trim()
      : null,
    status:
      derivedStatus ||
      c?.status ||
      c?.meta?.status ||
      context?.status ||
      "A_TRAITER",
    owner: c?.owner ? String(c.owner).trim() : null,
    session_ids: Array.isArray(links?.session_ids) ? links.session_ids : [],
  };
}

function ActionIconButton({
  title,
  onClick,
  children,
  disabled = false,
}: {
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InboxCard({
  item,
  selected,
  onSelect,
  onIgnore,
  onToggleScope,
  scopeChanging,
}: {
  item: InboxOverviewCard;
  selected: boolean;
  onSelect: () => void;
  onIgnore: () => void;
  onToggleScope: () => void;
  scopeChanging?: boolean;
}) {
  const displayName = pickDisplayName(item);
  const isOutOfScope = String(item.scope || "").toUpperCase() === "OUT_OF_SCOPE";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "w-full cursor-pointer rounded-2xl border bg-white p-4 text-left transition",
        selected
          ? "border-slate-900 shadow-sm"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">

          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              channelPillClass(item.channel),
            ].join(" ")}
          >
            {channelLabel(item.channel)}
          </span>

          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              statusPillClass(item.status),
            ].join(" ")}
          >
            {statusLabel(item.status)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title={isOutOfScope ? "Remettre en SAV pertinent" : "Mettre hors périmètre"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleScope();
            }}
            disabled={scopeChanging}
            className={[
              "rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
              isOutOfScope
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
            ].join(" ")}
          >
            {scopeChanging ? "..." : isOutOfScope ? "SAV" : "Hors"}
          </button>

          <ActionIconButton
            title="Ignorer"
            onClick={(e) => {
              e.stopPropagation();
              onIgnore();
            }}
          >
            <XIcon />
          </ActionIconButton>
        </div>
      </div>

      <div className="mt-3">
        <div className="line-clamp-2 text-base font-semibold text-slate-950">
          {item.title || "Sans titre"}
        </div>

        <div className="mt-2 text-sm text-slate-600">
          {displayName}
          {item.product ? ` · ${item.product}` : ""}
        </div>

         <div className="mt-1 text-sm text-slate-500">
          {item.photo_count || 0} photo{(item.photo_count || 0) > 1 ? "s" : ""}
          {" · "}
          {timeAgo(item.last_message_at || item.updated_at || item.received_at)}
        </div>
      </div>
    </div>
  );
}

function ColumnSection({
  title,
  subtitle,
  items,
  selectedId,
  onSelect,
  onIgnore,
  onToggleScope,
  scopeChangingId,
  emptyLabel,
  tone = "neutral",
}: {
  title: string;
  subtitle: string;
  items: InboxOverviewCard[];
  selectedId: string | null;
  onSelect: (item: InboxOverviewCard) => void;
  onIgnore: (item: InboxOverviewCard) => void;
  onToggleScope: (item: InboxOverviewCard) => void;
  scopeChangingId: string | null;
  emptyLabel: string;
  tone?: "sav" | "out" | "neutral";
}) {
  const toneClasses =
    tone === "sav"
      ? "border-emerald-300 bg-emerald-50/45"
      : tone === "out"
      ? "border-amber-300 bg-amber-50/45"
      : "border-slate-200 bg-white";

  const titleDotClasses =
    tone === "sav"
      ? "bg-emerald-500"
      : tone === "out"
      ? "bg-amber-500"
      : "bg-neutral-300";

  return (
    <section className={`min-h-[640px] rounded-2xl border p-5 shadow-sm ${toneClasses}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${titleDotClasses}`} />
            <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div className="px-2 text-sm font-semibold text-slate-700">
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <InboxCard
              key={item.inbox_item_id}
              item={item}
              selected={selectedId === item.inbox_item_id}
              onSelect={() => onSelect(item)}
              onIgnore={() => onIgnore(item)}
              onToggleScope={() => onToggleScope(item)}
              scopeChanging={scopeChangingId === item.inbox_item_id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function InboxSavPage() {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<InboxOverviewResponse | null>(null);

  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  const [scopeChangingId, setScopeChangingId] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InboxItemDetail | null>(null);

  const [savingReview, setSavingReview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState<string | null>(null);

  const [formScope, setFormScope] = useState("OUT_OF_SCOPE");
  const [formStatus, setFormStatus] = useState("NEW");
  const [formSavType, setFormSavType] = useState("PANNE");

  const [formInstallateurName, setFormInstallateurName] = useState("");
  const [formInstallateurCompany, setFormInstallateurCompany] = useState("");
  const [formInstallateurEmail, setFormInstallateurEmail] = useState("");
  const [formInstallateurPhone, setFormInstallateurPhone] = useState("");

  const [crmQuery, setCrmQuery] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmResults, setCrmResults] = useState<CrmCandidate[]>([]);
  const [crmOpen, setCrmOpen] = useState(false);
  const crmTimer = useRef<number | null>(null);
  const crmBoxRef = useRef<HTMLDivElement | null>(null);

  const [formProduct, setFormProduct] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSubCategory, setFormSubCategory] = useState("");
  const [formComponents, setFormComponents] = useState<string[]>([]);
  const [componentDraft, setComponentDraft] = useState("");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [catalogClassification, setCatalogClassification] =
    useState<CatalogClassification | null>(null);
  const [catalogComponents, setCatalogComponents] = useState<string[]>([]);

  const [attachQuery, setAttachQuery] = useState("");
  const [attachResults, setAttachResults] = useState<AttachChantierResult[]>([]);
  const [attachSearchLoading, setAttachSearchLoading] = useState(false);

  const [attachSelectedChantierId, setAttachSelectedChantierId] = useState("");
  const [attachNewChantierId, setAttachNewChantierId] = useState("");

  const [attachCreateNewSav, setAttachCreateNewSav] = useState(true);
  const [attachSavSessions, setAttachSavSessions] = useState<SavSessionLite[]>([]);
  const [attachSelectedSavSessionId, setAttachSelectedSavSessionId] = useState("");

  const [attachActor, setAttachActor] = useState("William Perge");

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/products"), { cache: "no-store" });
      if (!res.ok) {
        setProducts([]);
        return;
      }

      const json = (await res.json()) as unknown;
      const opts: ProductOption[] = Array.isArray(json)
        ? json
            .map((p: any) => ({
              code: safeStr(p?.code),
              label: safeStr(p?.label),
            }))
            .filter((p) => p.code && p.label)
        : [];

      setProducts(opts);
    } catch (e) {
      console.error("fetch /products error", e);
      setProducts([]);
    }
  }, []);

  const fetchCatalogClassification = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/catalog/classification"), {
        cache: "no-store",
      });
      if (!res.ok) {
        setCatalogClassification(null);
        return;
      }

      const json = (await res.json()) as any;

      setCatalogClassification({
        categories: Array.isArray(json?.categories) ? json.categories : [],
        sub_categories: Array.isArray(json?.sub_categories)
          ? json.sub_categories
          : [],
      });
    } catch (e) {
      console.error("fetch /catalog/classification error", e);
      setCatalogClassification(null);
    }
  }, []);

  const fetchCatalogComponents = useCallback(async (product: string) => {
    try {
      const res = await fetch(
        buildUrl("/catalog/components", { product: product || "" }),
        { cache: "no-store" }
      );
      if (!res.ok) {
        setCatalogComponents([]);
        return;
      }

      const json = (await res.json()) as any;
      const suggestions = Array.isArray(json?.suggestions)
        ? json.suggestions.map((x: unknown) => safeStr(x)).filter(Boolean)
        : [];

      setCatalogComponents(suggestions);
    } catch (e) {
      console.error("fetch /catalog/components error", e);
      setCatalogComponents([]);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
    void fetchCatalogClassification();
  }, [fetchProducts, fetchCatalogClassification]);

  useEffect(() => {
    void fetchCatalogComponents(formProduct);
  }, [formProduct, fetchCatalogComponents]);

  const fetchCrm = useCallback(async (q: string) => {
    const query = q.trim();

    if (!query) {
      setCrmResults([]);
      setCrmError(null);
      setCrmLoading(false);
      return;
    }

    setCrmLoading(true);
    setCrmError(null);

    try {
      const res = await fetch(
        buildUrl("/contacts/search", { q: query }),
        { cache: "no-store" }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          txt && txt.length < 180
            ? `Erreur CRM: ${txt}`
            : "Erreur lors de la recherche CRM."
        );
      }

      const json = await res.json();
      const results = Array.isArray(json?.results)
        ? (json.results as CrmCandidate[])
        : [];

      setCrmResults(results);
    } catch (e: any) {
      console.error("fetch /contacts/search error", e);
      setCrmError(e?.message || "Erreur CRM inconnue.");
      setCrmResults([]);
    } finally {
      setCrmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (crmTimer.current) window.clearTimeout(crmTimer.current);

    crmTimer.current = window.setTimeout(() => {
      void fetchCrm(crmQuery);
    }, 250);

    return () => {
      if (crmTimer.current) window.clearTimeout(crmTimer.current);
    };
  }, [crmQuery, fetchCrm]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!crmBoxRef.current) return;
      if (!crmBoxRef.current.contains(e.target as Node)) {
        setCrmOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectCrmCandidate = useCallback((cand: CrmCandidate) => {
    setFormInstallateurName(cand.name || "");
    setFormInstallateurCompany(cand.company || "");
    setFormInstallateurEmail(cand.email || "");
    setFormInstallateurPhone(cand.phone || "");

    setCrmQuery(cand.display || cand.name || cand.company || cand.email || "");
    setCrmOpen(false);
    setCrmError(null);
  }, []);

  const applyDetectedCrmInstallateur = useCallback(() => {
    const detectedInstallateur = detailItem?.detected?.installateur;

    if (!detectedInstallateur) return;

    setFormInstallateurName(safeStr(detectedInstallateur.name));
    setFormInstallateurCompany(safeStr(detectedInstallateur.company));
    setFormInstallateurEmail(safeStr(detectedInstallateur.email));
    setFormInstallateurPhone(
      firstNonEmpty(detectedInstallateur.phone, detailItem?.sender_phone)
    );

    setCrmQuery(
      firstNonEmpty(
        detectedInstallateur.company,
        detectedInstallateur.name,
        detectedInstallateur.email,
        detectedInstallateur.phone
      )
    );

    setCrmOpen(false);
    setCrmError(null);
  }, [detailItem]);

  const fetchOverview = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    setError(null);

    if (silent) setIsRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (channelFilter !== "ALL") params.set("channel", channelFilter);

      const res = await fetch(buildUrl("/inbox/overview", params), {
        cache: "no-store",
      });

      if (!res.ok) {
        setError("Erreur lors du chargement de l’Inbox SAV.");
        return;
      }

      const data = (await res.json()) as InboxOverviewResponse;
      setOverview(data);

      if (selectedItemId) {
        const allIds =
          (data.columns || []).flatMap((c) => c.items || []).map((x) => x.inbox_item_id);
        if (!allIds.includes(selectedItemId)) {
          setSelectedItemId(null);
        }
      }
    } catch (e) {
      console.error("fetch /inbox/overview error", e);
      setError("Erreur réseau lors du chargement de l’Inbox SAV.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter]);

  const relevantColumn = useMemo(() => {
    return pickRelevantColumn(overview?.columns || []);
  }, [overview]);

  const outOfScopeColumn = useMemo(() => {
    return pickOutOfScopeColumn(overview?.columns || []);
  }, [overview]);

  const filteredRelevantItems = useMemo(() => {
    return relevantColumn.items || [];
  }, [relevantColumn]);

  const selectedItem = useMemo(() => {
    const allItems = [
      ...(relevantColumn.items || []),
      ...(outOfScopeColumn.items || []),
    ];
    return allItems.find((x) => x.inbox_item_id === selectedItemId) || null;
  }, [relevantColumn, outOfScopeColumn, selectedItemId]);

  const reviewPanelOpen = Boolean(selectedItem);

  const selectedColumnKey = useMemo(() => {
    if (!selectedItem) return null;

    const scope = (selectedItem.scope || "").toUpperCase();

    if (scope === "OUT_OF_SCOPE") return "OUT_OF_SCOPE";

    return "SAV_RELEVANT";
  }, [selectedItem]);

  const showRelevantColumn =
    !reviewPanelOpen || selectedColumnKey === "SAV_RELEVANT";

  const showOutOfScopeColumn =
    !reviewPanelOpen || selectedColumnKey === "OUT_OF_SCOPE";

  const productOptions = useMemo(() => {
    const fromProducts = products.map((p) => p.label).filter(Boolean);
    return uniqStrings([formProduct, ...fromProducts]).filter(Boolean);
  }, [products, formProduct]);

  const subCategoryOptions = useMemo(() => {
    const fromCatalog =
      catalogClassification?.sub_categories
        ?.map((sc) => safeStr(sc?.label))
        .filter(Boolean) || [];

    return uniqStrings([formSubCategory, ...fromCatalog]).filter(Boolean);
  }, [catalogClassification, formSubCategory]);

  const componentSuggestions = useMemo(() => {
    return uniqStrings([...catalogComponents, ...formComponents]).filter(Boolean);
  }, [catalogComponents, formComponents]);

  const addComponent = () => {
    const next = componentDraft.trim();
    if (!next) return;

    setFormComponents((prev) => uniqStrings([...prev, next]));
    setComponentDraft("");
  };

  const removeComponent = (component: string) => {
    setFormComponents((prev) => prev.filter((x) => x !== component));
  };

  const resetAttachForm = () => {
    setAttachQuery("");
    setAttachResults([]);
    setAttachSelectedChantierId("");
    setAttachNewChantierId("");
    setAttachCreateNewSav(true);
    setAttachSavSessions([]);
    setAttachSelectedSavSessionId("");
  };

  const searchChantiersForAttach = async () => {
    const q = attachQuery.trim();

    if (!q) {
      setAttachResults([]);
      setAttachError("Tape une référence chantier, un installateur ou un morceau de texte.");
      return;
    }

    setAttachSearchLoading(true);
    setAttachError(null);

    try {
      const res = await fetch(buildUrl("/sav/overview"), { cache: "no-store" });

      if (!res.ok) {
        setAttachResults([]);
        setAttachError("Erreur lors de la recherche chantier.");
        return;
      }

      const data = (await res.json()) as SavOverviewResponse;
      const rawChantiers = Array.isArray(data?.chantiers) ? data.chantiers : [];

      const rows = rawChantiers
        .map(buildAttachChantierResultFromJson)
        .filter((x): x is AttachChantierResult => Boolean(x));

      const qn = normalizeSearchStr(q);

      const filtered = rows.filter((r) => {
        const hay = [
          r.chantier_id,
          r.chantier_label || "",
          r.installateur || "",
          r.owner || "",
          ...(r.session_ids || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(qn);
      });

      setAttachResults(filtered.slice(0, 20));

      if (filtered.length === 0) {
        setAttachError(null);
      }
    } catch (e) {
      console.error("search attach /sav/overview error", e);
      setAttachResults([]);
      setAttachError("Erreur réseau lors de la recherche chantier.");
    } finally {
      setAttachSearchLoading(false);
    }
  };

  const loadSavSessionsForChantier = async (chantierId: string) => {
    const id = chantierId.trim();

    if (!id) {
      setAttachSavSessions([]);
      setAttachSelectedSavSessionId("");
      return;
    }

    try {
      const res = await fetch(buildUrl(`/chantiers/${encodeURIComponent(id)}`), {
        cache: "no-store",
      });

      if (!res.ok) {
        setAttachSavSessions([]);
        setAttachSelectedSavSessionId("");
        return;
      }

      const chantier = await res.json();
      const sav = chantier?.sav || {};
      const sessions = Array.isArray(sav?.sav_sessions) ? sav.sav_sessions : [];

      const mapped: SavSessionLite[] = sessions
        .filter((s: any) => s && typeof s === "object" && s.sav_session_id)
        .map((s: any) => ({
          sav_session_id: String(s.sav_session_id),
          title: s.title ?? null,
          created_at: typeof s.created_at === "number" ? s.created_at : null,
          updated_at: typeof s.updated_at === "number" ? s.updated_at : null,
          status: s.status ?? null,
        }));

      setAttachSavSessions(mapped);

      const activeId = String(sav?.active_sav_session_id || "").trim();
      const fallbackId = mapped[0]?.sav_session_id || "";
      const nextId =
        activeId && mapped.some((x) => x.sav_session_id === activeId)
          ? activeId
          : fallbackId;

      setAttachSelectedSavSessionId(nextId);
    } catch (e) {
      console.error("loadSavSessionsForChantier error", e);
      setAttachSavSessions([]);
      setAttachSelectedSavSessionId("");
    }
  };

  const selectAttachChantier = (chantierId: string) => {
    const id = chantierId.trim();
    if (!id) return;

    setAttachSelectedChantierId(id);
    setAttachNewChantierId("");
    setAttachCreateNewSav(true);
    void loadSavSessionsForChantier(id);
  };

  const markInboxItemAsInProgress = async (inboxItemId: string) => {
    const id = inboxItemId.trim();
    if (!id) return false;

    try {
      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(id)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "EN_COURS" }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(
          "mark inbox item EN_COURS failed",
          txt || res.statusText
        );
        return false;
      }

      return true;
    } catch (e) {
      console.error("mark inbox item EN_COURS error", e);
      return false;
    }
  };

  const ignoreItem = async (item: InboxOverviewCard) => {
    setActionError(null);
    setIgnoringId(item.inbox_item_id);

    try {
      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(item.inbox_item_id)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IGNORED" }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setActionError(
          txt && txt.length < 220
            ? `Erreur ignore: ${txt}`
            : "Erreur lors du passage en ignoré."
        );
        return;
      }

      if (selectedItemId === item.inbox_item_id) {
        setSelectedItemId(null);
      }

      await fetchOverview({ silent: true });
    } catch (e) {
      console.error("ignore inbox item error", e);
      setActionError("Erreur réseau lors du changement de statut.");
    } finally {
      setIgnoringId(null);
    }
  };

  const toggleItemScope = async (item: InboxOverviewCard) => {
    const currentScope = String(item.scope || "").toUpperCase();
    const nextScope =
      currentScope === "OUT_OF_SCOPE" ? "SAV_RELEVANT" : "OUT_OF_SCOPE";

    setActionError(null);
    setScopeChangingId(item.inbox_item_id);

    try {
      const body: {
        scope: string;
        sav_type?: null;
        triage: Record<string, unknown>;
      } = {
        scope: nextScope,
        triage: {
          scope_source: "MANUAL",
          manual_reason: "user_changed_scope",
          manual_target_scope: nextScope,
          manual_changed_at: Date.now() / 1000,
        },
      };

      // Si on sort du périmètre SAV, on nettoie aussi le type SAV.
      // Si on remet en SAV pertinent, on laisse le type SAV vide :
      // il sera qualifié humainement dans le review panel.
      if (nextScope === "OUT_OF_SCOPE") {
        body.sav_type = null;
      }

      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(item.inbox_item_id)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setActionError(
          txt && txt.length < 220
            ? `Erreur changement périmètre: ${txt}`
            : "Erreur lors du changement de périmètre."
        );
        return;
      }

      if (selectedItemId === item.inbox_item_id) {
        setFormScope(nextScope);

        setDetailItem((prev) =>
          prev
            ? {
                ...prev,
                scope: nextScope,
                sav_type: nextScope === "OUT_OF_SCOPE" ? null : prev.sav_type,
              }
            : prev
        );
      }

      await fetchOverview({ silent: true });

      if (selectedItemId === item.inbox_item_id) {
        await fetchInboxItemDetail(item.inbox_item_id);
      }
    } catch (e) {
      console.error("toggle inbox item scope error", e);
      setActionError("Erreur réseau lors du changement de périmètre.");
    } finally {
      setScopeChangingId(null);
    }
  };

  const resetReviewMessages = () => {
    setDetailError(null);
    setSaveSuccess(null);
    setAttachError(null);
    setAttachSuccess(null);
  };

  const applyDetailToForm = (item: InboxItemDetail) => {
    const detected = item.detected || {};
    const review = item.review || {};

    const detectedInstallateur = detected.installateur || {};
    const reviewInstallateur = review.installateur || {};

    setFormScope((item.scope || "OUT_OF_SCOPE").toUpperCase());
    setFormStatus((item.status || "NEW").toUpperCase());
    setFormSavType(
      (item.sav_type || review.category || detected.category || "PANNE").toUpperCase()
    );

    setFormInstallateurName(
      firstNonEmpty(
        reviewInstallateur.name,
        detectedInstallateur.name,
        item.sender_display
      )
    );

    setFormInstallateurCompany(
      firstNonEmpty(
        reviewInstallateur.company,
        detectedInstallateur.company
      )
    );

    setFormInstallateurEmail(
      firstNonEmpty(
        reviewInstallateur.email,
        detectedInstallateur.email,
        item.sender_email
      )
    );

    setFormInstallateurPhone(
      firstNonEmpty(
        reviewInstallateur.phone,
        detectedInstallateur.phone,
        item.sender_phone
      )
    );

    setCrmQuery(
      firstNonEmpty(
        reviewInstallateur.company,
        reviewInstallateur.name,
        detectedInstallateur.company,
        detectedInstallateur.name,
        item.sender_display
      )
    );
    setCrmResults([]);
    setCrmOpen(false);
    setCrmError(null);

    setFormProduct(String(review.product || detected.product || ""));
    setFormCategory("");
    setFormSubCategory(String(review.sub_category || detected.sub_category || ""));
    setFormComponents(
      Array.isArray(review.components)
        ? review.components.map((x) => String(x).trim()).filter(Boolean)
        : Array.isArray(detected.components)
        ? detected.components.map((x) => String(x).trim()).filter(Boolean)
        : []
    );
    setComponentDraft("");
  };

  const fetchInboxItemDetail = async (inboxItemId: string) => {
    resetReviewMessages();
    setDetailLoading(true);
    setDetailError(null);

    try {
      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(inboxItemId)}`),
        { cache: "no-store" }
      );

      if (!res.ok) {
        setDetailItem(null);
        setDetailError("Erreur lors du chargement du détail de l’item.");
        return;
      }

      let data = (await res.json()) as InboxItemDetail;

      if ((data.status || "").toUpperCase() === "NEW") {
        const marked = await markInboxItemAsInProgress(inboxItemId);

        if (marked) {
          data = {
            ...data,
            status: "EN_COURS",
          };

          await fetchOverview({ silent: true });
        }
      }

      setDetailItem(data);
      applyDetailToForm(data);

      resetAttachForm();

      if (data.linked_chantier_id) {
        const linkedId = String(data.linked_chantier_id);
        setAttachSelectedChantierId(linkedId);
        setAttachQuery(linkedId);
        void loadSavSessionsForChantier(linkedId);
      }
    } catch (e) {
      console.error("fetch inbox item detail error", e);
      setDetailItem(null);
      setDetailError("Erreur réseau lors du chargement du détail.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedItemId) {
      setDetailItem(null);
      setDetailError(null);
      setSaveSuccess(null);
      setAttachError(null);
      setAttachSuccess(null);
      resetAttachForm();
      return;
    }

    fetchInboxItemDetail(selectedItemId);
  }, [selectedItemId]);

const buildReviewPanelPayload = () => ({
  scope: formScope,
  sav_type: formScope === "SAV_RELEVANT" ? formSavType : null,
  review: {
    installateur: {
      name: formInstallateurName || null,
      company: formInstallateurCompany || null,
      email: formInstallateurEmail || null,
      phone: formInstallateurPhone || null,
    },
    product: formProduct || null,
    category: formScope === "SAV_RELEVANT" ? formSavType : null,
    sub_category: formSubCategory || null,
    components: formComponents,
    reviewed_by: attachActor || "William Perge",
  },
});

const saveReviewPanelSilent = async (): Promise<boolean> => {
  if (!selectedItemId) return false;

  const res = await fetch(
    buildUrl(`/inbox/items/${encodeURIComponent(selectedItemId)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReviewPanelPayload()),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    setAttachError(
      txt && txt.length < 240
        ? `Erreur sauvegarde avant rattachement: ${txt}`
        : "Erreur lors de la sauvegarde avant rattachement."
    );
    return false;
  }

  return true;
};

  const saveReviewPanel = async () => {
    if (!selectedItemId) return;

    resetReviewMessages();
    setSavingReview(true);

    try {
      const body = buildReviewPanelPayload();

      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(selectedItemId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setDetailError(
          txt && txt.length < 240
            ? `Erreur sauvegarde: ${txt}`
            : "Erreur lors de la sauvegarde du review panel."
        );
        return;
      }

      setSaveSuccess("Modifications enregistrées.");
      await fetchInboxItemDetail(selectedItemId);
      await fetchOverview({ silent: true });
    } catch (e) {
      console.error("save review panel error", e);
      setDetailError("Erreur réseau lors de la sauvegarde.");
    } finally {
      setSavingReview(false);
    }
  };

  const attachSelectedInboxItem = async () => {
    if (!selectedItemId) return;

    const selectedChantierId = attachSelectedChantierId.trim();
    const newChantierId = attachNewChantierId.trim();
    const chantierId = selectedChantierId || newChantierId;

    if (!chantierId) {
      setAttachError("Sélectionne un chantier existant ou saisis une nouvelle référence chantier.");
      return;
    }

    const isNewChantier = !selectedChantierId && Boolean(newChantierId);

    if (!isNewChantier && !attachCreateNewSav && !attachSelectedSavSessionId.trim()) {
      setAttachError("Sélectionne une session SAV existante ou choisis d’en créer une nouvelle.");
      return;
    }

    const savSessionIdToUse = isNewChantier
      ? DEFAULT_SAV_SESSION_ID
      : attachCreateNewSav
      ? "__new__"
      : attachSelectedSavSessionId.trim() || DEFAULT_SAV_SESSION_ID;

    resetReviewMessages();
    setAttachLoading(true);

    try {
      // Avant de rattacher, on sauvegarde silencieusement le contenu actuel
      // du review panel. Cela évite de perdre les champs installateur/contact
      // ou qualification technique si l'utilisateur clique directement sur Rattacher.
      const savedBeforeAttach = await saveReviewPanelSilent();

      if (!savedBeforeAttach) {
        return;
      }

      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(selectedItemId)}/attach`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chantier_id: chantierId,
            sav_session_id: savSessionIdToUse,
            actor: attachActor.trim() || null,
          }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setAttachError(
          txt && txt.length < 260
            ? `Erreur rattachement: ${txt}`
            : "Erreur lors du rattachement."
        );
        return;
      }

      setAttachSuccess(
        `Rattachement effectué vers ${chantierId} / ${savSessionIdToUse}.`
      );

      await fetchInboxItemDetail(selectedItemId);
      await fetchOverview({ silent: true });
    } catch (e) {
      console.error("attach inbox item error", e);
      setAttachError("Erreur réseau lors du rattachement.");
    } finally {
      setAttachLoading(false);
    }
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-10 py-7 backdrop-blur">
          <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Inbox SAV
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vue unifiée — emails + WhatsApp avant rattachement chantier
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchOverview({ silent: true })}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              {isRefreshing ? "Rafraîchissement..." : "Rafraîchir"}
            </button>

            <Link
              href="/sav/sessions"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              ← Retour liste chantiers
            </Link>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Canal :</span>

            {(["ALL", "EMAIL", "WHATSAPP"] as const).map((value) => {
              const active = channelFilter === value;
              const label =
                value === "ALL" ? "Tous" : value === "EMAIL" ? "Email" : "WhatsApp";

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChannelFilter(value)}
                  className={[
                    "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition",
                    active
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {actionError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </div>
          ) : null}
         </div>
        </div>

        <div className="px-10 py-7">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Chargement de l’Inbox SAV…
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
            {error}
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
            {showRelevantColumn ? (
              <ColumnSection
                title="SAV pertinent"
                subtitle="Demandes techniques chantier à qualifier et rattacher"
                items={filteredRelevantItems}
                selectedId={selectedItemId}
                onSelect={(item) => setSelectedItemId(item.inbox_item_id)}
                onIgnore={(item) => ignoreItem(item)}
                onToggleScope={(item) => toggleItemScope(item)}
                scopeChangingId={scopeChangingId}
                emptyLabel="Aucun item SAV pertinent avec les filtres actuels."
                tone="sav"
              />
            ) : null}

            {showOutOfScopeColumn ? (
              <ColumnSection
                title="Hors périmètre"
                subtitle="Demandes non prioritaires pour le flux SAV chantier"
                items={outOfScopeColumn.items || []}
                selectedId={selectedItemId}
                onSelect={(item) => setSelectedItemId(item.inbox_item_id)}
                onIgnore={(item) => ignoreItem(item)}
                onToggleScope={(item) => toggleItemScope(item)}
                scopeChangingId={scopeChangingId}
                emptyLabel="Aucun item hors périmètre."
                tone="out"
              />
            ) : null}

            {reviewPanelOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Fermer le panneau review"
                  onClick={() => setSelectedItemId(null)}
                  className="fixed inset-0 z-40 cursor-default bg-slate-950/35 backdrop-blur-[1px]"
                />

                <aside
                  className="inbox-review-slide fixed right-0 top-0 z-50 h-screen w-full max-w-[640px] overflow-y-auto border-l border-slate-200 bg-white p-7 shadow-2xl"
                >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Review</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Qualification, édition et rattachement de l’item sélectionné.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Fermer
                </button>
              </div>

              {!selectedItem ? (
                <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Clique une carte pour ouvrir son review panel.
                </div>
              ) : detailLoading ? (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Chargement du détail…
                </div>
              ) : detailError ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                  {detailError}
                </div>
              ) : !detailItem ? (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                  Aucun détail disponible.
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-5">
                  <div className="rounded-2xl bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center gap-2">

                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                          channelPillClass(detailItem.channel),
                        ].join(" ")}
                      >
                        {channelLabel(detailItem.channel)}
                      </span>

                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                          statusPillClass(detailItem.status || formStatus),
                        ].join(" ")}
                      >
                        {statusLabel(detailItem.status || formStatus)}
                      </span>
                    </div>

                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {detailItem.title || "Sans titre"}
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      {pickDisplayName(selectedItem)}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {(detailItem.photo_count || detailItem.photos?.length || 0)} photo
                      {(detailItem.photo_count || detailItem.photos?.length || 0) > 1 ? "s" : ""}
                      {" · "}
                      {timeAgo(
                        selectedItem.last_message_at ||
                          selectedItem.updated_at ||
                          selectedItem.received_at
                      )}
                    </div>
                  </div>

                  {saveSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {saveSuccess}
                    </div>
                  ) : null}

                  {attachSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {attachSuccess}
                    </div>
                  ) : null}

                  {attachError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {attachError}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-orange-200 bg-orange-50/25 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">
                          Contenu brut
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Message reçu à lire avant qualification.
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-neutral-800 ring-1 ring-orange-100">
                      {detailItem.clean_content_text || detailItem.raw_content_text || "Aucun contenu brut disponible."}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">
                          Photos
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Photos reçues avec le message.
                        </div>
                      </div>

                      <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                        {detailItem.photos?.length || 0}
                      </div>
                    </div>

                    {!detailItem.photos || detailItem.photos.length === 0 ? (
                      <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500 ring-1 ring-neutral-200">
                        Aucune photo.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {detailItem.photos.map((photo) => (
                          <a
                            key={photo.photo_uid}
                            href={photo.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="group overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
                          >
                            {photo.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo.url}
                                alt={photo.source_name || photo.photo_uid}
                                className="h-36 w-full object-cover transition group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-36 items-center justify-center text-xs text-neutral-400">
                                Image indisponible
                              </div>
                            )}

                            <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                              {photo.source_name || photo.photo_uid}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">
                          Installateur / contact
                        </div>

                        {detailItem ? (() => {
                          const src = getReviewPanelInstallateurSource(detailItem);
                          const detected = src.detectedInstallateur;

                          if (!src.crmMatched || !detected) return null;

                          const label = firstNonEmpty(
                            detected.company,
                            detected.name,
                            detected.email,
                            detected.phone
                          );

                          return (
                            <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                              <div className="font-semibold">
                                Contact CRM détecté
                              </div>
                              <div className="mt-1">
                                {label}
                              </div>
                              <div className="mt-1 text-emerald-700">
                                Match {crmMethodLabel(src.matchMethod)}
                                {src.confidence !== null
                                  ? ` · confiance ${formatCrmConfidence(src.confidence)}`
                                  : ""}
                                {src.crmContactId ? ` · ID ${src.crmContactId}` : ""}
                              </div>

                              {src.hasReview ? (
                                <button
                                  type="button"
                                  onClick={applyDetectedCrmInstallateur}
                                  className="mt-2 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                  Réappliquer le contact CRM détecté
                                </button>
                              ) : null}
                            </div>
                          );
                        })() : null}
                      </div>

                      {detailItem?.detected?.installateur?.source &&
                      !detailItem.detected.installateur.crm_match?.matched ? (
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                          Source : {detailItem.detected.installateur.source}
                        </span>
                      ) : null}
                    </div>

                    <div ref={crmBoxRef} className="mb-4">
                      <div className="text-sm font-medium text-neutral-700">
                        Rechercher installateur CRM
                      </div>

                      <div className="relative mt-1">
                        <input
                          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={crmQuery}
                          onChange={(e) => {
                            setCrmQuery(e.target.value);
                            setCrmOpen(true);
                          }}
                          onFocus={() => setCrmOpen(true)}
                          placeholder="Nom / Société / Email / Téléphone…"
                        />

                        {crmOpen &&
                        (crmLoading || crmError || crmResults.length > 0 || crmQuery.trim()) ? (
                          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                            {crmLoading ? (
                              <div className="px-4 py-3 text-sm text-neutral-600">
                                Recherche…
                              </div>
                            ) : null}

                            {crmError && !crmLoading ? (
                              <div className="px-4 py-3 text-sm text-rose-600">
                                {crmError}
                              </div>
                            ) : null}

                            {!crmLoading &&
                            !crmError &&
                            crmResults.length === 0 &&
                            crmQuery.trim() ? (
                              <div className="px-4 py-3 text-sm text-neutral-600">
                                Aucun résultat
                              </div>
                            ) : null}

                            {!crmLoading && !crmError && crmResults.length > 0 ? (
                              <div className="max-h-64 overflow-auto">
                                {crmResults.map((r, idx) => (
                                  <button
                                    key={`${r.email || r.phone || r.display}-${idx}`}
                                    type="button"
                                    className="w-full px-4 py-3 text-left text-sm transition hover:bg-neutral-50"
                                    onClick={() => selectCrmCandidate(r)}
                                  >
                                    <div className="font-medium text-neutral-900">
                                      {r.display || r.name || r.company || "Contact CRM"}
                                    </div>

                                    <div className="mt-1 text-xs text-neutral-500">
                                      {[r.email, r.phone].filter(Boolean).join(" · ")}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Nom</span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formInstallateurName}
                          onChange={(e) => setFormInstallateurName(e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Société</span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formInstallateurCompany}
                          onChange={(e) => setFormInstallateurCompany(e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Email</span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formInstallateurEmail}
                          onChange={(e) => setFormInstallateurEmail(e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Téléphone</span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formInstallateurPhone}
                          onChange={(e) => setFormInstallateurPhone(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-4 text-sm font-semibold text-neutral-900">
                      Qualification technique
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Type SAV</span>
                        <select
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formSavType}
                          onChange={(e) => setFormSavType(e.target.value)}
                          disabled={formScope !== "SAV_RELEVANT"}
                        >
                          <option value="PANNE">Panne</option>
                          <option value="MISE_EN_SERVICE">Mise en service</option>
                          <option value="ASSISTANCE">Assistance</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Produit</span>
                        <select
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formProduct}
                          onChange={(e) => setFormProduct(e.target.value)}
                        >
                          <option value="">—</option>
                          {productOptions.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">Sous-catégorie</span>
                        <select
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={formSubCategory}
                          onChange={(e) => setFormSubCategory(e.target.value)}
                        >
                          <option value="">—</option>
                          {subCategoryOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-neutral-700">
                          Composants
                        </span>

                        {formComponents.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {formComponents.map((component) => (
                              <span
                                key={component}
                                className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200"
                              >
                                {component}
                                <button
                                  type="button"
                                  className="text-neutral-500 hover:text-neutral-900"
                                  onClick={() => removeComponent(component)}
                                  aria-label={`Retirer ${component}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                            Aucun composant sélectionné.
                          </div>
                        )}

                        <div className="flex gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                            placeholder="Ajouter un composant…"
                            value={componentDraft}
                            list="inbox_components_suggestions"
                            onChange={(e) => setComponentDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addComponent();
                              }
                            }}
                          />

                          <button
                            type="button"
                            onClick={addComponent}
                            disabled={!componentDraft.trim()}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Ajouter
                          </button>
                        </div>

                        <datalist id="inbox_components_suggestions">
                          {componentSuggestions.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveReviewPanel}
                        disabled={savingReview}
                        className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingReview ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-4 text-sm font-semibold text-neutral-900">
                      Rattachement chantier
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-neutral-700">
                          Trouver un chantier existant
                        </span>

                        <div className="flex gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                            placeholder="Tape une ref, un installateur, un morceau…"
                            value={attachQuery}
                            onChange={(e) => setAttachQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void searchChantiersForAttach();
                              }
                            }}
                          />

                          <button
                            type="button"
                            onClick={searchChantiersForAttach}
                            disabled={attachSearchLoading}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {attachSearchLoading ? "Recherche..." : "Chercher"}
                          </button>
                        </div>

                        {attachResults.length > 0 ? (
                          <div className="max-h-48 overflow-auto rounded-2xl border border-neutral-200">
                            {attachResults.map((r) => {
                              const active =
                                attachSelectedChantierId === String(r.chantier_id || "");

                              return (
                                <button
                                  key={r.group_key}
                                  type="button"
                                  onClick={() => selectAttachChantier(r.chantier_id)}
                                  className={[
                                    "w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-50",
                                    active ? "bg-neutral-100" : "bg-white",
                                  ].join(" ")}
                                >
                                  <div className="font-medium text-neutral-900">
                                    {r.chantier_label || r.chantier_id}
                                  </div>

                                  <div className="mt-1 text-xs text-neutral-500">
                                    {r.installateur || "Installateur inconnu"}
                                    {" · "}
                                    {chantierStatusLabel(r.status)}
                                    {r.owner ? ` · ${r.owner}` : ""}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : attachQuery.trim() && !attachSearchLoading ? (
                          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                            Aucun chantier sélectionné pour l’instant. Lance une recherche ou crée une nouvelle référence.
                          </div>
                        ) : null}

                        {attachSelectedChantierId ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            Chantier sélectionné : <strong>{attachSelectedChantierId}</strong>
                          </div>
                        ) : null}
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">
                          Ou créer un nouveau chantier
                        </span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          placeholder="Nouvelle référence chantier"
                          value={attachNewChantierId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setAttachNewChantierId(next);

                            if (next.trim()) {
                              setAttachSelectedChantierId("");
                              setAttachSavSessions([]);
                              setAttachSelectedSavSessionId("");
                              setAttachCreateNewSav(true);
                            }
                          }}
                        />
                        {attachNewChantierId.trim() ? (
                          <span className="text-xs text-neutral-500">
                            Un nouveau chantier sera créé et les photos iront dans SAV-001.
                          </span>
                        ) : null}
                      </label>

                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-neutral-700">
                          Session SAV cible
                        </span>

                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="radio"
                            name="inboxSavTarget"
                            className="h-4 w-4"
                            checked={attachCreateNewSav}
                            onChange={() => setAttachCreateNewSav(true)}
                            disabled={Boolean(attachNewChantierId.trim())}
                          />
                          {attachNewChantierId.trim()
                            ? "SAV-001 sera utilisée pour ce nouveau chantier"
                            : "Créer une nouvelle session SAV"}
                        </label>

                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="radio"
                            name="inboxSavTarget"
                            className="h-4 w-4"
                            checked={!attachCreateNewSav}
                            onChange={() => setAttachCreateNewSav(false)}
                            disabled={!attachSelectedChantierId}
                          />
                          Rattacher à une session existante
                          {!attachSelectedChantierId ? (
                            <span className="text-xs text-neutral-400">
                              (sélectionne un chantier existant)
                            </span>
                          ) : null}
                        </label>

                        {!attachCreateNewSav && attachSelectedChantierId ? (
                          <select
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                            value={attachSelectedSavSessionId}
                            onChange={(e) => setAttachSelectedSavSessionId(e.target.value)}
                            disabled={attachSavSessions.length === 0}
                          >
                            {attachSavSessions.length === 0 ? (
                              <option value="">Aucune session SAV trouvée</option>
                            ) : (
                              attachSavSessions.map((s) => {
                                const label = s.title || s.sav_session_id;
                                const dt = s.updated_at || s.created_at;
                                const dtLabel = dt ? ` · ${formatTs(dt)}` : "";
                                const st = s.status ? ` · ${chantierStatusLabel(s.status)}` : "";

                                return (
                                  <option
                                    key={s.sav_session_id}
                                    value={s.sav_session_id}
                                  >
                                    {label}
                                    {dtLabel}
                                    {st}
                                  </option>
                                );
                              })
                            )}
                          </select>
                        ) : null}
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-700">
                          Acteur
                        </span>
                        <input
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          value={attachActor}
                          onChange={(e) => setAttachActor(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={attachSelectedInboxItem}
                        disabled={attachLoading}
                        className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {attachLoading ? "Rattachement..." : "Rattacher au chantier"}
                      </button>

                      {selectedItem ? (
                        <button
                          type="button"
                          disabled={scopeChangingId === detailItem.inbox_item_id}
                          onClick={() => toggleItemScope(selectedItem)}
                          className={[
                            "rounded-2xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                            String(detailItem.scope || "").toUpperCase() === "OUT_OF_SCOPE"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                          ].join(" ")}
                        >
                          {scopeChangingId === detailItem.inbox_item_id
                            ? "Changement..."
                            : String(detailItem.scope || "").toUpperCase() === "OUT_OF_SCOPE"
                            ? "Remettre en SAV pertinent"
                            : "Mettre hors périmètre"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={ignoringId === detailItem.inbox_item_id}
                        onClick={() =>
                          ignoreItem({
                            ...(selectedItem as InboxOverviewCard),
                            inbox_item_id: detailItem.inbox_item_id,
                          })
                        }
                        className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ignoringId === detailItem.inbox_item_id ? "Ignoré..." : "Ignorer"}
                      </button>
                    </div>

                    {detailItem.channel === "EMAIL" &&
                    (!detailItem.linked_session_ids || detailItem.linked_session_ids.length === 0) ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Cet email ne possède pas encore de session rattachable. Le rattachement réel
                        fonctionne déjà pour WhatsApp ; le support complet email viendra ensuite.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </aside>
            </>
            ) : null}
          </div>
        )}
        </div>

        <style>{`
          @keyframes inboxReviewSlideIn {
            from {
              opacity: 0;
              transform: translateX(32px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .inbox-review-slide {
            animation: inboxReviewSlideIn 180ms ease-out;
          }
        `}</style>
      </main>
    </AppShell>
  );
}