"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const buildUrl = (path: string, params?: URLSearchParams | Record<string, string>) => {
  const url = new URL(path, API_BASE);
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => url.searchParams.set(k, v));
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
};

type SessionListItem = {
  session_id: string;
  installateur_phone?: string;
  installateur_nom?: string;
  installateur_societe?: string;
  chantier_ref?: string;
  produit_label?: string;
  produit_code?: string;
  sheet?: string;
  status?: string;
  created_at?: number;
  updated_at?: number;
  last_published_at?: number | null;
  photo_count?: number;
  thumbnail_url?: string | null;
  has_public_link?: boolean;
};

function formatTs(ts?: number | null) {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

export default function SavSessionsListPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const params =
          statusFilter.trim() && statusFilter !== "Tous"
            ? { status: statusFilter }
            : undefined;
        const res = await fetch(buildUrl("/sessions/list", params || {}));
        if (!res.ok) {
          setError("Erreur lors du chargement des sessions.");
          setSessions([]);
          return;
        }
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("fetch /sessions/list error", e);
        setError("Erreur réseau lors du chargement des sessions.");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [statusFilter]);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Visual Assistant · Sessions SAV
        </h1>
        <Link
          href="/generateur"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline-offset-2 hover:underline"
        >
          ← Retour générateur
        </Link>
      </div>

      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Liste des sessions</h2>
            <p className="text-sm text-neutral-500">
              Sessions courtes créées automatiquement à partir de WhatsApp
              (triées par dernière mise à jour).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-700">
              Statut :
              <select
                className="ml-2 rounded-lg border border-neutral-300 px-2 py-1 text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="Nouveau">Nouveau</option>
                <option value="Publié">Publié</option>
                <option value="À revoir">À revoir</option>
              </select>
            </label>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-neutral-500">Chargement…</div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-sm text-neutral-500">
            Aucune session trouvée pour ce filtre.
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-2 px-2">Date maj</th>
                  <th className="text-left py-2 px-2">Statut</th>
                  <th className="text-left py-2 px-2">Installateur</th>
                  <th className="text-left py-2 px-2">Chantier</th>
                  <th className="text-left py-2 px-2">Produit / Feuille</th>
                  <th className="text-left py-2 px-2">Photos</th>
                  <th className="text-left py-2 px-2">Aperçu</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                  >
                    <td className="py-2 px-2 align-top">
                      {formatTs(s.updated_at || s.created_at)}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                          s.status === "Publié"
                            ? "bg-emerald-100 text-emerald-700"
                            : s.status === "À revoir"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {s.status || "N/A"}
                      </span>
                    </td>
                    <td className="py-2 px-2 align-top">
                      <div className="font-medium">
                        {s.installateur_nom || "—"}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {s.installateur_societe || "—"}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {s.installateur_phone || "—"}
                      </div>
                    </td>
                    <td className="py-2 px-2 align-top">
                      {s.chantier_ref || "—"}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <div>{s.produit_label || "—"}</div>
                      <div className="text-xs text-neutral-500">
                        {s.sheet || "—"}
                      </div>
                    </td>
                    <td className="py-2 px-2 align-top">
                      {s.photo_count ?? 0}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <Link
                        href={`/sav/sessions/${encodeURIComponent(
                          s.session_id
                        )}`}
                        className="inline-flex items-center text-xs px-2 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800"
                      >
                        Voir le détail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
