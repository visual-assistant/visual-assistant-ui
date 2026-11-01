"use client";

import { useEffect, useState } from "react";

type ChantierTask = {
  task_id: string;
  text: string;
  type: string;
  status: string;
  responsible: string;
  source_type: string;
  source_id: string;
  source_member_id?: string | null;
  chantier_id?: string | null;
};

function taskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    a_faire: "À faire",
    en_attente_retour: "En attente de retour",
    realisee: "Réalisée",
    annulee: "Annulée",
  };
  return labels[status] || status || "Statut non précisé";
}

function taskTypeLabel(type: string) {
  const labels: Record<string, string> = {
    piece_detachee: "Pièce détachée",
    documentation: "Documentation",
    verification: "Vérification",
    retour_attendu: "Retour attendu",
    autre: "Autre",
  };
  return labels[type] || type || "Type non précisé";
}

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
          ? payload.tasks.filter((task): task is ChantierTask => Boolean(task && typeof task === "object"))
          : [];
        if (!cancelled) setTasks(nextTasks);
      } catch (loadError) {
        if (!cancelled) {
          setTasks([]);
          setError(loadError instanceof Error ? loadError.message : "Erreur de chargement des tâches");
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
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Tâches</h2>
          <p className="mt-2 text-sm text-slate-500">
            Engagements ouverts identifiés dans les appels et rattachés à ce chantier.
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
          <h3 className="mt-4 font-semibold text-slate-900">Aucune tâche rattachée</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Les engagements ouverts détectés dans les appels associés à ce chantier apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Tâche</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Responsable</th>
                  <th className="px-4 py-4">Statut</th>
                  <th className="px-5 py-4 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.task_id} className="align-top hover:bg-slate-50/70">
                    <td className="max-w-[420px] px-5 py-4">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                        {task.text || "Tâche sans description"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {taskTypeLabel(task.type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">
                      {task.responsible || "Non précisé"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${statusClasses(task.status)}`}>
                        {taskStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <a
                        href={`/sav/sessions/${encodeURIComponent(chantierId)}?tab=MESSAGES`}
                        className="text-xs font-semibold text-orange-700 hover:text-orange-900"
                      >
                        Messages reçus →
                      </a>
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

