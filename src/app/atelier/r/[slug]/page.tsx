"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API?.replace(/\/+$/, "") ||
  "http://localhost:8001";

const buildUrl = (pathOrUrl?: string | null) => {
  if (!pathOrUrl) return "";
  const raw = pathOrUrl.trim();
  if (!raw || raw.includes("\\") || /^[a-zA-Z]:/.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.startsWith("/") ? raw : `/${raw}`, API_BASE).toString();
};

type PublicVisualRef = {
  visual_ref_id?: string | null;
  id?: string | null;
  kind?: string | null;
  page?: number | null;
  url?: string | null;
  relative_path?: string | null;
  included?: boolean | null;
};

type ExpandedVisual = {
  imageUrl: string;
  sourceUrl: string;
  title: string;
  meta: string;
};

type PublicSource = {
  source_id?: string | null;
  document_title?: string | null;
  result_type?: string | null;
  section_title?: string | null;
  anchor_title?: string | null;
  anchor_kind?: string | null;
  pages?: number[] | null;
  text?: string | null;
  source_url?: string | null;
};

type PublicBlock = {
  block_id?: string | null;
  id?: string | null;
  type?: string | null;
  kind?: string | null;
  title?: string | null;
  text?: string | null;
  source_ids?: string[] | null;
  visual_refs?: PublicVisualRef[] | null;
  visual_ref_ids?: string[] | null;
  confidence?: string | null;
  reason?: string | null;
  order?: number | null;
};

type PublicAtelierAnswer = {
  title?: string | null;
  question?: string | null;
  answer_text?: string | null;
  answer_blocks?: PublicBlock[] | null;
  blocks?: PublicBlock[] | null;
  visual_refs?: PublicVisualRef[] | null;
  sources?: PublicSource[] | null;
  supplementary_source_ids?: string[] | null;
  supplementary_visual_ref_ids?: string[] | null;
};

function publicErrorMessage(status: number, fallback?: string | null) {
  if (fallback) return fallback;
  if (status === 400) return "Lien public invalide.";
  if (status === 404) return "Réponse Atelier introuvable.";
  if (status === 410) return "Lien expiré ou révoqué.";
  return `Erreur backend (${status}).`;
}

function pagesLabel(pages?: number[] | null) {
  if (!pages?.length) return "";
  return `Page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}`;
}

function safeStr(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

const visualKindLabel: Record<string, string> = {
  anchor_crop: "Repère",
  section_crop: "Section",
  page_snapshot: "Page",
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

function visualPriority(ref: PublicVisualRef) {
  if (ref.kind === "anchor_crop") return 0;
  if (ref.kind === "section_crop") return 1;
  if (ref.kind === "page_snapshot") return 2;
  return 3;
}

function visualRefId(ref: PublicVisualRef, index: number) {
  return (
    safeStr(ref.visual_ref_id) ||
    safeStr(ref.id) ||
    [safeStr(ref.kind, "visual_ref"), ref.page ?? index + 1, index].join("_")
  );
}

function visualRefDedupeKey(ref: PublicVisualRef) {
  return [
    safeStr(ref.kind, "visual_ref"),
    ref.page ?? "",
    buildUrl(ref.url) || safeStr(ref.relative_path),
  ].join("|");
}

function dedupeVisualRefs(refs: PublicVisualRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = visualRefDedupeKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visualLabel(ref: PublicVisualRef, fallback = "Visuel notice") {
  return visualKindLabel[safeStr(ref.kind)] || safeStr(ref.kind, fallback);
}

function visualMeta(ref: PublicVisualRef) {
  return [visualLabel(ref), ref.page ? `Page ${ref.page}` : ""].filter(Boolean).join(" · ");
}

function sourceUrlForVisual(ref: PublicVisualRef, sources: PublicSource[]) {
  const page = ref.page;
  const matchingSource = page
    ? sources.find((source) => source.pages?.includes(page) && buildUrl(source.source_url))
    : null;
  return buildUrl(matchingSource?.source_url || sources.find((source) => buildUrl(source.source_url))?.source_url);
}

function buildSourcesById(data?: PublicAtelierAnswer | null) {
  return new Map(
    (data?.sources || [])
      .filter((source) => safeStr(source.source_id))
      .map((source) => [safeStr(source.source_id), source] as const),
  );
}

function buildVisualRefsById(data?: PublicAtelierAnswer | null) {
  return new Map(
    (data?.visual_refs || [])
      .map((ref, index) => [visualRefId(ref, index), ref] as const)
      .filter(([id]) => Boolean(id)),
  );
}

function getPrimaryBlocks(data?: PublicAtelierAnswer | null) {
  const answerBlocks = data?.answer_blocks || [];
  if (answerBlocks.length) {
    return answerBlocks
      .map((block, index) => ({
        ...block,
        block_id: safeStr(block.block_id || block.id, `answer_block_${index}`),
        source_ids: (block.source_ids || []).filter(Boolean),
        visual_ref_ids: (block.visual_ref_ids || []).filter(Boolean),
        order: block.order ?? index,
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const legacyBlocks = data?.blocks || [];
  if (legacyBlocks.length) {
    return legacyBlocks.map((block, index) => ({
      ...block,
      block_id: safeStr(block.block_id || block.id, `legacy_block_${index}`),
      source_ids: (block.source_ids || []).filter(Boolean),
      visual_ref_ids: (block.visual_ref_ids || []).filter(Boolean),
      order: index,
    }));
  }

  if (!safeStr(data?.answer_text)) return [];
  return [{
    block_id: "fallback_answer",
    type: "answer",
    title: null,
    text: data?.answer_text || "",
    source_ids: [],
    visual_ref_ids: [],
    confidence: null,
    reason: null,
    order: 0,
  }];
}

function NoticeVisualCard({
  refData,
  imageUrl,
  sourceUrl,
  alt,
  imageClassName,
  onExpand,
}: {
  refData: PublicVisualRef;
  imageUrl: string;
  sourceUrl?: string;
  alt: string;
  imageClassName: string;
  onExpand: (visual: ExpandedVisual) => void;
}) {
  const meta = visualMeta(refData);
  const title = refData.page ? `Extrait notice page ${refData.page}` : "Extrait notice";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
        <span>{visualLabel(refData)}</span>
        {refData.page ? <span>Page {refData.page}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => onExpand({ imageUrl, sourceUrl: sourceUrl || "", title, meta })}
        className="block w-full bg-slate-50 text-left hover:bg-orange-50/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className={imageClassName} />
      </button>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => onExpand({ imageUrl, sourceUrl: sourceUrl || "", title, meta })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Agrandir
        </button>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function PublicAtelierAnswerPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [data, setData] = useState<PublicAtelierAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedVisual, setExpandedVisual] = useState<ExpandedVisual | null>(null);
  const [isVisualPanelOpen, setIsVisualPanelOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);

      try {
        const res = await fetch(buildUrl(`/atelier/public/${encodeURIComponent(slug)}`), {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          const message = publicErrorMessage(res.status, payload?.detail || payload?.message);
          throw Object.assign(new Error(message), { status: res.status });
        }

        if (!cancelled) setData(payload as PublicAtelierAnswer);
      } catch (err) {
        if (!cancelled) {
          const status = typeof err === "object" && err && "status" in err ? Number(err.status) : null;
          setData(null);
          setErrorStatus(status);
          setErrorMessage(err instanceof Error ? err.message : "Impossible de charger la réponse.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visualRefs = useMemo(
    () =>
      (data?.visual_refs || [])
        .filter((ref) => buildUrl(ref.url))
        .sort((a, b) => visualPriority(a) - visualPriority(b)),
    [data?.visual_refs],
  );
  const answerBlocks = useMemo(() => getPrimaryBlocks(data), [data]);
  const sourcesById = useMemo(() => buildSourcesById(data), [data]);
  const visualRefsById = useMemo(() => buildVisualRefsById(data), [data]);
  const usedSourceIds = useMemo(
    () => new Set(answerBlocks.flatMap((block) => block.source_ids || [])),
    [answerBlocks],
  );
  const usedVisualRefIds = useMemo(
    () => new Set(answerBlocks.flatMap((block) => block.visual_ref_ids || [])),
    [answerBlocks],
  );
  const supplementarySources = useMemo(
    () =>
      (data?.supplementary_source_ids || [])
        .filter((id) => !usedSourceIds.has(id))
        .map((id) => sourcesById.get(id))
        .filter((source): source is PublicSource => Boolean(source)),
    [data?.supplementary_source_ids, sourcesById, usedSourceIds],
  );
  const supplementaryVisualRefs = useMemo(
    () =>
      dedupeVisualRefs(
        (data?.supplementary_visual_ref_ids || [])
          .filter((id) => !usedVisualRefIds.has(id))
          .map((id) => visualRefsById.get(id))
          .filter((ref): ref is PublicVisualRef => Boolean(ref))
          .filter((ref) => buildUrl(ref.url)),
      ),
    [data?.supplementary_visual_ref_ids, usedVisualRefIds, visualRefsById],
  );
  const answerBlockVisualsByBlockId = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, PublicVisualRef[]>();

    answerBlocks.forEach((block) => {
      const refs = (block.visual_ref_ids || [])
        .map((id) => visualRefsById.get(id))
        .filter((ref): ref is PublicVisualRef => Boolean(ref))
        .filter((ref) => buildUrl(ref.url))
        .filter((ref) => {
          const key = visualRefDedupeKey(ref);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      map.set(safeStr(block.block_id), refs);
    });

    return map;
  }, [answerBlocks, visualRefsById]);
  const sources = Array.isArray(data?.sources) ? data.sources : [];

  useEffect(() => {
    if (!expandedVisual) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedVisual(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expandedVisual]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la réponse...
        </div>
      </main>
    );
  }

  if (!data) {
      const title =
        errorStatus === 410
        ? "Lien expiré ou révoqué"
        : errorStatus === 404
          ? "Réponse introuvable"
          : errorStatus === 400
            ? "Lien invalide"
            : "Réponse indisponible";

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-orange-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {errorMessage || "Ce lien public n'est plus disponible."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            <Sparkles className="h-3.5 w-3.5" />
            Réponse Atelier PRIA
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {data.title || "Réponse technique PERGE"}
          </h1>
          {data.question ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {data.question}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <section className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Réponse</h2>
            {answerBlocks.length ? (
              <div className="mt-4 space-y-4">
                {answerBlocks.map((block) => {
                  const blockSources = (block.source_ids || [])
                    .map((id) => sourcesById.get(id))
                    .filter((source): source is PublicSource => Boolean(source));
                  const blockVisuals = answerBlockVisualsByBlockId.get(safeStr(block.block_id)) || [];

                  return (
                    <section key={block.block_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {block.title ? <h3 className="text-sm font-semibold text-slate-950">{block.title}</h3> : null}
                      {block.confidence ? (
                        <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                          Confiance {block.confidence}
                        </span>
                      ) : null}
                      {block.text ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{block.text}</p>
                      ) : null}

                      {blockVisuals.length ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {blockVisuals.map((ref, index) => {
                            const imageUrl = buildUrl(ref.url);
                            if (!imageUrl) return null;
                            const sourceUrl = sourceUrlForVisual(ref, blockSources.length ? blockSources : sources);

                            return (
                              <NoticeVisualCard
                                key={`${block.block_id}-${visualRefId(ref, index)}`}
                                refData={ref}
                                imageUrl={imageUrl}
                                sourceUrl={sourceUrl}
                                alt={`Visuel réponse page ${ref.page || index + 1}`}
                                imageClassName="h-auto max-h-72 w-full object-contain"
                                onExpand={setExpandedVisual}
                              />
                            );
                          })}
                        </div>
                      ) : null}

                      {blockSources.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {blockSources.map((source, index) => {
                            const kind = source.anchor_kind
                              ? anchorKindLabel[source.anchor_kind] || source.anchor_kind
                              : source.result_type === "anchor"
                                ? "Repère"
                                : "Section";
                            const pages = pagesLabel(source.pages);

                            return (
                              <span
                                key={source.source_id || `${block.block_id}-source-${index}`}
                                className="inline-flex max-w-full rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                              >
                                <span className="truncate">
                                  {source.document_title || "Document"} · {kind}
                                  {source.section_title ? ` · ${source.section_title}` : ""}
                                  {source.anchor_title ? ` · ${source.anchor_title}` : ""}
                                  {pages ? ` · ${pages}` : ""}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}

                {supplementarySources.length || supplementaryVisualRefs.length ? (
                  <section className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Repères complémentaires</h3>
                    <p className="mt-1 text-xs text-slate-500">Éléments conservés en complément de la réponse principale.</p>
                    {supplementaryVisualRefs.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {supplementaryVisualRefs.map((ref, index) => {
                          const imageUrl = buildUrl(ref.url);
                          if (!imageUrl) return null;
                          const sourceUrl = sourceUrlForVisual(ref, supplementarySources.length ? supplementarySources : sources);
                          return (
                            <NoticeVisualCard
                              key={`supplementary-${visualRefId(ref, index)}`}
                              refData={ref}
                              imageUrl={imageUrl}
                              sourceUrl={sourceUrl}
                              alt={`Repère complémentaire page ${ref.page || index + 1}`}
                              imageClassName="h-auto max-h-56 w-full object-contain"
                              onExpand={setExpandedVisual}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                    {supplementarySources.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {supplementarySources.map((source, index) => (
                          <span
                            key={source.source_id || `supplementary-source-${index}`}
                            className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500"
                          >
                            <span className="truncate">
                              {source.document_title || "Document"}
                              {source.section_title ? ` · ${source.section_title}` : ""}
                              {source.anchor_title ? ` · ${source.anchor_title}` : ""}
                              {pagesLabel(source.pages) ? ` · ${pagesLabel(source.pages)}` : ""}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Aucun texte de réponse disponible.
              </p>
            )}
          </article>

          {sources.length ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">Sources</h2>
              <div className="mt-4 space-y-3">
                {sources.map((source, index) => {
                  const sourceUrl = buildUrl(source.source_url);
                  return (
                    <section key={source.source_id || index} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {source.document_title || "Document produit"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[source.section_title, source.anchor_title, pagesLabel(source.pages)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {sourceUrl ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Ouvrir
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                      {source.text ? (
                        <p className="mt-3 line-clamp-5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          {source.text}
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </article>
          ) : null}
        </section>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setIsVisualPanelOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="text-base font-semibold text-slate-950">Extraits visuels</span>
              {visualRefs.length ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {visualRefs.length} extrait{visualRefs.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </span>
            {isVisualPanelOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>
          {isVisualPanelOpen ? (
            visualRefs.length ? (
              <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {visualRefs.map((ref, index) => {
                  const imageUrl = buildUrl(ref.url);
                  if (!imageUrl) return null;
                  const sourceUrl = sourceUrlForVisual(ref, sources);

                  return (
                    <NoticeVisualCard
                      key={`${ref.kind}-${ref.page}-${index}`}
                      refData={ref}
                      imageUrl={imageUrl}
                      sourceUrl={sourceUrl}
                      alt={`Extrait visuel page ${ref.page || index + 1}`}
                      imageClassName="h-auto w-full object-contain"
                      onExpand={setExpandedVisual}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="mx-5 mb-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Aucun extrait visuel inclus.
              </p>
            )
          ) : null}
        </article>
      </div>

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
    </main>
  );
}
