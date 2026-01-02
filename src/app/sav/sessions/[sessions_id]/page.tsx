"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const WEBHOOK_BASE =
  process.env.NEXT_PUBLIC_WEBHOOK_URL || "http://localhost:8000";

const buildUrl = (path: string) => new URL(path, API_BASE).toString();
const buildWebhookUrl = (path: string) => new URL(path, WEBHOOK_BASE).toString();
const normalizeApiUrl = (u?: string | null) => {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return buildUrl(u); // u est un path type "/sessions/..."
};

type SessionPhoto = {
  id: string; // ⚠️ dans la session: "p1", "p2"... / dans l'UI chantier: "sessionid__p1"
  url: string;
  timestamp?: number;
  [key: string]: any;

  // champs ajoutés côté UI (chantier multi-sessions)
  __session_id?: string; // session d'origine
  __photo_id?: string; // photo id d'origine ("p1")
};

type NoteAsset = {
  asset_id: string;
  kind?: string;
  filename?: string;
  relpath?: string;
  created_at?: number;
  asset_url?: string; // convenience côté UI (GET url)
};

type SessionSavItem = {
  note_id: string;
  title?: string;
  body?: string;
  assets?: NoteAsset[];
  created_at?: number;
  updated_at?: number;
  [key: string]: any;
};

type SessionDetail = {
  session_id: string;

  // legacy / v1
  installateur?: {
    user_id?: string;
    nom?: string;
    societe?: string;
    email?: string;
    phone?: string;
  };
  chantier?: { ref?: string };
  produit?: { code?: string; label?: string; sheet?: string };

  // v2
  chantier_id?: string | null;
  report_recipient_number?: string | null;
  description_installateur?: string | null;
  numero_serie?: string | null;
  notes_sav?: string | null;

  // NEW (sessions_updated.py)
  notes_sav_items?: SessionSavItem[];

  sender_numbers?: string[];
  status?: string;

  created_at?: number;
  updated_at?: number;
  last_published_at?: number | null;
  last_published_by?: string | null;

  photos?: SessionPhoto[];

  photo_drafts?: Record<string, any>;

  public_url?: string | null;
  public_slug?: string | null;

  [key: string]: any;
};

type Chantier = {
  chantier_id: string;
  status?: string;
  title?: string;
  created_at?: number;
  updated_at?: number;

  participants?: {
    primary_sender_phone?: string | null;
    known_phones?: string[];
    report_recipient_phone?: string | null;
  };

  context?: {
    reference_chantier?: string | null;
    produit?: any;
    numero_serie?: string | null;
    installateur?: any;
    description_installateur?: string | null;
  };

  outputs?: {
    notes_sav?: any[]; // on stocke nos SavNote[]
    note_sav_generale?: { text?: string; updated_at?: number };
  };

  links?: { session_ids?: string[] };

  publication?: any;

  [key: string]: any;
};

type ProductOption = { code: string; label: string };

type Toast = { type: "success" | "error"; message: string };

type SavNote = {
  id: string; // stable note_id
  title?: string; // optional
  text: string;
  photo_ids: string[];

  // NEW: assets rattachés à la note (tech visuals, schémas…)
  assets?: NoteAsset[];

  updated_at?: number;
  created_at?: number;
};

type SavItemResponse =
  | {
      kind: "chantier";
      chantier_id: string;
      chantier: Chantier;
      sessions: SessionDetail[];
      session_count: number;
    }
  | {
      kind: "unattached_session";
      chantier_id: null;
      chantier: null;
      sessions: SessionDetail[];
      session_count: 1;
    }
  | { error: string };

function formatTs(ts?: number | null) {
  if (!ts) return "—";
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

function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function deepMerge<T extends Record<string, any>>(base: T, patch: any): T {
  if (!patch || typeof patch !== "object") return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = (base as any)?.[k];
    if (pv && typeof pv === "object" && !Array.isArray(pv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out as T;
}


// debounce helpers
function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delayMs: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(cb);
  latest.current = cb;

  return useCallback(
    (...args: Parameters<T>) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => {
        latest.current(...args);
      }, delayMs);
    },
    [delayMs]
  );
}

function pickMostRecentSession(sessions: SessionDetail[]): SessionDetail | null {
  if (!sessions || sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => {
    const au = typeof a.updated_at === "number" ? a.updated_at : 0;
    const bu = typeof b.updated_at === "number" ? b.updated_at : 0;
    if (bu !== au) return bu - au;
    // fallback: created_at
    const ac = typeof a.created_at === "number" ? a.created_at : 0;
    const bc = typeof b.created_at === "number" ? b.created_at : 0;
    return bc - ac;
  });
  return sorted[0] || null;
}

function buildChantierAggregatedPhotos(
  sessions: SessionDetail[]
): { photos: SessionPhoto[]; idMap: Record<string, { session_id: string; photo_id: string }> } {
  const all: SessionPhoto[] = [];
  const idMap: Record<string, { session_id: string; photo_id: string }> = {};

  // tri sessions pour un ordre "humain" (par created_at puis updated_at)
  const orderedSessions = [...sessions].sort((a, b) => {
    const ac = typeof a.created_at === "number" ? a.created_at : 0;
    const bc = typeof b.created_at === "number" ? b.created_at : 0;
    if (ac !== bc) return ac - bc;
    const au = typeof a.updated_at === "number" ? a.updated_at : 0;
    const bu = typeof b.updated_at === "number" ? b.updated_at : 0;
    return au - bu;
  });

  for (const s of orderedSessions) {
    const sid = s.session_id;
    const photos = (s.photos || []) as SessionPhoto[];
    for (const p of photos) {
      const pid = p.id;
      if (!sid || !pid) continue;

      const composite = `${sid}__${pid}`;

      // si collision (très improbable) -> suffix
      let finalId = composite;
      let k = 2;
      while (idMap[finalId]) {
        finalId = `${composite}__${k++}`;
      }

      idMap[finalId] = { session_id: sid, photo_id: pid };
      all.push({
        ...p,
        id: finalId,
        __session_id: sid,
        __photo_id: pid,
      });
    }
  }

  return { photos: all, idMap };
}

function mergeAssetsFromBackendNotes(
  localNotes: SavNote[],
  backendItems: SessionSavItem[] | undefined,
  sessionId: string
): SavNote[] {
  if (!backendItems || !Array.isArray(backendItems) || !sessionId) return localNotes;

  const map: Record<string, NoteAsset[]> = {};
  for (const it of backendItems) {
    const nid = it?.note_id;
    if (!nid) continue;

    const assets = (it.assets || []).map((a) => {
      const fallbackPath = `/sessions/${encodeURIComponent(sessionId)}/notes/${encodeURIComponent(
        nid
      )}/assets/${encodeURIComponent(a.asset_id)}`;

      const normalizedUrl = a.asset_url
        ? a.asset_url.startsWith("http://") || a.asset_url.startsWith("https://")
          ? a.asset_url
          : buildUrl(a.asset_url)
        : buildUrl(fallbackPath);

      return {
        ...a,
        asset_url: normalizedUrl,
      };
    });

    map[nid] = assets;
  }

  return localNotes.map((n) => {
    const backendAssets = map[n.id];
    if (!backendAssets || backendAssets.length === 0) return n;

    // merge stable by asset_id
    const existing = new Map((n.assets || []).map((a) => [a.asset_id, a]));
    for (const a of backendAssets) existing.set(a.asset_id, { ...existing.get(a.asset_id), ...a });

    return { ...n, assets: Array.from(existing.values()) };
  });
}

export default function SavSessionDetailPage() {
  const params = useParams() as { sessions_id?: string | string[] };

  const rawKey = Array.isArray(params.sessions_id)
    ? params.sessions_id[0]
    : params.sessions_id;

  const key = rawKey ? decodeURIComponent(rawKey) : "";

  // This is the ACTUAL loaded session_id (can differ from URL key if URL key is chantier_id)
  const [loadedSessionId, setLoadedSessionId] = useState<string>("");

  const [detail, setDetail] = useState<SessionDetail | null>(null);

  // NEW: chantier payload (source-of-truth si kind=chantier)
  const [chantier, setChantier] = useState<Chantier | null>(null);

  const [chantierMeta, setChantierMeta] = useState<{
    kind: "chantier" | "unattached_session" | null;
    chantier_id: string | null;
    session_count: number;
    session_ids: string[];
  }>({ kind: null, chantier_id: null, session_count: 0, session_ids: [] });

  // NEW: chantier multi-sessions photo mapping (UI ids -> backend ids)
  const [chantierPhotoIdMap, setChantierPhotoIdMap] = useState<
    Record<string, { session_id: string; photo_id: string }>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  // Actions
  const [author, setAuthor] = useState<string>("Xavier PERGE");
  const [publishing, setPublishing] = useState(false);

  // Inputs selection
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>({});

  // Meta fields (editable)
  const [reportRecipient, setReportRecipient] = useState<string>("");
  const [descriptionInstallateur, setDescriptionInstallateur] = useState<string>("");
  const [numeroSerie, setNumeroSerie] = useState<string>("");

  // Contexte chantier (editable via toggle)
  const [isEditingContext, setIsEditingContext] = useState(false);

  const [draftInstallerName, setDraftInstallerName] = useState("");
  const [draftInstallerCompany, setDraftInstallerCompany] = useState("");
  const [draftInstallerPhone, setDraftInstallerPhone] = useState("");

  const [draftReferenceChantier, setDraftReferenceChantier] = useState("");
  const [draftProductCode, setDraftProductCode] = useState<string>("");

  // CRM search (top 5)
  const [crmQuery, setCrmQuery] = useState("");
  const [crmResults, setCrmResults] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // Products list (normée)
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Notes SAV (outputs)
  const [notes, setNotes] = useState<SavNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [notePhotos, setNotePhotos] = useState<string[]>([]);
  const [uploadingVisual, setUploadingVisual] = useState(false);

  // ✅ NEW: quel visuel est sélectionné pour l’aperçu (par note)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Optional global note (separate from notes list)
  const [globalSavNote, setGlobalSavNote] = useState<string>("");

  // Fullscreen viewer
  const [fullscreen, setFullscreen] = useState<{
    kind: "photo" | "note_visual";
    photoUrl: string;
    title: string;
  } | null>(null);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load products (for dropdown)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(buildUrl("/products"));
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: ProductOption[] = Array.isArray(data)
          ? data
              .map((p: any) => ({ code: String(p.code || ""), label: String(p.label || p.code || "") }))
              .filter((p: any) => p.code)
          : [];
        setProducts(list);
      } catch {
        // ignore (dropdown can fallback to free text later)
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const photos: SessionPhoto[] = useMemo(() => detail?.photos || [], [detail]);

  const selectedPhoto = useMemo(() => {
    if (!photos.length) return null;
    const pid = selectedPhotoId || photos[0].id;
    return photos.find((p) => p.id === pid) || photos[0];
  }, [photos, selectedPhotoId]);

  const includedPhotoIds = useMemo(() => {
    const ids = photos.map((p) => p.id);
    return ids.filter((id) => includeMap[id] !== false);
  }, [photos, includeMap]);

  // chips: we show included photos, click to preview
  const previewChips = includedPhotoIds;

  const isMultiSessionChantier = useMemo(() => {
    return chantierMeta.kind === "chantier" && (chantierMeta.session_count || 0) > 1;
  }, [chantierMeta]);

  const isChantierMode = chantierMeta.kind === "chantier" && Boolean(chantierMeta.chantier_id);



  // --- Load (UNIFIED): /sav/item/{key} ---
  useEffect(() => {
    if (!key) {
      setLoading(false);
      setError("Paramètre sessions_id manquant dans l’URL.");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      setDetail(null);
      setChantier(null);
      setLoadedSessionId("");
      setChantierMeta({ kind: null, chantier_id: null, session_count: 0, session_ids: [] });

      setChantierPhotoIdMap({});
      setIncludeMap({});
      setSelectedPhotoId(null);

      try {
        const res = await fetch(buildUrl(`/sav/item/${encodeURIComponent(key)}`));
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Erreur API (${res.status}) : ${txt || "Impossible de charger"}`);
        }

        const data = (await res.json()) as SavItemResponse;

        if ((data as any)?.error) {
          throw new Error(`Introuvable (${key}).`);
        }

        if (cancelled) return;

        const sessions = (data as any).sessions as SessionDetail[];
        if (!sessions || sessions.length === 0) {
          throw new Error("Aucune session trouvée pour cette référence.");
        }

        const kind = (data as any).kind as "chantier" | "unattached_session";
        const chantierId = (data as any).chantier_id ?? null;
        const chantierObj = (data as any).chantier ?? null;

        setChantierMeta({
          kind,
          chantier_id: chantierId,
          session_count: (data as any).session_count ?? sessions.length,
          session_ids: sessions.map((s) => s.session_id).filter(Boolean),
        });

        if (kind === "chantier") {
          setChantier(chantierObj as Chantier);
        }

        // session “pilote” = la plus récente (sert pour publish, drafts, assets endpoints etc.)
        const chosen = pickMostRecentSession(sessions) || sessions[0];
        if (!chosen || !chosen.session_id) {
          throw new Error("Session pilote introuvable.");
        }

        // Photos: si chantier -> agrégation multi-sessions
        let finalDetail: SessionDetail = chosen;
        let finalPhotos = (chosen.photos || []) as SessionPhoto[];
        let idMap: Record<string, { session_id: string; photo_id: string }> = {};

        if (kind === "chantier" && sessions.length >= 1) {
          const agg = buildChantierAggregatedPhotos(sessions);
          finalPhotos = agg.photos;
          idMap = agg.idMap;

          finalDetail = {
            ...chosen,
            photos: finalPhotos,
          };
        }

        setDetail(finalDetail);
        setLoadedSessionId(chosen.session_id);
        setChantierPhotoIdMap(idMap);

        if (finalPhotos.length) {
          setSelectedPhotoId((prev) => prev || finalPhotos[0].id);
        }

        // init includeMap:
        const backendDrafts = (chosen as any).photo_drafts || {};
        const nextInclude: Record<string, boolean> = {};
        for (const ph of finalPhotos) {
          const originalPhotoId = ph.__photo_id || ph.id;
          const originSessionId = ph.__session_id || chosen.session_id;

          if (originSessionId === chosen.session_id) {
            const d = backendDrafts[originalPhotoId] || {};
            if (typeof d.include_in_report === "boolean") nextInclude[ph.id] = d.include_in_report;
            else nextInclude[ph.id] = true;
          } else {
            // pour les autres sessions: MVP = inclure par défaut
            nextInclude[ph.id] = true;
          }
        }
        setIncludeMap(nextInclude);

        // ---------------------------------------------------------
        // Init META fields (source-of-truth chantier si applicable)
        // ---------------------------------------------------------
        const defaultRecipientFromSession =
          (chosen.report_recipient_number || "").trim() ||
          (chosen.installateur?.user_id || "").trim() ||
          ((chosen.sender_numbers || [])[0] || "").trim();

        const chantierRecipient =
          kind === "chantier"
            ? ((chantierObj as any)?.participants?.report_recipient_phone || "").toString().trim()
            : "";

        const chantierDesc =
          kind === "chantier"
            ? ((chantierObj as any)?.context?.description_installateur || "").toString()
            : "";

        const chantierSerie =
          kind === "chantier"
            ? ((chantierObj as any)?.context?.numero_serie || "").toString()
            : "";

        setReportRecipient(chantierRecipient || defaultRecipientFromSession);
        setDescriptionInstallateur(
          kind === "chantier"
            ? chantierDesc
            : (chosen.description_installateur || "").toString()
        );
        setNumeroSerie(
          kind === "chantier"
            ? chantierSerie
            : (chosen.numero_serie || "").toString()
        );

        // ---------------------------------------------------------
        // Notes SAV + note générale (chantier si applicable)
        // ---------------------------------------------------------
        let parsedNotes: SavNote[] = [];
        let parsedGlobal = "";

        if (kind === "chantier") {
          const outNotes = ((chantierObj as any)?.outputs?.notes_sav || []) as any[];
          if (Array.isArray(outNotes)) parsedNotes = outNotes as SavNote[];

          const g = (chantierObj as any)?.outputs?.note_sav_generale?.text;
          if (typeof g === "string") parsedGlobal = g;
        } else {
          // legacy session storage
          const rawNotes = chosen.notes_sav;
          if (rawNotes && rawNotes.trim()) {
            try {
              const obj = JSON.parse(rawNotes);
              if (Array.isArray(obj)) {
                parsedNotes = obj as SavNote[];
              } else if (obj && typeof obj === "object") {
                if (Array.isArray((obj as any).notes)) parsedNotes = (obj as any).notes;
                if (typeof (obj as any).global === "string") parsedGlobal = (obj as any).global;
              } else {
                parsedGlobal = rawNotes;
              }
            } catch {
              parsedGlobal = rawNotes;
            }
          }

          // merge backend note assets (session-only)
          parsedNotes = mergeAssetsFromBackendNotes(
            parsedNotes,
            (chosen as any).notes_sav_items,
            chosen.session_id
          );
        }

        setNotes(parsedNotes);
        setGlobalSavNote(parsedGlobal);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Erreur inattendue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const effectiveSessionId = loadedSessionId || key;

  // --- Persist session meta (PATCH /sessions/{id}) ---
  const patchSession = useCallback(
    async (patch: Partial<SessionDetail>) => {
      if (!effectiveSessionId) return;
      try {
        const res = await fetch(buildUrl(`/sessions/${encodeURIComponent(effectiveSessionId)}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`PATCH session (${res.status}) : ${txt || "Erreur"}`);
        }

        // optimistic update UI
        setDetail((prev) => (prev ? deepMerge(prev as any, patch) : prev));
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message:
            (err as any)?.message ||
            "Erreur lors de la sauvegarde des informations chantier.",
        });
      }
    },
    [effectiveSessionId]
  );

  // --- Persist chantier meta (PATCH /chantiers/{id}) ---
  const patchChantier = useCallback(
    async (patch: any) => {
      if (!chantierMeta.chantier_id) return;
      try {
        const res = await fetch(buildUrl(`/chantiers/${encodeURIComponent(chantierMeta.chantier_id)}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`PATCH chantier (${res.status}) : ${txt || "Erreur"}`);
        }

        // optimistic update UI
        setChantier((prev) => (prev ? deepMerge(prev as any, patch) : prev));
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message:
            (err as any)?.message ||
            "Erreur lors de la sauvegarde du chantier.",
        });
      }
    },
    [chantierMeta.chantier_id]
  );

  const debouncedPatchSession = useDebouncedCallback(patchSession, 600);
  const debouncedPatchChantier = useDebouncedCallback(patchChantier, 600);

  const debouncedCrmSearch = useDebouncedCallback(async (q: string) => {
    const query = q.trim();
    if (!query) {
      setCrmResults([]);
      return;
    }
    try {
      setCrmLoading(true);
      const res = await fetch(buildUrl(`/contacts/search?q=${encodeURIComponent(query)}`));
      if (!res.ok) {
        setCrmResults([]);
        return;
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setCrmResults(arr.slice(0, 5));
    } catch {
      setCrmResults([]);
    } finally {
      setCrmLoading(false);
    }
  }, 250);

  useEffect(() => {
    debouncedCrmSearch(crmQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmQuery]);


  const displayInstaller = useMemo(() => {
    const fromChantier = (chantier as any)?.context?.installateur;
    return {
      nom: (isChantierMode ? fromChantier?.nom : detail?.installateur?.nom) || "",
      societe: (isChantierMode ? fromChantier?.societe : detail?.installateur?.societe) || "",
      phone:
        (isChantierMode ? fromChantier?.phone : detail?.installateur?.phone) ||
        detail?.installateur?.user_id ||
        reportRecipient ||
        "",
    };
  }, [isChantierMode, chantier, detail, reportRecipient]);

  const displayReferenceChantier = useMemo(() => {
    return (
      (chantier as any)?.context?.reference_chantier ||
      detail?.chantier?.ref ||
      detail?.chantier_id ||
      chantierMeta.chantier_id ||
      ""
    );
  }, [chantier, detail, chantierMeta]);

  const displayProductLabel = useMemo(() => {
    const fromChantier = (chantier as any)?.context?.produit;
    return (
      fromChantier?.label ||
      detail?.produit?.label ||
      detail?.produit?.code ||
      "—"
    );
  }, [chantier, detail]);

  const startEditContext = useCallback(() => {
    setDraftInstallerName(displayInstaller.nom || "");
    setDraftInstallerCompany(displayInstaller.societe || "");
    setDraftInstallerPhone(displayInstaller.phone || "");
    setDraftReferenceChantier(displayReferenceChantier || "");
    const code = ((chantier as any)?.context?.produit?.code || detail?.produit?.code || "") as string;
    setDraftProductCode(code || "");
    setCrmQuery("");
    setCrmResults([]);
    setIsEditingContext(true);
  }, [displayInstaller, displayReferenceChantier, chantier, detail]);

  const cancelEditContext = useCallback(() => {
    setIsEditingContext(false);
    setCrmQuery("");
    setCrmResults([]);
  }, []);

  const saveEditContext = useCallback(async () => {
    if (!isChantierMode || !chantierMeta.chantier_id) {
      setToast({ type: "error", message: "Cette session n'est pas encore rattachée à un chantier." });
      return;
    }

    const prod = draftProductCode
      ? products.find((p) => p.code === draftProductCode) || { code: draftProductCode, label: draftProductCode }
      : null;

    const patch = {
      context: {
        installateur: {
          nom: draftInstallerName || null,
          societe: draftInstallerCompany || null,
          phone: draftInstallerPhone || null,
          source: "crm_or_manual",
        },
        reference_chantier: draftReferenceChantier || null,
        produit: prod ? { code: prod.code, label: prod.label } : null,
      },
    };

    await patchChantier(patch);
    setIsEditingContext(false);
    setToast({ type: "success", message: "Contexte enregistré." });
  }, [
    isChantierMode,
    chantierMeta.chantier_id,
    draftInstallerName,
    draftInstallerCompany,
    draftInstallerPhone,
    draftReferenceChantier,
    draftProductCode,
    products,
    patchChantier,
  ]);


  // Save meta fields (route depending on kind)
  useEffect(() => {
    if (!detail) return;

    if (isChantierMode) {
      debouncedPatchChantier({
        participants: {
          report_recipient_phone: reportRecipient,
        },
        context: {
          description_installateur: descriptionInstallateur,
          numero_serie: numeroSerie,
        },
      });
      return;
    }

    debouncedPatchSession({
      report_recipient_number: reportRecipient,
      description_installateur: descriptionInstallateur,
      numero_serie: numeroSerie,
    } as any);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRecipient, descriptionInstallateur, numeroSerie, isChantierMode]);

  // --- Persist notes ---
  const saveNotesToBackend = useCallback(async () => {
    if (isChantierMode) {
      const now = Math.floor(Date.now() / 1000);
      await patchChantier({
        outputs: {
          notes_sav: notes,
          note_sav_generale: { text: globalSavNote || "", updated_at: now },
        },
      });
      return;
    }

    // legacy session storage
    const payload = JSON.stringify({
      notes,
      global: globalSavNote || "",
      v: 1,
    });
    await patchSession({ notes_sav: payload } as any);
  }, [notes, globalSavNote, patchSession, patchChantier, isChantierMode]);

  const debouncedSaveNotes = useDebouncedCallback(saveNotesToBackend, 700);

  useEffect(() => {
    if (!detail) return;
    debouncedSaveNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, globalSavNote, isChantierMode]);

  // --- Include in report ---
  const saveIncludeDraft = useCallback(
    async (uiPhotoId: string, include: boolean) => {
      if (!effectiveSessionId) return;

      const mapped = chantierPhotoIdMap[uiPhotoId];
      const targetSessionId = mapped?.session_id || effectiveSessionId;
      const targetPhotoId = mapped?.photo_id || uiPhotoId;

      try {
        await fetch(
          buildUrl(
            `/sessions/${encodeURIComponent(targetSessionId)}/photos/${encodeURIComponent(targetPhotoId)}/draft`
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ include_in_report: include }),
          }
        );
      } catch (err) {
        console.warn("Draft include save failed", err);
      }
    },
    [effectiveSessionId, chantierPhotoIdMap]
  );

  const toggleInclude = useCallback(
    (photoId: string) => {
      setIncludeMap((prev) => {
        const next = { ...prev, [photoId]: prev[photoId] === false ? true : false };
        saveIncludeDraft(photoId, next[photoId] !== false);
        return next;
      });
    },
    [saveIncludeDraft]
  );

  // --- Notes: edit helpers ---
  const activeNote = useMemo(
    () => (activeNoteId ? notes.find((n) => n.id === activeNoteId) || null : null),
    [notes, activeNoteId]
  );

  const startNewNote = useCallback(() => {
    setActiveNoteId(null);
    setNoteText("");
    setNotePhotos(includedPhotoIds.length ? includedPhotoIds.slice(0, 3) : []);
    setSelectedAssetId(null);
  }, [includedPhotoIds]);

  useEffect(() => {
    if (!detail) return;
    if (notes.length === 0 && activeNoteId === null && noteText === "" && notePhotos.length === 0) {
      startNewNote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const openNoteForEdit = useCallback(
    (id: string) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      setActiveNoteId(id);
      setNoteText(n.text || "");
      setNotePhotos(n.photo_ids || []);
      if (n.photo_ids?.length) setSelectedPhotoId(n.photo_ids[0]);
      // ✅ par défaut : sélectionner le premier visuel de cette note
      const first = (n.assets || [])[0]?.asset_id || null;
      setSelectedAssetId(first);
    },
    [notes]
  );

  const upsertNote = useCallback(() => {
    const cleanedText = (noteText || "").trim();
    if (!cleanedText) {
      setToast({ type: "error", message: "Écris au moins une recommandation SAV dans la note." });
      return;
    }

    const cleanedPhotos = Array.from(new Set((notePhotos || []).filter(Boolean)));
    const now = Math.floor(Date.now() / 1000);

    if (activeNoteId) {
      const exists = notes.some((n) => n.id === activeNoteId);
      if (!exists) {
        const newNote: SavNote = {
          id: activeNoteId,
          text: cleanedText,
          photo_ids: cleanedPhotos,
          assets: [],
          created_at: now,
          updated_at: now,
        };
        setNotes((prev) => [newNote, ...prev]);
        setToast({ type: "success", message: "Note SAV créée." });
        return;
      }

      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId
            ? {
                ...n,
                text: cleanedText,
                photo_ids: cleanedPhotos,
                updated_at: now,
              }
            : n
        )
      );
      setToast({ type: "success", message: "Note SAV mise à jour." });
      return;
    }

    const id = uid("note");
    const newNote: SavNote = {
      id,
      text: cleanedText,
      photo_ids: cleanedPhotos,
      assets: [],
      created_at: now,
      updated_at: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(id);
    setSelectedAssetId(null);
    setToast({ type: "success", message: "Note SAV créée." });
  }, [activeNoteId, notePhotos, noteText, notes]);

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNoteId === id) {
        startNewNote();
      }
      setToast({ type: "success", message: "Note supprimée." });
    },
    [activeNoteId, startNewNote]
  );

  // --- Note visual upload ---
  const handleChooseNoteVisual = useCallback(() => {
    const el = document.getElementById("note-visual-input") as HTMLInputElement | null;
    if (el) el.click();
  }, []);

  const handleNoteVisualChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !effectiveSessionId) return;

      setUploadingVisual(true);
      try {
        // Ensure we have a stable note_id even before saving text
        let noteId = activeNoteId;
        if (!noteId) {
          noteId = uid("note_tmp");
          setActiveNoteId(noteId);
        }

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch(
          buildUrl(
            `/sessions/${encodeURIComponent(effectiveSessionId)}/notes/${encodeURIComponent(
              noteId
            )}/assets?kind=${encodeURIComponent("tech_visual")}`
          ),
          { method: "POST", body: fd }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Upload visuel (${res.status}) : ${txt || "Erreur"}`);
        }

        const data = (await res.json()) as any;
        const asset = data?.asset as NoteAsset | undefined;
        const assetUrlPath = data?.asset_url as string | undefined;

        if (!asset || !asset.asset_id) {
          throw new Error("Upload OK mais réponse incomplète (asset manquant).");
        }

        const fullAssetUrl = assetUrlPath
          ? buildUrl(assetUrlPath)
          : buildUrl(
              `/sessions/${encodeURIComponent(effectiveSessionId)}/notes/${encodeURIComponent(
                noteId
              )}/assets/${encodeURIComponent(asset.asset_id)}`
            );

        setNotes((prev) => {
          const idx = prev.findIndex((n) => n.id === noteId);
          if (idx === -1) {
            const now = Math.floor(Date.now() / 1000);
            const placeholder: SavNote = {
              id: noteId!,
              text: noteText || "",
              photo_ids: notePhotos || [],
              assets: [{ ...asset, asset_url: fullAssetUrl }],
              created_at: now,
              updated_at: now,
            };
            return [placeholder, ...prev];
          }

          const target = prev[idx];
          const existing = new Map((target.assets || []).map((a) => [a.asset_id, a]));
          existing.set(asset.asset_id, { ...asset, asset_url: fullAssetUrl });

          const updated: SavNote = {
            ...target,
            assets: Array.from(existing.values()),
            updated_at: Math.floor(Date.now() / 1000),
          };

          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        });

        // ✅ si aucun visuel sélectionné, on sélectionne celui qu’on vient d’ajouter
        setSelectedAssetId((prev) => prev || asset.asset_id);

        setToast({ type: "success", message: "Visuel joint téléversé." });
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message: (err as any)?.message || "Erreur upload visuel joint.",
        });
      } finally {
        setUploadingVisual(false);
        e.target.value = "";
      }
    },
    [activeNoteId, effectiveSessionId, noteText, notePhotos]
  );

  // ✅ suppression d’un visuel (backend + UI)
  const deleteNoteAsset = useCallback(
    async (noteId: string, assetId: string) => {
      if (!effectiveSessionId) return;

      try {
        const res = await fetch(
          buildUrl(
            `/sessions/${encodeURIComponent(effectiveSessionId)}/notes/${encodeURIComponent(
              noteId
            )}/assets/${encodeURIComponent(assetId)}`
          ),
          { method: "DELETE" }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Suppression visuel (${res.status}) : ${txt || "Erreur"}`);
        }

        // update UI
        setNotes((prev) =>
          prev.map((n) =>
            n.id !== noteId ? n : { ...n, assets: (n.assets || []).filter((a) => a.asset_id !== assetId) }
          )
        );

        // si on supprime celui sélectionné, on repointe sur le premier restant
        setSelectedAssetId((prev) => {
          if (prev !== assetId) return prev;
          const n = notes.find((x) => x.id === noteId);
          const remaining = (n?.assets || []).filter((a) => a.asset_id !== assetId);
          return remaining[0]?.asset_id || null;
        });

        setToast({ type: "success", message: "Visuel supprimé." });
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message: (err as any)?.message || "Erreur suppression visuel.",
        });
      }
    },
    [effectiveSessionId, notes]
  );

  // Current note assets (for preview)
  const activeNoteAssets = useMemo(() => {
    if (!activeNoteId) return [];
    const n = notes.find((x) => x.id === activeNoteId);
    return (n?.assets || []).filter(Boolean);
  }, [activeNoteId, notes]);

  // ✅ garder selectedAssetId cohérent quand on change de note / quand liste assets change
  useEffect(() => {
    if (!activeNoteId) {
      setSelectedAssetId(null);
      return;
    }
    if (activeNoteAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }
    if (!selectedAssetId || !activeNoteAssets.some((a) => a.asset_id === selectedAssetId)) {
      setSelectedAssetId(activeNoteAssets[0].asset_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId, activeNoteAssets.length]);

  const selectedActiveAsset = useMemo(() => {
    if (!activeNoteAssets.length) return null;
    if (selectedAssetId) {
      return activeNoteAssets.find((a) => a.asset_id === selectedAssetId) || activeNoteAssets[0];
    }
    return activeNoteAssets[0];
  }, [activeNoteAssets, selectedAssetId]);

  const selectedActiveAssetUrl = useMemo(() => {
    const a = selectedActiveAsset;
    if (!a) return null;
    return normalizeApiUrl(a.asset_url) || null;
  }, [selectedActiveAsset]);

  // --- Publish (⚠️ MVP: on bloque la publication chantier multi-sessions) ---
  // --- Publish (chantier-first si chantier mode) ---
  const handlePublish = useCallback(async () => {
    if (!detail) return;

    // ----------------------------
    // ✅ CHANTIER-FIRST (nouveau)
    // ----------------------------
    if (isChantierMode && chantierMeta.chantier_id) {
      setPublishing(true);
      try {
        const res = await fetch(
          buildUrl(`/chantiers/${encodeURIComponent(chantierMeta.chantier_id)}/publish`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              author: author || "Service Technique",
            }),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Erreur publication chantier (${res.status}) : ${txt || "Impossible de publier"}`);
        }

        const data = (await res.json()) as any;

        // ✅ met à jour le chantier en local pour récupérer publication.report_public_url etc.
        setChantier((prev) => {
          const pubPatch = {
            publication: {
              ...(prev?.publication || {}),
              report_public_slug: data?.public_slug || prev?.publication?.report_public_slug,
              report_public_url: data?.public_url || prev?.publication?.report_public_url,
              last_published_at: data?.last_published_at || prev?.publication?.last_published_at,
              last_published_by: data?.last_published_by || prev?.publication?.last_published_by,
            },
            status: data?.status || prev?.status,
            updated_at: data?.updated_at || prev?.updated_at,
          };
          return prev ? deepMerge(prev as any, pubPatch) : (pubPatch as any);
        });

        // (Optionnel) tu peux aussi mettre un mini patch sur `detail` si tu veux refléter "Publié" dans le badge status
        setDetail((prev) => (prev ? { ...prev, status: "PUBLIÉ" } : prev));

        // Notify WhatsApp (best-effort)
        try {
          const notifyRes = await fetch(buildWebhookUrl("/notify-chantier-published"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chantier_id: chantierMeta.chantier_id,
              author: author || "Service Technique",
              public_url: data?.public_url, // optionnel (webhook peut aussi relire chantier.publication.report_public_url)
            }),
          });

          if (!notifyRes.ok) {
            const txt = await notifyRes.text();
            console.warn("Notify WhatsApp chantier failed:", notifyRes.status, txt);
          }
        } catch (notifyErr) {
          console.error("Erreur envoi WhatsApp chantier:", notifyErr);
        }

        setToast({ type: "success", message: "Rapport chantier publié." });
        return;
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message: (err as any)?.message || "Erreur lors de la publication chantier.",
        });
        return;
      } finally {
        setPublishing(false);
      }
    }

    // ----------------------------
    // Legacy: SESSION publish (inchangé)
    // ----------------------------
    if (isMultiSessionChantier) {
      setToast({
        type: "error",
        message:
          "Chantier multi-sessions : publication non supportée pour l’instant. (On affiche bien toutes les photos, mais le rapport reste lié à une session.)",
      });
      return;
    }

    if (!effectiveSessionId) return;

    const photosList = detail.photos || [];
    const included = photosList.filter((p) => includeMap[p.id] !== false);

    if (!included.length) {
      setToast({ type: "error", message: "Aucune photo sélectionnée pour le rapport." });
      return;
    }

    setPublishing(true);

    try {
      const payloadItems = included.map((p) => ({
        photo_id: p.__photo_id || p.id,
        commentaire: "",
        annotated_path: null,
        annotated_url: null,
      }));

      const res = await fetch(buildUrl(`/sessions/${encodeURIComponent(effectiveSessionId)}/publish`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author || "Service Technique",
          items: payloadItems,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur publication (${res.status}) : ${txt || "Impossible de publier"}`);
      }

      const updated = (await res.json()) as SessionDetail;
      setDetail(updated);

      // Notify WhatsApp (best-effort)
      try {
        await fetch(buildWebhookUrl("/notify-session-published"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: effectiveSessionId,
            author: author || "Service Technique",
          }),
        });
      } catch (notifyErr) {
        console.error("Erreur envoi WhatsApp:", notifyErr);
      }

      setToast({ type: "success", message: "Rapport publié." });
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        message: (err as any)?.message || "Erreur lors de la publication.",
      });
    } finally {
      setPublishing(false);
    }
  }, [author, detail, includeMap, effectiveSessionId, isMultiSessionChantier, isChantierMode, chantierMeta.chantier_id]);

  const handlePreviewReport = useCallback(() => {
    // ✅ chantier-first : on preview le rapport chantier
    const chantierUrl = (chantier as any)?.publication?.report_public_url;
    const chantierSlug = (chantier as any)?.publication?.report_public_slug;

    if (chantierUrl) {
      window.open(chantierUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (chantierSlug) {
      window.open(`/r/${chantierSlug}`, "_blank", "noopener,noreferrer");
      return;
    }

    // legacy session preview
    if (detail?.public_url) {
      window.open(detail.public_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (detail?.public_slug) {
      const guess = `/sav/public/${detail.public_slug}`;
      window.open(guess, "_blank", "noopener,noreferrer");
      return;
    }

    setToast({
      type: "error",
      message: "Aucun lien public disponible. Publie une première fois pour générer le rapport.",
    });
  }, [detail, chantier]);

  const toggleNotePhoto = useCallback((pid: string) => {
    setNotePhotos((prev) => {
      const set = new Set(prev);
      if (set.has(pid)) set.delete(pid);
      else set.add(pid);
      return Array.from(set);
    });
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100">
      {/* Top header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-neutral-900">Visual Assistant</span>
            <span className="text-xs text-neutral-500">PERGE · SAV</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {humanStatus(detail?.status)}
            </span>

            <button
              type="button"
              onClick={handlePreviewReport}
              className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
            >
              Aperçu
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !detail || !photos.length}
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white px-3 py-1.5 text-xs hover:bg-black disabled:opacity-50"
              title={
                isMultiSessionChantier
                  ? "Publication chantier multi-sessions non supportée (MVP)"
                  : undefined
              }
            >
              {publishing ? "Publication…" : "Publier"}
            </button>

            <Link
              href="/sav/sessions"
              className="text-neutral-500 hover:text-neutral-800 hover:underline"
            >
              ← Retour
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-4">
        {/* Page title */}
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Détail session SAV</h1>
            <p className="text-xs text-neutral-500">
              ID : <span className="font-mono">{key || "(session inconnue)"}</span>
              {loadedSessionId && loadedSessionId !== key && (
                <span className="text-neutral-400">
                  {" "}
                  · session : <span className="font-mono">{loadedSessionId}</span>
                </span>
              )}
            </p>

            {chantierMeta.kind && (
              <p className="text-[11px] text-neutral-400 mt-1">
                Type :{" "}
                {chantierMeta.kind === "chantier" ? "chantier" : "inbox"} · Sessions trouvées :{" "}
                {chantierMeta.session_count}
                {isMultiSessionChantier && (
                  <span className="text-neutral-400">
                    {" "}
                    · Photos affichées : agrégées (toutes les sessions)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <section className="bg-white shadow-sm rounded-xl p-4 flex flex-col gap-4">
          {loading && <div className="text-sm text-neutral-500">Chargement…</div>}

          {!loading && error && (
            <div className="text-sm text-red-600 whitespace-pre-line">{error}</div>
          )}

          {!loading && !error && detail && (
            <>
              {/* CONTEXTE CHANTIER */}
              <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pb-3 border-b border-neutral-200">
                {isChantierMode && (
                  <div className="absolute right-0 top-0 flex items-center gap-2">
                    {!isEditingContext ? (
                      <button
                        type="button"
                        onClick={startEditContext}
                        className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                      >
                        Modifier
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={cancelEditContext}
                          className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={saveEditContext}
                          className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white px-3 py-1.5 text-xs hover:bg-black"
                        >
                          Enregistrer
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Installateur
                  </div>
                  {!isEditingContext ? (
                    <>
                      <div className="font-medium text-neutral-900">
                        {displayInstaller.nom || "—"}
                      </div>
                      <div className="text-neutral-600">
                        {displayInstaller.societe || "—"}
                      </div>
                      <div className="text-neutral-500 text-xs">
                        {displayInstaller.phone || "—"}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        value={draftInstallerName}
                        onChange={(e) => setDraftInstallerName(e.target.value)}
                        placeholder="Nom"
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                      />
                      <input
                        value={draftInstallerCompany}
                        onChange={(e) => setDraftInstallerCompany(e.target.value)}
                        placeholder="Société"
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                      />
                      <input
                        value={draftInstallerPhone}
                        onChange={(e) => setDraftInstallerPhone(e.target.value)}
                        placeholder="+33…"
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                      />

                      <div className="pt-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Recherche CRM
                        </div>
                        <div className="relative">
                          <input
                            value={crmQuery}
                            onChange={(e) => setCrmQuery(e.target.value)}
                            placeholder="Rechercher un contact…"
                            className="mt-1 w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                          />

                          {(crmLoading || crmResults.length > 0) && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
                              {crmLoading && (
                                <div className="px-3 py-2 text-xs text-neutral-500">
                                  Recherche…
                                </div>
                              )}
                              {!crmLoading &&
                                crmResults.map((c: any) => {
                                  const label = c?.display || c?.name || c?.nom || c?.full_name || "Contact";
                                  const company = c?.company || c?.societe || "";
                                  const phone = c?.phone || c?.numero || c?.mobile || "";
                                  return (
                                    <button
                                      key={String(c?.id || c?.user_id || label + phone)}
                                      type="button"
                                      onClick={() => {
                                        setDraftInstallerName(String(c?.nom || c?.name || c?.full_name || label || ""));
                                        setDraftInstallerCompany(String(company || ""));
                                        setDraftInstallerPhone(String(phone || ""));
                                        setCrmQuery("");
                                        setCrmResults([]);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm"
                                    >
                                      <div className="font-medium text-neutral-900">
                                        {String(c?.nom || c?.name || c?.full_name || label || "")}
                                      </div>
                                      <div className="text-xs text-neutral-600">
                                        {company || "—"}{phone ? ` · ${phone}` : ""}
                                      </div>
                                    </button>
                                  );
                                })}
                              {!crmLoading && crmResults.length === 0 && crmQuery.trim() && (
                                <div className="px-3 py-2 text-xs text-neutral-500">
                                  Aucun résultat.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-[11px] text-neutral-400 mt-1">
                          Sélection top 5 · source : crm
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Chantier &amp; produit
                  </div>

                  {!isEditingContext ? (
                    <>
                      <div className="text-neutral-700 text-xs">
                        <span className="font-medium">Chantier :</span>{" "}
                        {displayReferenceChantier ||
                          detail.chantier_id ||
                          chantierMeta.chantier_id ||
                          "—"}
                      </div>
                      <div className="text-neutral-700 text-xs">
                        <span className="font-medium">Produit :</span> {displayProductLabel}
                      </div>
                      <div className="text-neutral-700 text-xs">
                        <span className="font-medium">Feuille :</span> {detail.produit?.sheet || "—"}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Référence chantier
                        </div>
                        <input
                          value={draftReferenceChantier}
                          onChange={(e) => setDraftReferenceChantier(e.target.value)}
                          placeholder="Ex : Dillabough"
                          className="mt-1 w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Produit
                        </div>
                        <select
                          value={draftProductCode}
                          onChange={(e) => setDraftProductCode(e.target.value)}
                          className="mt-1 w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                        >
                          <option value="">—</option>
                          {products.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-[11px] text-neutral-400 mt-1">
                          Liste normée · source : /products
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-neutral-500 text-[11px]">
                    Créée : {formatTs(detail.created_at)} · Maj : {formatTs(detail.updated_at)}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Publication
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Dernière :</span>{" "}
                    {detail.last_published_at ? formatTs(detail.last_published_at) : "—"}
                  </div>
                  <div className="text-neutral-700 text-xs">
                    <span className="font-medium">Par :</span> {detail.last_published_by || "—"}
                  </div>
                  <div className="text-neutral-500 text-[11px]">Photos reçues : {photos.length}</div>
                </div>
              </div>

              {/* META EDITABLE */}
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Description installateur
                  </div>
                  <input
                    value={descriptionInstallateur}
                    onChange={(e) => setDescriptionInstallateur(e.target.value)}
                    placeholder="Ex : chaudière en défaut, bruit anormal…"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Destinataire WhatsApp (modifiable)
                  </div>
                  <input
                    value={reportRecipient}
                    onChange={(e) => setReportRecipient(e.target.value)}
                    placeholder="+33…"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                  />
                  <div className="text-[11px] text-neutral-400">Le numéro qui recevra le rapport.</div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    N° de série
                  </div>
                  <input
                    value={numeroSerie}
                    onChange={(e) => setNumeroSerie(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                  />
                </div>
              </div>

              {/* INPUT STRIP */}
              <div className="pt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Photos reçues (input)
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Clique une photo pour prévisualiser · coche “Inclure” pour le rapport
                  </div>
                </div>

                <div className="mt-2 overflow-x-auto">
                  <div className="flex items-start gap-2 min-w-max pb-2">
                    {photos.map((p) => {
                      const isSelected = selectedPhoto?.id === p.id;
                      const isIncluded = includeMap[p.id] !== false;

                      const caption = (() => {
                        if (!isMultiSessionChantier) return p.__photo_id || p.id;
                        const sid = p.__session_id ? p.__session_id.slice(-6) : "—";
                        const pid = p.__photo_id || p.id;
                        return `${pid} · ${sid}`;
                      })();

                      return (
                        <div key={p.id} className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPhotoId(p.id)}
                            className={[
                              "w-[92px] h-[64px] rounded-xl overflow-hidden border bg-neutral-50 flex-none",
                              isSelected ? "border-neutral-900" : "border-neutral-200",
                            ].join(" ")}
                            title={`Ouvrir ${p.id}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.id} className="w-full h-full object-cover" />
                          </button>

                          <div className="w-[92px] flex items-center justify-between gap-2 px-1">
                            <div className="text-[10px] text-neutral-600 font-mono truncate" title={caption}>
                              {caption}
                            </div>

                            <label className="inline-flex items-center gap-1 text-[10px] text-neutral-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => toggleInclude(p.id)}
                              />
                              Inclure
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MAIN WORK AREA */}
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
                {/* Left: preview + create/edit note */}
                <div className="flex flex-col gap-3">
                  {/* chips line */}
                  <div className="text-[11px] text-neutral-500">
                    <span className="font-semibold uppercase tracking-wide text-neutral-400">
                      Prévisualisation & sélection
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {previewChips.length ? (
                        previewChips.map((pid) => (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setSelectedPhotoId(pid)}
                            className={[
                              "px-2 py-0.5 rounded-full text-[11px] border",
                              selectedPhoto?.id === pid
                                ? "bg-neutral-900 text-white border-neutral-900"
                                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50",
                            ].join(" ")}
                            title="Cliquer pour prévisualiser"
                          >
                            {pid}
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] text-neutral-500">Aucune photo incluse.</span>
                      )}
                    </div>
                  </div>

                  {/* big preview */}
                  <div className="relative bg-neutral-100 rounded-xl overflow-hidden aspect-[16/10] flex items-center justify-center">
                    {selectedPhoto ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedPhoto.url} alt={selectedPhoto.id} className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() =>
                            setFullscreen({
                              kind: "photo",
                              photoUrl: selectedPhoto.url,
                              title: `Photo ${selectedPhoto.__photo_id || selectedPhoto.id}`,
                            })
                          }
                          className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-md bg-neutral-900/70 text-neutral-50 text-xs"
                          title="Plein écran"
                        >
                          ⛶
                        </button>
                      </>
                    ) : (
                      <div className="text-sm text-neutral-600">Aucune photo</div>
                    )}
                  </div>

                  {/* NOTE EDITOR */}
                  <div className="border border-neutral-200 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Réponse / Note SAV (output)
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          Le tech répond au problème. Le visuel est optionnel (un ou plusieurs).
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={startNewNote}
                        className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                      >
                        + Nouvelle note
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Écris la recommandation SAV…"
                        className="w-full min-h-[110px] text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                      />

                      {/* Photo links selector */}
                      <div className="flex flex-col gap-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Photos liées à cette note
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {photos.map((p) => {
                            const on = notePhotos.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleNotePhoto(p.id)}
                                className={[
                                  "px-2 py-0.5 rounded-full text-[11px] border",
                                  on
                                    ? "bg-amber-100 border-amber-200 text-amber-900"
                                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                                ].join(" ")}
                                title="Associer/dissocier"
                              >
                                {p.__photo_id || p.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional visuals */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          Visuels joints (optionnels)
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            id="note-visual-input"
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleNoteVisualChange}
                          />

                          <button
                            type="button"
                            onClick={handleChooseNoteVisual}
                            disabled={uploadingVisual}
                            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
                          >
                            {uploadingVisual ? "Téléversement…" : "Joindre un visuel"}
                          </button>

                          {activeNoteAssets.length > 0 && selectedActiveAssetUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setFullscreen({
                                  kind: "note_visual",
                                  photoUrl: selectedActiveAssetUrl,
                                  title: selectedActiveAsset?.filename
                                    ? `Visuel · ${selectedActiveAsset.filename}`
                                    : "Visuel joint",
                                });
                              }}
                              className="inline-flex items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-100"
                              title="Voir le visuel sélectionné"
                            >
                              Voir visuel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* assets list (click to select + open fullscreen) */}
                      {activeNoteAssets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {activeNoteAssets.slice(0, 12).map((a) => {
                            const isSelected = a.asset_id === selectedAssetId;
                            return (
                              <div key={a.asset_id} className="relative inline-flex">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAssetId(a.asset_id)}
                                  className={[
                                    "px-2 py-0.5 rounded-full text-[11px] border flex items-center gap-1",
                                    isSelected
                                      ? "bg-emerald-200 border-emerald-300 text-emerald-900"
                                      : "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100",
                                  ].join(" ")}
                                  title="Sélectionner pour l’aperçu"
                                >
                                  {a.filename || a.asset_id}
                                </button>

                                {/* ✅ croix suppression */}
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (!activeNoteId) return;
                                    deleteNoteAsset(activeNoteId, a.asset_id);
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-emerald-200 text-emerald-900 text-[10px] flex items-center justify-center hover:bg-emerald-50"
                                  title="Supprimer ce visuel"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}

                          {activeNoteAssets.length > 12 && (
                            <span className="text-[11px] text-neutral-500">
                              +{activeNoteAssets.length - 12}
                            </span>
                          )}
                        </div>
                      )}

                      {/* actions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-neutral-500">
                          {activeNoteId ? (
                            <span>
                              Édition de la note <span className="font-mono">{activeNoteId}</span>
                            </span>
                          ) : (
                            <span>Création d’une nouvelle note</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {activeNoteId && notes.some((n) => n.id === activeNoteId) && (
                            <button
                              type="button"
                              onClick={() => activeNoteId && deleteNote(activeNoteId)}
                              className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs hover:bg-red-100"
                            >
                              Supprimer
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={upsertNote}
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white px-3 py-1.5 text-xs hover:bg-black"
                          >
                            {activeNoteId ? "Mettre à jour / créer" : "Créer la note"}
                          </button>
                        </div>
                      </div>

                      {/* ✅ visual preview : suit le visuel sélectionné */}
                      {selectedActiveAssetUrl && (
                        <div className="mt-1">
                          <div className="text-[11px] text-neutral-500 mb-1">
                            Aperçu visuel{selectedActiveAsset?.filename ? ` · ${selectedActiveAsset.filename}` : ""} :
                          </div>

                          <div className="relative bg-neutral-100 rounded-xl overflow-hidden aspect-[16/6] flex items-center justify-center">
                            {/* image */}
                            <img
                              src={selectedActiveAssetUrl}
                              alt="Visuel joint"
                              className="w-full h-full object-contain cursor-zoom-in"
                              onClick={() =>
                                setFullscreen({
                                  kind: "note_visual",
                                  photoUrl: selectedActiveAssetUrl,
                                  title: selectedActiveAsset?.filename
                                    ? `Visuel · ${selectedActiveAsset.filename}`
                                    : "Visuel joint",
                                })
                              }
                            />

                            {/* bouton plein écran — même UX que photos installateur */}
                            <button
                              type="button"
                              onClick={() =>
                                setFullscreen({
                                  kind: "note_visual",
                                  photoUrl: selectedActiveAssetUrl,
                                  title: selectedActiveAsset?.filename
                                    ? `Visuel · ${selectedActiveAsset.filename}`
                                    : "Visuel joint",
                                })
                              }
                              className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-md bg-neutral-900/70 text-neutral-50 text-xs hover:bg-neutral-900"
                              title="Plein écran"
                            >
                              ⛶
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GLOBAL NOTE */}
                  <div className="border border-neutral-200 rounded-xl p-3 bg-white">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Note générale SAV (optionnelle)
                    </div>
                    <textarea
                      value={globalSavNote}
                      onChange={(e) => setGlobalSavNote(e.target.value)}
                      placeholder="Synthèse globale, avertissements, points à surveiller…"
                      className="mt-2 w-full min-h-[90px] text-sm border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-neutral-800 focus:border-neutral-800"
                    />
                  </div>
                </div>

                {/* Right: notes list */}
                <div className="border border-neutral-200 rounded-xl bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Notes SAV du chantier
                    </div>
                    <div className="text-[11px] text-neutral-500">{notes.length} note(s)</div>
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    {notes.length === 0 && (
                      <div className="text-sm text-neutral-600 bg-white border border-neutral-200 rounded-xl p-3">
                        Aucune note pour le moment. Clique sur <b>Créer la note</b> pour ajouter une recommandation.
                      </div>
                    )}

                    {notes.map((n, idx) => {
                      const isActive = n.id === activeNoteId;
                      const hasVisual = Boolean((n.assets || []).length);

                      return (
                        <div
                          key={n.id}
                          className={[
                            "bg-white border rounded-xl p-3",
                            isActive ? "border-neutral-900" : "border-neutral-200",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-semibold text-neutral-900">
                                Note #{notes.length - idx}
                              </div>
                              <div className="text-xs text-neutral-600 line-clamp-3 whitespace-pre-line">
                                {n.text}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openNoteForEdit(n.id)}
                              className="text-xs text-blue-700 hover:underline"
                            >
                              Modifier
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {(n.photo_ids || []).slice(0, 8).map((pid) => (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => setSelectedPhotoId(pid)}
                                className="px-2 py-0.5 rounded-full text-[11px] border bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200"
                                title="Prévisualiser la photo"
                              >
                                {pid}
                              </button>
                            ))}
                            {(n.photo_ids || []).length > 8 && (
                              <span className="text-[11px] text-neutral-500">
                                +{(n.photo_ids || []).length - 8}
                              </span>
                            )}
                          </div>

                          {hasVisual && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {(n.assets || []).slice(0, 6).map((a) => (
                                <button
                                  key={a.asset_id}
                                  type="button"
                                  onClick={() => {
                                    const url = normalizeApiUrl(a.asset_url);
                                    if (!url) return;
                                    setFullscreen({
                                      kind: "note_visual",
                                      photoUrl: url,
                                      title: a.filename ? `Visuel · ${a.filename}` : "Visuel joint",
                                    });
                                  }}
                                  className="px-2 py-0.5 rounded-full text-[11px] border bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  title="Ouvrir"
                                >
                                  {a.filename || a.asset_id}
                                </button>
                              ))}
                              {(n.assets || []).length > 6 && (
                                <span className="text-[11px] text-neutral-500">
                                  +{(n.assets || []).length - 6}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2 py-1 text-[11px] border",
                                hasVisual
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                  : "bg-neutral-50 border-neutral-200 text-neutral-600",
                              ].join(" ")}
                            >
                              {hasVisual ? "Visuel(s) joint(s)" : "Texte seul"}
                            </span>

                            <div className="text-[11px] text-neutral-400">
                              Maj : {formatTs(n.updated_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* DEBUG (optional) */}
              <details className="mt-2">
                <summary className="text-xs text-neutral-500 cursor-pointer">
                  Debug (JSON session)
                </summary>
                <pre className="mt-2 text-[11px] bg-neutral-900 text-neutral-50 rounded-lg p-3 overflow-x-auto max-h-[400px]">
                  {JSON.stringify({ detail, chantier, chantierMeta }, null, 2)}
                </pre>
              </details>
            </>
          )}
        </section>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-neutral-900 rounded-xl max-w-6xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 flex-none">
              <div className="text-sm text-neutral-100">{fullscreen.title}</div>
              <button
                type="button"
                onClick={() => setFullscreen(null)}
                className="text-neutral-300 hover:text-white text-sm"
              >
                Fermer ✕
              </button>
            </div>
            <div className="flex-1 bg-black overflow-auto">
              <div className="min-h-full flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullscreen.photoUrl}
                  alt={fullscreen.title}
                  className="max-h-[86vh] w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={[
              "rounded-full px-4 py-2 text-xs shadow-lg border",
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700",
            ].join(" ")}
          >
            {toast.message}
          </div>
        </div>
      )}
    </main>
  );
}
