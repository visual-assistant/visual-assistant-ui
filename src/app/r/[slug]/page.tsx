"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const buildUrl = (pathOrUrl: string) => {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  return new URL(pathOrUrl, API_BASE).toString();
};

type PublicChantier = {
  meta: {
    chantier_id: string | null;
    title: string | null;
    installateur_company: string | null;
    produit_label: string | null;
    published_at: number | null;
    published_by: string | null;
  };
  contexte_initial?: string | null;
  note_sav_generale?: { text?: string | null; updated_at?: number | null } | null;
  notes_sav: Array<{
    id: string;
    text?: string | null;
    created_at?: number | null;
    updated_at?: number | null;
    photo_ids?: string[];
    assets?: Array<{
      asset_id?: string;
      kind?: string;
      filename?: string;
      asset_url?: string;
      created_at?: number;
    }>;
  }>;
  photos: Array<{
    photo_uid: string;
    original_url?: string | null;
    include_in_report?: boolean;
  }>;
  photos_by_id: Record<
    string,
    {
      photo_uid: string;
      original_url?: string | null;
      include_in_report?: boolean;
    }
  >;
};

function formatDate(ts?: number | null) {
  if (!ts) return null;
  try {
    const d = new Date(ts * 1000);
    return d.toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function pickTechVisualAsset(note: any) {
  const assets = Array.isArray(note?.assets) ? note.assets : [];
  const tech = assets.find((a: any) => (a?.kind || "").toLowerCase() === "tech_visual");
  return tech || null;
}

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Expandable block with bottom fade gradient when collapsed.
 * No Tailwind line-clamp dependency.
 */
function ExpandableBlock({
  label,
  text,
  tone = "white",
}: {
  label: string;
  text: string;
  tone?: "white" | "slate";
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const bg = tone === "slate" ? "bg-slate-100" : "bg-white";
  const border = "border border-slate-200";
  const fadeFrom = tone === "slate" ? "from-slate-100" : "from-white";

  // Plus agressif : on veut laisser respirer et montrer les points techniques
  const COLLAPSED_MAX_HEIGHT = 140; // px (tu peux passer à 120 si tu veux encore plus)

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // overflow si la hauteur réelle dépasse la hauteur repliée
    const over = el.scrollHeight > COLLAPSED_MAX_HEIGHT + 8;
    setIsOverflowing(over);
  }, [text]);

  return (
    <section className={`rounded-2xl ${bg} ${border} p-4 sm:p-5`}>
      <div className="text-xs text-slate-500">{label}</div>

      <div className="relative mt-1">
        <div
          ref={contentRef}
          className={[
            "whitespace-pre-wrap break-words",
            // ⬇️ police un peu plus petite + line-height plus compact
            "text-[15px] leading-6 sm:text-base sm:leading-6 font-extrabold",
            expanded ? "" : "overflow-hidden",
          ].join(" ")}
          style={!expanded ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
        >
          {text}
        </div>

        {!expanded && isOverflowing && (
          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t ${fadeFrom} to-transparent`}
          />
        )}
      </div>

      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-extrabold text-slate-700 underline underline-offset-2"
        >
          {expanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </section>
  );
}


export default function PublicChantierReportPage() {
  const params = useParams();
  const slug = (params?.slug ?? "") as string;

  const [data, setData] = useState<PublicChantier | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Chips navigation (mobile)
  const pointsRefs = useRef<Array<HTMLElement | null>>([]);
  const photosSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeChip, setActiveChip] = useState<string>("point_0");

  const scrollToRef = (ref: HTMLElement | null) => {
    if (!ref) return;
    const y = ref.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrMsg(null);
      try {
        const url = buildUrl(`/chantiers/public/${encodeURIComponent(slug)}`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Erreur ${res.status}`);
        }
        const json = (await res.json()) as PublicChantier;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) {
          setData(null);
          setErrMsg(e?.message || "Impossible de charger le rapport.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const headerTitle = data?.meta?.title || data?.meta?.chantier_id || "Chantier";

  const headerSubtitleParts = useMemo(() => {
    const parts: string[] = [];
    if (data?.meta?.installateur_company) parts.push(data.meta.installateur_company);
    if (data?.meta?.produit_label) parts.push(data.meta.produit_label);
    return parts;
  }, [data?.meta?.installateur_company, data?.meta?.produit_label]);

  const publishedLabel = useMemo(() => {
    const when = formatDate(data?.meta?.published_at ?? null);
    if (!when) return null;
    return `Publié le ${when}`;
  }, [data?.meta?.published_at]);

  if (loading || !slug) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 flex items-center justify-center">
        Chargement…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-lg font-semibold">Rapport introuvable</div>
        <div className="mt-2 text-sm text-neutral-400">
          {errMsg || "Le lien est invalide ou le chantier n’a pas été publié."}
        </div>
      </div>
    );
  }

  const notes = Array.isArray(data.notes_sav) ? data.notes_sav : [];
  const photos = Array.isArray(data.photos) ? data.photos : [];

  const generalText = data.note_sav_generale?.text ? safeText(data.note_sav_generale.text).trim() : "";
  const contexteInitial = data.contexte_initial ? safeText(data.contexte_initial).trim() : "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-6">
          <div className="text-base sm:text-xl font-extrabold tracking-tight">{headerTitle}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300">
            {headerSubtitleParts.length > 0 && (
              <span className="font-semibold text-slate-200">{headerSubtitleParts.join(" · ")}</span>
            )}
            {publishedLabel && <span className="text-slate-400">{headerSubtitleParts.length ? "· " : ""}{publishedLabel}</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <main className="space-y-3 sm:space-y-4">
            {/* Synthèse (optionnelle) */}
            {generalText && <ExpandableBlock label="Synthèse" text={generalText} tone="white" />}

            {/* Contexte initial (optionnel) */}
            {contexteInitial && <ExpandableBlock label="Contexte initial" text={contexteInitial} tone="slate" />}

            {/* Chips navigation (mobile) */}
            {notes.length > 0 && (
              <div className="sm:hidden sticky top-0 z-20 -mx-4 px-4 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {notes.map((_, idx) => {
                    const key = `point_${idx}`;
                    const isActive = activeChip === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActiveChip(key);
                          scrollToRef(pointsRefs.current[idx]);
                        }}
                        className={[
                          "shrink-0 px-4 py-2 rounded-full text-xs font-extrabold border",
                          isActive
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-200 text-slate-900 border-slate-200",
                        ].join(" ")}
                      >
                        Point #{idx + 1}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveChip("photos");
                      scrollToRef(photosSectionRef.current);
                    }}
                    className={[
                      "shrink-0 px-4 py-2 rounded-full text-xs font-extrabold border",
                      activeChip === "photos"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-200 text-slate-900 border-slate-200",
                    ].join(" ")}
                  >
                    Photos chantier
                  </button>
                </div>
              </div>
            )}

            {/* Points techniques title */}
            <div className="pt-1">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm sm:text-base font-extrabold">Points techniques</h2>
                <span className="text-xs text-slate-500">{notes.length} point{notes.length > 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Points techniques cards */}
            <div className="space-y-3 sm:space-y-4">
              {notes.map((n, idx) => {
                const tech = pickTechVisualAsset(n);
                const techUrl = tech?.asset_url ? buildUrl(tech.asset_url) : "";
                const noteText = n?.text ? safeText(n.text).trim() : "";
                const photoIds = Array.isArray(n?.photo_ids) ? n.photo_ids : [];

                const linkedPhotos = photoIds
                  .map((pid) => data.photos_by_id?.[pid])
                  .filter(Boolean)
                  .filter((p: any) => !!p?.original_url);

                return (
                  <article
                    key={n.id || `note_${idx}`}
                    ref={(el) => {
                      pointsRefs.current[idx] = el;
                    }}
                    className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold">Point technique #{idx + 1}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {techUrl ? "Visuel technique (réponse)" : "Réponse"}
                          </div>
                        </div>

                        {techUrl && (
                          <a
                            href={techUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hidden sm:inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-bold"
                          >
                            Plein écran
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Output image first */}
                    {techUrl && (
                      <div className="px-4 sm:px-5 pb-4">
                        <div className="rounded-2xl bg-slate-200 overflow-hidden">
                          <img
                            src={techUrl}
                            alt={`Visuel technique point ${idx + 1}`}
                            className="w-full h-auto max-h-[420px] object-contain bg-slate-200"
                            loading="lazy"
                          />
                        </div>

                        <div className="mt-3 sm:hidden">
                          <a
                            href={techUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-extrabold"
                          >
                            Voir en plein écran
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Note + linked input photos */}
                    <div className="px-4 sm:px-5 pb-5 space-y-3">
                      {noteText && (
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">Note</div>
                          <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                            {noteText}
                          </div>
                        </div>
                      )}

                      {linkedPhotos.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-500">Vu sur (photos installateur)</div>
                          <div className="mt-2 flex items-center gap-2">
                            {linkedPhotos.slice(0, 4).map((p: any) => {
                              const url = p?.original_url ? buildUrl(p.original_url) : "";
                              if (!url) return null;
                              return (
                                <a
                                  key={p.photo_uid}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden"
                                  title={p.photo_uid}
                                >
                                  <img
                                    src={url}
                                    alt="Photo installateur"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Photos chantier (mobile) */}
            <div ref={photosSectionRef} className="sm:hidden pt-2">
              <div className="rounded-2xl bg-white border border-slate-200 p-4">
                <div className="text-sm font-extrabold">Photos du chantier</div>
                <div className="mt-1 text-xs text-slate-500">Contexte complet (secondaire)</div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {photos.slice(0, 6).map((p) => {
                    const url = p.original_url ? buildUrl(p.original_url) : "";
                    if (!url) return null;
                    return (
                      <a
                        key={p.photo_uid}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl bg-slate-200 overflow-hidden border border-slate-200"
                        title={p.photo_uid}
                      >
                        <img src={url} alt="Photo chantier" className="w-full h-28 object-cover" loading="lazy" />
                      </a>
                    );
                  })}
                </div>

                {photos.length > 6 && (
                  <div className="mt-3 text-xs text-slate-500">
                    +{photos.length - 6} photo{photos.length - 6 > 1 ? "s" : ""}…
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Sidebar desktop */}
          <aside className="hidden lg:block space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="text-sm font-extrabold">Photos du chantier</div>
              <div className="mt-1 text-xs text-slate-500">Contexte complet (secondaire)</div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {photos.slice(0, 4).map((p) => {
                  const url = p.original_url ? buildUrl(p.original_url) : "";
                  if (!url) return null;
                  return (
                    <a
                      key={p.photo_uid}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl bg-slate-200 overflow-hidden border border-slate-200"
                      title={p.photo_uid}
                    >
                      <img src={url} alt="Photo chantier" className="w-full h-28 object-cover" loading="lazy" />
                    </a>
                  );
                })}
              </div>

              {photos.length > 4 && (
                <div className="mt-3 text-xs text-slate-500">
                  +{photos.length - 4} photo{photos.length - 4 > 1 ? "s" : ""}…
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
