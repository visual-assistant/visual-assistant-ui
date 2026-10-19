"use client";

/* The fetch effects reset their local loading/selection state before starting a request. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Hash, Layers } from "lucide-react";

type ProductDocument = {
  document_id: string;
  title?: string | null;
  document_type?: string | null;
  status?: string | null;
  indexing?: { status?: string | null } | null;
};

type ProductDocumentsResponse = {
  product?: { code?: string | null; label?: string | null } | null;
  documents?: ProductDocument[];
  message?: string | null;
};

type IndexSection = {
  section_id?: string | null;
  title?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  level?: number | null;
};

type IndexAnchor = {
  anchor_id?: string | null;
  parent_section_id?: string | null;
  section_id?: string | null;
  title?: string | null;
  kind?: string | null;
  page_start?: number | null;
  page_end?: number | null;
};

type ProductDocumentIndex = {
  sections?: IndexSection[];
  anchors?: IndexAnchor[];
  stats?: { page_count?: number | null } | null;
};

type ProductDocumentsViewerProps = {
  apiBase: string;
  chantierId: string;
};

function safePage(value: unknown, fallback = 1) {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : fallback;
}

const anchorKindLabels: Record<string, string> = {
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

function anchorLabel(kind?: string | null) {
  if (!kind) return "Repère";
  return anchorKindLabels[kind] || kind;
}

export default function ProductDocumentsViewer({ apiBase, chantierId }: ProductDocumentsViewerProps) {
  const [catalog, setCatalog] = useState<ProductDocumentsResponse | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [index, setIndex] = useState<ProductDocumentIndex | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [indexLoading, setIndexLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const documents = catalog?.documents ?? [];
  const selectedDocument = documents.find((item) => item.document_id === selectedDocumentId) ?? null;
  const fileUrl = useMemo(() => {
    if (!selectedDocumentId) return "";
    return `${apiBase}/product-documents/${encodeURIComponent(selectedDocumentId)}/file#page=${page}`;
  }, [apiBase, page, selectedDocumentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCatalog(null);
    setSelectedDocumentId(null);
    setIndex(null);
    setPage(1);
    setOpenSections({});

    fetch(`${apiBase}/chantiers/${encodeURIComponent(chantierId)}/product-documents`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ProductDocumentsResponse | null;
        if (!response.ok) throw new Error((payload as { detail?: string } | null)?.detail || `Erreur HTTP ${response.status}`);
        return payload ?? { documents: [] };
      })
      .then((payload) => {
        if (cancelled) return;
        setCatalog(payload);
        setSelectedDocumentId(payload.documents?.[0]?.document_id ?? null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Impossible de charger les documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [apiBase, chantierId]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setIndex(null);
      setPage(1);
      return;
    }

    let cancelled = false;
    setIndexLoading(true);
    setIndex(null);
    setPage(1);
    setOpenSections({});

    fetch(`${apiBase}/product-documents/${encodeURIComponent(selectedDocumentId)}/index`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ProductDocumentIndex | { detail?: string } | null;
        if (!response.ok) throw new Error((payload as { detail?: string } | null)?.detail || `Erreur HTTP ${response.status}`);
        return payload as ProductDocumentIndex;
      })
      .then((payload) => {
        if (!cancelled) setIndex(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Impossible de charger le sommaire.");
      })
      .finally(() => {
        if (!cancelled) setIndexLoading(false);
      });

    return () => { cancelled = true; };
  }, [apiBase, selectedDocumentId]);

  if (loading) {
    return <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 ring-1 ring-slate-200">Chargement de la documentation…</div>;
  }

  if (error && !catalog) {
    return <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 ring-1 ring-red-200">{error}</div>;
  }

  if (!documents.length) {
    return (
      <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-950">Documentation produit</h2>
        <p className="mt-2 text-sm text-slate-500">{catalog?.message || "Aucun document indexé n’est disponible pour le produit de ce chantier."}</p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Documentation produit</h2>
          <p className="mt-1 text-sm text-slate-500">{catalog?.product?.label || catalog?.product?.code || "Produit du chantier"}</p>
        </div>
        {error ? <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">{error}</div> : null}
      </div>

      <div className="grid min-h-[780px] grid-cols-12 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm lg:min-h-[calc(100vh+120px)]">
        <aside className="col-span-12 flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 lg:col-span-3 lg:max-h-[calc(100vh-260px)] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-4 py-4">
            <label htmlFor="product-document-select" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</label>
            <select
              id="product-document-select"
              value={selectedDocumentId ?? ""}
              onChange={(event) => setSelectedDocumentId(event.target.value || null)}
              className="mt-2 h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-orange-300"
            >
              {documents.map((document) => <option key={document.document_id} value={document.document_id}>{document.title || "Document produit"}</option>)}
            </select>
            {selectedDocument?.document_type ? <p className="mt-2 text-xs text-slate-500">{selectedDocument.document_type}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sommaire</h3>
              {indexLoading ? <span className="text-xs text-slate-400">Chargement…</span> : null}
            </div>
            {index?.sections?.length ? (
              <nav className="space-y-1">
                {index.sections.map((section, sectionIndex) => {
                  const sectionPage = safePage(section.page_start);
                  const sectionId = section.section_id || section.title || `section-${sectionIndex}`;
                  const isOpen = openSections[sectionId] ?? true;
                  const sectionAnchors = (index.anchors || []).filter(
                    (anchor) => (anchor.parent_section_id || anchor.section_id) === section.section_id,
                  );
                  return (
                    <div key={sectionId} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOpenSections((previous) => ({ ...previous, [sectionId]: !isOpen }))}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                          title={isOpen ? "Replier" : "Déplier"}
                          aria-label={isOpen ? "Replier la section" : "Déplier la section"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage(sectionPage)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white hover:text-orange-700"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Layers className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate text-sm font-semibold text-slate-800">{section.title || "Section sans titre"}</span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">{sectionPage}</span>
                        </button>
                      </div>
                      {isOpen && sectionAnchors.length ? (
                        <div className="ml-10 space-y-1 border-l border-slate-200 pl-3">
                          {sectionAnchors.map((anchor, anchorIndex) => {
                            const anchorPage = safePage(anchor.page_start, sectionPage);
                            return (
                              <button
                                key={anchor.anchor_id || `${anchor.title || "anchor"}-${anchorIndex}`}
                                type="button"
                                onClick={() => setPage(anchorPage)}
                                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white hover:text-orange-700"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <Hash className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm text-slate-700">{anchor.title || "Repère sans titre"}</span>
                                    {anchor.kind ? <span className="mt-0.5 block text-[11px] text-slate-400">{anchorLabel(anchor.kind)}</span> : null}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-slate-400">{anchorPage}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            ) : (
              <p className="px-1 text-sm text-slate-500">Aucun sommaire exploitable pour ce document.</p>
            )}
          </div>
        </aside>

        <div className="col-span-12 flex min-h-[780px] min-w-0 flex-col bg-slate-100 lg:col-span-9 lg:min-h-[calc(100vh+120px)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0 truncate text-sm font-semibold text-slate-900">{selectedDocument?.title || "Document produit"}</div>
            <div className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">Page {page}{index?.stats?.page_count ? ` / ${index.stats.page_count}` : ""}</div>
          </div>
          {fileUrl ? (
            <iframe
              key={fileUrl}
              title={selectedDocument?.title || "Visualiseur PDF"}
              src={fileUrl}
              className="h-[740px] min-h-[740px] w-full flex-1 border-0 lg:h-[calc(100vh+60px)] lg:min-h-[780px]"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Sélectionnez un document.</div>
          )}
        </div>
      </div>
    </section>
  );
}
