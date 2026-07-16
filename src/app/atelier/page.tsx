"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
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

const classificationSourceLabel: Record<string, string> = {
  automatic: "Automatique",
  provided: "Fourni",
  manual_review: "Corrigé",
};

type VisualRef = {
  kind?: string | null;
  page?: number | null;
  url?: string | null;
  local_path?: string | null;
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
  meta?: {
    revision_count?: number | null;
    previous_questions?: Array<{
      question?: string | null;
      updated_at?: string | number | null;
    }> | null;
    confidence?: string | null;
    missing_information?: string[] | null;
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

function normalizeAssetUrl(value?: string | null) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || raw.includes("\\") || /^[a-zA-Z]:/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return buildUrl(raw);
  return buildUrl(`/${raw}`);
}

function selectVisualRefs(refs?: VisualRef[] | null) {
  const usableRefs = (refs || []).filter((ref) => normalizeAssetUrl(ref.url));
  const anchorCrops = usableRefs.filter((ref) => ref.kind === "anchor_crop");
  if (anchorCrops.length) return anchorCrops;

  const sectionCrops = usableRefs.filter((ref) => ref.kind === "section_crop");
  if (sectionCrops.length) return sectionCrops;

  const pageSnapshots = usableRefs.filter((ref) => ref.kind === "page_snapshot");
  if (pageSnapshots.length) return pageSnapshots;

  return [];
}

function pagesLabel(pages?: number[] | null) {
  if (!pages?.length) return "Pages non précisées";
  return `Page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}`;
}

function questionListFromResponse(payload: QuestionsListResponse) {
  if (Array.isArray(payload)) return payload;
  return payload.questions || payload.items || payload.data || [];
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

export default function AtelierPage() {
  const [questionText, setQuestionText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<AtelierQuestion | null>(null);
  const [history, setHistory] = useState<AtelierQuestion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editedQuestionText, setEditedQuestionText] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      setHistory(questionListFromResponse(payload).slice(0, 8));
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

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
        body: JSON.stringify({ question: trimmed, retrieval_limit: 4 }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la question.");
    } finally {
      setIsLoadingDetail(false);
    }
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
            retrieval_limit: 4,
          }),
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.detail || payload?.message || `Régénération impossible (${res.status})`);
      }

      const regeneratedQuestion = questionFromResponse(payload);
      if (!regeneratedQuestion) throw new Error("Réponse Atelier invalide : question absente.");

      setCurrentQuestion(regeneratedQuestion);
      setEditedQuestionText(regeneratedQuestion.question || "");
      setIsEditingQuestion(false);
      setHistory((items) => {
        const nextItems = items.map((item) =>
          item.question_id === regeneratedQuestion.question_id ? regeneratedQuestion : item,
        );
        return nextItems.sort((a, b) => {
          const aDate = new Date((a.updated_at || a.created_at || 0) as string | number).getTime();
          const bDate = new Date((b.updated_at || b.created_at || 0) as string | number).getTime();
          return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue pendant la régénération.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const product = currentQuestion?.product || currentQuestion?.detected_product;
  const components =
    currentQuestion?.components?.length
      ? currentQuestion.components
      : currentQuestion?.detected_components || [];
  const sourceLabel = currentQuestion?.classification_source
    ? classificationSourceLabel[currentQuestion.classification_source] || currentQuestion.classification_source
    : "Non précisée";
  const revisionCount = currentQuestion?.meta?.revision_count || 0;

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-7xl gap-6 px-8 py-8">
          <section className="min-w-0 flex-1 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Atelier PRIA
                </div>
                <h1 className="text-3xl font-semibold text-slate-950">Demander à l&apos;Atelier</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Posez une question technique libre. L&apos;Atelier répond avec les sources documentaires produit et les extraits visuels disponibles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
                Actualiser
              </button>
            </div>

            <form onSubmit={submitQuestion} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label htmlFor="atelier-question" className="text-sm font-semibold text-slate-900">
                Posez une question à l&apos;Atelier
              </label>
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
                  className="min-h-24 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="submit"
                  disabled={!questionText.trim() || isSubmitting}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
              </div>
              {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </form>

            {currentQuestion ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question posée</p>
                        {revisionCount > 0 ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
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
                        <div className="mt-1 flex flex-wrap items-start gap-3">
                          <h2 className="min-w-0 flex-1 text-lg font-semibold text-slate-950">
                            {currentQuestion.question}
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              setEditedQuestionText(currentQuestion.question || "");
                              setIsEditingQuestion(true);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Modifier
                          </button>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={currentQuestion.status} />
                  </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Classification détectée</h3>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Produit</p>
                          {product ? (
                            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                              {product}
                            </span>
                          ) : (
                            <span className="text-slate-500">Produit non identifié</span>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Composants</p>
                          {components.length ? (
                            <div className="flex flex-wrap gap-2">
                              {components.map((component) => (
                                <span
                                  key={component}
                                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                  {component}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">Aucun composant détecté</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">Source de classification : {sourceLabel}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-base font-semibold text-slate-950">Réponse</h3>
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
                      <div className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                        {currentQuestion.answer_text || "Aucune réponse texte disponible pour cette question."}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" />
                        <h3 className="text-base font-semibold text-slate-950">Sources</h3>
                      </div>
                      {currentQuestion.sources?.length ? (
                        <div className="space-y-3">
                          {currentQuestion.sources.map((source, index) => {
                            const sourceUrl = normalizeAssetUrl(source.source_url);
                            const kind = source.anchor_kind
                              ? anchorKindLabel[source.anchor_kind] || source.anchor_kind
                              : null;

                            return (
                              <article
                                key={source.source_id || `${source.document_id}-${index}`}
                                className="rounded-lg border border-slate-200 p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-950">
                                      {source.document_title || "Document produit"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span>{source.result_type === "anchor" ? "Repère" : "Section"}</span>
                                      {kind ? (
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                                          {kind}
                                        </span>
                                      ) : null}
                                      <span>{pagesLabel(source.pages)}</span>
                                    </div>
                                  </div>
                                  {sourceUrl ? (
                                    <a
                                      href={sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                      Ouvrir
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : null}
                                </div>
                                <div className="mt-3 space-y-1 text-sm text-slate-700">
                                  {source.section_title ? <p>Section : {source.section_title}</p> : null}
                                  {source.anchor_title ? <p>Repère : {source.anchor_title}</p> : null}
                                  {source.text ? (
                                    <p className="mt-2 line-clamp-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                      {source.text}
                                    </p>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                          Aucune source documentaire disponible.
                        </p>
                      )}
                    </div>
                  </div>

                  <aside className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-slate-500" />
                        <h3 className="text-base font-semibold text-slate-950">Extrait visuel pertinent</h3>
                      </div>
                      {visualRefs.length ? (
                        <div className="space-y-3">
                          {visualRefs.map((ref, index) => {
                            const imageUrl = normalizeAssetUrl(ref.url);
                            if (!imageUrl) return null;

                            return (
                              <a
                                key={`${ref.kind}-${ref.page}-${index}`}
                                href={imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-orange-300"
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                                  <span>{ref.kind || "visual_ref"}</span>
                                  {ref.page ? <span>Page {ref.page}</span> : null}
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt={`Extrait visuel page ${ref.page || index + 1}`}
                                  className="h-auto w-full object-contain"
                                />
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                          Aucun crop visuel disponible. La réponse et les sources restent consultables.
                        </p>
                      )}
                    </div>
                  </aside>
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

          <aside className="w-80 shrink-0">
            <div className="sticky top-8 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-950">Historique</h2>
                {isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
              </div>
              <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-2">
                {history.length ? (
                  <div className="space-y-1">
                    {history.map((item) => {
                      const active = currentQuestion?.question_id === item.question_id;
                      const itemProduct = item.product || item.detected_product;
                      const itemComponents = item.components?.length
                        ? item.components
                        : item.detected_components || [];

                      return (
                        <button
                          key={item.question_id}
                          type="button"
                          onClick={() => void loadQuestionDetail(item.question_id, item)}
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
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
