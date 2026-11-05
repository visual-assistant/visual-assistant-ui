"use client";

import { useEffect, useState } from "react";

type ChantierTask = {
  task_id: string;
  text: string;
  type: string;
  status: string;
  responsible: string;
  installateur?: string | null;
  produit?: string | null;
  numero?: string | null;
  source_type: string;
  source_id: string;
  source_member_id?: string | null;
  chantier_id?: string | null;
  updated_at?: number | string | null;
  created_at?: number | string | null;
};

function statusClasses(status: string) {
  if (status === "en_attente_retour") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (status === "realisee") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "annulee") {
    return "bg-slate-100 text-slate-500 ring-slate-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
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

export default function ChantierTasksTab({
  apiBase,
  chantierId,
}: {
  apiBase: string;
  chantierId: string;
}) {
  const [tasks, setTasks] = useState<ChantierTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

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
      const updated = (await response.json()) as ChantierTask;
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

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      if (!chantierId) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBase}/chantiers/${encodeURIComponent(chantierId)}/tasks`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { tasks?: unknown };
        const nextTasks = Array.isArray(payload.tasks)
          ? payload.tasks.filter((task): task is ChantierTask =>
              Boolean(task && typeof task === "object"),
            )
          : [];
        if (!cancelled) setTasks(nextTasks);
      } catch (loadError) {
        if (!cancelled) {
          setTasks([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Erreur de chargement des tâches",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [apiBase, chantierId]);

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Tâches</h2>
          <p className="mt-2 text-sm text-slate-500">
            Engagements ouverts identifiés dans les appels et rattachés à ce
            chantier.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-slate-500">Total</span>{" "}
          <span className="font-semibold text-slate-950">{tasks.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
          Chargement des tâches…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          Impossible de charger les tâches. {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-2xl ring-1 ring-slate-200">
            ✓
          </div>
          <h3 className="mt-4 font-semibold text-slate-900">
            Aucune tâche rattachée
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Les engagements ouverts détectés dans les appels associés à ce
            chantier apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                {tasks.map((task) => (
                  <tr
                    key={task.task_id}
                    className="align-top hover:bg-slate-50/70"
                  >
                    <td className="max-w-[520px] px-5 py-4">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                        {task.text || "Tâche sans description"}
                      </div>
                    </td>
                    <td className="whitespace-normal break-words px-4 py-4">
                      <select
                        aria-label={`Modifier le statut de ${task.text}`}
                        value={task.status}
                        disabled={updatingTaskId === task.task_id}
                        style={{ fontSize: "14px", lineHeight: "1.25" }}
                        onChange={(event) =>
                          void updateStatus(task.task_id, event.target.value)
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
                      <span className="font-semibold text-slate-700">
                        {task.chantier_id || chantierId}
                      </span>
                    </td>
                    <td className="whitespace-normal break-words px-4 py-4 text-xs">
                      <a
                        href={`/sav/sessions/${encodeURIComponent(chantierId)}?tab=MESSAGES`}
                        className="text-xs font-semibold text-orange-700 hover:text-orange-900"
                      >
                        Messages reçus →
                      </a>
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
        </div>
      )}
    </div>
  );
}
