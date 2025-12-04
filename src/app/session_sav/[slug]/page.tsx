"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const buildUrl = (path: string) => {
  return new URL(path, API_BASE).toString();
};

interface PublishedItem {
  photo_id: string;
  original_url: string;
  annotated_url?: string | null;
  commentaire?: string | null;
  status: "ok" | "a_revoir";
}

interface PublicSession {
  slug: string;
  chantier_ref: string | null;
  produit: {
    label: string | null;
    sheet: string | null;
  } | null;
  installateur: {
    nom: string | null;
    societe: string | null;
  } | null;
  published_items: PublishedItem[];
  summary: {
    total_photos: number;
    ok_count: number;
    to_fix_count: number;
  };
}

export default function PublicSessionPage() {
  const params = useParams();
  const slug = (params?.slug ?? "") as string;

  const [session, setSession] = useState<PublicSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComment, setShowComment] = useState(false);
  const [viewMode, setViewMode] = useState<"original" | "annotated">("original");

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        setLoading(true);
        const url = buildUrl(`/sessions/public/${slug}`);
        console.log("[PublicSession] fetch", url);
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          console.log("[PublicSession] data", data);
          setSession(data);
        } else {
          console.warn("[PublicSession] status != 200", res.status);
          setSession(null);
        }
      } catch (e) {
        console.error("[PublicSession] error", e);
        setSession(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  const handlePrev = () => {
    if (!session) return;
    setShowComment(false);
    setViewMode("original");
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : idx));
  };

  const handleNext = () => {
    if (!session) return;
    setShowComment(false);
    setViewMode("original");
    setCurrentIndex((idx) =>
      idx < session.published_items.length - 1 ? idx + 1 : idx
    );
  };

  if (loading || !slug) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-neutral-400">
        Chargement…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-red-500">
        Session introuvable
      </div>
    );
  }

  const { published_items, summary } = session;
  const current = published_items[currentIndex];
  const hasAnnotated = !!current.annotated_url;

  // 🔧 Nouveau: on construit l'URL finale pour le visuel technique
  const computeImageUrl = () => {
    if (viewMode === "annotated" && hasAnnotated) {
      const raw = current.annotated_url as string;

      // Si c'est déjà une URL absolue (ImageKit, etc.), on la garde telle quelle
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
      }

      // Sinon, on suppose que c'est un chemin backend ("/sessions/...")
      return buildUrl(raw);
    }

    // Photo originale vient déjà d'ImageKit (URL absolue)
    return current.original_url;
  };

  const imageUrl = computeImageUrl();

  return (
    // Conteneur plein écran qui recouvre nav + footer
    <div className="fixed inset-0 z-40 bg-black text-white overflow-hidden">
      <div className="relative h-full w-full">
        {/* === HEADER overlay (dégradé comme le mock) === */}
        <div className="pointer-events-none absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-black/0 z-20 px-4 pt-6 pb-12">
          <div className="text-xs font-semibold tracking-wide opacity-90">
            {session.chantier_ref} – {session.produit?.label}
          </div>

          <div className="mt-1 flex items-center gap-3 text-[11px] opacity-80">
            <span>
              Photo {currentIndex + 1} / {summary.total_photos}
            </span>
            <span className="text-emerald-400">{summary.ok_count} OK</span>
            <span className="text-red-400">{summary.to_fix_count} à corriger</span>
          </div>
        </div>

        {/* === SWITCH ORIGINAL / ANNOTÉ (bouton en haut à droite) === */}
        <div className="absolute top-6 right-4 z-30">
          <button
            disabled={!hasAnnotated}
            onClick={() =>
              hasAnnotated &&
              setViewMode((m) => (m === "original" ? "annotated" : "original"))
            }
            className={`px-3 py-1 rounded-full text-[11px] border ${
              hasAnnotated
                ? "border-white/60 bg-black/40 text-white"
                : "border-white/20 bg-black/20 text-white/40"
            }`}
          >
            {hasAnnotated
              ? viewMode === "original"
                ? "Voir visuel technique"
                : "Voir photo originale"
              : "Pas de visuel technique"}
          </button>
        </div>

        {/* === IMAGE plein écran === */}
        <div className="h-full w-full flex items-center justify-center">
          <img
            src={imageUrl}
            alt="photo"
            className="h-full w-full object-contain"
          />
        </div>

        {/* === NAVIGATION PHOTOS (flèches gauche/droite) === */}
        {summary.total_photos > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 flex items-center justify-center text-lg text-white/80 z-30"
            >
              ‹
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 flex items-center justify-center text-lg text-white/80 z-30"
            >
              ›
            </button>
          </>
        )}

        {/* === BANDEAU BAS overlay (dégradé) === */}
        <div className="absolute bottom-0 left-0 w-full z-20">
          <div className="bg-gradient-to-t from-black/90 via-black/60 to-black/0 px-4 pt-8 pb-5 space-y-1">
            {/* Ligne d'aide gestuelle (proche du SVG) */}

            <div className="flex items-center justify-between text-[13px] opacity-90">
              <span>
                {current.status === "ok" ? "Photo OK" : "Photo à corriger"}
              </span>

              <button
                className="px-3 py-1 rounded-xl bg-white/18 backdrop-blur text-xs"
                onClick={() => setShowComment(true)}
              >
                Commentaire
              </button>
            </div>
          </div>
        </div>

        {/* === COMMENTAIRE (bottom sheet) === */}
        {showComment && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <div className="mx-auto w-full max-w-md">
              <div className="bg-white rounded-t-[10px] px-4 pt-3 pb-5 shadow-xl">
                {/* petit handle comme dans le mock */}
                <div className="flex justify-center mb-2">
                  <div className="h-1 w-12 rounded-full bg-neutral-300" />
                </div>

                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-sm">
                    Commentaire technique
                  </div>
                  <button
                    onClick={() => setShowComment(false)}
                    className="text-xs text-neutral-600"
                  >
                    Fermer
                  </button>
                </div>

                <div className="text-[13px] leading-relaxed text-neutral-800 whitespace-pre-line">
                  {current.commentaire || "Aucun commentaire sur cette photo."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
