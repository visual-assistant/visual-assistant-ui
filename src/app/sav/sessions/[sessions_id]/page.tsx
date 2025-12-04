"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  ChangeEvent,
  useCallback,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const WEBHOOK_BASE =
  process.env.NEXT_PUBLIC_WEBHOOK_URL || "http://localhost:8000";

const buildWebhookUrl = (path: string) => {
  return new URL(path, WEBHOOK_BASE).toString();
};

const buildUrl = (path: string) => {
  return new URL(path, API_BASE).toString();
};

type SessionPhotoDraft = {
  status?: "ok" | "a_revoir";
  commentaire?: string;
  annotatedPath?: string | null;
  annotatedUrl?: string | null;
};

async function savePhotoDraftToServer(
  sessionId: string,
  photoId: string,
  draft: SessionPhotoDraft
) {
  try {
    const body: any = {};
    if (draft.status) body.status = draft.status;
    if (draft.commentaire !== undefined) body.commentaire = draft.commentaire;
    if (draft.annotatedPath) body.annotated_path = draft.annotatedPath;
    if (draft.annotatedUrl) body.annotated_url = draft.annotatedUrl;

    await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(
        sessionId
      )}/photos/${encodeURIComponent(photoId)}/draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    console.error("Erreur auto-save draft:", err);
  }
}

// --- Debounce pour l'auto-save des brouillons de photo ---
const draftSaveTimers: Record<
  string,
  ReturnType<typeof setTimeout> | undefined
> = {};

function scheduleDraftSave(
  sessionId: string,
  photoId: string,
  draft: SessionPhotoDraft
) {
  const key = `${sessionId}::${photoId}`;

  const existing = draftSaveTimers[key];
  if (existing) {
    clearTimeout(existing);
  }

  draftSaveTimers[key] = setTimeout(() => {
    savePhotoDraftToServer(sessionId, photoId, draft);
    draftSaveTimers[key] = undefined;
  }, 500);
}

type IntroField = {
  key: string;
  label: string;
  value: string;
};

type SessionPhoto = {
  id: string;
  url: string;
  timestamp?: number;
  section?: string;
  [key: string]: any;
};

type PublishedItem = {
  photo_id: string;
  original_url?: string;
  annotated_path?: string | null;
  annotated_url?: string | null;
  commentaire?: string;
  created_at?: number;
  author?: string;
  [key: string]: any;
};

type SessionDetail = {
  session_id: string;
  status?: string;
  installateur?: {
    user_id?: string;
    nom?: string;
    societe?: string;
    email?: string;
    phone?: string;
  };
  chantier?: {
    ref?: string;
  };
  produit?: {
    code?: string;
    label?: string;
    sheet?: string;
  };
  photos?: SessionPhoto[];
  intro_fields?: IntroField[];
  created_at?: number;
  updated_at?: number;
  last_published_at?: number | null;
  last_published_by?: string | null;
  published_items?: PublishedItem[];
  [key: string]: any;
};

type PhotoDraft = {
  status: "ok" | "a_revoir";
  commentaire: string;
  annotatedPath?: string | null;
  annotatedUrl?: string | null;
};

function formatTs(ts?: number | null) {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

function humanStatus(status?: string) {
  if (!status) return "Nouveau";
  return status;
}

export default function SavSessionDetailPage() {
  const params = useParams() as { sessions_id?: string | string[] };

  const rawSessionId = Array.isArray(params.sessions_id)
    ? params.sessions_id[0]
    : params.sessions_id;

  const sessionId = rawSessionId ? decodeURIComponent(rawSessionId) : "";

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PhotoDraft>>({});
  const [author, setAuthor] = useState<string>("Xavier PERGE");
  const [publishing, setPublishing] = useState(false);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);

  const [fullscreen, setFullscreen] = useState<{
    photoId: string;
    variant: "original" | "annotated";
  } | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Auto-hide du toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- Chargement de la session ----
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError(
        "Impossible de trouver l'identifiant de session dans l'URL (paramètre manquant)."
      );
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildUrl(`/sessions/${encodeURIComponent(sessionId)}`)
        );
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Erreur API (${res.status}): ${txt || "Impossible de charger"}`
          );
        }
        const data = (await res.json()) as SessionDetail;
        if (!cancelled) {
          setDetail(data);

          const photos = data.photos || [];
          const nextDrafts: Record<string, PhotoDraft> = {};

          const publishedByPhoto: Record<string, PublishedItem> = {};
          (data.published_items || []).forEach((it) => {
            if (it.photo_id) publishedByPhoto[it.photo_id] = it;
          });

          const backendDrafts =
            (data as any).photo_drafts ||
            (data as any).photoDrafts ||
            {};

          for (const p of photos) {
            const pid = p.id;
            const existingPublished = publishedByPhoto[pid];
            const existingDraft = backendDrafts[pid] || {};

            nextDrafts[pid] = {
              status:
                (existingDraft.status as "ok" | "a_revoir" | undefined) ||
                (existingPublished?.status as "ok" | "a_revoir" | undefined) ||
                "a_revoir",
              commentaire:
                existingDraft.commentaire ??
                existingPublished?.commentaire ??
                "",
              annotatedPath:
                existingDraft.annotated_path ||
                existingPublished?.annotated_path ||
                null,
              annotatedUrl:
                existingDraft.annotated_url ||
                existingPublished?.annotated_url ||
                null,
            };
          }

          setDrafts(nextDrafts);
          if (!selectedPhotoId && photos.length > 0) {
            setSelectedPhotoId(photos[0].id);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Erreur inattendue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedPhotoId]);

  const photos: SessionPhoto[] = useMemo(
    () => detail?.photos || [],
    [detail]
  );

  const selectedPhoto: SessionPhoto | null = useMemo(() => {
    if (!photos.length) return null;
    if (!selectedPhotoId) return photos[0];
    return photos.find((p) => p.id === selectedPhotoId) || photos[0];
  }, [photos, selectedPhotoId]);

  const photosBySection = useMemo(() => {
    const sections: Record<string, SessionPhoto[]> = {};
    for (const p of photos) {
      const section = (p.section as string) || "Non catégorisé";
      if (!sections[section]) sections[section] = [];
      sections[section].push(p);
    }
    return sections;
  }, [photos]);

  const handleStatusChange = (photoId: string, status: "ok" | "a_revoir") => {
    if (!sessionId) {
      setDrafts((prev) => ({
        ...prev,
        [photoId]: {
          status,
          commentaire: prev[photoId]?.commentaire || "",
          annotatedPath: prev[photoId]?.annotatedPath,
          annotatedUrl: prev[photoId]?.annotatedUrl,
        },
      }));
      return;
    }

    setDrafts((prev) => {
      const next: Record<string, PhotoDraft> = {
        ...prev,
        [photoId]: {
          status,
          commentaire: prev[photoId]?.commentaire || "",
          annotatedPath: prev[photoId]?.annotatedPath,
          annotatedUrl: prev[photoId]?.annotatedUrl,
        },
      };

      scheduleDraftSave(sessionId, photoId, next[photoId]);
      return next;
    });
  };

  const handleCommentChange = (photoId: string, value: string) => {
    if (!sessionId) {
      setDrafts((prev) => ({
        ...prev,
        [photoId]: {
          status: prev[photoId]?.status || "a_revoir",
          commentaire: value,
          annotatedPath: prev[photoId]?.annotatedPath,
          annotatedUrl: prev[photoId]?.annotatedUrl,
        },
      }));
      return;
    }

    setDrafts((prev) => {
      const next: Record<string, PhotoDraft> = {
        ...prev,
        [photoId]: {
          status: prev[photoId]?.status || "a_revoir",
          commentaire: value,
          annotatedPath: prev[photoId]?.annotatedPath,
          annotatedUrl: prev[photoId]?.annotatedUrl,
        },
      };

      scheduleDraftSave(sessionId, photoId, next[photoId]);
      return next;
    });
  };

  const handleChooseAnnotated = (photoId: string) => {
    const input = document.getElementById(
      `annot-file-${photoId}`
    ) as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const handleAnnotatedFileChange = async (
    photoId: string,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    setUploadingPhotoId(photoId);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        buildUrl(
          `/sessions/${encodeURIComponent(
            sessionId
          )}/annotated/${encodeURIComponent(photoId)}`
        ),
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Erreur upload annoté (${res.status}) : ${
            txt || "Impossible de sauvegarder"
          }`
        );
      }

      const data = (await res.json()) as {
        annotated_path?: string;
        annotated_url?: string | null;
      };

      // cache-buster pour forcer le navigateur à recharger la nouvelle version
      const baseUrl =
        data.annotated_url ||
        `/sessions/${sessionId}/annotated/${photoId}`;
      const cacheBustedUrl = `${baseUrl}${
        baseUrl.includes("?") ? "&" : "?"
      }t=${Date.now()}`;

      setDrafts((prev) => ({
        ...prev,
        [photoId]: {
          status: prev[photoId]?.status || "a_revoir",
          commentaire: prev[photoId]?.commentaire || "",
          annotatedPath: data.annotated_path || null,
          annotatedUrl: cacheBustedUrl,
        },
      }));
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        message: (err as any)?.message
          ? String((err as any).message)
          : "Erreur lors de l’upload du visuel technique.",
      });
    } finally {
      setUploadingPhotoId(null);
      e.target.value = "";
    }
  };

  const handlePublish = useCallback(async () => {
    if (!sessionId || !detail) return;

    const photosList = detail.photos || [];

    const payloadItems = photosList.map((p) => {
      const d = drafts[p.id] || {
        status: "a_revoir" as "ok" | "a_revoir",
        commentaire: "",
        annotatedPath: null,
        annotatedUrl: null,
      };

      return {
        photo_id: p.id,
        commentaire: d.commentaire || "",
        annotated_path: d.annotatedPath || null,
        annotated_url: d.annotatedUrl || null,
      };
    });

    if (!payloadItems.length) {
      setToast({
        type: "error",
        message: "Aucune photo à publier pour cette session.",
      });
      return;
    }

    setPublishing(true);

    try {
      // 1) Publication côté internal_api
      const res = await fetch(
        buildUrl(`/sessions/${encodeURIComponent(sessionId)}/publish`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author: author || "Service Technique",
            items: payloadItems,
          }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Erreur publication (${res.status}) : ${
            txt || "Impossible de publier"
          }`
        );
      }

      const updated = (await res.json()) as SessionDetail;
      setDetail(updated);

      // 2) Appel webhook : envoi WhatsApp automatique
      try {
        await fetch(buildWebhookUrl("/notify-session-published"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            author: author || "Service Technique",
          }),
        });
      } catch (notifyErr) {
        console.error("Erreur lors de l'envoi WhatsApp:", notifyErr);
      }

      setToast({
        type: "success",
        message: "Diagnostic publié et envoyé à l’installateur.",
      });
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        message:
          (err as any)?.message ||
          "Erreur lors de la publication du diagnostic.",
      });
    } finally {
      setPublishing(false);
    }
  }, [sessionId, detail, drafts, author]);



  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-neutral-900">
              Visual Assistant
            </span>
            <span className="text-xs text-neutral-500">PERGE · SAV</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {humanStatus(detail?.status)}
            </span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !detail || !photos.length}
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white px-3 py-1.5 text-xs hover:bg-black disabled:opacity-50"
            >
              {publishing ? "Publication…" : "Publier ce diagnostic"}
            </button>
            <Link
              href="/sav/sessions"
              className="text-neutral-500 hover:text-neutral-800 hover:underline"
            >
              ← Retour à la liste
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Détail session SAV
            </h1>
            <p className="text-xs text-neutral-500">
              ID :{" "}
              <span className="font-mono">
                {sessionId || "(session inconnue)"}
              </span>
            </p>
          </div>
        </div>

        <section className="bg-white shadow-sm rounded-xl p-4 flex flex-col gap-4">
          {loading && (
            <div className="text-sm text-neutral-500">Chargement…</div>
          )}

          {!loading && error && (
            <div className="text-sm text-red-600 whitespace-pre-line">
              {error}
            </div>
          )}

          {!loading && !error && detail && (
            <>
              {/* Bloc contexte */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pb-2 border-b border-neutral-200">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Installateur
                  </div>
                  <div className="font-medium text-neutral-900">
                    {detail.installateur?.nom || "—"}
                  </div>
                  <div className="text-neutral-600">
                    {detail.installateur?.societe || "—"}
                  </div>
                  {detail.installateur?.email && (
                    <div className="text-neutral-500 text-xs">
                      {detail.installateur.email}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Chantier &amp; produit
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Chantier :</span>{" "}
                    {detail.chantier?.ref || "—"}
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Produit :</span>{" "}
                    {detail.produit?.label || detail.produit?.code || "—"}
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Feuille :</span>{" "}
                    {detail.produit?.sheet || "—"}
                  </div>
                  <div className="text-neutral-500 text-[11px]">
                    Créée : {formatTs(detail.created_at)} · Maj :{" "}
                    {formatTs(detail.updated_at)}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Publication
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Dernière publication :</span>{" "}
                    {detail.last_published_at
                      ? formatTs(detail.last_published_at)
                      : "—"}
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Par :</span>{" "}
                    {detail.last_published_by || "—"}
                  </div>
                  <div className="text-neutral-500 text-[11px]">
                    Photos : {photos.length || 0}
                  </div>
                </div>
              </div>

              {/* Photos par section + statut sélection */}
              <div className="pt-3 flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Photos par section
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)] gap-4 items-start">
                  {/* Miniatures */}
                  <div className="flex flex-col gap-1">
                    {Object.entries(photosBySection).map(
                      ([sectionLabel, sectionPhotos]) => (
                        <div key={sectionLabel} className="mb-1">
                          <div className="text-xs font-medium text-neutral-700 mb-1">
                            {sectionLabel} ({sectionPhotos.length})
                          </div>
                          <div className="flex flex-row flex-wrap gap-2">
                            {sectionPhotos.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedPhotoId(p.id)}
                                className={`flex flex-col items-center gap-1 border rounded-lg p-1 bg-neutral-50 hover:bg-neutral-100 ${
                                  selectedPhoto?.id === p.id
                                    ? "border-neutral-800"
                                    : "border-neutral-200"
                                }`}
                              >
                                <div className="w-16 h-12 bg-neutral-100 rounded overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={p.url}
                                    alt={p.id}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="text-[10px] text-neutral-600">
                                  {p.id}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                    <div className="text-[11px] text-neutral-500 mt-1">
                      Les sections viennent des étapes Excel (Fumisterie,
                      Hydraulique…). Les photos sans section sont classées dans{" "}
                      <span className="italic">Non catégorisé</span>.
                    </div>
                  </div>

                  {/* Statut de la photo sélectionnée */}
                  <div className="border border-neutral-200 rounded-xl bg-neutral-50 p-3 text-xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                      Statut de la photo sélectionnée
                    </div>
                    {selectedPhoto ? (
                      <>
                        <div className="text-[11px] text-neutral-600 mb-2">
                          Photo{" "}
                          <span className="font-mono">
                            {selectedPhoto.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="status-selected"
                              checked={
                                drafts[selectedPhoto.id]?.status === "ok"
                              }
                              onChange={() =>
                                handleStatusChange(selectedPhoto.id, "ok")
                              }
                            />
                            <span>OK</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="status-selected"
                              checked={
                                drafts[selectedPhoto.id]?.status === "a_revoir"
                              }
                              onChange={() =>
                                handleStatusChange(
                                  selectedPhoto.id,
                                  "a_revoir"
                                )
                              }
                            />
                            <span>À revoir</span>
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-neutral-500">
                        Sélectionne une photo pour ajuster son statut.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Zone principale : 1ère ligne = 2 images, 2ème ligne = commentaire + upload */}
              <div className="mt-4 flex flex-col gap-4">
                {/* Ligne 1 : deux images côte à côte */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Photo originale */}
                  <div>
                    <div className="text-sm font-medium text-neutral-800 mb-1">
                      {selectedPhoto
                        ? `Photo ${selectedPhoto.id} · ${formatTs(
                            selectedPhoto.timestamp
                          )}`
                        : "Aucune photo sélectionnée"}
                    </div>
                    <div className="text-[11px] text-neutral-500 mb-2">
                      Originale
                    </div>
                    <div className="relative bg-neutral-100 rounded-xl overflow-hidden aspect-[4/3]">
                      {selectedPhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedPhoto.url}
                          alt={selectedPhoto.id}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {selectedPhoto && (
                        <button
                          type="button"
                          onClick={() =>
                            setFullscreen({
                              photoId: selectedPhoto.id,
                              variant: "original",
                            })
                          }
                          className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-neutral-900/70 text-neutral-50 text-[10px]"
                        >
                          ⛶
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">
                      Cliquer sur l’icône en haut à droite pour voir en plein
                      écran.
                    </div>
                  </div>

                  {/* Visuel technique (preview) */}
                  <div>
                    {/* Ligne de titre invisible pour aligner verticalement avec la colonne de gauche */}
                    <div className="text-sm font-medium text-neutral-800 mb-1 invisible">
                      {selectedPhoto
                        ? `Photo ${selectedPhoto.id} · ${formatTs(
                            selectedPhoto.timestamp
                          )}`
                        : "Aucune photo sélectionnée"}
                    </div>

                    <div className="text-[11px] text-neutral-500 mb-2">
                      Visuel technique (prévisualisation)
                    </div>

                    <div className="relative bg-neutral-100 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center text-[11px] text-neutral-700">
                      {(() => {
                        if (!selectedPhoto) {
                          return <span>Aucune photo sélectionnée.</span>;
                        }
                        const draft = drafts[selectedPhoto.id];
                        const annotatedSrc = draft?.annotatedUrl
                          ? buildUrl(draft.annotatedUrl)
                          : null;

                        if (annotatedSrc) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={annotatedSrc}
                              alt={`Visuel technique ${selectedPhoto.id}`}
                              className="w-full h-full object-cover"
                            />
                          );
                        }

                        if (draft?.annotatedPath) {
                          return (
                            <span>
                              Visuel technique enregistré ({draft.annotatedPath})
                            </span>
                          );
                        }

                        return (
                          <span>Aucun visuel technique pour le moment.</span>
                        );
                      })()}

                      {selectedPhoto &&
                        drafts[selectedPhoto.id]?.annotatedPath && (
                          <button
                            type="button"
                            onClick={() =>
                              setFullscreen({
                                photoId: selectedPhoto.id,
                                variant: "annotated",
                              })
                            }
                            className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-neutral-900/70 text-neutral-50 text-[10px]"
                          >
                            ⛶
                          </button>
                        )}
                    </div>
                  </div>
                </div>

                {/* Ligne 2 : commentaire + bloc upload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Commentaire technique */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                      Commentaire technique (photo{" "}
                      {selectedPhoto?.id || "—"})
                    </div>
                    <textarea
                      className="w-full min-h-[150px] text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                      placeholder="Ex : encrassement important · prévoir nettoyage du conduit + contrôle tirage…"
                      value={
                        selectedPhoto
                          ? drafts[selectedPhoto.id]?.commentaire || ""
                          : ""
                      }
                      onChange={(e) =>
                        selectedPhoto &&
                        handleCommentChange(selectedPhoto.id, e.target.value)
                      }
                    />
                    <div className="text-[11px] text-neutral-400 mt-1">
                      Ce commentaire est partagé avec la future vue d’annotation
                      plein écran.
                    </div>
                  </div>

                  {/* Bloc upload visuel technique */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                      Visuel technique (annoté, schéma…)
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button
                        type="button"
                        disabled={
                          !selectedPhoto ||
                          uploadingPhotoId === selectedPhoto?.id
                        }
                        onClick={() =>
                          selectedPhoto &&
                          handleChooseAnnotated(selectedPhoto.id)
                        }
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {uploadingPhotoId === selectedPhoto?.id
                          ? "Téléversement en cours…"
                          : "Téléverser un visuel (annoté, schéma…)"}
                      </button>
                      {selectedPhoto &&
                        drafts[selectedPhoto.id]?.annotatedPath && (
                          <span className="text-[11px] text-emerald-700">
                            Visuel technique enregistré.
                          </span>
                        )}
                    </div>
                    {selectedPhoto && (
                      <input
                        id={`annot-file-${selectedPhoto.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleAnnotatedFileChange(selectedPhoto.id, e)
                        }
                      />
                    )}
                    <div className="text-[11px] text-neutral-400 mt-1">
                      Tu peux téléverser une capture annotée ou un schéma.
                      Plus tard, ce bouton sera connecté à un outil
                      d’annotation plein écran.
                    </div>
                  </div>
                </div>
              </div>

              {/* Debug JSON éventuel en bas */}
              <details className="mt-6">
                <summary className="text-xs text-neutral-500 cursor-pointer">
                  JSON brut de la session (debug)
                </summary>
                <pre className="mt-2 text-[11px] bg-neutral-900 text-neutral-50 rounded-lg p-3 overflow-x-auto max-h-[400px]">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </details>
            </>
          )}
        </section>
      </div>

      {/* Modal plein écran pour la photo */}
      {fullscreen && selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-neutral-900 rounded-xl max-w-5xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 flex-none">
              <div className="text-sm text-neutral-100">
                Photo {selectedPhoto.id} ·{" "}
                {fullscreen.variant === "annotated"
                  ? "visuel technique"
                  : "originale"}
              </div>
              <button
                type="button"
                onClick={() => setFullscreen(null)}
                className="text-neutral-300 hover:text-white text-sm"
              >
                Fermer ✕
              </button>
            </div>
            <div className="flex-1 bg-black overflow-auto">
              <div className="min-h-full flex items-center justify-center">
                {(() => {
                  const draft = drafts[selectedPhoto.id];
                  let src = selectedPhoto.url;

                  if (
                    fullscreen.variant === "annotated" &&
                    draft?.annotatedUrl
                  ) {
                    src = buildUrl(draft.annotatedUrl);
                  }

                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={selectedPhoto.id}
                      className="h-[90vh] w-auto object-contain"
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast bas de page */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`rounded-full px-4 py-2 text-xs shadow-lg border ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </main>
  );
}
