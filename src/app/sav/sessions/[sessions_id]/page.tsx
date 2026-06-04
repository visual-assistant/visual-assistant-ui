"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../../../components/AppShell";

/**
 * Chantier détail — Étape 2.5 (READ-ONLY + Chantier stable fini)
 * Patch A: mapping safe + pas de "[object Object]" + champs vides si inconnus
 * Patch B: Owner connecté à PATCH /chantiers/{chantier_id}
 * Patch C: Recherche CRM (GET /contacts/search?q=...) + sélection => PATCH context.installateur
 * Patch D: Produit connecté (GET /products + PATCH context.produit)
 *
 * ENV (compat ancien code):
 *   NEXT_PUBLIC_INTERNAL_API (fallback http://localhost:8001)
 *   NEXT_PUBLIC_INTERNAL_API_BASE_URL (optionnel)
 */

const USERS = ["Xavier Briffa", "Florent Boeuf", "William Perge"] as const;
type UserName = (typeof USERS)[number];

const NOTE_TARGET_OPTIONS = [
  { code: "INSTALLATEUR", label: "Installateur" },
  { code: "COMMERCIAL", label: "Commercial" },
  { code: "QUALITE", label: "Qualité" },
  { code: "BUREAU_ETUDES", label: "Bureau d'études" },
  { code: "DIRECTION", label: "Direction" },
  { code: "INTERNE", label: "Interne" },
] as const;

const NOTE_CHANNEL_OPTIONS = [
  { code: "WHATSAPP", label: "WhatsApp" },
  { code: "EMAIL", label: "Email" },
  { code: "NONE", label: "—" },
] as const;

const NOTE_ALLOWED_CHANNELS_BY_TARGET: Record<NoteTargetCode, NoteChannelCode[]> = {
  INSTALLATEUR: ["WHATSAPP", "EMAIL"],
  COMMERCIAL: ["EMAIL"],
  QUALITE: ["EMAIL"],
  BUREAU_ETUDES: ["EMAIL"],
  DIRECTION: ["EMAIL"],
  INTERNE: ["NONE"],
};

type NoteTargetCode = (typeof NOTE_TARGET_OPTIONS)[number]["code"];
type NoteChannelCode = (typeof NOTE_CHANNEL_OPTIONS)[number]["code"];

const CURRENT_USER_STORAGE_KEY = "sav_current_user_v1";
const OWNER_STORAGE_KEY = "chantier_owner_v1";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function get(obj: any, path: string, fallback?: any) {
  try {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  } catch {
    return fallback;
  }
}

function safeStr(v: any, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  // ⚠️ si c'est un objet, on NE le stringifie pas (sinon [object Object])
  return fallback;
}

function uniqStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function arraysEqualIgnoreOrder(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const aa = [...a].map((x) => x.trim()).filter(Boolean).sort();
  const bb = [...b].map((x) => x.trim()).filter(Boolean).sort();
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

function Pill({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "neutral" | "success" | "info";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
          : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  variant = "outline",
  className,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "outline" | "solid";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "solid"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : "bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50";
  return (
    <button
      type="button"
      className={cx(base, styles, className)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
  className,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          {title ? (
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          ) : (
            <div />
          )}
          {right}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  // ✅ valeur vide = affichage vide (pas de "—")
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-neutral-900">{value}</div>
    </div>
  );
}

function FakeSelect({ value }: { value: string }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-xl bg-neutral-50 px-3 text-sm text-neutral-900 ring-1 ring-neutral-200">
      <span>{value}</span>
      <span className="text-neutral-400">▾</span>
    </div>
  );
}

function FakeInput({
  placeholder,
  value,
}: {
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex h-10 items-center rounded-xl bg-white px-3 text-sm text-neutral-900 ring-1 ring-neutral-200">
      <span className={value ? "text-neutral-900" : "text-neutral-400"}>
        {value || placeholder}
      </span>
    </div>
  );
}

type UiSavSession = {
  id: string;
  code: string;
  dateLabel: string;
  category: string;
  subCategory: string;
  symptom: string;
  statusLabel: string;
};

type UiSavNote = {
  id: string;
  target: string;   // ex: "Commercial", "Installateur", "Interne", ...
  channel: string;  // ex: "Email", "WhatsApp", "—"
  status: string;   // ex: "Brouillon", "Envoyé", "Échec"
  text: string;
  createdAt: string;
  updatedAt: string;
};

type UiInboundAttachment = {
  filename: string;
  url: string;
  mimeType: string;
};

type UiInboundPhoto = {
  photoUid: string;
  url: string;
};

type UiInboundMessage = {
  id: string;
  channel: "WHATSAPP" | "EMAIL" | string;
  channelLabel: string;
  senderDisplay: string;
  senderRole: string;
  receivedAt: any;
  lastMessageAt: any;
  receivedAtLabel: string;
  kind: string;
  kindLabel: string;
  subject: string;
  text: string;
  messageCount: number;
  photoCount: number;
  attachmentCount: number;
  photos: UiInboundPhoto[];
  attachments: UiInboundAttachment[];
};

type UiInboundSummary = {
  channelLabel: string;
  channel: string;
  senderDisplay: string;
  totalMessages: number;
  totalPhotos: number;
  totalAttachments: number;
  firstReceivedLabel: string;
  lastReceivedLabel: string;
};

function normalizeNoteTarget(raw: any): string {
  const s = safeStr(raw, "");
  if (!s) return "—";
  if (s === "INSTALLATEUR") return "Installateur";
  if (s === "COMMERCIAL") return "Commercial";
  if (s === "QUALITE") return "Qualité";
  if (s === "BUREAU_ETUDES") return "Bureau d'études";
  if (s === "DIRECTION") return "Direction";
  if (s === "INTERNE") return "Interne";
  return s;
}

function normalizeNoteChannel(raw: any): string {
  const s = safeStr(raw, "");
  if (!s || s === "NONE") return "—";
  if (s === "EMAIL") return "Email";
  if (s === "WHATSAPP") return "WhatsApp";
  return s;
}

function normalizeNoteStatus(raw: any): string {
  const s = safeStr(raw, "");
  if (!s) return "Brouillon";
  if (s === "DRAFT") return "Brouillon";
  if (s === "SENT") return "Envoyé";
  if (s === "FAILED") return "Échec";
  return s;
}

function normalizeNoteStatusCode(raw: any): "DRAFT" | "SENT" | "FAILED" {
  const s = safeStr(raw, "").toUpperCase();
  if (s === "SENT") return "SENT";
  if (s === "FAILED") return "FAILED";
  return "DRAFT";
}

function noteStatusTone(code: "DRAFT" | "SENT" | "FAILED"): "neutral" | "success" | "warning" {
  if (code === "SENT") return "success";
  if (code === "FAILED") return "warning";
  return "neutral";
}

function pickMostRecentNoteId(notes: UiSavNote[]): string {
  if (!notes.length) return "";

  const score = (n: UiSavNote) => {
    // updatedAt / createdAt peuvent être des timestamps epoch seconds,
    // parfois convertis en string par safeStr().
    return toTs(n.updatedAt) || toTs(n.createdAt) || 0;
  };

  const sorted = [...notes].sort((a, b) => score(b) - score(a));
  return sorted[0]?.id || "";
}

function statusTone(statusLabel: string): "warning" | "neutral" | "success" | "info" {
  const s = (statusLabel || "").toLowerCase();
  if (s.includes("résolu") || s.includes("resolu")) return "success";
  if (s.includes("interne")) return "warning";
  if (s.includes("installateur")) return "info";
  return "neutral";
}

function normalizeStatusLabel(raw: any): string {
  const s = safeStr(raw, "");
  if (!s) return "A traiter";
  if (s === "A_TRAITER") return "A traiter";
  if (s === "EN_ATTENTE_INTERNE") return "En attente interne";
  if (s === "EN_ATTENTE_INSTALLATEUR") return "En attente installateur";
  if (s === "RESOLU") return "Résolu";
  return s;
}

function normalizeStatusCode(raw: any): string {
  const s = safeStr(raw, "").toUpperCase();
  if (s === "EN_ATTENTE_INTERNE") return "EN_ATTENTE_INTERNE";
  if (s === "EN_ATTENTE_INSTALLATEUR") return "EN_ATTENTE_INSTALLATEUR";
  if (s === "RESOLU") return "RESOLU";
  return "A_TRAITER";
}

const SAV_STATUS_OPTIONS = [
  { value: "A_TRAITER", label: "A traiter" },
  { value: "EN_ATTENTE_INTERNE", label: "En attente interne" },
  { value: "EN_ATTENTE_INSTALLATEUR", label: "En attente installateur" },
  { value: "RESOLU", label: "Résolu" },
] as const;

function formatHumanDate(value: any): string {
  if (value === null || value === undefined) return "";

  // number (epoch seconds)
  if (typeof value === "number" && isFinite(value)) {
    const d = new Date(value * 1000);
    return d.toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // numeric string (epoch seconds)
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "";

    const asNum = Number(s);
    if (!Number.isNaN(asNum) && isFinite(asNum)) {
      const d = new Date(asNum * 1000);
      return d.toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    // ISO / date-like
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    // fallback: keep short
    return s.slice(0, 16);
  }

  return "";
}

function toTs(value: any): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return 0;

    const asNum = Number(s);
    if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
      return asNum;
    }

    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      return parsed / 1000;
    }
  }

  return 0;
}

function normalizeInboundChannelLabel(channel: any): string {
  const s = safeStr(channel, "").toUpperCase();
  if (s === "WHATSAPP") return "WhatsApp";
  if (s === "EMAIL") return "Email";
  return s || "Canal inconnu";
}

function normalizeInboundKindLabel(kind: any, channel: any): string {
  const k = safeStr(kind, "").toLowerCase();
  const c = safeStr(channel, "").toUpperCase();

  if (k === "caption") return "Légende photo";
  if (k === "message") return "Message";
  if (k === "email") return "Email";
  if (k === "whatsapp_thread") return "Fil WhatsApp";
  if (k === "email_thread") return "Email";
  if (c === "WHATSAPP") return "Fil WhatsApp";
  if (c === "EMAIL") return "Email";
  return "Message reçu";
}

function inboundChannelTone(channel: any): string {
  const s = safeStr(channel, "").toUpperCase();
  if (s === "WHATSAPP") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (s === "EMAIL") return "bg-blue-100 text-blue-800 ring-blue-200";
  return "bg-neutral-100 text-neutral-700 ring-neutral-200";
}

function inboundChannelIcon(channel: any): string {
  const s = safeStr(channel, "").toUpperCase();
  if (s === "WHATSAPP") return "💬";
  if (s === "EMAIL") return "✉️";
  return "📥";
}

function MessagesRecusTab({
  messages,
  summary,
  selectedSessionLabel,
}: {
  messages: UiInboundMessage[];
  summary: UiInboundSummary;
  selectedSessionLabel: string;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Messages reçus</h2>
          <p className="mt-2 text-sm text-slate-500">
            Historique des messages, photos et fichiers reçus avant rattachement au chantier.
          </p>
          {selectedSessionLabel ? (
            <div className="mt-2 text-xs text-slate-400">
              Session affichée : {selectedSessionLabel}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>{inboundChannelIcon(summary.channel)}</span>
              <span className="font-semibold text-slate-900">{summary.channelLabel}</span>
            </div>

            <div className="text-slate-600">
              {summary.totalPhotos} photo{summary.totalPhotos > 1 ? "s" : ""}
            </div>

            <div className="text-slate-600">
              {summary.totalMessages} message{summary.totalMessages > 1 ? "s" : ""}
            </div>

            <div className="text-slate-600">
              Dernier : {summary.lastReceivedLabel || "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-lg font-semibold text-slate-950">Fil de réception</h3>

            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-slate-200">
                  📥
                </div>
                <h4 className="mt-4 font-semibold text-slate-900">Aucun message reçu</h4>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Les messages WhatsApp, captions, emails ou fichiers rattachés à cette session SAV apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={msg.id} className="relative">
                    {index < messages.length - 1 ? (
                      <div className="absolute bottom-0 left-4 top-11 w-px bg-slate-200" />
                    ) : null}

                    <div className="flex gap-4">
                      <div
                        className={cx(
                          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ring-1",
                          msg.channel === "WHATSAPP"
                            ? "bg-emerald-100 ring-emerald-200"
                            : msg.channel === "EMAIL"
                              ? "bg-blue-100 ring-blue-200"
                              : "bg-slate-100 ring-slate-200",
                        )}
                      >
                        {inboundChannelIcon(msg.channel)}
                      </div>

                      <article className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cx(
                                  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1",
                                  inboundChannelTone(msg.channel),
                                )}
                              >
                                {msg.channelLabel}
                              </span>

                              <span className="text-sm font-semibold text-slate-950">
                                {msg.senderDisplay || "Expéditeur inconnu"}
                              </span>

                              {msg.senderRole ? (
                                <>
                                  <span className="text-xs text-slate-400">·</span>
                                  <span className="text-xs text-slate-500">{msg.senderRole}</span>
                                </>
                              ) : null}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {msg.receivedAtLabel || "Date inconnue"}
                            </div>
                          </div>

                          <span className="shrink-0 text-xs text-slate-500">
                            {msg.kindLabel}
                          </span>
                        </div>

                        {msg.subject ? (
                          <div className="mb-3">
                            <div className="text-xs font-semibold text-slate-500">Sujet :</div>
                            <div className="mt-1 text-sm font-semibold text-slate-950">
                              {msg.subject}
                            </div>
                          </div>
                        ) : null}

                        {msg.text ? (
                          <div className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                            {msg.text}
                          </div>
                        ) : null}

                        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          {msg.photoCount > 0 ? (
                            <span>🖼️ {msg.photoCount} photo{msg.photoCount > 1 ? "s" : ""}</span>
                          ) : null}

                          {msg.attachmentCount > 0 ? (
                            <span>
                              📎 {msg.attachmentCount} pièce{msg.attachmentCount > 1 ? "s" : ""} jointe{msg.attachmentCount > 1 ? "s" : ""}
                            </span>
                          ) : null}

                          {msg.photoCount === 0 && msg.attachmentCount === 0 ? (
                            <span className="text-slate-400">Aucun média</span>
                          ) : null}
                        </div>

                        {msg.photos.length > 0 ? (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {msg.photos.slice(0, 4).map((photo) =>
                              photo.url ? (
                                <div
                                  key={photo.photoUid}
                                  className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-white"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photo.url}
                                    alt="Photo reçue"
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div
                                  key={photo.photoUid}
                                  className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-2xl text-slate-400"
                                >
                                  🖼️
                                </div>
                              ),
                            )}

                            {msg.photos.length > 4 ? (
                              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600">
                                +{msg.photos.length - 4}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {msg.attachments.length > 0 ? (
                          <div className="space-y-2">
                            {msg.attachments.map((att, i) => {
                              const label = att.filename || `Pièce jointe ${i + 1}`;

                              return att.url ? (
                                <a
                                  key={`${label}-${i}`}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
                                >
                                  <span>📎</span>
                                  <span className="truncate">{label}</span>
                                </a>
                              ) : (
                                <div
                                  key={`${label}-${i}`}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                >
                                  <span>📎</span>
                                  <span className="truncate">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="xl:col-span-1">
          <div className="sticky top-[164px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-slate-950">Résumé réception</h3>

            <div className="space-y-5">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">Canal principal</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>{inboundChannelIcon(summary.channel)}</span>
                  <span>{summary.channelLabel}</span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">Expéditeur principal</div>
                <div className="text-sm font-semibold text-slate-900">
                  {summary.senderDisplay || "—"}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-600">Messages totaux</span>
                    <span className="text-sm font-semibold text-slate-900">{summary.totalMessages}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-600">Photos</span>
                    <span className="text-sm font-semibold text-slate-900">{summary.totalPhotos}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-600">Fichiers</span>
                    <span className="text-sm font-semibold text-slate-900">{summary.totalAttachments}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">Première réception</div>
                    <div className="text-sm text-slate-900">{summary.firstReceivedLabel || "—"}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">Dernière réception</div>
                    <div className="text-sm text-slate-900">{summary.lastReceivedLabel || "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SessionsListItem({
  session,
  isSelected,
  isEditing,
  onClick,
  onStartEdit,
  onStopEdit,
  displayName,
  onRename,
  onCommitName,
  onDelete,
}: {
  session: UiSavSession;
  isSelected: boolean;
  isEditing: boolean;
  onClick: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  displayName: string;
  onRename: (name: string) => void;
  onCommitName: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onStopEdit();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStopEdit();
          onClick();
        }
      }}
      className={cx(
        "w-full rounded-2xl p-3 text-left ring-1 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200",
        isSelected
          ? "bg-orange-50 ring-orange-200"
          : "bg-white ring-neutral-200 hover:bg-neutral-50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-900 min-w-0">
          {isSelected && isEditing ? (
            <input
              className="w-full rounded-lg bg-white px-2 py-1 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200"
              value={displayName}
              placeholder={session.code}
              autoFocus
              onChange={(e) => onRename(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()} // ✅ empêche le click outside global
              onClick={(e) => e.stopPropagation()}
              onBlur={() => {
                onCommitName();
                onStopEdit(); // ✅ clic ailleurs => blur => exit rename
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitName();
                  onStopEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onStopEdit();
                }
              }}
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">
                {displayName?.trim() ? displayName : session.code}
              </span>

              {session.category ? (
                <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                  {session.category}
                </span>
              ) : null}

              {/* bouton renommer visible seulement quand la session est sélectionnée */}
              {isSelected ? (
                <>
                  <button
                    type="button"
                    className="shrink-0 rounded-md bg-white/70 px-2 py-1 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-white"
                    title="Renommer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit();
                    }}
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                    title="Supprimer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    🗑
                  </button>
                </>
              ) : null}
            </div>
          )}

        </div>
        <Pill tone={statusTone(session.statusLabel)}>{session.statusLabel}</Pill>
      </div>
    </div>
  );
}

/** CRM result type from internal_api.py */
type CrmCandidate = {
  name: string;
  company: string;
  email: string;
  phone: string;
  display: string;
};

/** Product option from internal_api.py GET /products */
type ProductOption = {
  code: string;
  label: string;
};

type AiImproveMeta = {
  model?: string | null;
  target?: string | null;
  channel?: string | null;
  used_ai?: boolean;
};

type AiImproveResult = {
  can_generate: boolean;
  severity: "ok" | "warning" | "blocked_for_ai" | string;
  suggested_subject?: string | null;
  suggested_body?: string | null;
  warnings: string[];
  missing_info: string[];
  explanation: string;
  meta?: AiImproveMeta;
};

type AiImproveResponse = {
  ok: boolean;
  result: AiImproveResult;
};


export default function ChantierDetailPage() {
  const [mainTab, setMainTab] = useState<"CHANTIER" | "SESSION" | "MESSAGES">("SESSION");

  // ✅ route param robuste (sessions_id / chantier_id / key / etc.)
  const params = useParams() as Record<string, string | string[] | undefined>;
  const router = useRouter();

  const rawKey =
    (typeof params?.key === "string" && params.key) ||
    (typeof params?.sessions_id === "string" && params.sessions_id) ||
    (typeof params?.session_id === "string" && params.session_id) ||
    (typeof params?.chantier_id === "string" && params.chantier_id) ||
    (typeof params?.id === "string" && params.id) ||
    (Object.values(params).find((v) => typeof v === "string") as
      | string
      | undefined) ||
    "";

  // IMPORTANT: Next peut te donner un segment déjà encodé (ex: "54%20avenue...").
  // Si on re-encode derrière => "%25" => 404 côté backend.
  const key = (() => {
    try {
      return decodeURIComponent(rawKey);
    } catch {
      return rawKey;
    }
  })();

  const sessionNamesStorageKey = useMemo(() => {
    // clé stable par chantier
    return `chantier_${key}_sav_session_names_v1`;
  }, [key]);

  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(sessionNamesStorageKey);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") setSessionNames(obj);
      }
    } catch {}
  }, [key, sessionNamesStorageKey]);

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(sessionNamesStorageKey, JSON.stringify(sessionNames));
    } catch {}
  }, [key, sessionNamesStorageKey, sessionNames]);

  // IMPORTANT: pas de trim ici sinon tu “perds” les espaces pendant la saisie
  function setSessionDisplayName(savSessionId: string, name: string) {
    const val = name ?? "";
    setSessionNames((prev) => ({ ...prev, [savSessionId]: val }));
  }

  // Si tu veux “nettoyer” (trim) => on le fait sur blur / enter, pas onChange
  function commitSessionDisplayName(savSessionId: string) {
    setSessionNames((prev) => {
      const current = prev[savSessionId] ?? "";
      const cleaned = current.replace(/\s+/g, " ").trim(); // garde les espaces entre mots
      return { ...prev, [savSessionId]: cleaned };
    });
  }

  // ✅ API_BASE compat ancien code
  const API_BASE = useMemo(() => {
    const v =
      process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_INTERNAL_API ||
      "http://localhost:8001";
    return String(v).replace(/\/$/, "");
  }, []);

  // ---------------------------
  // Patch D — Produit connecté (GET /products + PATCH context.produit)
  // ---------------------------
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // ---------------------------
  // Catalogue classification (catégories / sous-catégories)
  // ---------------------------
  const [catalogClassification, setCatalogClassification] = useState<{
    categories: { code: string; label: string }[];
    sub_categories: { code: string; label: string }[];
  } | null>(null);

  const [catalogClassificationError, setCatalogClassificationError] = useState<string | null>(null);

  const fetchCatalogClassification = useCallback(async () => {
    setCatalogClassificationError(null);
    try {
      const res = await fetch(`${API_BASE}/catalog/classification`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const categories = Array.isArray(json?.categories) ? json.categories : [];
      const sub_categories = Array.isArray(json?.sub_categories) ? json.sub_categories : [];

      setCatalogClassification({ categories, sub_categories });
    } catch (e: any) {
      setCatalogClassification(null);
      setCatalogClassificationError(e?.message || "Erreur catalogue classification");
    }
  }, [API_BASE]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const url = `${API_BASE}/products`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API /products: HTTP ${res.status} — ${txt.slice(0, 160)}`,
        );
      }
      const json = (await res.json()) as any[];
      const opts: ProductOption[] = Array.isArray(json)
        ? json
            .map((p) => ({
              code: safeStr(p?.code, ""),
              label: safeStr(p?.label, ""),
            }))
            .filter((p) => p.code && p.label)
        : [];
      setProducts(opts);
    } catch (e: any) {
      setProductsError(e?.message || "Erreur /products inconnue");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCatalogClassification();
  }, [fetchCatalogClassification]);

  const [debugOpen, setDebugOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserName>("William Perge");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_STORAGE_KEY) as UserName;
      if (saved && USERS.includes(saved)) setCurrentUser(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, currentUser);
    } catch {}
  }, [currentUser]);

  // Data load state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchSavItem = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!key) {
      setData(null);
      setLoading(false);
      setError("URL invalide: key manquant dans la route.");
      return;
    }

    try {
      const url = `${API_BASE}/chantiers/${encodeURIComponent(key)}`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API /chantiers/{id}: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      const json = await res.json();

      // On garde le même shape "data.chantier" que le reste du fichier attend déjà
      setData({ kind: "chantier", chantier: json });
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [API_BASE, key]);

  useEffect(() => {
    void fetchSavItem();
  }, [fetchSavItem]);

  const kind = get(data, "kind", null);
  const chantier = get(data, "chantier", null);

  // ✅ Chantier stable mapping (format Glass/Mat)
  const chantierTitle =
    safeStr(get(chantier, "title", ""), "") ||
    safeStr(get(chantier, "context.reference_chantier", ""), "") ||
    safeStr(get(chantier, "context.nom_chantier", ""), "");

  const referenceChantierFromData =
    safeStr(get(chantier, "context.reference_chantier", ""), "") ||
    safeStr(get(chantier, "title", ""), "") ||
    safeStr(get(chantier, "context.nom_chantier", ""), "");

  const numeroSerieFromData =
    safeStr(get(chantier, "context.numero_serie", ""), "") ||
    safeStr(get(chantier, "stable.numero_serie", ""), "");

  const [referenceChantier, setReferenceChantier] = useState<string>("");

  useEffect(() => {
    setReferenceChantier(referenceChantierFromData);
  }, [referenceChantierFromData]);

  const [numeroSerie, setNumeroSerie] = useState<string>("");

  useEffect(() => {
    setNumeroSerie(numeroSerieFromData);
  }, [numeroSerieFromData]);

  const produitRaw = safeStr(get(chantier, "context.produit", ""), "");

  const instCompany = safeStr(
    get(chantier, "context.installateur.company", ""),
    "",
  );
  const instName = safeStr(get(chantier, "context.installateur.name", ""), "");
  const instEmail = safeStr(get(chantier, "context.installateur.email", ""), "");
  const instPhone = safeStr(get(chantier, "context.installateur.phone", ""), "");

  const [installateurEmail, setInstallateurEmail] = useState<string>("");
  const [installateurPhone, setInstallateurPhone] = useState<string>("");

  useEffect(() => {
    setInstallateurEmail(instEmail);
  }, [instEmail]);

  useEffect(() => {
    setInstallateurPhone(instPhone);
  }, [instPhone]);

  const [installateurEmailSaving, setInstallateurEmailSaving] = useState(false);
  const [installateurEmailError, setInstallateurEmailError] = useState<string | null>(null);

  const [installateurPhoneSaving, setInstallateurPhoneSaving] = useState(false);
  const [installateurPhoneError, setInstallateurPhoneError] = useState<string | null>(null);

  // Produit: on stocke de préférence le "code" (ex: optipellet),
  // mais on accepte aussi qu'un ancien chantier ait stocké le label (ex: OptiPellet).
  const [productCode, setProductCode] = useState<string>("");

  // Init productCode quand on a chantier + products
  useEffect(() => {
    if (!chantier) return;
    if (!products.length) return;

    const raw = (produitRaw || "").trim();
    if (!raw) {
      setProductCode("");
      return;
    }

    // Match par code (exact / case-insensitive)
    const byCode =
      products.find((p) => p.code === raw) ||
      products.find((p) => p.code.toLowerCase() === raw.toLowerCase());

    if (byCode) {
      setProductCode(byCode.code);
      return;
    }

    // Match par label (exact / case-insensitive)
    const byLabel =
      products.find((p) => p.label === raw) ||
      products.find((p) => p.label.toLowerCase() === raw.toLowerCase());

    if (byLabel) {
      setProductCode(byLabel.code);
      return;
    }

    // Unknown => keep raw (but UI select won't match)
    setProductCode(raw);
  }, [chantier, products, produitRaw]);

  const selectedProductLabel = useMemo(() => {
    if (!productCode) return "";
    const p =
      products.find((x) => x.code === productCode) ||
      products.find((x) => x.label === productCode);
    return p?.label || "";
  }, [productCode, products]);

  // Pour ton besoin UI:
  // - "Installateur" = société si dispo, sinon vide
  // - "Contact" = nom de personne si dispo, sinon vide
  const installateurLabel = instCompany;
  const contactLabel = instName;

  // Sessions SAV (métier)
  const savSessionsRaw = (get(chantier, "sav.sav_sessions", []) || []) as any[];
  const activeSavSessionId = safeStr(
    get(chantier, "sav.active_sav_session_id", ""),
    "",
  );

  const uiSessions = useMemo<UiSavSession[]>(() => {
    if (!Array.isArray(savSessionsRaw)) return [];

    return savSessionsRaw.map((s: any, idx: number) => {
      const id =
        safeStr(get(s, "sav_session_id", ""), "") ||
        safeStr(get(s, "id", ""), "") ||
        `idx-${idx}`;

      const code =
        safeStr(get(s, "sav_session_id", ""), "") ||
        safeStr(get(s, "code", ""), "") ||
        `SAV-${idx + 1}`;

      const dateLabelRaw =
        safeStr(get(s, "date_label", ""), "") ||
        safeStr(get(s, "date", ""), "") ||
        safeStr(get(s, "created_at", ""), "");

      const category =
        safeStr(get(s, "classification.category", ""), "") ||
        safeStr(get(s, "category", ""), "");

      const subCategory =
        safeStr(get(s, "classification.sub_category", ""), "") ||
        safeStr(get(s, "classification.subCategory", ""), "") ||
        safeStr(get(s, "sub_category", ""), "");

      const symptom =
        safeStr(get(s, "classification.symptom", ""), "") ||
        safeStr(get(s, "symptom", ""), "");

      const statusLabel = normalizeStatusLabel(get(s, "status", null));
      const createdAt = get(s, "created_at", null);
      const updatedAt = get(s, "updated_at", null);

      // priorité: created_at (epoch) sinon updated_at sinon date_label/date
      const dateLabel =
        formatHumanDate(createdAt) ||
        formatHumanDate(updatedAt) ||
        formatHumanDate(dateLabelRaw) ||
        "";

      return { id, code, dateLabel, category, subCategory, symptom, statusLabel };
    });
  }, [savSessionsRaw]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [creatingSavSession, setCreatingSavSession] = useState(false);
  const [createSavSessionError, setCreateSavSessionError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);
  const [previewInstallateurLoading, setPreviewInstallateurLoading] = useState(false);
  const [movePhotoBusy, setMovePhotoBusy] = useState(false);
  const [movePhotoError, setMovePhotoError] = useState<string | null>(null);
  const [movePhotoTarget, setMovePhotoTarget] = useState<string>("");
  const [clsAiLoadingField, setClsAiLoadingField] = useState<"synthese" | "symptom" | null>(null);
  const [clsAiError, setClsAiError] = useState<string | null>(null);

  useEffect(() => {
    const onDown = () => setEditingSessionId(null);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!uiSessions.length) {
      setSelectedId(null);
      return;
    }

    setSelectedId((prev) => {
      // 1) si l’utilisateur a déjà sélectionné une session et qu’elle existe encore -> on garde
      if (prev && uiSessions.some((s) => s.id === prev)) return prev;

      // 2) sinon on prend l'active du backend si elle existe
      if (activeSavSessionId && uiSessions.some((s) => s.id === activeSavSessionId)) {
        return activeSavSessionId;
      }

      // 3) fallback: première
      return uiSessions[0].id;
    });
  }, [uiSessions, activeSavSessionId]);

  useEffect(() => {
    setActiveNoteId("");
    setNoteDirty(false);
    setNoteSaveState("idle");
    setNoteSaveError(null);
    setNotePublishState("idle");
    setNotePublishError(null);

    setMovePhotoBusy(false);
    setMovePhotoError(null);
    setMovePhotoTarget("");

    setAiState("idle");
    setAiError(null);
    setAiSuggestion(null);
    setAiSourceText("");
  }, [selectedId]);

  const selected = useMemo(() => {
    if (!uiSessions.length) return null;
    return uiSessions.find((s) => s.id === selectedId) || uiSessions[0];
  }, [uiSessions, selectedId]);

  // Raw session (objet original) pour accéder aux champs complets (components, etc.)
  const selectedRaw = useMemo(() => {
    if (!Array.isArray(savSessionsRaw) || !selectedId) return null;
    const found =
      savSessionsRaw.find(
        (s: any) => safeStr(get(s, "sav_session_id", ""), "") === selectedId,
      ) ||
      savSessionsRaw.find((s: any) => safeStr(get(s, "id", ""), "") === selectedId);
    return found || null;
  }, [savSessionsRaw, selectedId]);

  // ---------------------------
  // Étape 4.1 — Active session + notes
  // ---------------------------

  // 1) active session raw
  const currentSessionRaw = selectedRaw;

  const currentSavSessionId = useMemo(() => {
    if (!currentSessionRaw) return "";
    return (
      safeStr(get(currentSessionRaw, "sav_session_id", ""), "") ||
      safeStr(get(currentSessionRaw, "id", ""), "")
    );
  }, [currentSessionRaw]);

  // 2) notes raw
  const notesRaw = (get(currentSessionRaw, "notes", []) || []) as any[];

  // 3) notes UI (normalisées)
  const uiNotes = useMemo<UiSavNote[]>(() => {
    if (!Array.isArray(notesRaw)) return [];

    return notesRaw.map((n: any, idx: number) => {
      const id =
        safeStr(get(n, "note_id", ""), "") ||
        safeStr(get(n, "id", ""), "") ||
        `note-idx-${idx}`;

      const createdAt =
        safeStr(get(n, "created_at", ""), "") ||
        safeStr(get(n, "sent_at", ""), "");

      const updatedAt =
        safeStr(get(n, "updated_at", ""), "") ||
        createdAt;

      return {
        id,
        target: normalizeNoteTarget(get(n, "target", "")),
        channel: normalizeNoteChannel(get(n, "channel", "")),
        status: normalizeNoteStatus(get(n, "status", "")),
        text: safeStr(get(n, "text", ""), ""),
        createdAt,
        updatedAt,
      };
    });
  }, [notesRaw]);

  type UiHistoryNote = UiSavNote & {
    statusCode: "DRAFT" | "SENT" | "FAILED";
    inputCount: number;
    outputCount: number;
    fileCount: number;
    dateLabel: string; // basé sur updatedAt (fallback createdAt)
  };

  const uiNotesHistory = useMemo<UiHistoryNote[]>(() => {
    if (!Array.isArray(notesRaw)) return [];

    const rawById = new Map<string, any>();
    for (const n of notesRaw) {
      const id =
        safeStr(get(n, "note_id", ""), "") ||
        safeStr(get(n, "id", ""), "");
      if (id) rawById.set(id, n);
    }

    const score = (n: UiSavNote) => {
      // Les dates backend sont souvent des timestamps epoch seconds.
      // Date.parse() ne les interprète pas correctement quand elles sont en string.
      return toTs(n.updatedAt) || toTs(n.createdAt) || 0;
    };

    const sorted = [...uiNotes].sort((a, b) => score(b) - score(a));

    return sorted.map((n) => {
      const raw = rawById.get(n.id) || null;

      const inputArr = (get(raw, "includes.input_photo_uids", []) || []) as any[];
      const outputArr = (get(raw, "includes.output_asset_ids", []) || []) as any[];
      const fileArr = (get(raw, "includes.file_ids", []) || []) as any[];

      const inputCount = Array.isArray(inputArr) ? inputArr.length : 0;
      const outputCount = Array.isArray(outputArr) ? outputArr.length : 0;
      const fileCount = Array.isArray(fileArr) ? fileArr.length : 0;

      const statusCode = normalizeNoteStatusCode(get(raw, "status", ""));

      const dateLabel = formatHumanDate(n.updatedAt || n.createdAt);

      return {
        ...n,
        statusCode,
        inputCount,
        outputCount,
        fileCount,
        dateLabel,
      };
    });
  }, [notesRaw, uiNotes]);

  // 4) activeNoteId state + init fallback
  const [activeNoteId, setActiveNoteId] = useState<string>("");

  // init: si activeNoteId absent ou invalide, choisir la plus récente, sinon "__draft__"
  useEffect(() => {
    if (!currentSessionRaw) {
      if (activeNoteId) setActiveNoteId("");
      return;
    }

    // Important :
    // "__draft__" est un état volontaire de nouvelle note.
    // Il ne faut pas le remplacer automatiquement par la note la plus récente,
    // sinon après un enregistrement l'utilisateur revient malgré lui sur la note sauvegardée.
    if (activeNoteId === "__draft__") return;

    if (activeNoteId && uiNotes.some((n) => n.id === activeNoteId)) return;

    if (uiNotes.length > 0) {
      setActiveNoteId(pickMostRecentNoteId(uiNotes));
      return;
    }

    // pas de note => on met un placeholder draft
    setActiveNoteId("__draft__");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionRaw, uiNotes]);

  const activeNote = useMemo<UiSavNote | null>(() => {
    if (activeNoteId === "__draft__") {
      return {
        id: "__draft__",
        target: "—",
        channel: "—",
        status: "Brouillon",
        text: "",
        createdAt: "",
        updatedAt: "",
      };
    }
    return uiNotes.find((n) => n.id === activeNoteId) ?? null;
  }, [uiNotes, activeNoteId]);

  // ---------------------------
  // Étape 4.2 — Note en cours (editor) + upload P0
  // ---------------------------

  // Raw note (pour includes + patch)
  const activeNoteRaw = useMemo<any | null>(() => {
    if (!Array.isArray(notesRaw)) return null;
    if (!activeNoteId || activeNoteId === "__draft__") return null;

    const found = notesRaw.find((n: any) => {
      const id =
        safeStr(get(n, "note_id", ""), "") ||
        safeStr(get(n, "id", ""), "");
      return id === activeNoteId;
    });

    return found || null;
  }, [notesRaw, activeNoteId]);

  // ---------------------------
  // Étape 4.3 — Bibliothèques disponibles (union inter-notes)
  // ---------------------------

  type AvailableAsset = {
    assetId: string;
    url: string;
    noteId: string; // provenance (optionnel)
  };

  type AvailableFile = {
    fileId: string;
    url: string;
    name: string;
    noteId: string; // provenance (optionnel)
  };

  const availableFiles = useMemo<AvailableFile[]>(() => {
    const m = new Map<string, AvailableFile>();
    if (!Array.isArray(notesRaw)) return [];
    for (const n of notesRaw) {
      const noteId =
        safeStr(get(n, "note_id", ""), "") || safeStr(get(n, "id", ""), "");
      const files = (get(n, "attachments", []) || []) as any[];
      if (!Array.isArray(files)) continue;

      for (const f of files) {
        const fileId = safeStr(get(f, "file_id", ""), "");
        if (!fileId) continue;
        const url = safeStr(get(f, "url", ""), "");
        if (!url) continue;
        const name =
          safeStr(get(f, "name", ""), "") ||
          safeStr(get(f, "filename", ""), "") ||
          "Fichier";

        if (!m.has(fileId)) {
          m.set(fileId, { fileId, url, name, noteId });
        }
      }
    }
    return Array.from(m.values());
  }, [notesRaw]);

  const includedInputUids = useMemo<string[]>(() => {
    const arr = (get(activeNoteRaw, "includes.input_photo_uids", []) || []) as any[];
    return Array.isArray(arr) ? arr.map((x) => safeStr(x, "")).filter(Boolean) : [];
  }, [activeNoteRaw]);

  const includedOutputAssetIds = useMemo<string[]>(() => {
    const arr = (get(activeNoteRaw, "includes.output_asset_ids", []) || []) as any[];
    return Array.isArray(arr) ? arr.map((x) => safeStr(x, "")).filter(Boolean) : [];
  }, [activeNoteRaw]);

  const includedFileIds = useMemo<string[]>(() => {
    const arr = (get(activeNoteRaw, "includes.file_ids", []) || []) as any[];
    return Array.isArray(arr) ? arr.map((x) => safeStr(x, "")).filter(Boolean) : [];
  }, [activeNoteRaw]);

  async function toggleInclude(
    kind: "input" | "output" | "file",
    id: string,
  ) {
    if (!id) return;

    const noteId = await ensureNoteExists();

    const current =
      kind === "input"
        ? includedInputUids
        : kind === "output"
          ? includedOutputAssetIds
          : includedFileIds;

    const set = new Set(current);
    if (set.has(id)) set.delete(id);
    else set.add(id);

    const next = Array.from(set);

    setNoteDirty(true);
    setNoteSaveState("idle");
    setNoteSaveError(null);

    await patchNote(noteId, {
      actor: currentUser,
      includes:
        kind === "input"
          ? { input_photo_uids: next }
          : kind === "output"
            ? { output_asset_ids: next }
            : { file_ids: next },
    });

    await fetchSavItem();
  }

  function normalizeTargetCode(v: any): NoteTargetCode {
    const s = safeStr(v, "").toUpperCase();
    const ok = NOTE_TARGET_OPTIONS.some((o) => o.code === (s as any));
    return (ok ? (s as any) : "INTERNE") as NoteTargetCode;
  }
  function normalizeChannelCode(v: any): NoteChannelCode {
    const s = safeStr(v, "").toUpperCase();
    const ok = NOTE_CHANNEL_OPTIONS.some((o) => o.code === (s as any));
    return (ok ? (s as any) : "WHATSAPP") as NoteChannelCode;
  }

  const includesInputCount = useMemo(() => {
    const arr = (get(activeNoteRaw, "includes.input_photo_uids", []) || []) as any[];
    return Array.isArray(arr) ? arr.length : 0;
  }, [activeNoteRaw]);

  const includesOutputCount = useMemo(() => {
    const arr = (get(activeNoteRaw, "includes.output_asset_ids", []) || []) as any[];
    return Array.isArray(arr) ? arr.length : 0;
  }, [activeNoteRaw]);

  const includesFileCount = useMemo(() => {
    const arr = (get(activeNoteRaw, "includes.file_ids", []) || []) as any[];
    return Array.isArray(arr) ? arr.length : 0;
  }, [activeNoteRaw]);

  // Etats UI editor (codes, pas les labels)
  const [noteTarget, setNoteTarget] = useState<NoteTargetCode>("INTERNE");
  const [noteChannel, setNoteChannel] = useState<NoteChannelCode>("NONE");
  const [noteText, setNoteText] = useState<string>("");
  const [noteDirty, setNoteDirty] = useState<boolean>(false);

  // Etat autosave
  type NoteSaveState = "idle" | "saving" | "saved" | "error";
  const [noteSaveState, setNoteSaveState] = useState<NoteSaveState>("idle");
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);

  type NotePublishState = "idle" | "publishing" | "published" | "error";
  const [notePublishState, setNotePublishState] = useState<NotePublishState>("idle");
  const [notePublishError, setNotePublishError] = useState<string | null>(null);

  const [noteDeleteBusy, setNoteDeleteBusy] = useState(false);
  const [noteDeleteError, setNoteDeleteError] = useState<string | null>(null);

  type AiState = "idle" | "loading" | "success" | "error";

  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiImproveResult | null>(null);
  const [aiSourceText, setAiSourceText] = useState<string>("");

  // Upload refs
  const uploadVisualInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const lastInitNoteIdRef = useRef<string>("");

  // Init editor quand on change de note active (IMPORTANT: ne pas écraser pendant un refresh)
  useEffect(() => {
    if (lastInitNoteIdRef.current === activeNoteId) return;
    lastInitNoteIdRef.current = activeNoteId;

    setAiState("idle");
    setAiError(null);
    setAiSuggestion(null);
    setAiSourceText("");
    setNoteDeleteError(null);

    // Draft local
    if (activeNoteId === "__draft__" || !activeNoteRaw) {
      setNoteTarget("INTERNE");
      setNoteChannel("NONE");
      setNoteText("");
      setNoteSaveState("idle");
      setNoteSaveError(null);
      setNotePublishState("idle");
      setNotePublishError(null);
      setNoteDirty(false);
      return;
    }

    const t = normalizeTargetCode(get(activeNoteRaw, "target", "INTERNE"));
    let c = normalizeChannelCode(
      get(activeNoteRaw, "channel", t === "INTERNE" ? "NONE" : "WHATSAPP"),
    );
    if (t === "INTERNE") c = "NONE";

    setNoteTarget(t);
    setNoteChannel(c);
    setNoteText(safeStr(get(activeNoteRaw, "text", ""), ""));
    setNoteSaveState("idle");
    setNoteSaveError(null);
    setNotePublishState("idle");
    setNotePublishError(null);
    setNoteDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId]);

  // Si target=INTERNE => channel forcé NONE
  useEffect(() => {
    if (noteTarget === "INTERNE" && noteChannel !== "NONE") {
      setNoteChannel("NONE");
    }
  }, [noteTarget, noteChannel]);

  const createNote = useCallback(
    async (payload: Record<string, any>) => {
      if (!key) throw new Error("chantier_id manquant");
      if (!currentSavSessionId) throw new Error("sav_session_id manquant");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav-sessions/${encodeURIComponent(currentSavSessionId)}/notes`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur API POST note: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key, currentSavSessionId],
  );

  const patchNote = useCallback(
    async (noteId: string, payload: Record<string, any>) => {
      if (!key) throw new Error("chantier_id manquant");
      if (!currentSavSessionId) throw new Error("sav_session_id manquant");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav-sessions/${encodeURIComponent(currentSavSessionId)}/notes/${encodeURIComponent(noteId)}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur API PATCH note: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key, currentSavSessionId],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!key) throw new Error("chantier_id manquant");
      if (!currentSavSessionId) throw new Error("sav_session_id manquant");
      if (!noteId || noteId === "__draft__") {
        throw new Error("note_id invalide pour suppression");
      }

      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav-sessions/${encodeURIComponent(currentSavSessionId)}/notes/${encodeURIComponent(noteId)}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: currentUser }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur API DELETE note: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key, currentSavSessionId, currentUser],
  );

  const improveNoteWithAi = useCallback(
    async (noteId: string) => {
      if (!key) throw new Error("chantier_id manquant");
      if (!currentSavSessionId) throw new Error("sav_session_id manquant");
      if (!noteId || noteId === "__draft__") throw new Error("note_id manquant");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav/${encodeURIComponent(currentSavSessionId)}/notes/${encodeURIComponent(noteId)}/ai-improve`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur API AI improve: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      return (await res.json()) as AiImproveResponse;
    },
    [API_BASE, key, currentSavSessionId],
  );

  const generateClassificationTextWithAi = useCallback(
    async (field: "synthese" | "symptom") => {
      if (!key) throw new Error("chantier_id manquant");
      if (!currentSavSessionId) throw new Error("sav_session_id manquant");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key as string,
      )}/sav-sessions/${encodeURIComponent(currentSavSessionId)}/ai-generate-classification-text`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur API classification AI: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      return await res.json();
    },
    [API_BASE, key, currentSavSessionId],
  );

  const ensureNoteExists = useCallback(async () => {
    if (activeNoteId && activeNoteId !== "__draft__") return activeNoteId;

    // Création P0 (au 1er edit/upload)
    const t = noteTarget || "INTERNE";
    const c = t === "INTERNE" ? "NONE" : (noteChannel || "WHATSAPP");

    const created = await createNote({
      actor: currentUser,
      target: t,
      channel: c,
      status: "DRAFT",
      text: noteText || "",
      includes: { input_photo_uids: [], output_asset_ids: [], file_ids: [] },
    });

    const newId = safeStr(get(created, "note.note_id", ""), "") || safeStr(get(created, "note_id", ""), "");
    if (!newId) throw new Error("Création note OK mais ID introuvable");

    setActiveNoteId(newId);
    // refresh chantier pour récupérer note + includes
    await fetchSavItem();

    return newId;
  }, [activeNoteId, noteTarget, noteChannel, noteText, createNote, currentUser, fetchSavItem]);

  const saveNoteNow = useCallback(async () => {
    try {
      setNoteSaveState("saving");
      setNoteSaveError(null);

      const noteId = await ensureNoteExists();

      const t = noteTarget || "INTERNE";
      const c = t === "INTERNE" ? "NONE" : (noteChannel || "WHATSAPP");

      await patchNote(noteId, {
        actor: currentUser,
        target: t,
        channel: c,
        text: noteText || "",
      });

      setNoteSaveState("saved");
      setNoteDirty(false);

      await fetchSavItem();

      // Après un enregistrement réussi, l'éditeur devient immédiatement
      // une nouvelle note vierge.
      //
      // Important :
      // - activeNoteId repasse en "__draft__"
      // - on vide explicitement l'éditeur tout de suite
      // - lastInitNoteIdRef est reset pour permettre à l'effet d'init de
      //   réappliquer proprement l'état draft si besoin.
      lastInitNoteIdRef.current = "";
      setActiveNoteId("__draft__");
      setNoteTarget("INTERNE");
      setNoteChannel("NONE");
      setNoteText("");
      setNoteSaveState("idle");
      setNoteSaveError(null);
      setNoteDirty(false);
    } catch (e: any) {
      setNoteSaveState("error");
      setNoteSaveError(e?.message || "Erreur enregistrement");
    }
  }, [ensureNoteExists, patchNote, currentUser, noteTarget, noteChannel, noteText, fetchSavItem]);

  const publishNoteNow = useCallback(async () => {
    try {
      setNotePublishState("publishing");
      setNotePublishError(null);

      // 1) S’assure que la note existe + la sauvegarde si nécessaire
      if (noteDirty) {
        await saveNoteNow();
      } else {
        // même si pas dirty, on s'assure qu'il y a bien une note id (cas __draft__)
        await ensureNoteExists();
      }

      const noteId = activeNoteId === "__draft__" ? await ensureNoteExists() : activeNoteId;

      // 2) Interdire publish si canal NONE (ex: INTERNE)
      const t = noteTarget || "INTERNE";
      const c = t === "INTERNE" ? "NONE" : (noteChannel || "WHATSAPP");
      if (c === "NONE") {
        throw new Error("Impossible de publier: aucun canal sélectionné (—).");
      }

      // 3) Call backend send
      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav/${encodeURIComponent(currentSavSessionId)}/notes/${encodeURIComponent(noteId)}/send`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: currentUser }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Erreur publication: HTTP ${res.status} — ${txt.slice(0, 220)}`);
      }

      setNotePublishState("published");
      await fetchSavItem(); // refresh pour voir status SENT/FAILED + last_error
      window.setTimeout(() => setNotePublishState("idle"), 1500);
    } catch (e: any) {
      setNotePublishState("error");
      setNotePublishError(e?.message || "Erreur publication");
    }
  }, [
    API_BASE,
    key,
    currentSavSessionId,
    activeNoteId,
    currentUser,
    noteTarget,
    noteChannel,
    noteDirty,
    saveNoteNow,
    ensureNoteExists,
    fetchSavItem,
  ]);

  const createNewDraftNote = useCallback(async () => {
    try {
      setNoteSaveState("idle");
      setNoteSaveError(null);

      const created = await createNote({
        actor: currentUser,
        target: "INTERNE",
        channel: "NONE",
        status: "DRAFT",
        text: "",
        includes: { input_photo_uids: [], output_asset_ids: [], file_ids: [] },
      });

      const newId =
        safeStr(get(created, "note.note_id", ""), "") ||
        safeStr(get(created, "note_id", ""), "");

      if (!newId) throw new Error("Création note OK mais ID introuvable");

      setActiveNoteId(newId);
      await fetchSavItem();
    } catch (e: any) {
      setNoteSaveState("error");
      setNoteSaveError(e?.message || "Erreur création note");
    }
  }, [createNote, currentUser, fetchSavItem]);

  const handleDeleteNote = useCallback(
    async (noteId?: string) => {
      const targetNoteId = (noteId || activeNoteId || "").trim();

      if (!targetNoteId || targetNoteId === "__draft__") {
        return;
      }

      const confirmed = window.confirm(
        "Supprimer cette note ? Cette action est définitive.",
      );
      if (!confirmed) return;

      try {
        setNoteDeleteBusy(true);
        setNoteDeleteError(null);
        setNoteSaveError(null);
        setNotePublishError(null);

        await deleteNote(targetNoteId);

        // on vide la sélection pour éviter de rester pointé vers une note supprimée
        setActiveNoteId("");
        setNoteDirty(false);

        await fetchSavItem();
      } catch (e: any) {
        setNoteDeleteError(e?.message || "Erreur suppression note");
      } finally {
        setNoteDeleteBusy(false);
      }
    },
    [activeNoteId, deleteNote, fetchSavItem],
  );

  const handleImproveWithAi = useCallback(async () => {
    try {
      setAiState("loading");
      setAiError(null);
      setAiSuggestion(null);

      // 1) garantir que la note existe
      let noteId = await ensureNoteExists();

      // 2) sauvegarder ce qui est réellement affiché à l'écran avant appel IA
      const t = noteTarget || "INTERNE";
      const c = t === "INTERNE" ? "NONE" : (noteChannel || "WHATSAPP");

      setNoteSaveState("saving");
      setNoteSaveError(null);

      await patchNote(noteId, {
        actor: currentUser,
        target: t,
        channel: c,
        text: noteText || "",
      });

      setNoteSaveState("saved");
      setNoteDirty(false);

      // on garde une copie du texte exact envoyé à l'IA
      setAiSourceText(noteText || "");

      // refresh pour rester cohérent avec le backend
      await fetchSavItem();

      // 3) appel IA sur la dernière version réellement sauvegardée
      const json = await improveNoteWithAi(noteId);

      if (!json?.ok || !json?.result) {
        throw new Error("Réponse IA invalide");
      }

      setAiSuggestion(json.result);
      setAiState("success");
    } catch (e: any) {
      setAiState("error");
      setAiError(e?.message || "Erreur amélioration IA");
      setNoteSaveState("error");
      setNoteSaveError(e?.message || "Erreur enregistrement avant IA");
    }
  }, [
    ensureNoteExists,
    noteTarget,
    noteChannel,
    noteText,
    patchNote,
    currentUser,
    fetchSavItem,
    improveNoteWithAi,
  ]);

  const handleApplyAiSuggestion = useCallback(async () => {
    const suggested = aiSuggestion?.suggested_body || "";
    if (!suggested.trim()) return;

    try {
      setNoteText(suggested);
      setNoteDirty(true);
      setNoteSaveState("saving");
      setNoteSaveError(null);

      const noteId = await ensureNoteExists();

      const t = noteTarget || "INTERNE";
      const c = t === "INTERNE" ? "NONE" : (noteChannel || "WHATSAPP");

      await patchNote(noteId, {
        actor: currentUser,
        target: t,
        channel: c,
        text: suggested,
      });

      setNoteSaveState("saved");
      setNoteDirty(false);

      setAiState("idle");
      setAiError(null);
      setAiSuggestion(null);
      setAiSourceText("");

      await fetchSavItem();
    } catch (e: any) {
      setNoteSaveState("error");
      setNoteSaveError(e?.message || "Erreur enregistrement après application IA");
    }
  }, [
    aiSuggestion,
    ensureNoteExists,
    noteTarget,
    noteChannel,
    currentUser,
    patchNote,
    fetchSavItem,
  ]);

  const handleCancelAiSuggestion = useCallback(() => {
    setAiState("idle");
    setAiError(null);
    setAiSuggestion(null);
    setAiSourceText("");
  }, []);

  async function uploadToNote(kind: "asset" | "file", file: File) {
    const noteId = await ensureNoteExists();

    const base = `${API_BASE}/chantiers/${encodeURIComponent(
      key as string,
    )}/sav-sessions/${encodeURIComponent(currentSavSessionId)}/notes/${encodeURIComponent(noteId)}`;

    const url =
      kind === "asset"
        ? `${base}/assets?kind=tech_visual`
        : `${base}/files?kind=file`;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Erreur upload ${kind}: HTTP ${res.status} — ${txt.slice(0, 220)}`);
    }

    const json = await res.json().catch(() => ({}));
    const returnedId =
      kind === "asset"
        ? safeStr(get(json, "asset.asset_id", ""), "")
        : safeStr(get(json, "file.file_id", ""), "");

    if (!returnedId) throw new Error("Upload OK mais id introuvable dans la réponse");

    // Auto-include (checkbox sera la source de vérité plus tard dans les tabs)
    const currentInc =
      kind === "asset"
        ? ((get(activeNoteRaw, "includes.output_asset_ids", []) || []) as any[])
        : ((get(activeNoteRaw, "includes.file_ids", []) || []) as any[]);

    const list = Array.isArray(currentInc) ? currentInc.map((x) => safeStr(x, "")).filter(Boolean) : [];
    if (!list.includes(returnedId)) list.push(returnedId);

    await patchNote(noteId, {
      actor: currentUser,
      includes:
        kind === "asset"
          ? { output_asset_ids: list }
          : { file_ids: list },
    });

    await fetchSavItem();
  }

  // ---------------------------
  // Photos (réelles) — depuis chantier.inputs.photos et sav_session.photos.photo_uids
  // ---------------------------
  const inputPhotosRaw = (get(chantier, "inputs.photos", []) || []) as any[];

  function photoUidFrontend(p: any): string | null {
    const uid = safeStr(get(p, "photo_uid", ""), "");
    if (uid) return uid;
    const sid = safeStr(get(p, "session_id", ""), "");
    const pid = safeStr(get(p, "photo_id_in_session", ""), "");
    if (sid && pid) return `${sid}__${pid}`;
    return null;
  }

  const photosByUid = useMemo(() => {
    const m = new Map<string, any>();
    if (!Array.isArray(inputPhotosRaw)) return m;
    for (const p of inputPhotosRaw) {
      const uid = photoUidFrontend(p);
      if (!uid) continue;
      m.set(uid, p);
    }
    return m;
  }, [inputPhotosRaw]);

  const selectedPhotoUids = useMemo<string[]>(() => {
    if (!selectedRaw) return [];
    const uids = (get(selectedRaw, "photos.photo_uids", []) || []) as any[];
    if (!Array.isArray(uids)) return [];
    return uids.map((x) => safeStr(x, "")).filter(Boolean);
  }, [selectedRaw]);

  const selectedPrimaryUid = useMemo(() => {
    if (!selectedRaw) return "";
    return (
      safeStr(get(selectedRaw, "photos.primary_photo_uid", ""), "") ||
      (selectedPhotoUids[0] || "")
    );
  }, [selectedRaw, selectedPhotoUids]);

  const selectedPhotos = useMemo(() => {
    // On garde aussi les uids “orphelins” (pas trouvés dans inputs.photos) pour debug
    return selectedPhotoUids.map((uid) => {
      const p = photosByUid.get(uid);
      const url =
        safeStr(get(p, "annotated_url", ""), "") ||
        safeStr(get(p, "original_url", ""), "");
      return { uid, p: p || null, url };
    });
  }, [selectedPhotoUids, photosByUid]);

  const inboundMessages = useMemo<UiInboundMessage[]>(() => {
    const raw = (get(selectedRaw, "inbound_messages", []) || []) as any[];
    if (!Array.isArray(raw)) return [];

    const mapped = raw.map((msg: any, idx: number) => {
      const id =
        safeStr(get(msg, "id", ""), "") ||
        safeStr(get(msg, "source_inbox_item_id", ""), "") ||
        `inbound-${idx}`;

      const channel = safeStr(get(msg, "channel", ""), "").toUpperCase();
      const linkedPhotoUidsRaw = (get(msg, "linked_photo_uids", []) || []) as any[];
      const linkedPhotoUids = Array.isArray(linkedPhotoUidsRaw)
        ? linkedPhotoUidsRaw.map((x) => safeStr(x, "")).filter(Boolean)
        : [];

      const photos: UiInboundPhoto[] = linkedPhotoUids.map((uid) => {
        const p = photosByUid.get(uid);
        const url =
          safeStr(get(p, "annotated_url", ""), "") ||
          safeStr(get(p, "original_url", ""), "") ||
          safeStr(get(p, "url", ""), "");
        return {
          photoUid: uid,
          url,
        };
      });

      const attachmentsRaw = (get(msg, "attachments", []) || []) as any[];
      const attachments: UiInboundAttachment[] = Array.isArray(attachmentsRaw)
        ? attachmentsRaw
            .filter((att) => att && typeof att === "object")
            .map((att) => ({
              filename: safeStr(get(att, "filename", ""), ""),
              url: safeStr(get(att, "url", ""), ""),
              mimeType:
                safeStr(get(att, "mime_type", ""), "") ||
                safeStr(get(att, "mime", ""), ""),
            }))
        : [];

      const receivedAt = get(msg, "received_at", null);
      const lastMessageAt = get(msg, "last_message_at", null);
      const kind = safeStr(get(msg, "kind", ""), "");

      const photoCountFromData = Number(get(msg, "photo_count", 0) || 0);
      const attachmentCountFromData = Number(get(msg, "attachment_count", 0) || 0);
      const messageCountFromData = Number(get(msg, "message_count", 0) || 0);

      return {
        id,
        channel,
        channelLabel: normalizeInboundChannelLabel(channel),
        senderDisplay:
          safeStr(get(msg, "sender_display", ""), "") ||
          safeStr(get(msg, "sender_phone", ""), "") ||
          safeStr(get(msg, "sender_email", ""), ""),
        senderRole: safeStr(get(msg, "sender_role", ""), ""),
        receivedAt,
        lastMessageAt,
        receivedAtLabel: formatHumanDate(receivedAt),
        kind,
        kindLabel: normalizeInboundKindLabel(kind, channel),
        subject: safeStr(get(msg, "subject", ""), ""),
        text:
          safeStr(get(msg, "text", ""), "") ||
          safeStr(get(msg, "clean_content_text", ""), "") ||
          safeStr(get(msg, "raw_content_text", ""), ""),
        messageCount: messageCountFromData > 0 ? messageCountFromData : 1,
        photoCount: photoCountFromData > 0 ? photoCountFromData : photos.length,
        attachmentCount:
          attachmentCountFromData > 0 ? attachmentCountFromData : attachments.length,
        photos,
        attachments,
      };
    });

    mapped.sort((a, b) => {
      const ta = toTs(a.receivedAt) || toTs(a.lastMessageAt);
      const tb = toTs(b.receivedAt) || toTs(b.lastMessageAt);
      return ta - tb;
    });

    return mapped;
  }, [selectedRaw, photosByUid]);

  const inboundSummary = useMemo<UiInboundSummary>(() => {
    if (!inboundMessages.length) {
      return {
        channelLabel: "—",
        channel: "",
        senderDisplay: "—",
        totalMessages: 0,
        totalPhotos: 0,
        totalAttachments: 0,
        firstReceivedLabel: "",
        lastReceivedLabel: "",
      };
    }

    const channelCounts = new Map<string, number>();
    for (const msg of inboundMessages) {
      const key = msg.channel || "";
      channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
    }

    const mainChannel =
      Array.from(channelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const first = inboundMessages[0];
    const last = inboundMessages[inboundMessages.length - 1];

    return {
      channel: mainChannel,
      channelLabel: normalizeInboundChannelLabel(mainChannel),
      senderDisplay: first?.senderDisplay || "—",
      totalMessages: inboundMessages.reduce((sum, msg) => sum + Math.max(1, msg.messageCount || 1), 0),
      totalPhotos: inboundMessages.reduce((sum, msg) => sum + (msg.photoCount || 0), 0),
      totalAttachments: inboundMessages.reduce((sum, msg) => sum + (msg.attachmentCount || 0), 0),
      firstReceivedLabel: first?.receivedAtLabel || "",
      lastReceivedLabel:
        formatHumanDate(last?.lastMessageAt) ||
        last?.receivedAtLabel ||
        "",
    };
  }, [inboundMessages]);

  const [activePhotoUid, setActivePhotoUid] = useState<string>("");
  const [isPhotoFullscreenOpen, setIsPhotoFullscreenOpen] = useState(false);
  type VfTab = "input" | "output" | "files";
  const [vfTab, setVfTab] = useState<VfTab>("input");
  const [activeOutputAssetId, setActiveOutputAssetId] = useState<string>("");

  const availableOutputAssets = useMemo<AvailableAsset[]>(() => {
    const m = new Map<string, AvailableAsset>();
    if (!Array.isArray(notesRaw)) return [];
    for (const n of notesRaw) {
      const noteId =
        safeStr(get(n, "note_id", ""), "") || safeStr(get(n, "id", ""), "");
      const visuals = (get(n, "visuals", []) || []) as any[];
      if (!Array.isArray(visuals)) continue;

      for (const v of visuals) {
        const assetId = safeStr(get(v, "asset_id", ""), "");
        if (!assetId) continue;
        const url =
          safeStr(get(v, "url", ""), "") ||
          safeStr(get(v, "original_url", ""), "") ||
          safeStr(get(v, "annotated_url", ""), "");
        if (!url) continue;

        if (!m.has(assetId)) {
          m.set(assetId, { assetId, url, noteId });
        }
      }
    }
    return Array.from(m.values());
  }, [notesRaw]);

  const activeOutputAsset = useMemo<AvailableAsset | null>(() => {
    if (!activeOutputAssetId) return availableOutputAssets[0] ?? null;
    return (
      availableOutputAssets.find((a) => a.assetId === activeOutputAssetId) ??
      (availableOutputAssets[0] ?? null)
    );
  }, [availableOutputAssets, activeOutputAssetId]);

  useEffect(() => {
    if (vfTab !== "output") return;

    if (!availableOutputAssets.length) {
      if (activeOutputAssetId) setActiveOutputAssetId("");
      return;
    }

    if (
      activeOutputAssetId &&
      availableOutputAssets.some((a) => a.assetId === activeOutputAssetId)
    ) {
      return;
    }

    setActiveOutputAssetId(availableOutputAssets[0].assetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfTab, availableOutputAssets]);
  
  useEffect(() => {
    // Quand on change de session SAV sélectionnée → on reset sur la primary
    setActivePhotoUid(selectedPrimaryUid || (selectedPhotoUids[0] || ""));
  }, [selectedId, selectedPrimaryUid, selectedPhotoUids]);

  const activePhoto = useMemo(() => {
    if (!activePhotoUid) return null;
    return selectedPhotos.find((x) => x.uid === activePhotoUid) || null;
  }, [activePhotoUid, selectedPhotos]);

  const movePhotoOptions = useMemo(() => {
    const otherSessions = uiSessions
      .filter((s) => s.id && s.id !== currentSavSessionId)
      .map((s) => ({
        value: s.id,
        label: s.code || s.id,
      }));

    return [
      ...otherSessions,
      { value: "__new__", label: "Nouvelle session SAV" },
    ];
  }, [uiSessions, currentSavSessionId]);

  useEffect(() => {
    if (!movePhotoOptions.length) {
      if (movePhotoTarget) setMovePhotoTarget("");
      return;
    }

    if (
      movePhotoTarget &&
      movePhotoOptions.some((opt) => opt.value === movePhotoTarget)
    ) {
      return;
    }

    setMovePhotoTarget(movePhotoOptions[0].value);
  }, [movePhotoOptions, movePhotoTarget]);

  const fullscreenUrl = activePhoto?.url || "";

  // ---------------------------
  // Patch B — Owner connecté
  // ---------------------------
  const chantierOwnerFromData = safeStr(get(chantier, "owner", ""), "");
  const [owner, setOwner] = useState<UserName>("Xavier Briffa");
  const [ownerSaving, setOwnerSaving] = useState(false);

  // Init owner: chantier.owner > localStorage > défaut
  useEffect(() => {
    if (chantierOwnerFromData && USERS.includes(chantierOwnerFromData as any)) {
      setOwner(chantierOwnerFromData as UserName);
      return;
    }
    try {
      const saved = localStorage.getItem(OWNER_STORAGE_KEY) as UserName;
      if (saved && USERS.includes(saved)) setOwner(saved);
    } catch {}
  }, [chantierOwnerFromData]);

  useEffect(() => {
    try {
      localStorage.setItem(OWNER_STORAGE_KEY, owner);
    } catch {}
  }, [owner]);

  const patchChantier = useCallback(
    async (payload: Record<string, any>) => {
      if (!key) throw new Error("Impossible de patch: key manquant.");
      const url = `${API_BASE}/chantiers/${encodeURIComponent(key)}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API PATCH /chantiers: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key],
  );

  // ---------------------------
  // Étape 2A+2B — Classification éditable + PATCH sav-session dédié
  // ---------------------------
  const patchSavSession = useCallback(
    async (savSessionId: string, payload: Record<string, any>) => {
      if (!key) throw new Error("Impossible de patch sav-session: key manquant.");
      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav-sessions/${encodeURIComponent(savSessionId)}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API PATCH sav-session: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key],
  );

  const createSavSession = useCallback(
    async (payload: Record<string, any> = {}) => {
      if (!key) throw new Error("Impossible de créer une SAV session: key manquant.");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(key)}/sav-sessions`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API POST sav-session: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key],
  );

  const moveSavPhoto = useCallback(
    async (payload: {
      from_sav_session_id: string;
      to_sav_session_id: string;
      photo_uid: string;
      actor?: string;
    }) => {
      if (!key) throw new Error("Impossible de déplacer une photo: key manquant.");

      const url = `${API_BASE}/chantiers/${encodeURIComponent(key)}/sav-sessions/move-photo`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API move-photo: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      return res.json().catch(() => ({}));
    },
    [API_BASE, key],
  );

  const handleMoveActivePhoto = useCallback(async () => {
    if (!activePhotoUid) return;
    if (!currentSavSessionId) return;
    if (!movePhotoTarget) return;
    if (movePhotoBusy) return;

    const targetLabel =
      movePhotoTarget === "__new__" ? "une nouvelle session SAV" : movePhotoTarget;

    const confirmed = window.confirm(
      `Déplacer cette photo vers ${targetLabel} ?`,
    );
    if (!confirmed) return;

    try {
      setMovePhotoBusy(true);
      setMovePhotoError(null);

      const json = await moveSavPhoto({
        from_sav_session_id: currentSavSessionId,
        to_sav_session_id: movePhotoTarget,
        photo_uid: activePhotoUid,
        actor: currentUser,
      });

      const finalTarget =
        safeStr(get(json, "to_sav_session_id", ""), "") || movePhotoTarget;

      await fetchSavItem();

      if (finalTarget) {
        setSelectedId(finalTarget);
      }
    } catch (e: any) {
      setMovePhotoError(e?.message || "Erreur déplacement photo");
    } finally {
      setMovePhotoBusy(false);
    }
  }, [
    activePhotoUid,
    currentSavSessionId,
    movePhotoTarget,
    movePhotoBusy,
    moveSavPhoto,
    currentUser,
    fetchSavItem,
  ]);

  const handleCreateSavSession = useCallback(async () => {
    if (!key || creatingSavSession) return;

    setCreatingSavSession(true);
    setCreateSavSessionError(null);

    try {
      const json = await createSavSession({
        actor: currentUser,
      });

      const newSavId = safeStr(get(json, "sav_session_id", ""), "");
      await fetchSavItem();

      if (newSavId) {
        setEditingSessionId(null);
        setSelectedId(newSavId);
      }
    } catch (e: any) {
      setCreateSavSessionError(
        e?.message || "Erreur lors de la création de la nouvelle session SAV.",
      );
    } finally {
      setCreatingSavSession(false);
    }
  }, [key, creatingSavSession, createSavSession, currentUser, fetchSavItem]);

  const handleDeleteSavSession = useCallback(
    async (savSessionId: string) => {
      if (!key || !savSessionId) return;

      const confirmed = window.confirm(
        "⚠️ ATTENTION\n\nTu es sur le point de supprimer définitivement cette session SAV.\n\nCette action est irréversible.\n\nContinuer ?",
      );
      if (!confirmed) return;

      try {
        const url = `${API_BASE}/chantiers/${encodeURIComponent(
          key,
        )}/sav-sessions/${encodeURIComponent(savSessionId)}`;

        const res = await fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: currentUser }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Erreur API DELETE sav-session: HTTP ${res.status} — ${txt.slice(0, 220)}`,
          );
        }

        const json = await res.json().catch(() => ({}));
        const nextActive = safeStr(get(json, "active_sav_session_id", ""), "");

        await fetchSavItem();

        if (nextActive) {
          setSelectedId(nextActive);
        } else {
          setSelectedId(null);
        }
      } catch (e: any) {
        alert(e?.message || "Erreur suppression session SAV");
      }
    },
    [API_BASE, key, currentUser, fetchSavItem],
  );

  const handleChangeSavSessionStatus = useCallback(
    async (nextStatus: string) => {
      if (!currentSavSessionId) return;

      setStatusSaving(true);
      setStatusSaveError(null);

      try {
        await patchSavSession(currentSavSessionId, {
          actor: currentUser,
          status: nextStatus,
        });

        await fetchSavItem();
      } catch (e: any) {
        setStatusSaveError(
          e?.message || "Erreur lors de la mise à jour du statut de la session SAV.",
        );
      } finally {
        setStatusSaving(false);
      }
    },
    [currentSavSessionId, patchSavSession, currentUser, fetchSavItem],
  );

  const handlePreviewInstallateur = useCallback(async () => {
    if (!key || !currentSavSessionId || previewInstallateurLoading) return;

    setPreviewInstallateurLoading(true);
    setStatusSaveError(null);

    try {
      const url = `${API_BASE}/chantiers/${encodeURIComponent(
        key,
      )}/sav/${encodeURIComponent(currentSavSessionId)}/preview-installateur`;

      const res = await fetch(url, {
        method: "GET",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Erreur API preview-installateur: HTTP ${res.status} — ${txt.slice(0, 220)}`,
        );
      }

      const json = await res.json().catch(() => ({}));
      const publicUrl = safeStr(get(json, "public_url", ""), "");

      if (!publicUrl) {
        throw new Error("Aucune URL publique renvoyée pour l’aperçu installateur.");
      }

      window.open(publicUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setStatusSaveError(
        e?.message || "Erreur lors de l’ouverture de l’aperçu installateur.",
      );
    } finally {
      setPreviewInstallateurLoading(false);
    }
  }, [API_BASE, key, currentSavSessionId, previewInstallateurLoading]);

  type SaveState = "idle" | "saving" | "saved" | "error";
  const [clsSaveState, setClsSaveState] = useState<SaveState>("idle");
  const [clsSaveError, setClsSaveError] = useState<string | null>(null);

  const [clsTextSaveState, setClsTextSaveState] = useState<SaveState>("idle");
  const [clsTextSaveError, setClsTextSaveError] = useState<string | null>(null);
  const [clsTextDirty, setClsTextDirty] = useState<boolean>(false);

  // États éditables (remplis depuis selectedRaw)
  const [clsCategory, setClsCategory] = useState<string>("");
  const [clsSubCategory, setClsSubCategory] = useState<string>("");
  const [clsSymptom, setClsSymptom] = useState<string>("");
  const [clsSynthese, setClsSynthese] = useState<string>("");
  const [clsComponents, setClsComponents] = useState<string[]>([]);
  const [componentDraft, setComponentDraft] = useState<string>("");

  // Init quand on change de session
  const clsInitRef = useRef<string>(""); // sav_session_id pour éviter patch au mount
  useEffect(() => {
    const sid = safeStr(get(selectedRaw, "sav_session_id", ""), "");
    if (!sid) return;

    const rawCat = safeStr(get(selectedRaw, "classification.category", ""), "") || "";
    const rawSub =
      safeStr(get(selectedRaw, "classification.sub_category", ""), "") ||
      safeStr(get(selectedRaw, "classification.subCategory", ""), "") ||
      "";
    const rawSym = safeStr(get(selectedRaw, "classification.symptom", ""), "") || "";
    const rawSynthese = safeStr(get(selectedRaw, "classification.synthese", ""), "") || "";
    const rawComps = Array.isArray(get(selectedRaw, "classification.components", []))
      ? (get(selectedRaw, "classification.components", []) as any[])
          .map((x) => safeStr(x, ""))
          .filter(Boolean)
      : [];

    setClsCategory(rawCat);
    setClsSubCategory(rawSub);
    setClsSymptom(rawSym);
    setClsSynthese(rawSynthese);
    setClsComponents(uniqStrings(rawComps));
    setComponentDraft("");

    setClsSaveState("idle");
    setClsSaveError(null);
    setClsTextSaveState("idle");
    setClsTextSaveError(null);
    setClsTextDirty(false);

    clsInitRef.current = sid;
  }, [selectedRaw]);

  // Options de dropdown basées sur les données existantes du chantier (zéro hardcode)
  const categoryOptions = useMemo(() => {
    const fromCatalog = catalogClassification?.categories?.map((c) => safeStr(c?.label, "")).filter(Boolean) || [];
    const fromSessions =
      Array.isArray(savSessionsRaw)
        ? savSessionsRaw
            .map((s: any) => safeStr(get(s, "classification.category", ""), ""))
            .filter(Boolean)
        : [];
    return uniqStrings([clsCategory, ...fromCatalog, ...fromSessions]).filter(Boolean);
  }, [catalogClassification, savSessionsRaw, clsCategory]);

  const subCategoryOptions = useMemo(() => {
    const fromCatalog =
      catalogClassification?.sub_categories?.map((sc) => safeStr(sc?.label, "")).filter(Boolean) || [];

    // si tu veux filtrer les sous-cats par catégorie -> il faudrait une relation cat->subcat.
    // Ton endpoint actuel ne la fournit pas, donc on garde une liste unique globale.
    const fromSessions =
      Array.isArray(savSessionsRaw)
        ? savSessionsRaw
            .map(
              (s: any) =>
                safeStr(get(s, "classification.sub_category", ""), "") ||
                safeStr(get(s, "classification.subCategory", ""), ""),
            )
            .filter(Boolean)
        : [];

    return uniqStrings([clsSubCategory, ...fromCatalog, ...fromSessions]).filter(Boolean);
  }, [catalogClassification, savSessionsRaw, clsSubCategory]);

  // ---------------------------
  // Catalogue composants (common + produit)
  // ---------------------------
  const [catalogComponents, setCatalogComponents] = useState<string[]>([]);
  const [catalogComponentsError, setCatalogComponentsError] = useState<string | null>(null);

  const fetchCatalogComponents = useCallback(
    async (productLabel: string) => {
      setCatalogComponentsError(null);
      try {
        const url = `${API_BASE}/catalog/components?product=${encodeURIComponent(productLabel || "")}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
        setCatalogComponents(suggestions.map((x: any) => safeStr(x, "")).filter(Boolean));
      } catch (e: any) {
        setCatalogComponents([]);
        setCatalogComponentsError(e?.message || "Erreur catalogue composants");
      }
    },
    [API_BASE],
  );

  // Fetch catalogue composants quand le produit change
  useEffect(() => {
    // On privilégie le code si on l’a, sinon fallback sur ce qui est stocké dans le chantier
    const productForCatalog = (productCode || produitRaw || "").trim();
    fetchCatalogComponents(productForCatalog);
  }, [productCode, produitRaw, fetchCatalogComponents]);

  const componentSuggestions = useMemo(() => {
    const comps: string[] = [];
    if (Array.isArray(savSessionsRaw)) {
      for (const s of savSessionsRaw) {
        const arr = get(s, "classification.components", []);
        if (Array.isArray(arr)) {
          for (const x of arr) comps.push(safeStr(x, ""));
        }
      }
    }
    return uniqStrings([...catalogComponents, ...clsComponents, ...comps]).filter(Boolean);
  }, [savSessionsRaw, clsComponents, catalogComponents]);

  // Debounced PATCH
  const clsDebounceTimer = useRef<number | null>(null);
  const clsLastSentRef = useRef<any>(null);

  const computeClassificationDiffPayload = useCallback(() => {
    const sid = safeStr(get(selectedRaw, "sav_session_id", ""), "");
    if (!sid) return null;

    const rawCat = safeStr(get(selectedRaw, "classification.category", ""), "") || "";
    const rawSub =
      safeStr(get(selectedRaw, "classification.sub_category", ""), "") ||
      safeStr(get(selectedRaw, "classification.subCategory", ""), "") ||
      "";
    const rawComps = Array.isArray(get(selectedRaw, "classification.components", []))
      ? (get(selectedRaw, "classification.components", []) as any[])
          .map((x) => safeStr(x, ""))
          .filter(Boolean)
      : [];

    const nextComps = uniqStrings(clsComponents);

    const changed =
      (clsCategory || "") !== (rawCat || "") ||
      (clsSubCategory || "") !== (rawSub || "") ||
      !arraysEqualIgnoreOrder(nextComps, uniqStrings(rawComps));

    if (!changed) return { sid, payload: null };

    const payload = {
      actor: currentUser,
      classification: {
        category: clsCategory || "",
        sub_category: clsSubCategory || "",
        components: nextComps,
      },
    };

    return { sid, payload };
  }, [selectedRaw, clsCategory, clsSubCategory, clsComponents, currentUser]);

  useEffect(() => {
    const sid = safeStr(get(selectedRaw, "sav_session_id", ""), "");
    if (!sid) return;

    // éviter patch juste après init
    if (clsInitRef.current === sid && clsLastSentRef.current == null) {
      // on autorise ensuite (après 1 tick)
      clsLastSentRef.current = {};
      return;
    }

    if (clsDebounceTimer.current) window.clearTimeout(clsDebounceTimer.current);

    clsDebounceTimer.current = window.setTimeout(async () => {
      const res = computeClassificationDiffPayload();
      if (!res || !res.sid) return;
      if (!res.payload) {
        setClsSaveState("idle");
        setClsSaveError(null);
        return;
      }

      setClsSaveState("saving");
      setClsSaveError(null);
      try {
        await patchSavSession(res.sid, res.payload);
        setClsSaveState("saved");
        // refresh pour refléter les données (et garder UI en phase)
        await fetchSavItem();
        // repasse en idle après un court délai
        window.setTimeout(() => setClsSaveState("idle"), 800);
      } catch (e: any) {
        setClsSaveState("error");
        setClsSaveError(e?.message || "Erreur patch classification");
      }
    }, 450);

    return () => {
      if (clsDebounceTimer.current) window.clearTimeout(clsDebounceTimer.current);
    };
  }, [
    selectedRaw,
    clsCategory,
    clsSubCategory,
    clsComponents,
    computeClassificationDiffPayload,
    patchSavSession,
    fetchSavItem,
  ]);

  const addComponent = useCallback(() => {
    const v = (componentDraft || "").trim();
    if (!v) return;
    setClsComponents((prev) => uniqStrings([...prev, v]));
    setComponentDraft("");
  }, [componentDraft]);

  const removeComponent = useCallback((name: string) => {
    const n = (name || "").trim().toLowerCase();
    setClsComponents((prev) => prev.filter((x) => x.trim().toLowerCase() !== n));
  }, []);

  const saveClassificationTextsNow = useCallback(async () => {
    const sid = safeStr(get(selectedRaw, "sav_session_id", ""), "");
    if (!sid) return;

    try {
      setClsTextSaveState("saving");
      setClsTextSaveError(null);

      await patchSavSession(sid, {
        actor: currentUser,
        classification: {
          symptom: clsSymptom || "",
          synthese: clsSynthese || "",
        },
      });

      setClsTextSaveState("saved");
      setClsTextDirty(false);
      await fetchSavItem();
      window.setTimeout(() => setClsTextSaveState("idle"), 1000);
    } catch (e: any) {
      setClsTextSaveState("error");
      setClsTextSaveError(e?.message || "Erreur enregistrement texte");
    }
  }, [selectedRaw, patchSavSession, currentUser, clsSymptom, clsSynthese, fetchSavItem]);

  const handleGenerateClassificationText = useCallback(
    async (field: "synthese" | "symptom") => {
      const sid = safeStr(get(selectedRaw, "sav_session_id", ""), "");
      if (!sid) return;

      try {
        setClsAiLoadingField(field);
        setClsAiError(null);

        const json = await generateClassificationTextWithAi(field);
        const suggested = safeStr(get(json, "result.suggested_text", ""), "");

        if (!suggested) {
          throw new Error("Aucune suggestion IA renvoyée");
        }

        if (field === "synthese") {
          setClsSynthese(suggested);
          await patchSavSession(sid, {
            actor: currentUser,
            classification: {
              synthese: suggested,
            },
          });
        } else {
          setClsSymptom(suggested);
          await patchSavSession(sid, {
            actor: currentUser,
            classification: {
              symptom: suggested,
            },
          });
        }

        setClsTextDirty(false);
        setClsTextSaveState("saved");
        setClsTextSaveError(null);

        await fetchSavItem();
        window.setTimeout(() => setClsTextSaveState("idle"), 1000);
      } catch (e: any) {
        setClsAiError(e?.message || "Erreur génération IA");
      } finally {
        setClsAiLoadingField(null);
      }
    },
    [selectedRaw, generateClassificationTextWithAi, patchSavSession, currentUser, fetchSavItem],
  );

  const onOwnerChange = useCallback(
    async (newOwner: UserName) => {
      setOwner(newOwner);
      setOwnerSaving(true);
      try {
        await patchChantier({
          actor: currentUser,
          owner: newOwner,
        });
        await fetchSavItem(); // refresh pour refléter l'objet
      } finally {
        setOwnerSaving(false);
      }
    },
    [currentUser, fetchSavItem, patchChantier],
  );

  const [productSaving, setProductSaving] = useState<boolean>(false);

  const [referenceSaving, setReferenceSaving] = useState<boolean>(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [numeroSerieSaving, setNumeroSerieSaving] = useState<boolean>(false);
  const [numeroSerieError, setNumeroSerieError] = useState<string | null>(null);

  const onProductChange = useCallback(
    async (newCode: string) => {
      setProductCode(newCode);
      setProductSaving(true);
      try {
        await patchChantier({
          actor: currentUser,
          context: { produit: newCode || "" },
        });
        await fetchSavItem();
      } finally {
        setProductSaving(false);
      }
    },
    [currentUser, fetchSavItem, patchChantier],
  );

  const onReferenceChantierSave = useCallback(async () => {
    const nextValue = (referenceChantier || "").trim();

    if (nextValue === referenceChantierFromData) {
      setReferenceError(null);
      return;
    }

    setReferenceSaving(true);
    setReferenceError(null);

    try {
      await patchChantier({
        actor: currentUser,
        context: {
          reference_chantier: nextValue,
        },
      });

      await fetchSavItem();
    } catch (e: any) {
      setReferenceError(
        e?.message || "Erreur lors de la mise à jour de la référence chantier."
      );
    } finally {
      setReferenceSaving(false);
    }
  }, [
    referenceChantier,
    referenceChantierFromData,
    patchChantier,
    currentUser,
    fetchSavItem,
  ]);

  const onNumeroSerieSave = useCallback(async () => {
    const nextValue = (numeroSerie || "").trim();

    if (nextValue === numeroSerieFromData) {
      setNumeroSerieError(null);
      return;
    }

    setNumeroSerieSaving(true);
    setNumeroSerieError(null);

    try {
      await patchChantier({
        actor: currentUser,
        context: {
          numero_serie: nextValue,
        },
      });

      await fetchSavItem();
    } catch (e: any) {
      setNumeroSerieError(
        e?.message || "Erreur lors de la mise à jour du numéro de série."
      );
    } finally {
      setNumeroSerieSaving(false);
    }
  }, [
    numeroSerie,
    numeroSerieFromData,
    patchChantier,
    currentUser,
    fetchSavItem,
  ]);

  const onInstallateurEmailSave = useCallback(async () => {
    const nextValue = (installateurEmail || "").trim();
    const currentValue = (instEmail || "").trim();

    if (nextValue === currentValue) {
      setInstallateurEmailError(null);
      return;
    }

    setInstallateurEmailSaving(true);
    setInstallateurEmailError(null);

    try {
      await patchChantier({
        actor: currentUser,
        context: {
          installateur: {
            email: nextValue,
          },
        },
      });

      await fetchSavItem();
    } catch (e: any) {
      setInstallateurEmailError(
        e?.message || "Erreur lors de la mise à jour de l’email installateur.",
      );
    } finally {
      setInstallateurEmailSaving(false);
    }
  }, [
    installateurEmail,
    instEmail,
    patchChantier,
    currentUser,
    fetchSavItem,
  ]);

  const onInstallateurPhoneSave = useCallback(async () => {
    const nextValue = (installateurPhone || "").trim();
    const currentValue = (instPhone || "").trim();

    if (nextValue === currentValue) {
      setInstallateurPhoneError(null);
      return;
    }

    setInstallateurPhoneSaving(true);
    setInstallateurPhoneError(null);

    try {
      await patchChantier({
        actor: currentUser,
        context: {
          installateur: {
            phone: nextValue,
          },
        },
      });

      await fetchSavItem();
    } catch (e: any) {
      setInstallateurPhoneError(
        e?.message || "Erreur lors de la mise à jour du téléphone installateur.",
      );
    } finally {
      setInstallateurPhoneSaving(false);
    }
  }, [
    installateurPhone,
    instPhone,
    patchChantier,
    currentUser,
    fetchSavItem,
  ]);

  // ---------------------------
  // Patch C — CRM autocomplete
  // ---------------------------
  const [crmQuery, setCrmQuery] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmResults, setCrmResults] = useState<CrmCandidate[]>([]);
  const [crmOpen, setCrmOpen] = useState(false);
  const crmTimer = useRef<number | null>(null);
  const crmBoxRef = useRef<HTMLDivElement | null>(null);

  const fetchCrm = useCallback(
    async (q: string) => {
      const query = q.trim();
      if (!query) {
        setCrmResults([]);
        setCrmError(null);
        return;
      }
      setCrmLoading(true);
      setCrmError(null);
      try {
        const url = `${API_BASE}/contacts/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Erreur CRM: HTTP ${res.status} — ${txt.slice(0, 160)}`,
          );
        }
        const json = await res.json();
        const results = (json?.results || []) as CrmCandidate[];
        setCrmResults(results);
      } catch (e: any) {
        setCrmError(e?.message || "Erreur CRM inconnue");
        setCrmResults([]);
      } finally {
        setCrmLoading(false);
      }
    },
    [API_BASE],
  );

  useEffect(() => {
    if (crmTimer.current) window.clearTimeout(crmTimer.current);
    crmTimer.current = window.setTimeout(() => {
      void fetchCrm(crmQuery);
    }, 250);
    return () => {
      if (crmTimer.current) window.clearTimeout(crmTimer.current);
    };
  }, [crmQuery, fetchCrm]);

  // Fermer dropdown CRM en cliquant dehors
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!crmBoxRef.current) return;
      if (!crmBoxRef.current.contains(e.target as Node)) setCrmOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onSelectCrm = useCallback(
    async (cand: CrmCandidate) => {
      setCrmOpen(false);
      setCrmQuery(cand.display); // feedback visuel
      try {
        await patchChantier({
          actor: currentUser,
          context: {
            installateur: {
              source: "crm",
              company: cand.company || "",
              name: cand.name || "",
              email: cand.email || "",
              phone: cand.phone || "",
            },
          },
        });
        await fetchSavItem();
      } catch (e: any) {
        setCrmError(e?.message || "Erreur patch CRM");
      }
    },
    [currentUser, fetchSavItem, patchChantier],
  );

  // ---------------------------
  // Render
  // ---------------------------
  const rightStatusLabel = selected?.statusLabel || "";
  const rightStatusCode = normalizeStatusCode(get(selectedRaw, "status", "A_TRAITER"));

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-[88px] items-center justify-between gap-4 px-10">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/sav/sessions")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-700 hover:bg-slate-100"
                title="Retour liste chantiers"
              >
                ←
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-950">
                  Chantier Détail
                </h1>
                <div className="mt-1 truncate text-sm text-slate-500">
                  {(referenceChantierFromData || key || "Chantier") +
                    " · " +
                    (owner || "—")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                onClick={() => setDebugOpen((v) => !v)}
                title="Afficher/masquer debug"
              >
                debug
              </button>

              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none hover:bg-slate-50"
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value as UserName)}
              >
                {USERS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex h-12 items-end gap-8 px-10">
            <button
              type="button"
              onClick={() => setMainTab("CHANTIER")}
              className={cx(
                "h-12 border-b-2 px-1 text-sm font-semibold transition",
                mainTab === "CHANTIER"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-700 hover:text-slate-950",
              )}
            >
              Info Chantier
            </button>

            <button
              type="button"
              onClick={() => setMainTab("SESSION")}
              className={cx(
                "h-12 border-b-2 px-1 text-sm font-semibold transition",
                mainTab === "SESSION"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-700 hover:text-slate-950",
              )}
            >
              Session SAV
            </button>

            <button
              type="button"
              onClick={() => setMainTab("MESSAGES")}
              className={cx(
                "h-12 border-b-2 px-1 text-sm font-semibold transition",
                mainTab === "MESSAGES"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-slate-700 hover:text-slate-950",
              )}
            >
              Messages reçus
            </button>
          </div>
        </div>

        <div className="px-10 py-7">
        {/* Debug panel */}
        {debugOpen && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
            <div className="font-semibold text-neutral-900">Debug</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <span className="text-neutral-500">API_BASE:</span>{" "}
                <span className="font-mono text-xs">{API_BASE}</span>
              </div>
              <div>
                <span className="text-neutral-500">key:</span>{" "}
                <span className="font-mono text-xs">{key || "—"}</span>
              </div>
              <div>
                <span className="text-neutral-500">kind:</span>{" "}
                <span className="font-mono text-xs">{String(kind || "")}</span>
              </div>
              <div>
                <span className="text-neutral-500">sav_sessions:</span>{" "}
                <span className="font-mono text-xs">
                  {Array.isArray(savSessionsRaw) ? savSessionsRaw.length : "—"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">active_sav_session_id:</span>{" "}
                <span className="font-mono text-xs">
                  {activeSavSessionId || "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading / error */}
        {(loading || error) && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
            {loading ? (
              <span className="text-neutral-700">Chargement…</span>
            ) : (
              <span className="text-red-600">{error}</span>
            )}
          </div>
        )}

        

        {/* Unattached session state */}
        {kind === "unattached_session" ? (
          <section className="rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="text-base font-semibold text-neutral-900">
                Session non rattachée à un chantier
              </h2>
            </div>
            <div className="px-5 py-4 text-sm text-neutral-700">
              Cette session WhatsApp existe, mais n’est pas encore liée à un
              chantier.
            </div>
          </section>
        ) : mainTab === "MESSAGES" ? (
          <MessagesRecusTab
            messages={inboundMessages}
            summary={inboundSummary}
            selectedSessionLabel={
              selected
                ? `${selected.code}${selected.dateLabel ? ` · ${selected.dateLabel}` : ""}`
                : ""
            }
          />
        ) : (
          <div className="grid grid-cols-12 gap-7">
            {/* Left column */}
            <div
              className={cx(
                "col-span-12 space-y-6",
                mainTab === "CHANTIER"
                  ? "lg:col-span-8 lg:col-start-3"
                  : "lg:sticky lg:top-[164px] lg:col-span-3 lg:max-h-[calc(100vh-188px)] lg:overflow-auto lg:pr-1",
              )}
            >
            {mainTab === "CHANTIER" ? (
              <Card
                title="Chantier (stable)"
                right={
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-neutral-500 md:inline">
                      Propriétaire
                    </span>
                    <select
                      className="h-9 rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                      value={owner}
                      disabled={ownerSaving}
                      onChange={(e) =>
                        void onOwnerChange(e.target.value as UserName)
                      }
                      title={ownerSaving ? "Enregistrement…" : ""}
                    >
                      {USERS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                }
              >
                {/* ✅ CRM search */}
                <div ref={crmBoxRef} className="mb-4">
                  <div className="text-xs text-neutral-500">
                    Rechercher installateur (CRM)
                  </div>
                  <div className="relative mt-2">
                    <input
                      value={crmQuery}
                      onChange={(e) => {
                        setCrmQuery(e.target.value);
                        setCrmOpen(true);
                      }}
                      onFocus={() => setCrmOpen(true)}
                      placeholder="Nom / Société / Email / Téléphone…"
                      className="h-10 w-full rounded-xl bg-white px-3 text-sm text-neutral-900 ring-1 ring-neutral-200 outline-none focus:ring-2 focus:ring-neutral-300"
                    />

                    {/* Dropdown results */}
                    {crmOpen &&
                      (crmLoading || crmError || crmResults.length > 0) && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-neutral-200">
                          {crmLoading && (
                            <div className="px-4 py-3 text-sm text-neutral-600">
                              Recherche…
                            </div>
                          )}

                          {crmError && !crmLoading && (
                            <div className="px-4 py-3 text-sm text-red-600">
                              {crmError}
                            </div>
                          )}

                          {!crmLoading &&
                            !crmError &&
                            crmResults.length === 0 &&
                            crmQuery.trim() && (
                              <div className="px-4 py-3 text-sm text-neutral-600">
                                Aucun résultat
                              </div>
                            )}

                          {!crmLoading &&
                            !crmError &&
                            crmResults.length > 0 && (
                              <div className="max-h-64 overflow-auto">
                                {crmResults.map((r, idx) => (
                                  <button
                                    key={`${r.email}-${idx}`}
                                    type="button"
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-neutral-50"
                                    onClick={() => void onSelectCrm(r)}
                                  >
                                    <div className="font-medium text-neutral-900">
                                      {r.display}
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-500">
                                      {r.email ? r.email : ""}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                  </div>
                </div>

                {/* ✅ Stable fields (vides si inconnus) */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <div className="text-xs text-neutral-500">Référence chantier</div>

                    <div className="mt-1">
                      <input
                        className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        value={referenceChantier}
                        disabled={referenceSaving}
                        placeholder="Référence chantier..."

                        onChange={(e) => {
                          setReferenceChantier(e.target.value);
                          if (referenceError) setReferenceError(null);
                        }}

                        onBlur={() => void onReferenceChantierSave()}

                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void onReferenceChantierSave();
                          }
                        }}
                      />

                      {referenceError && (
                        <div className="mt-1 text-xs text-red-600">
                          {referenceError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Produit</div>
                    <div className="mt-1">
                      <select
                        className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        value={productCode}
                        disabled={productsLoading || productSaving}
                        onChange={(e) => void onProductChange(e.target.value)}
                      >
                        <option value="">—</option>
                        {products.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </select>

                      {productsError ? (
                        <div className="mt-1 text-xs text-red-600">
                          {productsError}
                        </div>
                      ) : null}

                      {!productsError && productCode && !selectedProductLabel ? (
                        <div className="mt-1 text-xs text-amber-700">
                          Produit non reconnu: {productCode}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Numéro de série</div>

                    <div className="mt-1">
                      <input
                        className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        value={numeroSerie}
                        disabled={numeroSerieSaving}
                        placeholder="Numéro de série..."

                        onChange={(e) => {
                          setNumeroSerie(e.target.value);
                          if (numeroSerieError) setNumeroSerieError(null);
                        }}

                        onBlur={() => void onNumeroSerieSave()}

                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void onNumeroSerieSave();
                          }
                        }}
                      />

                      {numeroSerieError && (
                        <div className="mt-1 text-xs text-red-600">
                          {numeroSerieError}
                        </div>
                      )}
                    </div>
                  </div>

                  <Field label="Installateur" value={installateurLabel} />
                  <Field label="Contact" value={contactLabel} />

                  <div>
                    <div className="text-xs text-neutral-500">Email installateur</div>

                    <div className="mt-1">
                      <input
                        className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        value={installateurEmail}
                        disabled={installateurEmailSaving}
                        placeholder="Email installateur..."
                        onChange={(e) => {
                          setInstallateurEmail(e.target.value);
                          if (installateurEmailError) setInstallateurEmailError(null);
                        }}
                        onBlur={() => void onInstallateurEmailSave()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void onInstallateurEmailSave();
                          }
                        }}
                      />

                      {installateurEmailError && (
                        <div className="mt-1 text-xs text-red-600">
                          {installateurEmailError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-neutral-500">Téléphone</div>

                    <div className="mt-1">
                      <input
                        className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                        value={installateurPhone}
                        disabled={installateurPhoneSaving}
                        placeholder="Téléphone installateur..."
                        onChange={(e) => {
                          setInstallateurPhone(e.target.value);
                          if (installateurPhoneError) setInstallateurPhoneError(null);
                        }}
                        onBlur={() => void onInstallateurPhoneSave()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void onInstallateurPhoneSave();
                          }
                        }}
                      />

                      {installateurPhoneError && (
                        <div className="mt-1 text-xs text-red-600">
                          {installateurPhoneError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
              ) : null}

              {mainTab === "SESSION" ? (
              <>
              <Card
                title="Sessions SAV"
                right={
                  <Button
                    variant="outline"
                    onClick={handleCreateSavSession}
                    disabled={creatingSavSession}
                  >
                    {creatingSavSession ? "Création..." : "+ Nouvelle"}
                  </Button>
                }
                className="pb-2"
              >
                {createSavSessionError ? (
                  <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                    {createSavSessionError}
                  </div>
                ) : null}
                {uiSessions.length ? (
                  <div className="space-y-3">
                    {uiSessions.map((s) => {
                      const displayName = sessionNames[s.id] || "";
                      return (
                        <SessionsListItem
                          key={s.id}
                          session={s}
                          isSelected={s.id === selectedId}
                          isEditing={editingSessionId === s.id}
                          onClick={() => {
                            setEditingSessionId(null); // ✅ si on clique ailleurs/une autre session => exit rename
                            setSelectedId(s.id);
                          }}
                          onStartEdit={() => setEditingSessionId(s.id)}
                          onStopEdit={() => setEditingSessionId(null)}
                          displayName={displayName}
                          onRename={(val) => setSessionDisplayName(s.id, val)}
                          onCommitName={() => commitSessionDisplayName(s.id)}
                          onDelete={() => void handleDeleteSavSession(s.id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 ring-1 ring-neutral-200">
                    Aucune session SAV trouvée dans ce chantier.
                  </div>
                )}
              </Card>

              <Card
                title="Contexte session"
                className="ring-orange-200"
                right={
                  <div className="flex items-center gap-2">
                    {selected ? (
                      <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
                        {selected.id}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-xl bg-white px-2 py-1 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
                      title="Modifier le contexte de la session"
                    >
                      ✎
                    </button>
                  </div>
                }
              >
                {selected ? (
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs text-neutral-500">
                        {selected.dateLabel || "Session active"}
                      </div>

                      <select
                        className={cx(
                          "mt-2 h-9 w-full rounded-xl px-3 text-xs font-medium border border-transparent",
                          rightStatusCode === "RESOLU"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : rightStatusCode === "EN_ATTENTE_INTERNE"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : rightStatusCode === "EN_ATTENTE_INSTALLATEUR"
                                ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                                : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
                          statusSaving ? "opacity-60 cursor-wait" : "cursor-pointer",
                        )}
                        value={rightStatusCode}
                        onChange={(e) => void handleChangeSavSessionStatus(e.target.value)}
                        disabled={statusSaving || !currentSavSessionId}
                        title="Modifier le statut de la session SAV"
                      >
                        {SAV_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handlePreviewInstallateur()}
                        disabled={!currentSavSessionId || previewInstallateurLoading}
                        className="mt-3 h-10 w-full rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {previewInstallateurLoading ? "Ouverture..." : "Aperçu installateur"}
                      </button>
                    </div>

                    {statusSaveError ? (
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                        {statusSaveError}
                      </div>
                    ) : null}

                    <div className="border-t border-neutral-100 pt-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Qualification
                        </div>

                        <div className="text-xs">
                          {clsSaveState === "saving" ? (
                            <span className="text-neutral-500">Enregistrement…</span>
                          ) : clsSaveState === "saved" ? (
                            <span className="text-emerald-700">Enregistré</span>
                          ) : clsSaveState === "error" ? (
                            <span className="text-red-600">
                              Erreur{clsSaveError ? `: ${clsSaveError}` : ""}
                            </span>
                          ) : (
                            <span className="text-neutral-400"> </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 text-xs text-neutral-500">Catégorie</div>
                          <select
                            className="h-8 w-full rounded-lg bg-red-50 px-2 text-xs font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                            value={clsCategory}
                            onChange={(e) => {
                              setClsCategory(e.target.value);
                              setClsSubCategory("");
                            }}
                          >
                            <option value="">—</option>
                            {categoryOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="mb-1 text-xs text-neutral-500">Sous-catégorie</div>
                          <select
                            className="h-8 w-full rounded-lg bg-neutral-100 px-2 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
                            value={clsSubCategory}
                            onChange={(e) => setClsSubCategory(e.target.value)}
                          >
                            <option value="">—</option>
                            {subCategoryOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="mb-2 text-xs text-neutral-500">Composants</div>

                          {clsComponents.length > 0 ? (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {clsComponents.map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200"
                                >
                                  {c}
                                  <button
                                    type="button"
                                    className="text-neutral-500 hover:text-neutral-900"
                                    onClick={() => removeComponent(c)}
                                    aria-label={`Retirer ${c}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <input
                            className="h-8 w-full rounded-lg bg-white px-2 text-xs text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400"
                            placeholder="Ajouter composant…"
                            value={componentDraft}
                            list="components_suggestions_context"
                            onChange={(e) => setComponentDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addComponent();
                              }
                            }}
                          />

                          <datalist id="components_suggestions_context">
                            {componentSuggestions.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>

                          <button
                            type="button"
                            className="mt-2 h-7 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                            onClick={addComponent}
                            disabled={!componentDraft.trim()}
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                          Symptômes
                        </div>

                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Générer avec l’IA"
                          disabled={clsAiLoadingField !== null || clsTextSaveState === "saving"}
                          onClick={() => void handleGenerateClassificationText("symptom")}
                        >
                          {clsAiLoadingField === "symptom" ? "…" : "✨"}
                        </button>
                      </div>

                      <textarea
                        className="min-h-[170px] w-full rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 ring-1 ring-orange-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        placeholder="Décrire le symptôme…"
                        value={clsSymptom}
                        onChange={(e) => {
                          setClsSymptom(e.target.value);
                          setClsTextDirty(true);
                          if (clsTextSaveState !== "idle") {
                            setClsTextSaveState("idle");
                            setClsTextSaveError(null);
                          }
                        }}
                      />
                    </div>

                    <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                          Synthèse
                        </div>

                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Générer avec l’IA"
                          disabled={clsAiLoadingField !== null || clsTextSaveState === "saving"}
                          onClick={() => void handleGenerateClassificationText("synthese")}
                        >
                          {clsAiLoadingField === "synthese" ? "…" : "✨"}
                        </button>
                      </div>

                      <textarea
                        className="min-h-[170px] w-full rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 ring-1 ring-orange-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        placeholder="Résumer le diagnostic ou la situation…"
                        value={clsSynthese}
                        onChange={(e) => {
                          setClsSynthese(e.target.value);
                          setClsTextDirty(true);
                          if (clsTextSaveState !== "idle") {
                            setClsTextSaveState("idle");
                            setClsTextSaveError(null);
                          }
                        }}
                      />

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Button
                          variant="outline"
                          className="h-9 px-3 py-1 text-xs"
                          disabled={clsTextSaveState === "saving" || !clsTextDirty}
                          onClick={() => void saveClassificationTextsNow()}
                        >
                          {clsTextSaveState === "saving" ? "Enregistrement…" : "Enregistrer contexte"}
                        </Button>

                        <div className="text-xs">
                          {clsAiError ? (
                            <span className="text-red-600">{clsAiError}</span>
                          ) : clsTextSaveState === "saved" ? (
                            <span className="text-emerald-700">Texte enregistré</span>
                          ) : clsTextSaveState === "error" ? (
                            <span className="text-red-600">
                              Erreur{clsTextSaveError ? `: ${clsTextSaveError}` : ""}
                            </span>
                          ) : (
                            <span className="text-neutral-400"> </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 ring-1 ring-neutral-200">
                    Sélectionne une session SAV pour afficher son contexte.
                  </div>
                )}
              </Card>
              </>
              ) : null}
            </div>

            {/* Right column */}
            <div
              className={cx(
                "col-span-12 lg:col-span-9",
                mainTab === "CHANTIER" ? "hidden" : "",
              )}
            >
              <section className="space-y-6">
                {/* Header inside right card */}
                <div className="hidden">
                  <div className="flex items-center gap-3 flex-nowrap min-w-0">
                    <h2 className="text-base font-semibold text-neutral-900">
                      Session SAV (événement)
                    </h2>
                    {selected ? (
                      <div className="ml-2 text-sm text-neutral-500">
                        {selected.id} {selected.dateLabel ? `· ${selected.dateLabel}` : ""}
                      </div>
                    ) : null}
                    <select
                      className={cx(
                        "h-9 rounded-full px-3 text-xs font-medium border border-transparent",
                        rightStatusCode === "RESOLU"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : rightStatusCode === "EN_ATTENTE_INTERNE"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : rightStatusCode === "EN_ATTENTE_INSTALLATEUR"
                              ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                              : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
                        statusSaving ? "opacity-60 cursor-wait" : "cursor-pointer",
                      )}
                      value={rightStatusCode}
                      onChange={(e) => void handleChangeSavSessionStatus(e.target.value)}
                      disabled={statusSaving || !currentSavSessionId}
                      title="Modifier le statut de la session SAV"
                    >
                      {SAV_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handlePreviewInstallateur()}
                      disabled={!currentSavSessionId || previewInstallateurLoading}
                    >
                      {previewInstallateurLoading ? "Ouverture..." : "Aperçu installateur"}
                    </Button>
                  </div>
                </div>

                {statusSaveError ? (
                  <div className="px-5 pt-3">
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                      {statusSaveError}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-6">
                  {/* Classification déplacée dans la colonne gauche */}
                  <div className="hidden">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        Classification
                      </h3>

                      <div className="text-xs">
                        {clsSaveState === "saving" ? (
                          <span className="text-neutral-500">Enregistrement…</span>
                        ) : clsSaveState === "saved" ? (
                          <span className="text-emerald-700">Enregistré</span>
                        ) : clsSaveState === "error" ? (
                          <span className="text-red-600">
                            Erreur{clsSaveError ? `: ${clsSaveError}` : ""}
                          </span>
                        ) : (
                          <span className="text-neutral-400"> </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <div className="mb-2 text-xs text-neutral-500">Catégorie</div>
                        <select
                          className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
                          value={clsCategory}
                          onChange={(e) => {
                            setClsCategory(e.target.value);
                            // reset sous-cat si on change la cat
                            setClsSubCategory("");
                          }}
                        >
                          <option value="">—</option>
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-2 text-xs text-neutral-500">
                          Sous-catégorie
                        </div>
                        <select
                          className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
                          value={clsSubCategory}
                          onChange={(e) => setClsSubCategory(e.target.value)}
                        >
                          <option value="">—</option>
                          {subCategoryOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-2 text-xs text-neutral-500">Composant</div>

                        {/* Chips */}
                        {clsComponents.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {clsComponents.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200"
                              >
                                {c}
                                <button
                                  type="button"
                                  className="text-neutral-500 hover:text-neutral-900"
                                  onClick={() => removeComponent(c)}
                                  aria-label={`Retirer ${c}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Input + suggestions */}
                        <input
                          className="h-10 w-full rounded-xl bg-white px-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400"
                          placeholder="Ajouter composant…"
                          value={componentDraft}
                          list="components_suggestions"
                          onChange={(e) => setComponentDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addComponent();
                            }
                          }}
                          onBlur={() => {
                            // option: auto-ajout si blur avec texte
                            // addComponent();
                          }}
                        />
                        <datalist id="components_suggestions">
                          {componentSuggestions.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>

                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            onClick={addComponent}
                            disabled={!componentDraft.trim()}
                          >
                            Ajouter
                          </Button>
                          <span className="text-xs text-neutral-400">
                            Entrée pour ajouter
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-neutral-500">Synthèse (optionnel)</div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Générer avec l’IA"
                              disabled={clsAiLoadingField !== null || clsTextSaveState === "saving"}
                              onClick={() => void handleGenerateClassificationText("synthese")}
                            >
                              {clsAiLoadingField === "synthese" ? "…" : "✨"}
                            </button>

                            <Button
                              variant="outline"
                              className="h-8 px-3 py-1 text-xs"
                              disabled={clsTextSaveState === "saving" || !clsTextDirty}
                              onClick={() => void saveClassificationTextsNow()}
                            >
                              {clsTextSaveState === "saving" ? "Enregistrement…" : "Enregistrer"}
                            </Button>
                          </div>
                        </div>

                        <textarea
                          className="min-h-[110px] w-full rounded-xl bg-white px-3 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400"
                          placeholder="Résumer le diagnostic ou la situation…"
                          value={clsSynthese}
                          onChange={(e) => {
                            setClsSynthese(e.target.value);
                            setClsTextDirty(true);
                            if (clsTextSaveState !== "idle") {
                              setClsTextSaveState("idle");
                              setClsTextSaveError(null);
                            }
                          }}
                        />
                      </div>

                      <div className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-neutral-500">Symptôme (optionnel)</div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Générer avec l’IA"
                              disabled={clsAiLoadingField !== null || clsTextSaveState === "saving"}
                              onClick={() => void handleGenerateClassificationText("symptom")}
                            >
                              {clsAiLoadingField === "symptom" ? "…" : "✨"}
                            </button>

                            <Button
                              variant="outline"
                              className="h-8 px-3 py-1 text-xs"
                              disabled={clsTextSaveState === "saving" || !clsTextDirty}
                              onClick={() => void saveClassificationTextsNow()}
                            >
                              {clsTextSaveState === "saving" ? "Enregistrement…" : "Enregistrer"}
                            </Button>
                          </div>
                        </div>

                        <textarea
                          className="min-h-[110px] w-full rounded-xl bg-white px-3 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400"
                          placeholder="Décrire le symptôme…"
                          value={clsSymptom}
                          onChange={(e) => {
                            setClsSymptom(e.target.value);
                            setClsTextDirty(true);
                            if (clsTextSaveState !== "idle") {
                              setClsTextSaveState("idle");
                              setClsTextSaveError(null);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-xs">
                      {clsAiError ? (
                        <span className="text-red-600">{clsAiError}</span>
                      ) : clsTextSaveState === "saved" ? (
                        <span className="text-emerald-700">Texte enregistré</span>
                      ) : clsTextSaveState === "error" ? (
                        <span className="text-red-600">
                          Erreur{clsTextSaveError ? `: ${clsTextSaveError}` : ""}
                        </span>
                      ) : (
                        <span className="text-neutral-400"> </span>
                      )}
                    </div>
                  </div>

                  {/* Note en cours */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold text-neutral-900">Note en cours</h3>

                      <div className="flex items-center gap-2">
                        {activeNoteId && activeNoteId !== "__draft__" ? (
                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            onClick={() => handleDeleteNote(activeNoteId)}
                            disabled={noteDeleteBusy}
                          >
                            {noteDeleteBusy ? "Suppression..." : "Supprimer"}
                          </Button>
                        ) : null}

                        <Button
                          variant="outline"
                          className="h-9 px-3 py-1 text-xs"
                          onClick={createNewDraftNote}
                        >
                          + Nouvelle note
                        </Button>
                      </div>
                    </div>

                    {noteDeleteError ? (
                      <div className="mt-2 text-xs text-red-600">{noteDeleteError}</div>
                    ) : null}

                    {/* Upload inputs invisibles */}
                    <input
                      ref={uploadVisualInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          setUploadBusy(true);
                          await uploadToNote("asset", f);
                        } catch (err: any) {
                          setNoteSaveState("error");
                          setNoteSaveError(err?.message || "Erreur upload visuel");
                        } finally {
                          setUploadBusy(false);
                        }
                      }}
                    />
                    <input
                      ref={uploadFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          setUploadBusy(true);
                          await uploadToNote("file", f);
                        } catch (err: any) {
                          setNoteSaveState("error");
                          setNoteSaveError(err?.message || "Erreur upload fichier");
                        } finally {
                          setUploadBusy(false);
                        }
                      }}
                    />

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
                      {/* Interlocuteur */}
                      <div className="md:col-span-5">
                        <div className="mb-2 text-xs text-neutral-500">Interlocuteur</div>
                        <select
                          className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
                          value={noteTarget}
                          onChange={(e) => {
                            const nextTarget = e.target.value as NoteTargetCode;
                            setNoteTarget(nextTarget);
                            setNoteDirty(true);

                            // ✅ s'assurer que le canal est valide pour ce target
                            const allowed = NOTE_ALLOWED_CHANNELS_BY_TARGET[nextTarget] || ["NONE"];
                            if (!allowed.includes(noteChannel)) {
                              setNoteChannel(allowed[0] as NoteChannelCode); // COMMERCIAL => EMAIL, INTERNE => NONE, etc.
                            }
                          }}
                        >
                          {NOTE_TARGET_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Canal */}
                      <div className="md:col-span-4">
                        <div className="mb-2 text-xs text-neutral-500">Canal</div>
                        <select
                          className="h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                          value={noteTarget === "INTERNE" ? "NONE" : noteChannel}
                          disabled={noteTarget === "INTERNE"}
                          onChange={(e) => {
                            setNoteChannel(e.target.value as any);
                            setNoteDirty(true);
                          }}
                        >
                          {NOTE_CHANNEL_OPTIONS
                            .filter((o) =>
                              (NOTE_ALLOWED_CHANNELS_BY_TARGET[noteTarget] || ["NONE"]).includes(
                                o.code as NoteChannelCode
                              )
                            )
                            .map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.label}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Compteurs inclure */}
                      <div className="md:col-span-3">
                        <div className="mb-2 text-xs text-neutral-500">Inclure</div>
                        <div className="flex h-10 items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-orange-900">
                          <span>{includesInputCount} photo{includesInputCount > 1 ? "s" : ""}</span>
                          <span>{includesOutputCount} visuel{includesOutputCount > 1 ? "s" : ""}</span>
                          <span>{includesFileCount} fichier{includesFileCount > 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="mt-4">
                      <textarea
                        rows={6}
                        className="min-h-[240px] w-full rounded-2xl bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        placeholder="Écrire la note…"
                        value={noteText}
                        onChange={(e) => {
                          setNoteText(e.target.value);
                          setNoteDirty(true);

                          if (aiSuggestion || aiState === "error") {
                            setAiState("idle");
                            setAiError(null);
                            setAiSuggestion(null);
                            setAiSourceText("");
                          }
                        }}
                        onInput={(e) => {
                          const el = e.currentTarget;
                          el.style.height = "auto";
                          el.style.height = `${el.scrollHeight}px`;
                        }}
                      />
                    </div>

                    {/* Panneau temporaire IA */}
                    {(aiState === "error" || aiSuggestion) ? (
                      <div className="mt-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-neutral-900">Proposition IA</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Vérifie la proposition avant de l’appliquer à la note.
                            </div>
                          </div>

                          {aiSuggestion?.severity ? (
                            <Pill
                              tone={
                                aiSuggestion.severity === "ok"
                                  ? "success"
                                  : aiSuggestion.severity === "warning"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {aiSuggestion.severity === "ok"
                                ? "OK"
                                : aiSuggestion.severity === "warning"
                                  ? "Warning"
                                  : "Infos manquantes"}
                            </Pill>
                          ) : null}
                        </div>

                        {aiError ? (
                          <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                            {aiError}
                          </div>
                        ) : null}

                        {!aiError && aiSourceText ? (
                          <div className="mt-4">
                            <div className="mb-2 text-xs text-neutral-500">Texte actuel</div>
                            <div className="whitespace-pre-wrap rounded-xl bg-white px-3 py-3 text-sm text-neutral-800 ring-1 ring-neutral-200">
                              {aiSourceText || <span className="text-neutral-400">—</span>}
                            </div>
                          </div>
                        ) : null}

                        {!aiError && aiSuggestion?.suggested_body ? (
                          <div className="mt-4">
                            <div className="mb-2 text-xs text-neutral-500">Proposition IA</div>
                            <div className="whitespace-pre-wrap rounded-xl bg-white px-3 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200">
                              {aiSuggestion.suggested_body}
                            </div>
                          </div>
                        ) : null}

                        {!aiError && aiSuggestion?.explanation ? (
                          <div className="mt-4 text-sm text-neutral-700">{aiSuggestion.explanation}</div>
                        ) : null}

                        {!aiError && aiSuggestion?.warnings?.length ? (
                          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 ring-1 ring-amber-200">
                            <div className="text-xs font-semibold text-amber-800">Warnings</div>
                            <ul className="mt-2 space-y-1 text-sm text-amber-800">
                              {aiSuggestion.warnings.map((w, idx) => (
                                <li key={`${w}-${idx}`}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {!aiError && aiSuggestion?.missing_info?.length ? (
                          <div className="mt-4 rounded-xl bg-red-50 px-3 py-3 ring-1 ring-red-200">
                            <div className="text-xs font-semibold text-red-800">Informations manquantes</div>
                            <ul className="mt-2 space-y-1 text-sm text-red-800">
                              {aiSuggestion.missing_info.map((m, idx) => (
                                <li key={`${m}-${idx}`}>• {m}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center gap-2">
                          {aiSuggestion?.can_generate && aiSuggestion?.suggested_body ? (
                            <Button
                              variant="solid"
                              className="h-9 px-4 text-xs"
                              onClick={handleApplyAiSuggestion}
                            >
                              Appliquer
                            </Button>
                          ) : null}

                          <Button
                            variant="outline"
                            className="h-9 px-4 text-xs"
                            onClick={handleCancelAiSuggestion}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {/* Ligne actions (upload à gauche, enregistrer à droite) */}
                      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        {/* Gauche */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            disabled={uploadBusy}
                            onClick={() => uploadVisualInputRef.current?.click()}
                          >
                            Uploader visuel
                          </Button>

                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            disabled={uploadBusy}
                            onClick={() => uploadFileInputRef.current?.click()}
                          >
                            Uploader fichier
                          </Button>

                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            disabled={uploadBusy || aiState === "loading" || !currentSavSessionId}
                            onClick={() => void handleImproveWithAi()}
                          >
                            {aiState === "loading" ? "IA..." : "Améliorer avec IA"}
                          </Button>

                          {uploadBusy ? (
                            <span className="text-xs text-neutral-500">Upload…</span>
                          ) : null}
                        </div>

                        {/* Droite (zone verte) */}
                        <div className="flex items-start gap-3">
                          <Button
                            className="h-11 px-5 text-sm"
                            disabled={uploadBusy || !noteDirty || noteSaveState === "saving"}
                            onClick={saveNoteNow}
                          >
                            Enregistrer
                          </Button>

                          <Button
                            variant="solid"
                            className="h-11 bg-orange-600 px-6 text-sm hover:bg-orange-700"
                            disabled={
                              uploadBusy ||
                              noteSaveState === "saving" ||
                              notePublishState === "publishing" ||
                              noteChannel === "NONE" ||
                              !noteChannel
                            }
                            onClick={() => void publishNoteNow()}
                          >
                            {notePublishState === "publishing" ? "Publication…" : "Publier"}
                          </Button>

                          {/* Status compact sous les boutons */}
                          <div className="flex flex-col items-end gap-1 pt-1 text-xs">
                            {noteSaveState === "saving" ? (
                              <span className="text-neutral-500">Enregistrement…</span>
                            ) : noteSaveState === "saved" ? (
                              <span className="text-emerald-700">Enregistré</span>
                            ) : noteSaveState === "error" ? (
                              <span className="text-red-600">
                                Erreur{noteSaveError ? `: ${noteSaveError}` : ""}
                              </span>
                            ) : noteDirty ? (
                              <span className="text-neutral-500">Non enregistré</span>
                            ) : (
                              <span className="text-neutral-400"> </span>
                            )}

                            {notePublishState === "published" ? (
                              <span className="text-emerald-700">Publié</span>
                            ) : notePublishState === "error" ? (
                              <span className="text-red-600">
                                {notePublishError ? `Erreur: ${notePublishError}` : "Erreur publication"}
                              </span>
                            ) : noteTarget === "INTERNE" ? (
                              <span className="text-neutral-500">Publication désactivée (Interne)</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Visuels & fichiers */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-neutral-900">Visuels & documents</h3>
                        <div className="mt-1 text-sm text-neutral-500">
                          Sélection des éléments inclus dans la note active.
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={cx(
                            "h-9 rounded-xl px-3 text-xs font-medium ring-1 ring-neutral-200",
                            vfTab === "input" ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 hover:bg-neutral-50",
                          )}
                          onClick={() => setVfTab("input")}
                        >
                          Photos reçues
                        </button>
                        <button
                          type="button"
                          className={cx(
                            "h-9 rounded-xl px-3 text-xs font-medium ring-1 ring-neutral-200",
                            vfTab === "output" ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 hover:bg-neutral-50",
                          )}
                          onClick={() => setVfTab("output")}
                        >
                          Visuels créés
                        </button>
                        <button
                          type="button"
                          className={cx(
                            "h-9 rounded-xl px-3 text-xs font-medium ring-1 ring-neutral-200",
                            vfTab === "files" ? "bg-neutral-900 text-white" : "bg-white text-neutral-900 hover:bg-neutral-50",
                          )}
                          onClick={() => setVfTab("files")}
                        >
                          Fichiers
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
                      <div className="font-semibold">
                        Inclusions pour la note active
                      </div>
                      <div className="mt-1">
                        {includesInputCount} photo{includesInputCount > 1 ? "s" : ""} ·{" "}
                        {includesOutputCount} visuel{includesOutputCount > 1 ? "s" : ""} ·{" "}
                        {includesFileCount} fichier{includesFileCount > 1 ? "s" : ""} inclus
                      </div>
                    </div>

                    {/* TAB: Visuels input */}
                    {vfTab === "input" ? (
                      <div className="mt-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                          <div className="text-xs font-medium text-neutral-700">
                            Déplacer la photo active vers
                          </div>

                          <select
                            className="h-9 rounded-xl bg-white px-3 text-xs font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                            value={movePhotoTarget}
                            disabled={!activePhotoUid || movePhotoBusy || !movePhotoOptions.length}
                            onChange={(e) => setMovePhotoTarget(e.target.value)}
                          >
                            {movePhotoOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <Button
                            variant="outline"
                            className="h-9 px-3 py-1 text-xs"
                            disabled={!activePhotoUid || movePhotoBusy || !movePhotoTarget}
                            onClick={() => void handleMoveActivePhoto()}
                          >
                            {movePhotoBusy ? "Déplacement..." : "Déplacer"}
                          </Button>

                          {activePhotoUid ? (
                            <span className="text-xs text-neutral-500">
                              Photo active sélectionnée
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">
                              Sélectionner une photo
                            </span>
                          )}

                          {movePhotoError ? (
                            <span className="text-xs text-red-600">{movePhotoError}</span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        {/* Preview */}
                        <div className="lg:col-span-8">
                          <div className="relative flex h-[460px] items-center justify-center overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
                            {activePhoto?.url ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setIsPhotoFullscreenOpen(true)}
                                  className="absolute right-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-neutral-900 ring-1 ring-neutral-200 hover:bg-white"
                                  title="Ouvrir en plein écran"
                                >
                                  ⤢
                                </button>

                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={activePhoto.url}
                                  alt="Photo"
                                  className="h-full w-full object-contain"
                                />
                              </>
                            ) : selectedPhotos.length ? (
                              <div className="text-sm text-neutral-400">
                                Photo introuvable (uid: {activePhotoUid || "—"})
                              </div>
                            ) : (
                              <div className="text-sm text-neutral-400">
                                Aucune photo pour cette session
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Thumbnails + checkbox Inclure */}
                        <div className="lg:col-span-4">
                          <div className="mb-2 text-sm font-semibold text-neutral-900">
                            {selectedPhotos.length} photo{selectedPhotos.length > 1 ? "s" : ""}
                          </div>

                          {selectedPhotos.length ? (
                            <div className="space-y-3">
                              {selectedPhotos.map((ph) => {
                                const isActive = ph.uid === activePhotoUid;
                                const isIncluded = includedInputUids.includes(ph.uid);

                                return (
                                  <div key={ph.uid} className="flex items-stretch gap-2">
                                    <button
                                      type="button"
                                      className={cx(
                                        "flex h-[78px] flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200",
                                        isActive
                                          ? "ring-2 ring-indigo-200 bg-indigo-50"
                                          : "hover:bg-neutral-100",
                                      )}
                                      onClick={() => setActivePhotoUid(ph.uid)}
                                      title={ph.uid}
                                    >
                                      {ph.url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={ph.url}
                                          alt="Miniature"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="px-2 text-center text-xs text-neutral-400">
                                          Pas d’URL
                                          <div className="mt-1 break-all">{ph.uid}</div>
                                        </div>
                                      )}
                                    </button>

                                    <label className="flex w-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-white px-2 ring-1 ring-neutral-200">
                                      <input
                                        type="checkbox"
                                        checked={isIncluded}
                                        onChange={() => toggleInclude("input", ph.uid)}
                                      />
                                      <span className="text-[11px] text-neutral-700">Inclure</span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="h-[78px] rounded-2xl bg-neutral-50 ring-1 ring-neutral-200" />
                          )}
                        </div>
                      </div>
                    </div>
                    ) : null}

                    {/* TAB: Visuels output */}
                      {vfTab === "output" ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                          {/* Preview */}
                          <div className="lg:col-span-8">
                            <div className="relative flex h-[460px] items-center justify-center overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
                              {activeOutputAsset?.url ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={activeOutputAsset.url}
                                    alt="Visuel output"
                                    className="h-full w-full object-contain"
                                  />
                                </>
                              ) : availableOutputAssets.length ? (
                                <div className="text-sm text-neutral-400">
                                  Visuel introuvable (asset: {activeOutputAssetId || "—"})
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-400">
                                  Aucun visuel output disponible (upload via une note).
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Liste + checkbox Inclure */}
                          <div className="lg:col-span-4">
                            <div className="mb-2 text-sm font-semibold text-neutral-900">
                              {availableOutputAssets.length} visuel{availableOutputAssets.length > 1 ? "s" : ""}
                            </div>

                            {availableOutputAssets.length ? (
                              <div className="space-y-3">
                                {availableOutputAssets.map((a) => {
                                  const isActive = a.assetId === activeOutputAssetId;
                                  const isIncluded = includedOutputAssetIds.includes(a.assetId);

                                  return (
                                    <div key={a.assetId} className="flex items-stretch gap-2">
                                      <button
                                        type="button"
                                        className={cx(
                                          "flex h-[78px] flex-1 items-center justify-center overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-neutral-200",
                                          isActive ? "ring-2 ring-indigo-200 bg-indigo-50" : "hover:bg-neutral-100",
                                        )}
                                        onClick={() => setActiveOutputAssetId(a.assetId)}
                                        title={a.assetId}
                                      >
                                        {a.url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={a.url} alt="Miniature output" className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="px-2 text-center text-xs text-neutral-400">
                                            Pas d’URL
                                          </div>
                                        )}
                                      </button>

                                      <label className="flex w-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-white px-2 ring-1 ring-neutral-200">
                                        <input
                                          type="checkbox"
                                          checked={isIncluded}
                                          onChange={() => toggleInclude("output", a.assetId)}
                                        />
                                        <span className="text-[11px] text-neutral-700">Inclure</span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="h-[78px] rounded-2xl bg-neutral-50 ring-1 ring-neutral-200" />
                            )}
                          </div>
                        </div>
                      ) : null}

                    {/* TAB: Fichiers */}
                    {vfTab === "files" ? (
                      <div className="mt-4">
                        {availableFiles.length ? (
                          <div className="space-y-3">
                            {availableFiles.map((f) => {
                              const included = includedFileIds.includes(f.fileId);
                              return (
                                <div
                                  key={f.fileId}
                                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-neutral-900">
                                      {f.name}
                                    </div>
                                    <div className="mt-0.5 text-xs text-neutral-500">
                                      Document
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <a
                                      href={f.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-medium text-neutral-900 underline"
                                    >
                                      Ouvrir
                                    </a>

                                    <label className="flex items-center gap-2 text-xs text-neutral-700">
                                      <input
                                        type="checkbox"
                                        checked={included}
                                        onChange={() => toggleInclude("file", f.fileId)}
                                      />
                                      Inclure
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-500 ring-1 ring-neutral-200">
                            Aucun fichier disponible (upload via une note).
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Historique des notes */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-neutral-900">Historique des notes</h3>
                        <div className="mt-1 text-xs text-neutral-500">
                          Timeline — plus lisible quand il y a beaucoup de notes.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {uiNotesHistory.length ? (
                        uiNotesHistory.map((n, idx) => {
                          const isActive = n.id === activeNoteId;

                          const excerpt = (n.text || "").trim();
                          const short =
                            excerpt.length > 140 ? `${excerpt.slice(0, 140)}…` : excerpt;

                          return (
                            <div
                              key={n.id}
                              className={cx(
                                "rounded-2xl bg-white p-4 ring-1 shadow-sm",
                                isActive ? "ring-indigo-200 bg-indigo-50/40" : "ring-neutral-200",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-neutral-900">
                                      Note {uiNotesHistory.length - idx}
                                    </div>

                                    <Pill tone="neutral">{n.target}</Pill>
                                    <Pill tone="neutral">{n.channel}</Pill>
                                    <Pill tone={noteStatusTone(n.statusCode)}>{n.statusCode}</Pill>

                                    {n.dateLabel ? (
                                      <span className="ml-1 text-xs text-neutral-500">
                                        {n.dateLabel}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 text-sm text-neutral-900">
                                    {short || <span className="text-neutral-400">—</span>}
                                  </div>

                                  <div className="mt-2 text-xs text-neutral-500">
                                    Inclut: {n.inputCount} input · {n.outputCount} output · {n.fileCount} fichier
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <Button
                                    variant="outline"
                                    className="h-9 px-3 py-1 text-xs"
                                    onClick={() => setActiveNoteId(n.id)}
                                  >
                                    Réouvrir
                                  </Button>

                                  <Button
                                    variant="outline"
                                    className="h-9 px-3 py-1 text-xs"
                                    onClick={() => handleDeleteNote(n.id)}
                                    disabled={noteDeleteBusy}
                                  >
                                    {noteDeleteBusy && n.id === activeNoteId ? "Suppression..." : "Supprimer"}
                                  </Button>

                                  <Button
                                    variant="outline"
                                    className="h-9 px-3 py-1 text-xs"
                                    disabled
                                    onClick={() => {}}
                                  >
                                    Dupliquer
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-500 ring-1 ring-neutral-200">
                          Aucune note pour cette session.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-2" />
                </div>
              </section>
            </div>
          </div>
        )}
        </div>
      </main>
      {isPhotoFullscreenOpen && fullscreenUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <button
            type="button"
            onClick={() => setIsPhotoFullscreenOpen(false)}
            className="absolute right-6 top-6 rounded-xl bg-white px-3 py-2 text-sm font-medium text-neutral-900"
          >
            Fermer
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenUrl}
            alt="Photo plein écran"
            className="max-h-[90vh] max-w-[92vw] rounded-2xl bg-white object-contain"
          />
        </div>
      ) : null}
    </AppShell>
  );
}
