"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, Phone, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";
const STORAGE_KEY = "perge-call-processing-job-id";
const buildUrl = (path: string) => new URL(path, API_BASE).toString();

export type CallProcessingConversation = {
  id: string;
  conversation_id?: string | null;
  discovery_keys?: string[];
  call_count?: number;
  period?: string | number | null;
  phone?: string | null;
  contact?: string | null;
  status?: "pending" | "running" | "completed" | "error" | string | null;
  chantier_id?: string | null;
  sav_session_id?: string | null;
  attachment_status?: string | null;
  processing_stage?: string | null;
  error_code?: string | null;
  error_message?: string | null;
};

export type CallProcessingJob = {
  job_id: string;
  status?: string | null;
  stage?: string | null;
  progress?: number | null;
  total_calls?: number | null;
  total_count?: number | null;
  processed_count?: number | null;
  completed_count?: number | null;
  failed_count?: number | null;
  pre_attachment_failed_count?: number | null;
  error?: string | null;
  conversations?: CallProcessingConversation[];
};

type StartPayload = { discovery_keys: string[]; attachments?: Array<Record<string, unknown>> };
type ContextValue = {
  job: CallProcessingJob | null;
  notice: string | null;
  startCallProcessing: (payload: StartPayload) => Promise<boolean>;
  retryConversation: (conversation: CallProcessingConversation) => Promise<void>;
  dismissJob: () => void;
};
const ProcessingContext = createContext<ContextValue | null>(null);

export function useCallProcessing() {
  const value = useContext(ProcessingContext);
  if (!value) throw new Error("useCallProcessing must be used inside CallProcessingProvider");
  return value;
}

const activeStatus = (status?: string | null) => status === "queued" || status === "running";
const terminalStatus = (status?: string | null) => ["completed", "completed_with_errors", "failed"].includes(status || "");
const stageLabel = (stage?: string | null) => ({ queued: "Mise en file", processing: "Traitement", downloading: "Téléchargement", importing: "Import", transcribing: "Transcription", analyzing: "Analyse", attaching: "Rattachement", completed: "Terminé", failed: "Échec" }[String(stage || "").toLowerCase()] || "Traitement des appels");
const periodLabel = (value?: string | number | null) => !value ? "Période inconnue" : typeof value === "string" ? value : new Date(value * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function CallProcessingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CallProcessingJob | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshJob = useCallback(async (id: string) => {
    const response = await fetch(buildUrl(`/inbox/calls/process/${encodeURIComponent(id)}`), { cache: "no-store" });
    if (response.status === 404) {
      window.localStorage.removeItem(STORAGE_KEY);
      setJobId(null);
      setJob(null);
      return null;
    }
    if (!response.ok) throw new Error("Impossible de récupérer le traitement des appels.");
    const next = (await response.json()) as CallProcessingJob;
    setJob({ ...next, job_id: next.job_id || id });
    return next;
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    setJobId(stored);
    void refreshJob(stored).catch(() => {
      window.localStorage.removeItem(STORAGE_KEY);
      setJobId(null);
    });
  }, [refreshJob]);

  useEffect(() => {
    if (!jobId || !activeStatus(job?.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await refreshJob(jobId);
        if (!cancelled && next && activeStatus(next.status)) timer = window.setTimeout(poll, 1200);
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 2500);
      }
    };
    timer = window.setTimeout(poll, 0);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [jobId, job?.status, refreshJob]);

  const startCallProcessing = useCallback(async (payload: StartPayload) => {
    setNotice(null);
    const response = await fetch(buildUrl("/inbox/calls/process"), { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Le traitement des appels n’a pas pu démarrer.");
    const id = String(data?.job_id || "").trim();
    if (!id) throw new Error("Le backend n’a pas retourné d’identifiant de traitement.");
    window.localStorage.setItem(STORAGE_KEY, id);
    setJobId(id);
    await refreshJob(id);
    if (data?.already_running) setNotice("Un traitement d’appels est déjà en cours. Vous pouvez suivre sa progression ici.");
    return true;
  }, [refreshJob]);

  const retryConversation = useCallback(async (conversation: CallProcessingConversation) => {
    const keys = conversation.discovery_keys || [];
    if (!keys.length) return;
    const response = await fetch(buildUrl("/inbox/calls/process/retry"), { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ discovery_keys: keys }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Impossible de relancer cet appel.");
    const id = String(data?.job_id || "").trim();
    if (!id) throw new Error("Le backend n’a pas retourné le job de reprise.");
    window.localStorage.setItem(STORAGE_KEY, id);
    setJobId(id);
    await refreshJob(id);
  }, [refreshJob]);

  const dismissJob = useCallback(() => {
    if (job && !terminalStatus(job.status)) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setJobId(null);
    setJob(null);
    setNotice(null);
  }, [job]);

  const value = useMemo(() => ({ job, notice, startCallProcessing, retryConversation, dismissJob }), [job, notice, startCallProcessing, retryConversation, dismissJob]);
  return <ProcessingContext.Provider value={value}>{children}{job ? <CallProcessingCenter job={job} notice={notice} onRetry={retryConversation} onDismiss={dismissJob} onOpenChantier={(id) => router.push(`/sav/sessions/${encodeURIComponent(id)}`)} /> : null}</ProcessingContext.Provider>;
}

function CallProcessingCenter({ job, notice, onRetry, onDismiss, onOpenChantier }: { job: CallProcessingJob; notice: string | null; onRetry: (conversation: CallProcessingConversation) => Promise<void>; onDismiss: () => void; onOpenChantier: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const active = activeStatus(job.status);
  const hasErrors = job.status === "completed_with_errors" || job.status === "failed";
  const rows = job.conversations || [];
  const completed = Math.max(job.completed_count || 0, rows.filter((row) => row.status === "completed").length);
  const failed = Math.max(job.failed_count || 0, rows.filter((row) => row.status === "error").length, job.pre_attachment_failed_count || 0);
  const total = job.total_calls || job.total_count || rows.length;
  const progress = typeof job.progress === "number" ? job.progress : total ? Math.round(((completed + failed) / total) * 100) : 0;
  const retry = async (row: CallProcessingConversation) => { setRetryingId(row.id); try { await onRetry(row); } finally { setRetryingId(null); } };
  return <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2">
    {notice ? <div className="max-w-[360px] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg">{notice}</div> : null}
    {open ? <div className="w-[min(410px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-orange-100 text-orange-700" : hasErrors ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{active ? <Loader2 className="h-4 w-4 animate-spin" /> : hasErrors ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</span><div><p className="text-sm font-semibold text-slate-900">Traitement des appels</p><p className="mt-0.5 text-xs text-slate-500">{active ? `${stageLabel(job.stage)} en cours` : hasErrors ? "Terminé avec des erreurs" : "Traitement terminé"}</p></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Réduire"><ChevronDown className="h-4 w-4" /></button></div>
      <div className="space-y-3 px-4 py-3.5"><div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-700">{active ? stageLabel(job.stage) : "Récapitulatif"}</span><span className="tabular-nums text-slate-500">{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${hasErrors ? "bg-amber-500" : active ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div><div className="flex flex-wrap gap-1.5 text-[11px]"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{completed} terminé{completed > 1 ? "s" : ""}</span>{active ? <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">{Math.max(0, total - completed - failed)} en cours</span> : null}{failed ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">{failed} erreur{failed > 1 ? "s" : ""}</span> : null}</div></div>{job.error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{job.error}</div> : null}<div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">{rows.map((row) => { const error = row.status === "error"; const count = row.call_count || row.discovery_keys?.length || 1; return <div key={row.id} className="bg-white p-3"><div className="flex items-start gap-2.5"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${row.status === "completed" ? "bg-emerald-100 text-emerald-700" : error ? "bg-red-100 text-red-700" : row.status === "running" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"}`}>{row.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : error ? <AlertTriangle className="h-3.5 w-3.5" /> : row.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">{row.contact || "Appel"}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{periodLabel(row.period)}{row.phone ? ` · ${row.phone}` : ""}</p></div><span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">{count} appel{count > 1 ? "s" : ""}</span></div>{row.chantier_id ? <div className="mt-1.5 flex items-center justify-between gap-2"><p className="truncate text-[11px] font-medium text-sky-700">Chantier {row.chantier_id}</p>{row.status === "completed" ? <button type="button" onClick={() => onOpenChantier(row.chantier_id!)} className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-orange-700">Voir le chantier <ExternalLink className="h-3 w-3" /></button> : null}</div> : null}{error ? <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-red-50 px-2 py-1.5"><p className="min-w-0 truncate text-[11px] text-red-700">{row.error_code || "TRAITEMENT_FAILED"}{row.error_message ? ` · ${row.error_message}` : ""}</p><button type="button" onClick={() => void retry(row)} disabled={retryingId === row.id || active} className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-red-700 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${retryingId === row.id ? "animate-spin" : ""}`} /> Relancer</button></div> : null}</div></div></div>; })}</div></div>
    </div> : null}
    <div className={`relative flex items-center overflow-hidden rounded-full border shadow-lg ${active ? "border-orange-200 bg-orange-600" : hasErrors ? "border-amber-200 bg-amber-600" : "border-emerald-200 bg-emerald-600"}`}><button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-white"><span>{active ? <Loader2 className="h-4 w-4 animate-spin" /> : hasErrors ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</span><span><span className="block text-xs font-semibold leading-tight">{active ? "Traitement des appels" : hasErrors ? "Traitement à vérifier" : "Traitement terminé"}</span><span className="block text-[10px] leading-tight text-white/80">{active ? `${job.processed_count || 0}/${total} appels · ${progress}%` : `${total} appel${total > 1 ? "s" : ""} · ${failed ? `${failed} échec${failed > 1 ? "s" : ""}` : "terminés"}`}</span></span>{open ? <ChevronDown className="h-3.5 w-3.5 text-white/80" /> : <ChevronUp className="h-3.5 w-3.5 text-white/80" />}</button>{!active ? <button type="button" onClick={(event) => { event.stopPropagation(); onDismiss(); }} className="mr-1.5 rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Masquer le traitement terminé"><X className="h-3.5 w-3.5" /></button> : null}</div>
  </div>;
}
