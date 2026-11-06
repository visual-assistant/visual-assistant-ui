"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import { ChevronDown, ChevronUp, Loader2, Phone } from "lucide-react";

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
  transcription?: unknown;
  transcript?: unknown;
  segments?: unknown;
  call?: Record<string, unknown> | null;
};

type CallConversation = {
  conversation_id: string;
  member_count?: number | null;
  member_inbox_item_ids?: string[] | null;
  members?: CallConversationMember[] | null;
  external_phone?: string | null;
  contact?: Record<string, unknown> | null;
  perge_collaborators?: unknown[] | null;
  started_at?: number | string | null;
  ended_at?: number | string | null;
  duration_seconds?: number | null;
  title?: string | null;
  summary?: string | null;
  nature?: string | null;
  scope?: string | null;
  sav_type?: string | null;
  product?: unknown;
  analysis?: Record<string, unknown> | null;
  analysis_status?: string | null;
  analysis_error?: string | null;
  linked_chantier_id?: string | null;
  continuity?: unknown;
  processing?: Record<string, unknown> | string | null;
};

type CallChronologyBlock = {
  id?: string | null;
  speaker?: string | null;
  text?: string | null;
  turn_kind?: string | null;
  questions?: string[] | null;
  hypotheses?: string[] | null;
  actions?: string[] | null;
  resolution?: string | null;
  pending?: boolean | null;
  source_segments?: string[] | null;
};

type CallCommitment = {
  text?: string | null;
  type?: string | null;
  status?: string | null;
  responsible?: string | null;
  source_segments?: string[] | null;
};

type DiscoveredCall = {
  discovery_key: string;
  row_fingerprint?: string | null;
  date_label?: string | null;
  started_at?: string | number | null;
  phone_labels?: string[] | null;
  labels?: string[] | null;
  crm?: {
    status?: string | null;
    matches?: Array<Record<string, unknown>> | null;
  } | null;
  processing_status?: string | null;
  suggested_group?: string | null;
  [key: string]: unknown;
};

type CallConversationMember = {
  inbox_item_id?: string | null;
  processing_status?: string | null;
  summary?: string | null;
  updated_at?: string | number | null;
  started_at?: string | number | null;
  ended_at?: string | number | null;
  duration_seconds?: number | null;
  external_phone?: string | null;
  phone?: string | null;
  contact?: Record<string, unknown> | null;
  perge_collaborator?: unknown;
  perge_collaborators?: unknown[] | null;
  analysis?: Record<string, unknown> | null;
  actions?: unknown;
  uncertainties?: unknown;
  [key: string]: unknown;
};

type GroupSuggestion = {
  group_id: string;
  phone?: string | null;
  crm?: {
    status?: string | null;
    normalized_phone?: string | null;
    matches?: Array<Record<string, unknown>> | null;
  } | null;
  call_row_indexes?: number[] | null;
  call_fingerprints: string[];
  reason?: string | null;
  max_gap_minutes?: number | null;
  duration_based?: boolean | null;
  confidence?: "high" | "medium" | "low" | string | null;
};

type DiscoveryJob = {
  job_id?: string | null;
  status?: string | null;
  stage?: string | null;
};

type CallProcessJob = DiscoveryJob & {
  total_count?: number | null;
  processed_count?: number | null;
  failed_count?: number | null;
  completed_count?: number | null;
  result?: {
    crawler?: unknown;
    import?: unknown;
    transcription?: unknown;
    analysis?: unknown;
  } | null;
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
  payload?: {
    call_conversations?: CallConversation[] | null;
  } | null;
  call_conversations?: CallConversation[] | null;
};

type ChannelFilter = "ALL" | "EMAIL" | "WHATSAPP" | "VOICE_CALL";

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
  if (c === "VOICE_CALL") return "Appel";
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
  const contact = item.installateur || {};
  const name = contact.name?.trim();
  const company = contact.company?.trim();

  if (name && company) return `${name} · ${company}`;
  if (name) return name;
  if (company) return company;
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

function sortableTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : 0;
}

function inboxEntryTimestamp(entry: InboxOverviewCard | CallConversation): number {
  if ("conversation_id" in entry) {
    return sortableTimestamp(entry.ended_at || entry.started_at);
  }
  return sortableTimestamp(entry.last_message_at || entry.updated_at || entry.received_at);
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

function CallConversationCard({
  call,
  selected,
  onSelect,
}: {
  call: CallConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const outOfScope = callScope(call) === "OUT_OF_SCOPE";
  const collaborators = callCollaborators(call);
  const memberCount = call.member_count || call.member_inbox_item_ids?.length || 1;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-2xl border bg-white p-4 text-left transition",
        selected
          ? "border-slate-900 shadow-sm"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
            <Phone className="h-3.5 w-3.5" /> Appel
          </span>
          <span className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
            outOfScope ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
          ].join(" ")}>
            {outOfScope ? "Hors périmètre" : "SAV pertinent"}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {memberCount > 1 ? `${memberCount} appels regroupés` : "1 appel"}
        </span>
      </div>

      <div className="mt-3 text-base font-semibold text-slate-950">
        {callTitle(call)}
      </div>
      <div className="mt-2 text-sm text-slate-600">
        {callPhoneOrContact(call)}{callProductLabel(call) ? ` · ${callProductLabel(call)}` : ""}
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {callDate(call)} · {callDuration(call.duration_seconds)}
      </div>
      {callConversationSummary(call) ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-700">
          {callConversationSummary(call)}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {collaborators.length ? <span>{collaborators.join(", ")}</span> : <span>Collaborateur non renseigné</span>}
        <span>·</span>
        <span>{callProcessingLabel(call)}</span>
        {safeStr(call.analysis_status).toUpperCase() === "AGGREGATED_COMPLETED" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">Synthèse disponible</span>
        ) : null}
        {safeStr(call.analysis_error) ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">Synthèse groupée en fallback</span>
        ) : null}
      </div>
      <div className="mt-2 text-xs font-medium text-slate-600">
        {call.linked_chantier_id ? `Chantier ${call.linked_chantier_id}` : "Non rattaché"}
      </div>
    </button>
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
  calls = [],
  selectedCallId,
  onSelectCall,
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
  calls?: CallConversation[];
  selectedCallId: string | null;
  onSelectCall: (call: CallConversation) => void;
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

  const entries = [
    ...items.map((item) => ({ kind: "item" as const, value: item })),
    ...calls.map((call) => ({ kind: "call" as const, value: call })),
  ].sort((a, b) => inboxEntryTimestamp(b.value) - inboxEntryTimestamp(a.value));

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
          {items.length + calls.length}
        </div>
      </div>

      {items.length === 0 && calls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
           {entries.map((entry) =>
             entry.kind === "item" ? (
               <InboxCard
                 key={entry.value.inbox_item_id}
                 item={entry.value}
                 selected={selectedId === entry.value.inbox_item_id}
                 onSelect={() => onSelect(entry.value)}
                 onIgnore={() => onIgnore(entry.value)}
                 onToggleScope={() => onToggleScope(entry.value)}
                 scopeChanging={scopeChangingId === entry.value.inbox_item_id}
               />
             ) : (
               <CallConversationCard
                 key={entry.value.conversation_id}
                 call={entry.value}
                 selected={selectedCallId === entry.value.conversation_id}
                 onSelect={() => onSelectCall(entry.value)}
               />
             ),
           )}
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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [requestedCallId, setRequestedCallId] = useState<string | null>(null);
  const [callTranscriptOpen, setCallTranscriptOpen] = useState(false);
  const [callTranscriptLoading, setCallTranscriptLoading] = useState(false);
  const [callTranscriptError, setCallTranscriptError] = useState<string | null>(null);
  const [callTranscriptItem, setCallTranscriptItem] = useState<InboxItemDetail | null>(null);
  const [callTranscriptMemberId, setCallTranscriptMemberId] = useState<string | null>(null);
  const [callAttachOpen, setCallAttachOpen] = useState(false);
  const [callAttachMemberId, setCallAttachMemberId] = useState<string | null>(null);
  const [discoveredCalls, setDiscoveredCalls] = useState<DiscoveredCall[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [discoveredTotalCount, setDiscoveredTotalCount] = useState<number | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [lookbackMinutes, setLookbackMinutes] = useState("60");
  const [discoveryJob, setDiscoveryJob] = useState<DiscoveryJob | null>(null);
  const [processJob, setProcessJob] = useState<CallProcessJob | null>(null);
  const [selectedDiscoveryKeys, setSelectedDiscoveryKeys] = useState<Set<string>>(new Set());
  const [processError, setProcessError] = useState<string | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
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

      if (selectedCallId) {
        const calls = getCallConversations(data);
        if (!calls.some((call) => call.conversation_id === selectedCallId)) {
          setSelectedCallId(null);
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

  const fetchDiscoveredCalls = useCallback(async (lookbackValue: string, silent = false) => {
    if (!silent) setDiscoveryLoading(true);
    setDiscoveryError(null);

    try {
      const res = await fetch(
        buildUrl("/inbox/calls/discovered", {
          lookback_minutes: lookbackValue,
          limit: "200",
        }),
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("discovered calls unavailable");
      const data = (await res.json()) as {
        calls?: unknown;
        group_suggestions?: unknown;
        count?: unknown;
        total_count?: unknown;
      };
      setDiscoveredCalls(Array.isArray(data.calls) ? (data.calls as DiscoveredCall[]) : []);
      setDiscoveredTotalCount(typeof data.total_count === "number" ? data.total_count : null);
      setGroupSuggestions(
        Array.isArray(data.group_suggestions)
          ? (data.group_suggestions as GroupSuggestion[]).filter(
              (group) => safeStr(group.group_id) && Array.isArray(group.call_fingerprints),
            )
          : [],
      );
    } catch (e) {
      console.error("fetch /inbox/calls/discovered error", e);
      setDiscoveryError("Impossible de charger les appels découverts.");
    } finally {
      if (!silent) setDiscoveryLoading(false);
    }
  }, []);

  const pollCallDiscovery = useCallback(async (jobId: string): Promise<void> => {
    try {
      const res = await fetch(buildUrl(`/inbox/calls/discover/${encodeURIComponent(jobId)}`), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("discovery status unavailable");
      const job = (await res.json()) as DiscoveryJob;
      setDiscoveryJob({ ...job, job_id: job.job_id || jobId });
      const status = safeStr(job.status).toLowerCase();

      if (status === "completed") {
        await fetchDiscoveredCalls(lookbackMinutes, true);
        return;
      }
      if (status === "failed") {
        setDiscoveryError("La recherche des appels récents a échoué.");
        return;
      }
      window.setTimeout(() => void pollCallDiscovery(jobId), 1500);
    } catch (e) {
      console.error("poll call discovery error", e);
      setDiscoveryError("Impossible de suivre la recherche des appels récents.");
    }
  }, [fetchDiscoveredCalls, lookbackMinutes]);

  const discoverRecentCalls = async () => {
    setDiscoveryError(null);
    setDiscoveryJob({ status: "queued", stage: "queued" });
    try {
      const params = new URLSearchParams({
        lookback_minutes: lookbackMinutes,
        limit: "100",
      });
      const res = await fetch(buildUrl(`/inbox/calls/discover?${params.toString()}`), {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("discovery unavailable");
      const job = (await res.json()) as DiscoveryJob & { already_running?: boolean };
      setDiscoveryJob(job);
      const jobId = safeStr(job.job_id);
      if (jobId) await pollCallDiscovery(jobId);
      else await fetchDiscoveredCalls(lookbackMinutes, true);
    } catch (e) {
      console.error("discover recent calls error", e);
      setDiscoveryError("La recherche des appels récents n’a pas pu démarrer.");
    }
  };

  const pollCallProcess = useCallback(async (jobId: string): Promise<void> => {
    try {
      const res = await fetch(buildUrl(`/inbox/calls/process/${encodeURIComponent(jobId)}`), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("process status unavailable");
      const job = (await res.json()) as CallProcessJob;
      setProcessJob({ ...job, job_id: job.job_id || jobId });
      const status = safeStr(job.status).toLowerCase();

      if (status === "completed") {
        setSelectedDiscoveryKeys(new Set());
        await Promise.all([fetchDiscoveredCalls(lookbackMinutes, true), fetchOverview({ silent: true })]);
        return;
      }
      if (status === "failed") {
        setProcessError("Le traitement des appels a échoué.");
        await fetchDiscoveredCalls(lookbackMinutes, true);
        return;
      }
      window.setTimeout(() => void pollCallProcess(jobId), 1500);
    } catch (e) {
      console.error("poll call process error", e);
      setProcessError("Impossible de suivre le traitement des appels.");
    }
  }, [fetchDiscoveredCalls, fetchOverview, lookbackMinutes]);

  const processSelectedCalls = async () => {
    const discoveryKeys = Array.from(selectedDiscoveryKeys);
    if (!discoveryKeys.length) return;
    setProcessError(null);
    try {
      const res = await fetch(buildUrl("/inbox/calls/process"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ discovery_keys: discoveryKeys }),
      });
      if (!res.ok) throw new Error("call processing unavailable");
      const job = (await res.json()) as CallProcessJob;
      setProcessJob(job);
      const jobId = safeStr(job.job_id);
      if (jobId) await pollCallProcess(jobId);
    } catch (e) {
      console.error("process selected calls error", e);
      setProcessError("Le traitement des appels n’a pas pu démarrer.");
    }
  };

  useEffect(() => {
    void fetchDiscoveredCalls("60");
  }, [fetchDiscoveredCalls]);

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

  const callConversations = useMemo(
    () => (channelFilter === "ALL" || channelFilter === "VOICE_CALL" ? getCallConversations(overview) : []),
    [overview, channelFilter],
  );

  useEffect(() => {
    const callId = new URLSearchParams(window.location.search).get("call_id");
    if (callId) setRequestedCallId(callId);
  }, []);

  useEffect(() => {
    if (!requestedCallId || !callConversations.length) return;
    const requestedCall = callConversations.find(
      (call) => call.conversation_id === requestedCallId,
    );
    if (!requestedCall) return;

    setSelectedItemId(null);
    setSelectedCallId(requestedCall.conversation_id);
    setRequestedCallId(null);
  }, [callConversations, requestedCallId]);
  const relevantCalls = useMemo(
    () => callConversations.filter((call) => callScope(call) !== "OUT_OF_SCOPE"),
    [callConversations],
  );
  const outOfScopeCalls = useMemo(
    () => callConversations.filter((call) => callScope(call) === "OUT_OF_SCOPE"),
    [callConversations],
  );

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

  const selectedCall = useMemo(
    () => callConversations.find((call) => call.conversation_id === selectedCallId) || null,
    [callConversations, selectedCallId],
  );

  const reviewPanelOpen = Boolean(selectedItem) || Boolean(selectedCall);

  const selectedColumnKey = useMemo(() => {
    if (!selectedItem) return selectedCall ? callScope(selectedCall) : null;

    const scope = (selectedItem.scope || "").toUpperCase();

    if (scope === "OUT_OF_SCOPE") return "OUT_OF_SCOPE";

    return "SAV_RELEVANT";
  }, [selectedItem, selectedCall]);

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

  const loadCallTranscript = async (memberIdOverride?: string) => {
    if (!selectedCall) return;
    const memberId = memberIdOverride || callMemberId(selectedCall);
    setCallTranscriptOpen(true);
    setCallTranscriptError(null);
    setCallTranscriptItem(null);
    setCallTranscriptMemberId(memberId || null);

    if (!memberId) {
      setCallTranscriptError("Transcription non disponible");
      return;
    }

    setCallTranscriptLoading(true);
    try {
      const res = await fetch(buildUrl(`/inbox/items/${encodeURIComponent(memberId)}`), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("transcript unavailable");
      setCallTranscriptItem((await res.json()) as InboxItemDetail);
    } catch (e) {
      console.error("fetch call transcript error", e);
      setCallTranscriptError("Transcription non disponible");
    } finally {
      setCallTranscriptLoading(false);
    }
  };

  const openCallAttachment = () => {
    if (!selectedCall) return;
    const memberId = callMemberId(selectedCall);
    if (!memberId) return;

    resetAttachForm();
    setAttachError(null);
    setAttachSuccess(null);
    setCallAttachMemberId(memberId);
    setCallAttachOpen(true);
  };

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

  const attachSelectedCallConversation = async () => {
    if (!callAttachMemberId) return;

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

    setAttachError(null);
    setAttachSuccess(null);
    setAttachLoading(true);

    try {
      const res = await fetch(
        buildUrl(`/inbox/items/${encodeURIComponent(callAttachMemberId)}/attach`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chantier_id: chantierId,
            sav_session_id: savSessionIdToUse,
            actor: attachActor.trim() || null,
          }),
          cache: "no-store",
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setAttachError(
          txt && txt.length < 260
            ? `Erreur rattachement: ${txt}`
            : "Erreur lors du rattachement de l’appel.",
        );
        return;
      }

      setAttachSuccess(`Rattachement effectué vers ${chantierId} / ${savSessionIdToUse}.`);
      setCallAttachOpen(false);
      await fetchOverview({ silent: true });
    } catch (e) {
      console.error("attach call conversation error", e);
      setAttachError("Erreur réseau lors du rattachement de l’appel.");
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
              Vue unifiée — emails, WhatsApp et appels avant rattachement chantier
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

            {(["ALL", "VOICE_CALL", "WHATSAPP", "EMAIL"] as const).map((value) => {
              const active = channelFilter === value;
              const label =
                value === "ALL"
                  ? "Tous"
                  : value === "EMAIL"
                  ? "Email"
                  : value === "WHATSAPP"
                  ? "WhatsApp"
                  : "Appel";

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
        <CallDiscoveryPanel
          open={discoveryOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setSelectedItemId(null);
              setSelectedCallId(null);
            }
            setDiscoveryOpen(nextOpen);
          }}
          calls={discoveredCalls}
          groups={groupSuggestions}
          loading={discoveryLoading}
          error={discoveryError}
          lookbackMinutes={lookbackMinutes}
          onLookbackMinutesChange={setLookbackMinutes}
          discoveryJob={discoveryJob}
          onDiscover={() => void discoverRecentCalls()}
          onRefresh={() => void fetchDiscoveredCalls(lookbackMinutes)}
          totalHistoryCount={discoveredTotalCount}
          selectedKeys={selectedDiscoveryKeys}
          onSelectedKeysChange={setSelectedDiscoveryKeys}
          processJob={processJob}
          processError={processError}
          onProcess={() => void processSelectedCalls()}
        />

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
                calls={relevantCalls}
                selectedCallId={selectedCallId}
                onSelectCall={(call) => {
                  setSelectedItemId(null);
                  setSelectedCallId(call.conversation_id);
                  setCallAttachOpen(false);
                  setCallAttachMemberId(null);
                  setCallTranscriptOpen(false);
                  setCallTranscriptItem(null);
                  setCallTranscriptMemberId(null);
                  setCallTranscriptError(null);
                }}
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
                calls={outOfScopeCalls}
                selectedCallId={selectedCallId}
                onSelectCall={(call) => {
                  setSelectedItemId(null);
                  setSelectedCallId(call.conversation_id);
                  setCallAttachOpen(false);
                  setCallAttachMemberId(null);
                  setCallTranscriptOpen(false);
                  setCallTranscriptItem(null);
                  setCallTranscriptMemberId(null);
                  setCallTranscriptError(null);
                }}
              />
            ) : null}

            {reviewPanelOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Fermer le panneau review"
                  onClick={() => {
                    setSelectedItemId(null);
                    setSelectedCallId(null);
                  }}
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
                  onClick={() => {
                    setSelectedItemId(null);
                    setSelectedCallId(null);
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Fermer
                </button>
              </div>

              {selectedCall ? (
                <div className="mt-6 flex flex-col gap-5">
                  <div className="rounded-2xl bg-violet-50 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
                        <Phone className="h-3.5 w-3.5" /> Appel téléphonique
                      </span>
                      <span className={[
                        "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                        callScope(selectedCall) === "OUT_OF_SCOPE"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800",
                      ].join(" ")}>
                        {callScope(selectedCall) === "OUT_OF_SCOPE" ? "Hors périmètre" : "SAV pertinent"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-slate-950">{callTitle(selectedCall)}</h3>
                    <p className="mt-1 text-sm text-slate-600">{callPhoneOrContact(selectedCall)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {callDate(selectedCall)} · {callDuration(selectedCall.duration_seconds)} · {selectedCall.member_count || selectedCall.member_inbox_item_ids?.length || 1} appel(s)
                    </p>
                  </div>

                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <h3 className="text-sm font-semibold text-neutral-900">Métadonnées</h3>
                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs text-neutral-500">Collaborateur(s) PERGE</dt><dd className="font-medium text-neutral-800">{callCollaborators(selectedCall).join(", ") || "Non renseigné"}</dd></div>
                      <div><dt className="text-xs text-neutral-500">Produit</dt><dd className="font-medium text-neutral-800">{callProductLabel(selectedCall) || "Non détecté"}</dd></div>
                      <div><dt className="text-xs text-neutral-500">Catégorie SAV</dt><dd className="font-medium text-neutral-800">{selectedCall.sav_type || "Non qualifiée"}</dd></div>
                      <div><dt className="text-xs text-neutral-500">Chantier</dt><dd className="font-medium text-neutral-800">{selectedCall.linked_chantier_id || "Non rattaché"}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-orange-200 bg-orange-50/25 p-4">
                    <h3 className="text-sm font-semibold text-neutral-900">Résumé</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                      {callConversationSummary(selectedCall) || "Résumé non disponible."}
                    </p>
                  </section>

                  {callChronology(selectedCall).length ? (
                    <section className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4">
                      <h3 className="text-sm font-semibold text-neutral-900">Chronologie de l’appel</h3>
                      <div className="mt-4 space-y-3">
                        {callChronology(selectedCall).map((block, index) => (
                          <article key={safeStr(block.id) || `chronology-${index}`} className="rounded-xl border border-sky-100 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                                {safeStr(block.speaker, "Échange")} · {safeStr(block.turn_kind, "mixte")}
                              </div>
                              {block.pending ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Point ouvert</span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-neutral-800">{safeStr(block.text)}</p>
                            {block.questions?.length ? <div className="mt-2 text-xs text-neutral-700"><span className="font-semibold">Questions :</span> {block.questions.join(" · ")}</div> : null}
                            {block.hypotheses?.length ? <div className="mt-2 text-xs text-neutral-700"><span className="font-semibold">Hypothèses :</span> {block.hypotheses.join(" · ")}</div> : null}
                            {block.actions?.length ? <div className="mt-2 text-xs text-neutral-700"><span className="font-semibold">Actions :</span> {block.actions.join(" · ")}</div> : null}
                            {safeStr(block.resolution) ? <div className="mt-2 text-xs text-neutral-700"><span className="font-semibold">Résolution :</span> {safeStr(block.resolution)}</div> : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {callCommitments(selectedCall).length ? (
                    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                      <h3 className="text-sm font-semibold text-neutral-900">Engagements détectés</h3>
                      <div className="mt-3 space-y-2">
                        {callCommitments(selectedCall).map((commitment, index) => (
                          <div key={`${safeStr(commitment.text) || "commitment"}-${index}`} className="rounded-xl border border-emerald-100 bg-white p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800">{commitmentTypeLabel(commitment.type)}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">{commitmentStatusLabel(commitment.status)}</span>
                            </div>
                            <p className="mt-2 text-sm text-neutral-800">{safeStr(commitment.text)}</p>
                            {safeStr(commitment.responsible) ? <p className="mt-1 text-xs text-neutral-500">Responsable : {safeStr(commitment.responsible)}</p> : null}
                             {safeStr((commitment as CallCommitment & { source_member_label?: string }).source_member_label) ? (
                               <p className="mt-1 text-xs font-medium text-violet-700">
                                 Source : {safeStr((commitment as CallCommitment & { source_member_label?: string }).source_member_label)}
                               </p>
                             ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <h3 className="text-sm font-semibold text-neutral-900">{callAnalysisTitle(selectedCall)}</h3>
                    {safeStr(selectedCall.analysis_status).toUpperCase() === "AGGREGATED_COMPLETED" ? (
                      <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                        Synthèse de conversation disponible
                      </div>
                    ) : null}
                    {safeStr(selectedCall.analysis_error) ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        La synthèse groupée a échoué et le résultat affiché est un fallback. Cause : {safeStr(selectedCall.analysis_error)}
                      </div>
                    ) : null}
                    {callAnalysisSummary(selectedCall) ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                        {callAnalysisSummary(selectedCall)}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-4 text-sm">
                      <div><span className="text-xs text-neutral-500">Nature de l’appel</span><p className="font-medium text-neutral-800">{selectedCall.nature || "Non déterminée"}</p></div>
                      <div><span className="text-xs text-neutral-500">Type SAV</span><p className="font-medium text-neutral-800">{selectedCall.sav_type || "Non déterminé"}</p></div>
                      <div>
                        <span className="text-xs text-neutral-500">Actions identifiées</span>
                        {callAnalysisList(selectedCall, "actions", "identified_actions", "actions_identifiees").length ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-800">
                            {callAnalysisList(selectedCall, "actions", "identified_actions", "actions_identifiees").map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        ) : <p className="mt-1 text-neutral-500">Aucune action identifiée.</p>}
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500">Incertitudes</span>
                        {callAnalysisList(selectedCall, "uncertainties", "incertitudes", "limites").length ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-800">
                            {callAnalysisList(selectedCall, "uncertainties", "incertitudes", "limites").map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        ) : <p className="mt-1 text-neutral-500">Aucune incertitude renseignée.</p>}
                      </div>
                    </div>
                  </section>

                  {callMemberCount(selectedCall) > 1 && Array.isArray(selectedCall.members) ? (
                    <section className="rounded-2xl border border-neutral-200 p-4">
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                          Détails des appels ({selectedCall.members.length})
                        </summary>
                        <div className="mt-4 space-y-3">
                          {selectedCall.members.map((member, index) => {
                            const memberId = safeStr(member.inbox_item_id) || safeStr(selectedCall.member_inbox_item_ids?.[index]);
                            const memberActions = memberAnalysisList(member, "actions", "identified_actions", "actions_identifiees");
                            const memberUncertainties = memberAnalysisList(member, "uncertainties", "incertitudes", "limites");
                            return (
                              <article key={memberId || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">Appel {index + 1}</div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {memberDate(member)} · {callDuration(member.duration_seconds)} · {memberCollaboratorLabel(member)}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {firstNonEmpty(contactLabel(member.contact), member.external_phone, member.phone, "Contact inconnu")}
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">
                                    {discoveredStatusLabel(member.processing_status)}
                                  </span>
                                </div>
                                {safeStr(member.summary) ? (
                                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{safeStr(member.summary)}</p>
                                ) : null}
                                {memberActions.length || memberUncertainties.length ? (
                                  <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
                                    {memberActions.length ? <div><div className="font-semibold">Actions</div><ul className="mt-1 list-disc space-y-1 pl-4">{memberActions.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                                    {memberUncertainties.length ? <div><div className="font-semibold text-amber-800">Incertitudes</div><ul className="mt-1 list-disc space-y-1 pl-4 text-amber-800">{memberUncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                                  </div>
                                ) : null}
                                 {memberChronology(member).length || memberCommitments(member).length ? (
                                   <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                     <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                                       Voir les segments et engagements de cet appel
                                     </summary>
                                     <div className="mt-3 space-y-3">
                                       {memberChronology(member).length ? (
                                         <div>
                                           <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">Segments sémantiques</div>
                                           <div className="mt-2 space-y-2">
                                             {memberChronology(member).map((block, blockIndex) => (
                                               <div key={safeStr(block.id) || `member-chronology-${index}-${blockIndex}`} className="rounded-lg border border-sky-100 bg-sky-50/40 p-2 text-xs">
                                                 <div className="font-semibold text-sky-800">{safeStr(block.speaker, "Échange")} · {safeStr(block.turn_kind, "mixte")}</div>
                                                 <div className="mt-1 text-slate-700">{safeStr(block.text)}</div>
                                                 {block.pending ? <div className="mt-1 font-medium text-amber-700">Point ouvert</div> : null}
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       ) : null}
                                       {memberCommitments(member).length ? (
                                         <div>
                                           <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Engagements</div>
                                           <div className="mt-2 space-y-2">
                                             {memberCommitments(member).map((commitment, commitmentIndex) => (
                                               <div key={`${safeStr(commitment.text) || "member-commitment"}-${commitmentIndex}`} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 text-xs text-slate-700">
                                                 <div className="font-semibold text-emerald-800">{commitmentTypeLabel(commitment.type)} · {commitmentStatusLabel(commitment.status)}</div>
                                                 <div className="mt-1">{safeStr(commitment.text)}</div>
                                                 {safeStr(commitment.responsible) ? <div className="mt-1 text-slate-500">Responsable : {safeStr(commitment.responsible)}</div> : null}
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       ) : null}
                                     </div>
                                   </details>
                                 ) : null}
                                <button
                                  type="button"
                                  disabled={!memberId}
                                  onClick={() => void loadCallTranscript(memberId)}
                                  className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Voir la transcription
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      </details>
                    </section>
                  ) : null}

                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (callTranscriptOpen) setCallTranscriptOpen(false);
                        else void loadCallTranscript();
                      }}
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-neutral-900"
                    >
                      <span>{callTranscriptOpen ? "Masquer la transcription" : callTranscriptMemberId ? "Voir la transcription du membre" : "Voir la transcription"}</span>
                      {callTranscriptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {callTranscriptOpen ? (
                      <div className="mt-3">
                        {callTranscriptLoading ? <p className="text-sm text-neutral-500">Chargement de la transcription…</p> : null}
                        {callTranscriptError ? <p className="text-sm text-neutral-500">{callTranscriptError}</p> : null}
                        {!callTranscriptLoading && !callTranscriptError && transcriptSegments(callTranscriptItem).length === 0 ? (
                          <p className="text-sm text-neutral-500">Transcription non disponible</p>
                        ) : null}
                        {transcriptSegments(callTranscriptItem).length > 0 ? (
                          <div className="space-y-3">
                            {transcriptSegments(callTranscriptItem).map((segment, index) => (
                              <div key={`${segment.timestamp}-${index}`} className="rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                                <div className="text-xs font-semibold text-neutral-500">{segment.speaker}{segment.timestamp ? ` · ${segment.timestamp}` : ""}</div>
                                <div className="mt-1 whitespace-pre-wrap text-neutral-800">{segment.text}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <p className="text-sm text-neutral-600">
                      Le rattachement utilise un membre de cette conversation ; le backend rattache ensuite tous les appels membres ensemble.
                    </p>
                    <button
                      type="button"
                      disabled={!callMemberId(selectedCall)}
                      onClick={openCallAttachment}
                      className="mt-3 rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedCall.linked_chantier_id ? "Modifier le rattachement" : "Rattacher au chantier"}
                    </button>

                    {attachSuccess && !callAttachOpen ? (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {attachSuccess}
                      </div>
                    ) : null}

                    {callAttachOpen ? (
                      <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                        <div className="text-sm font-semibold text-neutral-900">Rattacher cette conversation</div>
                        <p className="mt-1 text-xs text-neutral-500">
                          Le premier appel membre est utilisé pour rattacher toute la CallConversation.
                        </p>

                        {attachError ? (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {attachError}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-4">
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-neutral-700">Trouver un chantier existant</span>
                            <div className="flex gap-2">
                              <input
                                className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                placeholder="Référence, installateur ou morceau de texte…"
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
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                              >
                                {attachSearchLoading ? "Recherche…" : "Chercher"}
                              </button>
                            </div>
                            {attachResults.length > 0 ? (
                              <div className="max-h-48 overflow-auto rounded-2xl border border-neutral-200 bg-white">
                                {attachResults.map((result) => {
                                  const active = attachSelectedChantierId === result.chantier_id;
                                  return (
                                    <button
                                      key={result.group_key}
                                      type="button"
                                      onClick={() => selectAttachChantier(result.chantier_id)}
                                      className={[
                                        "w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-50",
                                        active ? "bg-neutral-100" : "bg-white",
                                      ].join(" ")}
                                    >
                                      <div className="font-medium text-neutral-900">{result.chantier_label || result.chantier_id}</div>
                                      <div className="mt-1 text-xs text-neutral-500">
                                        {result.installateur || "Installateur inconnu"} · {chantierStatusLabel(result.status)}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>

                          {attachSelectedChantierId ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                              Chantier sélectionné : <strong>{attachSelectedChantierId}</strong>
                            </div>
                          ) : null}

                          <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-neutral-700">Ou créer un nouveau chantier</span>
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
                              <span className="text-xs text-neutral-500">SAV-001 sera utilisée pour ce nouveau chantier.</span>
                            ) : null}
                          </label>

                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-neutral-700">Session SAV cible</span>
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                              <input
                                type="radio"
                                name="callAttachSavTarget"
                                className="h-4 w-4"
                                checked={attachCreateNewSav}
                                onChange={() => setAttachCreateNewSav(true)}
                                disabled={Boolean(attachNewChantierId.trim())}
                              />
                              {attachNewChantierId.trim() ? "SAV-001 pour ce nouveau chantier" : "Créer une nouvelle session SAV"}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                              <input
                                type="radio"
                                name="callAttachSavTarget"
                                className="h-4 w-4"
                                checked={!attachCreateNewSav}
                                onChange={() => setAttachCreateNewSav(false)}
                                disabled={!attachSelectedChantierId}
                              />
                              Rattacher à une session existante
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
                                  attachSavSessions.map((session) => (
                                    <option key={session.sav_session_id} value={session.sav_session_id}>
                                      {session.title || session.sav_session_id}
                                    </option>
                                  ))
                                )}
                              </select>
                            ) : null}
                          </div>

                          <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-neutral-700">Acteur</span>
                            <input
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                              value={attachActor}
                              onChange={(e) => setAttachActor(e.target.value)}
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={attachSelectedCallConversation}
                              disabled={attachLoading}
                              className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                            >
                              {attachLoading ? "Rattachement…" : "Confirmer le rattachement"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCallAttachOpen(false)}
                              disabled={attachLoading}
                              className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : !selectedItem ? (
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

function CallDiscoveryPanel({
  open,
  onOpenChange,
  calls,
  groups,
  totalHistoryCount,
  loading,
  error,
  lookbackMinutes,
  onLookbackMinutesChange,
  discoveryJob,
  onDiscover,
  onRefresh,
  selectedKeys,
  onSelectedKeysChange,
  processJob,
  processError,
  onProcess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calls: DiscoveredCall[];
  groups: GroupSuggestion[];
  totalHistoryCount: number | null;
  loading: boolean;
  error: string | null;
  lookbackMinutes: string;
  onLookbackMinutesChange: (value: string) => void;
  discoveryJob: DiscoveryJob | null;
  onDiscover: () => void;
  onRefresh: () => void;
  selectedKeys: Set<string>;
  onSelectedKeysChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  processJob: CallProcessJob | null;
  processError: string | null;
  onProcess: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const discoveryStatus = safeStr(discoveryJob?.status).toLowerCase();
  const processStatus = safeStr(processJob?.status).toLowerCase();
  const discoveryBusy = discoveryStatus === "queued" || discoveryStatus === "running";
  const processBusy = processStatus === "queued" || processStatus === "running";
  const allSelected = calls.length > 0 && calls.every((call) => selectedKeys.has(call.discovery_key));
  const total = processJob?.total_count || 0;
  const completed = processJob?.completed_count ?? processJob?.processed_count ?? 0;
  const failed = processJob?.failed_count ?? 0;
  const progress = total > 0 ? Math.min(100, Math.round(((completed + failed) / total) * 100)) : null;

  const toggleKey = (key: string) => {
    onSelectedKeysChange((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    onSelectedKeysChange((current) => {
      const next = new Set(current);
      if (allSelected) calls.forEach((call) => next.delete(call.discovery_key));
      else calls.forEach((call) => next.add(call.discovery_key));
      return next;
    });
  };

  const toggleGroup = (group: GroupSuggestion) => {
    onSelectedKeysChange((current) => {
      const next = new Set(current);
      const fingerprints = group.call_fingerprints || [];
      const shouldSelect = fingerprints.some((key) => !next.has(key));
      fingerprints.forEach((key) => (shouldSelect ? next.add(key) : next.delete(key)));
      return next;
    });
  };

  return (
    <>
      <section className="mb-7 rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">☎</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">Appels récents</span>
              <span className="block truncate text-xs font-normal text-slate-500">
                {calls.length} appel{calls.length > 1 ? "s" : ""} trouvé{calls.length > 1 ? "s" : ""}
                {totalHistoryCount !== null ? ` · ${totalHistoryCount} dans l’historique` : ""}
                {` · ${selectedKeys.size} sélectionné(s)`}
              </span>
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="call-lookback-compact">Période</label>
            <select
              id="call-lookback-compact"
              value={lookbackMinutes}
              onChange={(event) => onLookbackMinutesChange(event.target.value)}
              disabled={discoveryBusy || processBusy}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="60">1 heure</option>
              <option value="240">4 heures</option>
              <option value="600">10 heures</option>
              <option value="1440">24 heures</option>
            </select>
            <button
              type="button"
              onClick={onDiscover}
              disabled={discoveryBusy || processBusy}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discoveryBusy ? "Recherche…" : "Rechercher"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="h-10 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Afficher les appels
            </button>
          </div>
        </div>
      </section>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Fermer la découverte des appels"
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-950/30 backdrop-blur-[1px]"
          />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[980px] flex-col overscroll-contain border-l border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-5 top-5 z-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              Fermer
            </button>
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Découverte des appels récents</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recherche 3CX manuelle, indépendante du filtre de canal sélectionné.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="call-lookback">
              Période
            </label>
            <select
              id="call-lookback"
              value={lookbackMinutes}
              onChange={(event) => onLookbackMinutesChange(event.target.value)}
              disabled={discoveryBusy || processBusy}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="60">1 heure</option>
              <option value="240">4 heures</option>
              <option value="600">10 heures</option>
              <option value="1440">24 heures</option>
            </select>
            <button
              type="button"
              onClick={onDiscover}
              disabled={discoveryBusy || processBusy}
              className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discoveryBusy ? "Recherche en cours…" : "Rechercher les appels récents"}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || discoveryBusy || processBusy}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div> : null}
      {processError ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{processError}</div> : null}

      {processJob && processBusy ? (
        <div className="border-b border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-900">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              {callProcessStageLabel(processJob.stage)}
            </span>
            <span>{total > 0 ? `${completed + failed}/${total}` : "Progression en cours"}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-200">
            <div
              className={progress === null ? "h-full w-1/3 animate-pulse rounded-full bg-violet-700" : "h-full rounded-full bg-violet-700 transition-all"}
              style={progress === null ? undefined : { width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {processJob && processStatus === "completed" ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          Traitement terminé : {processJob.completed_count ?? processJob.processed_count ?? 0} appel(s) traité(s)
          {processJob.failed_count ? `, ${processJob.failed_count} échec(s)` : ""}.
        </div>
      ) : null}

      {groups.length ? (
        <div className="border-b border-violet-200 bg-violet-50/50 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Appels probablement liés</h3>
              <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-xs font-medium text-violet-700">
                {groups.length} groupe{groups.length > 1 ? "s" : ""}
              </span>
            </div>
            <span className="hidden text-xs text-slate-500 sm:inline">Sélection rapide par groupe</span>
          </div>
          <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
            {groups.map((group) => {
              const selected = group.call_fingerprints.length > 0 && group.call_fingerprints.every((key) => selectedKeys.has(key));
              const crm = group.crm;
              const crmMatches = Array.isArray(crm?.matches) ? crm.matches : [];
              const crmStatus = safeStr(crm?.status).toLowerCase();
              const crmLabel = crmStatus === "matched"
                ? crmMatches.length > 1
                  ? "Plusieurs correspondances CRM"
                  : crmMatches[0]
                    ? `${safeStr(crmMatches[0].name) || "Contact trouvé"}${safeStr(crmMatches[0].company) ? ` — ${safeStr(crmMatches[0].company)}` : ""}`
                    : "Correspondance CRM trouvée"
                : "";
              const displayPhone = safeStr(crmMatches[0]?.phone) || safeStr(group.phone) || safeStr(crm?.normalized_phone);
              return (
                <div key={group.group_id} className="flex min-w-[270px] max-w-[310px] snap-start items-center justify-between gap-3 rounded-lg border border-violet-200 bg-white px-3 py-2 shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{crmLabel || displayPhone || "Numéro inconnu"}</p>
                    </div>
                    <p className="truncate text-xs text-slate-500">{crmLabel ? displayPhone : "Correspondance CRM non disponible"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {group.call_fingerprints.length} appel{group.call_fingerprints.length > 1 ? "s" : ""}
                      {group.max_gap_minutes !== null && group.max_gap_minutes !== undefined ? ` · ${group.max_gap_minutes} min max` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-label={selected ? `Désélectionner le groupe ${group.group_id}` : `Sélectionner le groupe ${group.group_id}`}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${selected ? "border-violet-300 bg-violet-100 text-violet-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {selected ? "✓" : "+"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 text-sm">
        <label className="inline-flex items-center gap-2 font-medium text-slate-700">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!calls.length || processBusy} className="h-4 w-4 rounded border-slate-300" />
          Tout sélectionner
        </label>
        <span className="text-slate-500">
          {calls.length} appel(s) trouvé(s)
          {totalHistoryCount !== null ? ` · ${totalHistoryCount} dans l’historique` : ""}
          {` · ${selectedKeys.size} sélectionné(s)`}
        </span>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-sm text-slate-500">Chargement des appels découverts…</div>
      ) : calls.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3" />
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Collaborateur PERGE</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Contact CRM</th>
                <th className="px-4 py-3">Société / email</th>
                <th className="px-4 py-3">Statut CRM</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((call) => {
                const match = call.crm?.matches?.[0] || {};
                const multiple = (call.crm?.matches?.length || 0) > 1;
                return (
                  <tr key={call.discovery_key} className={selectedKeys.has(call.discovery_key) ? "bg-sky-50" : "hover:bg-slate-50"}>
                    <td className="px-5 py-3 align-top">
                      <input type="checkbox" checked={selectedKeys.has(call.discovery_key)} onChange={() => toggleKey(call.discovery_key)} disabled={processBusy} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-slate-700">{call.date_label || formatDiscoveryDate(call.started_at)}</td>
                    <td className="px-4 py-3 align-top text-slate-700">{discoveredCollaborator(call)}</td>
                    <td className="px-4 py-3 align-top font-medium text-slate-900">{call.phone_labels?.[0] || "—"}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {safeStr(match.name) || "Non trouvé"}
                      {multiple ? <span className="mt-1 block text-xs text-amber-700">Plusieurs correspondances CRM</span> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      <div>{safeStr(match.company) || "—"}</div>
                      <div className="text-xs">{safeStr(match.email) || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {crmStatusLabel(call.crm?.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{discoveredStatusLabel(call.processing_status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8 text-sm text-slate-500">Aucun appel découvert. Lancez une recherche pour récupérer les appels récents.</div>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <span className="text-sm font-semibold text-slate-700">{selectedKeys.size} appel(s) sélectionné(s)</span>
        <button type="button" onClick={onProcess} disabled={!selectedKeys.size || discoveryBusy || processBusy} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
          {processBusy ? "Traitement en cours…" : "Traiter les appels sélectionnés"}
        </button>
      </div>
    </section>
          </aside>
        </>
      ) : null}
    </>
  );
}

function discoveredCollaborator(call: DiscoveredCall) {
  const labels = Array.isArray(call.labels) ? call.labels : [];
  return labels.find((label) => !call.phone_labels?.includes(label)) || "Non identifié";
}

function formatDiscoveryDate(value?: string | number | null) {
  if (!value) return "Date inconnue";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? formatTs(numeric) : safeStr(value);
}

function discoveredStatusLabel(status?: string | null) {
  const normalized = safeStr(status).toLowerCase();
  if (normalized === "discovered") return "Découvert";
  if (normalized === "processing") return "En traitement";
  if (normalized === "completed") return "Traité";
  if (normalized === "failed") return "Échec";
  return status || "Disponible";
}

function crmStatusLabel(status?: string | null) {
  const normalized = safeStr(status).toLowerCase();
  if (normalized === "matched") return "Correspondance trouvée";
  if (normalized === "unmatched") return "Non trouvé";
  if (normalized === "multiple") return "Plusieurs correspondances";
  return status || "Non vérifié";
}

function callProcessStageLabel(stage?: string | null) {
  const normalized = safeStr(stage).toLowerCase();
  if (normalized === "downloading") return "Téléchargement des appels…";
  if (normalized === "importing") return "Import des appels…";
  if (normalized === "transcribing") return "Transcription des appels…";
  if (normalized === "analyzing") return "Analyse des appels…";
  return "Traitement des appels…";
}

function callMemberCount(call: CallConversation) {
  return call.member_count || call.member_inbox_item_ids?.length || call.members?.length || 1;
}

function callConversationSummary(call: CallConversation) {
  const globalSummary = callAnalysisSummary(call);
  return callMemberCount(call) > 1 ? globalSummary || safeStr(call.summary) : safeStr(call.summary) || globalSummary;
}

function callChronology(call: CallConversation): CallChronologyBlock[] {
  const value = call.analysis?.chronology;
  return Array.isArray(value) ? value.filter((item): item is CallChronologyBlock => Boolean(item && typeof item === "object")) : [];
}

function callCommitments(call: CallConversation): CallCommitment[] {
  const value = call.analysis?.commitments;
  return Array.isArray(value) ? value.filter((item): item is CallCommitment => Boolean(item && typeof item === "object")) : [];
}

function commitmentTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    piece_detachee: "Pièce détachée",
    documentation: "Documentation",
    verification: "Vérification",
    retour_attendu: "Retour attendu",
    autre: "Engagement",
  };
  return labels[safeStr(value)] || "Engagement";
}

function commitmentStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    a_faire: "À faire",
    en_attente_retour: "En attente d’un retour",
    realisee: "Réalisée",
    incertaine: "À confirmer",
  };
  return labels[safeStr(value)] || "Statut non précisé";
}

function contactLabel(contact?: Record<string, unknown> | null) {
  if (!contact) return "";
  const name = firstNonEmpty(contact.name);
  const company = firstNonEmpty(contact.company);
  const identity = name && company ? `${name} · ${company}` : firstNonEmpty(name, company);
  return firstNonEmpty(identity, contact.display, contact.email);
}

function memberDate(member: CallConversationMember) {
  const value = member.started_at || member.updated_at || member.ended_at;
  if (!value) return "Date inconnue";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? formatTs(numeric) : safeStr(value);
}

function memberCollaboratorLabel(member: CallConversationMember) {
  const values = Array.isArray(member.perge_collaborators)
    ? member.perge_collaborators
    : member.perge_collaborator !== undefined
    ? [member.perge_collaborator]
    : [];
  return values
    .map((value) => {
      if (typeof value === "string" || typeof value === "number") return String(value);
      if (!value || typeof value !== "object") return "";
      const row = value as Record<string, unknown>;
      return firstNonEmpty(row.name, row.display, row.email, row.user_name);
    })
    .filter(Boolean)
    .join(", ") || "Collaborateur non renseigné";
}

function memberAnalysisList(member: CallConversationMember, ...keys: string[]) {
  const analysis = member.analysis || {};
  for (const key of keys) {
    const value = member[key] ?? analysis[key];
    if (Array.isArray(value)) {
      const items = value
        .map((item) => typeof item === "string" || typeof item === "number" ? String(item) : safeStr((item as Record<string, unknown>)?.text || (item as Record<string, unknown>)?.label))
        .filter(Boolean);
      if (items.length) return items;
    } else {
      const text = safeStr(value);
      if (text) return [text];
    }
  }
  return [];
}

function memberChronology(member: CallConversationMember): CallChronologyBlock[] {
  const value = member.analysis?.chronology;
  return Array.isArray(value)
    ? value.filter((item): item is CallChronologyBlock => Boolean(item && typeof item === "object"))
    : [];
}

function memberCommitments(member: CallConversationMember): CallCommitment[] {
  const value = member.analysis?.commitments;
  return Array.isArray(value)
    ? value.filter((item): item is CallCommitment => Boolean(item && typeof item === "object"))
    : [];
}

function callScope(call: CallConversation) {
  return safeStr(call.scope, "SAV_RELEVANT").toUpperCase();
}

function callPhoneOrContact(call: CallConversation) {
  const contact = call.contact || {};
  const name = firstNonEmpty(contact.name);
  const company = firstNonEmpty(contact.company);
  const identity = name && company ? `${name} · ${company}` : firstNonEmpty(name, company);
  return firstNonEmpty(
    identity,
    contact.display,
    contact.email,
    call.external_phone,
    "Contact inconnu",
  );
}

function callProductLabel(call: CallConversation) {
  const product = call.product;
  if (typeof product === "string" || typeof product === "number") return String(product);
  if (!product || typeof product !== "object") return "";

  const row = product as Record<string, unknown>;
  return firstNonEmpty(row.product_label, row.label, row.product_code, row.code);
}

function callCollaborators(call: CallConversation) {
  const values = Array.isArray(call.perge_collaborators) ? call.perge_collaborators : [];
  return values
    .map((value) => {
      if (typeof value === "string" || typeof value === "number") return String(value);
      if (!value || typeof value !== "object") return "";
      const row = value as Record<string, unknown>;
      return firstNonEmpty(row.name, row.display, row.email, row.user_name);
    })
    .filter(Boolean);
}

function callTitle(call: CallConversation) {
  const analysisTitle = safeStr(call.analysis?.title);
  if (analysisTitle) return analysisTitle;
  if (safeStr(call.title)) return safeStr(call.title);
  const summary = safeStr(call.summary);
  if (summary) return summary;
  return "Appel téléphonique";
}

function callDate(call: CallConversation) {
  const value = call.started_at || call.ended_at;
  if (!value) return "Date inconnue";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? formatTs(numeric) : String(value);
}

function callDuration(seconds?: number | null) {
  if (!seconds || seconds < 0) return "Durée inconnue";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return minutes ? `${minutes} min ${String(remaining).padStart(2, "0")} s` : `${remaining} s`;
}

function callProcessingLabel(call: CallConversation) {
  const processing = call.processing;
  const status = typeof processing === "string" ? processing : safeStr(processing && processing.status);
  const stage = typeof processing === "object" && processing ? safeStr(processing.stage) : "";
  return status || stage || "Disponible";
}

function callAnalysisList(call: CallConversation, ...keys: string[]) {
  const analysis = call.analysis || {};
  for (const key of keys) {
    const value = analysis[key];
    if (Array.isArray(value)) {
      const items = value
        .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : safeStr((item as Record<string, unknown>)?.text || (item as Record<string, unknown>)?.label)))
        .filter(Boolean);
      if (items.length > 0) return items;
      continue;
    }
    const text = safeStr(value);
    if (text) return [text];
  }
  return [];
}

function callAnalysisSummary(call: CallConversation) {
  return safeStr(call.analysis?.summary) || safeStr(call.analysis?.resume);
}

function callAnalysisTitle(call: CallConversation) {
  return safeStr(call.analysis?.title) || "Analyse de l’appel";
}

function callMemberId(call: CallConversation) {
  return safeStr(call.member_inbox_item_ids?.[0]);
}

function getCallConversations(overview?: InboxOverviewResponse | null) {
  const topLevel = overview?.call_conversations;
  if (Array.isArray(topLevel) && topLevel.length > 0) return topLevel;

  const fromPayload = overview?.payload?.call_conversations;
  if (Array.isArray(fromPayload) && fromPayload.length > 0) return fromPayload;

  return Array.isArray(topLevel) ? topLevel : Array.isArray(fromPayload) ? fromPayload : [];
}

type TranscriptSegment = {
  speaker: string;
  text: string;
  timestamp: string;
};

function transcriptSegments(detail: InboxItemDetail | null): TranscriptSegment[] {
  if (!detail) return [];
  const callPayload = detail.call || null;
  const callTranscription = callPayload?.transcription;
  const raw =
    detail.transcription ||
    detail.transcript ||
    detail.segments ||
    callTranscription ||
    callPayload?.transcript;
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).segments)
    ? ((raw as Record<string, unknown>).segments as unknown[])
    : [];

  if (candidates.length === 0) {
    const text = safeStr(detail.clean_content_text || detail.raw_content_text);
    return text ? [{ speaker: "Transcription", text, timestamp: "" }] : [];
  }

  return candidates
    .map((segment: unknown) => {
      if (!segment || typeof segment !== "object") return null;
      const row = segment as Record<string, unknown>;
      return {
        speaker: firstNonEmpty(row.speaker, row.speaker_label, row.role, "Interlocuteur"),
        text: firstNonEmpty(row.text, row.content, row.transcript),
        timestamp: firstNonEmpty(row.start, row.start_time, row.timestamp, row.offset),
      };
    })
    .filter((segment): segment is { speaker: string; text: string; timestamp: string } => Boolean(segment?.text));
}
