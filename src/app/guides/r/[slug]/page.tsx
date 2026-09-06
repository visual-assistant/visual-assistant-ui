"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw, Shield } from "lucide-react";
import {
  InstallerPreviewWebapp,
  type InstallerPreviewResponse,
} from "../../../../components/GuideChantierReview";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_INTERNAL_API ||
  "http://localhost:8001";

function apiUrl(path: string) {
  return new URL(path, API_BASE).toString();
}

function publicErrorLabel(status: number, detail: string) {
  if (status === 404) return "Guide chantier introuvable ou lien expiré";
  if (status === 410) return "Ce guide n’est plus disponible";
  return detail || "Impossible de charger le guide chantier.";
}

export default function PublicGuidePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [preview, setPreview] = useState<InstallerPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuide = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/guides/public/${encodeURIComponent(slug)}`), {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(publicErrorLabel(res.status, text));
      }
      setPreview((await res.json()) as InstallerPreviewResponse);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Impossible de charger le guide chantier.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadGuide();
  }, [loadGuide]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">PRIA · PERGE</p>
              <p className="text-xs text-slate-500">Guide chantier installateur</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadGuide()}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            aria-label="Actualiser le guide"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </header>

        <section className="min-h-0 flex-1">
          {loading ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                Chargement du guide chantier...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[70vh] items-center justify-center px-5">
              <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <AlertCircle className="mx-auto h-9 w-9 text-orange-500" />
                <h1 className="mt-3 text-base font-semibold text-slate-950">{error}</h1>
                <button
                  type="button"
                  onClick={() => void loadGuide()}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              </div>
            </div>
          ) : preview ? (
            <InstallerPreviewWebapp preview={preview} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
