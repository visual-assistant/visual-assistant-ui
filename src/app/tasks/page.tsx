"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";

type Task = {
  task_id: string;
  text: string;
  type: string;
  status: string;
  responsible?: string | null;
  installateur?: string | null;
  produit?: string | null;
  numero?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  chantier_id?: string | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
};

const apiBase =
  process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_INTERNAL_API ||
  "http://localhost:8001";

const statusOptions = [
  ["a_faire", "À faire"],
  ["en_attente_retour", "En attente de retour"],
  ["realisee", "Réalisée"],
  ["annulee", "Annulée"],
] as const;

function readable(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.replaceAll("_", " ") : fallback;
}

function statusClasses(status: string) {
  if (status === "en_attente_retour")
    return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "realisee")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "annulee") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function isCallSource(sourceType: string | null | undefined) {
  const normalized = (sourceType || "").toLowerCase();
  return (
    normalized.includes("call") ||
    normalized.includes("appel") ||
    normalized === "voice_call"
  );
}

function responsibleKey(responsible: string | null | undefined) {
  return (responsible || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isInternalResponsible(responsible: string | null | undefined) {
  const key = responsibleKey(responsible);
  if (!key) return false;

  if (key.includes("servicetechnique") || key === "perge") return true;

  return new Set([
    "xavierbriffa",
    "florentboeuf",
    "florentbuf",
    "williamperge",
    "wperge",
    "denislaffont",
  ]).has(key);
}

function formatDate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric =
    typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))
      ? Number(value) * 1000
      : String(value);
  const date = new Date(numeric);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/tasks`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as
        { tasks?: unknown } | unknown[];
      const rawTasks = Array.isArray(payload) ? payload : payload.tasks;
      setTasks(
        Array.isArray(rawTasks)
          ? rawTasks.filter((task): task is Task =>
              Boolean(task && typeof task === "object"),
            )
          : [],
      );
    } catch (loadError) {
      setTasks([]);
      setError(
        loadError instanceof Error ? loadError.message : "Erreur de chargement",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const updateStatus = async (taskId: string, status: string) => {
    setUpdatingTaskId(taskId);
    try {
      const response = await fetch(
        `${apiBase}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const updated = (await response.json()) as Task;
      setTasks((current) =>
        current.map((task) =>
          task.task_id === taskId ? { ...task, ...updated } : task,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Erreur de mise à jour",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const visibleTasks = useMemo(
    () => tasks.filter((task) => isInternalResponsible(task.responsible)),
    [tasks],
  );
  const responsibleOptions = useMemo(
    () =>
      Array.from(
        new Set(visibleTasks.map((task) => task.responsible).filter(Boolean)),
      ).sort() as string[],
    [visibleTasks],
  );
  const productOptions = useMemo(
    () =>
      Array.from(
        new Set(visibleTasks.map((task) => task.produit).filter(Boolean)),
      ).sort() as string[],
    [visibleTasks],
  );
  const filteredTasks = useMemo(
    () =>
      visibleTasks.filter((task) => {
        const needle = search.trim().toLocaleLowerCase();
        if (
          needle &&
          ![task.text, task.chantier_id, task.installateur, task.produit].some(
            (value) =>
              String(value || "")
                .toLocaleLowerCase()
                .includes(needle),
          )
        )
          return false;
        if (statusFilter && task.status !== statusFilter) return false;
        if (responsibleFilter && task.responsible !== responsibleFilter)
          return false;
        if (productFilter && task.produit !== productFilter) return false;
        if (openOnly && ["realisee", "annulee"].includes(task.status))
          return false;
        return true;
      }),
    [
      openOnly,
      productFilter,
      responsibleFilter,
      search,
      statusFilter,
      visibleTasks,
    ],
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-6 py-6 backdrop-blur sm:px-10 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Tâches
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Vue d’ensemble des engagements identifiés dans les appels
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un installateur ou un chantier..."
              className="h-11 min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none hover:bg-slate-50"
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par responsable"
              value={responsibleFilter}
              onChange={(event) => setResponsibleFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none hover:bg-slate-50"
            >
              <option value="">Tous les responsables</option>
              {responsibleOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par produit"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              className="h-11 max-w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none hover:bg-slate-50"
            >
              <option value="">Tous les produits</option>
              {productOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => setOpenOnly(event.target.checked)}
                className="h-4 w-4 accent-orange-600"
              />{" "}
              Ouvertes uniquement
            </label>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {filteredTasks.length} tâche(s)
            </p>
          </div>
          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
              Chargement des tâches…
            </section>
          ) : error ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
              Impossible de charger les tâches. {error}
            </section>
          ) : filteredTasks.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
              <h2 className="font-semibold text-slate-900">Aucune tâche</h2>
              <p className="mt-2 text-sm text-slate-500">
                Aucune tâche ne correspond aux filtres actuels.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-hidden">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="w-[12%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Tâche</th>
                      <th className="px-4 py-4">Statut</th>
                      <th className="px-4 py-4">Responsable</th>
                      <th className="px-4 py-4">Installateur</th>
                      <th className="px-4 py-4">Numéro</th>
                      <th className="px-4 py-4">Produit</th>
                      <th className="px-4 py-4">Chantier</th>
                      <th className="px-4 py-4">Source</th>
                      <th className="px-4 py-4">Créée le</th>
                      <th className="px-5 py-4">Mise à jour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map((task) => (
                      <tr
                        key={task.task_id}
                        className="align-top hover:bg-slate-50/70"
                      >
                        <td className="max-w-[520px] px-5 py-4 text-sm leading-relaxed text-slate-900">
                          {task.text || "Tâche sans description"}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4">
                          <select
                            aria-label={`Modifier le statut de ${task.text}`}
                            value={task.status}
                            disabled={updatingTaskId === task.task_id}
                            style={{ fontSize: "14px", lineHeight: "1.25" }}
                            onChange={(event) =>
                              void updateStatus(
                                task.task_id,
                                event.target.value,
                              )
                            }
                            className={`w-full max-w-full min-w-0 cursor-pointer appearance-none rounded-full border-0 px-1 py-1 text-sm font-medium ring-1 outline-none ${statusClasses(task.status)} disabled:cursor-wait disabled:opacity-60`}
                          >
                            <option value="a_faire">À faire</option>
                            <option value="en_attente_retour">
                              En attente de retour
                            </option>
                            <option value="realisee">Réalisée</option>
                            <option value="annulee">Annulée</option>
                          </select>
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-sm font-medium text-slate-700">
                          {task.responsible || "Non précisé"}
                        </td>
                        <td className="max-w-[220px] whitespace-normal break-words px-4 py-4 text-sm leading-snug text-slate-700">
                          {task.installateur || "Non précisé"}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-sm text-slate-600">
                          {task.numero || "Non précisé"}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-sm text-slate-600">
                          {task.produit || "Non précisé"}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-sm">
                          {task.chantier_id ? (
                            <Link
                              href={`/sav/sessions/${encodeURIComponent(task.chantier_id)}`}
                              className="font-semibold text-orange-700 hover:text-orange-900"
                            >
                              {task.chantier_id}
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              Sans chantier
                            </span>
                          )}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-xs">
                          {task.chantier_id &&
                          isCallSource(task.source_type) ? (
                            <Link
                              href={`/sav/sessions/${encodeURIComponent(task.chantier_id)}?tab=MESSAGES`}
                              className="font-semibold text-orange-700 hover:text-orange-900"
                            >
                              Messages reçus →
                            </Link>
                          ) : isCallSource(task.source_type) ? (
                            <Link
                              href={`/inbox-sav?call_id=${encodeURIComponent(task.source_id || "")}`}
                              className="font-semibold text-orange-700 hover:text-orange-900"
                            >
                              Inbox SAV →
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              {readable(
                                task.source_type,
                                "Source non précisée",
                              )}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-normal break-words px-4 py-4 text-sm text-slate-500">
                          {formatDate(task.created_at)}
                        </td>
                        <td className="whitespace-normal break-words px-5 py-4 text-sm text-slate-500">
                          {formatDate(task.updated_at || task.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
