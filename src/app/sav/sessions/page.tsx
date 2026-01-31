"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";

const buildUrl = (
  path: string,
  params?: URLSearchParams | Record<string, string | undefined>
) => {
  const url = new URL(path, API_BASE);
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => url.searchParams.set(k, v));
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
};

type ChantierAggItem = {
  group_key: string;
  chantier_id?: string | null;

  // Affichage liste: nom installateur (context.societe / context.installateur.company)
  installateur?: string | null;

  status?: string;
  type?: string;

  origins?: string[];
  sender_numbers?: string[];
  report_recipient_number?: string | null;

  session_ids?: string[];
  session_count?: number;

  photo_count?: number;

  // legacy / inbox timestamps (sessions non rattachées)
  updated_at?: number;
  created_at?: number;

  // ✅ NOUVEAU: propriétaire + activité réelle (pour chantiers)
  owner?: string | null;
  last_activity_at?: number | null;
  last_activity_by?: string | null;
};

// --- Chantiers JSON (format large, on le “projette” en ChantierAggItem) ---
type ChantierJson = Record<string, any>;

type SavOverviewResponse = {
  chantiers: ChantierJson[];
  unattached_groups: ChantierAggItem[];
};

function formatTs(ts?: number | null) {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR");
  } catch {
    return String(ts);
  }
}

function statusLabel(st?: string) {
  const s = (st || "").toUpperCase();
  // Nouveau modèle
  if (s === "A_TRAITER") return "À traiter";
  if (s === "RESOLU") return "Résolu";

  // Legacy / compat
  if (s === "PUBLIE") return "Publié";
  if (st === "Publié") return "Publié";

  if (st === "À revoir") return "À revoir";
  if (st === "Nouveau") return "Nouveau";
  return st || "—";
}

function statusPillClass(st?: string) {
  const s = (st || "").toUpperCase();
  if (s === "RESOLU") return "bg-emerald-100 text-emerald-700";
  // legacy
  if (s === "PUBLIE" || st === "Publié")
    return "bg-emerald-100 text-emerald-700";

  if (s === "A_TRAITER" || st === "Nouveau")
    return "bg-neutral-100 text-neutral-700";
  if (st === "À revoir") return "bg-amber-100 text-amber-700";
  return "bg-neutral-100 text-neutral-700";
}

function normalizeStatusForFilter(st?: string) {
  const s = (st || "").toString().trim().toUpperCase();
  // on considère l'ancien "PUBLIE" comme "RESOLU" pour les filtres
  if (s === "PUBLIE") return "RESOLU";
  return s;
}

const STATUS_OPTIONS = [
  { value: "A_TRAITER", label: "À traiter" },
  { value: "RESOLU", label: "Résolu" },
] as const;

function originLabel(origins?: string[], type?: string) {
  const o = (origins || [])[0];
  if (o === "inbox_whatsapp") return "Inbox WhatsApp";
  if (o === "diag_guide") return "Diagnostic guidé";
  if (o === "manuel") return "Manuel";
  if ((type || "").toLowerCase() === "inbox") return "Inbox";
  if ((type || "").toLowerCase() === "chantier") return "Chantier";
  if ((type || "").toLowerCase() === "legacy") return "Legacy";
  return "—";
}

const SEEN_STORAGE_KEY = "sav_sessions_seen_sig_v1";

// ✅ user dropdown
const CURRENT_USER_STORAGE_KEY = "sav_current_user_v1";
const USERS = ["Xavier Briffa", "Florent Boeuf", "William Perge"] as const;

function normalizeStr(v: any) {
  return String(v || "").trim().toLowerCase();
}

function pickChantierActivityTs(c: ChantierJson): number | undefined {
  const al = c?.activity_log || {};
  const ts =
    al?.last_activity_at ??
    c?.updated_at ??
    c?.meta?.updated_at ??
    c?.created_at ??
    c?.meta?.created_at ??
    undefined;
  return typeof ts === "number" ? ts : undefined;
}

function buildRowFromChantierJson(c: ChantierJson): ChantierAggItem {
  // chantier_id canonique
  const chantierId =
    (c?.chantier_id ?? c?.id ?? c?.reference ?? c?.ref ?? "")
      .toString()
      .trim();

  const links = c?.links || {};
  const inputs = c?.inputs || {};
  const participants = c?.participants || {};
  const context = c?.context || {};

  // Installateur / société
  const installerCompany =
    (context?.societe ??
      context?.installateur?.societe ??
      context?.installateur?.company ??
      context?.installateur?.company_name ??
      context?.installateur?.companyName ??
      null) as any;

  const installerName =
    (context?.installateur?.nom ??
      context?.installateur?.name ??
      context?.installateur?.full_name ??
      context?.installateur?.fullName ??
      null) as any;

  const installer = installerCompany ?? installerName ?? null;

  const sessionIds: string[] = Array.isArray(links?.session_ids)
    ? links.session_ids
    : [];

  const photosArr: any[] = Array.isArray(inputs?.photos) ? inputs.photos : [];

  // statut : on prend ce qui existe, sinon fallback A_TRAITER
  const st =
    (c?.status ??
      c?.meta?.status ??
      c?.context?.status ??
      c?.links?.status ??
      "") || "A_TRAITER";

  // numéros
  const knownPhones: string[] = Array.isArray(participants?.known_phones)
    ? participants.known_phones
    : [];
  const primarySender = participants?.primary_sender_phone
    ? [String(participants.primary_sender_phone)]
    : [];
  const senders = [...primarySender, ...knownPhones].filter(
    (x, i, arr) => x && arr.indexOf(x) === i
  );

  const reportRecipient = participants?.report_recipient_phone ?? null;

  const owner = (c?.owner ?? "Xavier Briffa") as any;
  const lastActivityAt = pickChantierActivityTs(c);
  const lastActivityBy = (c?.activity_log?.last_activity_by ?? null) as any;

  return {
    group_key: chantierId, // important: clé utilisée dans l’URL
    chantier_id: chantierId,
    installateur: installer ? String(installer).trim() : null,
    status: st,
    type: "chantier",
    origins: ["chantier_json"],
    sender_numbers: senders,
    report_recipient_number: reportRecipient,
    session_ids: sessionIds,
    session_count: sessionIds.length,
    photo_count: photosArr.length,

    // legacy timestamps kept (not used for sorting “Dernière activité” anymore)
    updated_at: c?.updated_at ?? c?.meta?.updated_at ?? undefined,
    created_at: c?.created_at ?? c?.meta?.created_at ?? undefined,

    owner: owner ? String(owner).trim() : "Xavier Briffa",
    last_activity_at: lastActivityAt,
    last_activity_by: lastActivityBy ? String(lastActivityBy).trim() : null,
  };
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 3h6m-9 4h12M10 7v13m4-13v13M7 7l1 15h8l1-15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SavSessionsListPage() {
  const [unattached, setUnattached] = useState<ChantierAggItem[]>([]);
  const [chantiers, setChantiers] = useState<ChantierAggItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // refresh manuel discret (pas de polling)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // filtres
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>(""); // ✅ AJOUT
  const [search, setSearch] = useState<string>("");

  // ✅ user dropdown
  const [currentUser, setCurrentUser] = useState<string>("Xavier Briffa");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (raw && typeof raw === "string" && raw.trim()) {
        setCurrentUser(raw.trim());
      }
    } catch {
      // ignore
    }
  }, []);
  const persistCurrentUser = (u: string) => {
    setCurrentUser(u);
    try {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, u);
    } catch {
      // ignore
    }
  };

  // -------------------------------------------------------------------
  // ✅ AJOUT MVP: envoi template WhatsApp "request photos"
  // -------------------------------------------------------------------
  const [waPhone, setWaPhone] = useState<string>("");
  const [waSending, setWaSending] = useState(false);
  const [waMsg, setWaMsg] = useState<string | null>(null);

  const toE164FR = (raw: string) => {
    const v = String(raw || "").trim();
    if (!v) return "";

    // on enlève espaces / points / tirets / parenthèses
    const cleaned = v.replace(/[ \.\-\(\)]/g, "");

    // déjà en +...
    if (cleaned.startsWith("+")) return cleaned;

    // 06XXXXXXXX / 07XXXXXXXX -> +336XXXXXXXX
    if (/^0[67]\d{8}$/.test(cleaned)) return `+33${cleaned.slice(1)}`;

    // 33XXXXXXXXX -> +33...
    if (/^33\d{9}$/.test(cleaned)) return `+${cleaned}`;

    // fallback: on renvoie tel quel (l’API renverra une erreur si invalide)
    return cleaned;
  };

  const sendWhatsAppTemplate = async () => {
    setWaMsg(null);
    const toNumber = toE164FR(waPhone);

    if (!toNumber) {
      setWaMsg("Veuillez saisir un numéro.");
      return;
    }
    if (!toNumber.startsWith("+")) {
      setWaMsg("Numéro invalide. Format attendu: 06… / 07… ou +33…");
      return;
    }

    setWaSending(true);
    try {
      const res = await fetch(buildUrl("/actions/whatsapp/request-photos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_number: toNumber }),
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setWaMsg(
          txt && txt.length < 220
            ? `Erreur envoi: ${txt}`
            : "Erreur lors de l’envoi WhatsApp."
        );
        return;
      }

      setWaMsg("✅ Template WhatsApp envoyé.");
    } catch (e) {
      console.error("sendWhatsAppTemplate error", e);
      setWaMsg("Erreur réseau lors de l’envoi WhatsApp.");
    } finally {
      setWaSending(false);
    }
  };
  // -------------------------------------------------------------------

  // modal rattachement
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<ChantierAggItem | null>(null);
  const [attachSessionId, setAttachSessionId] = useState<string>("");

  const [attachQuery, setAttachQuery] = useState<string>("");
  const [attachResults, setAttachResults] = useState<ChantierAggItem[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSelectedChantierId, setAttachSelectedChantierId] =
    useState<string>("");
  const [attachNewChantierId, setAttachNewChantierId] = useState<string>("");

  // suppression
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // édition statut chantier
  const [statusUpdatingKey, setStatusUpdatingKey] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const updateChantierStatus = async (
    chantierId: string,
    nextStatus: string,
    rowKey: string
  ) => {
    setStatusError(null);
    if (!chantierId) return;

    setStatusUpdatingKey(rowKey);
    try {
      const res = await fetch(
        buildUrl(`/chantiers/${encodeURIComponent(chantierId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus, actor: currentUser }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatusError(
          txt && txt.length < 220
            ? `Erreur statut: ${txt}`
            : "Erreur lors de la mise à jour du statut."
        );
        return;
      }

      await fetchOverview();
    } catch (e) {
      console.error("updateChantierStatus error", e);
      setStatusError("Erreur réseau lors de la mise à jour du statut.");
    } finally {
      setStatusUpdatingKey(null);
    }
  };

  // ✅ édition owner (propriétaire)
  const [ownerUpdatingKey, setOwnerUpdatingKey] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const updateChantierOwner = async (
    chantierId: string,
    nextOwner: string,
    rowKey: string
  ) => {
    setOwnerError(null);
    if (!chantierId) return;

    setOwnerUpdatingKey(rowKey);
    try {
      const res = await fetch(
        buildUrl(`/chantiers/${encodeURIComponent(chantierId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: nextOwner, actor: currentUser }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setOwnerError(
          txt && txt.length < 220
            ? `Erreur propriétaire: ${txt}`
            : "Erreur lors de la mise à jour du propriétaire."
        );
        return;
      }

      await fetchOverview();
    } catch (e) {
      console.error("updateChantierOwner error", e);
      setOwnerError("Erreur réseau lors de la mise à jour du propriétaire.");
    } finally {
      setOwnerUpdatingKey(null);
    }
  };

  // non-vu persistant : map group_key -> signature
  const [seenSig, setSeenSig] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setSeenSig(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistSeenSig = (next: Record<string, string>) => {
    setSeenSig(next);
    try {
      localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const computeSig = (c: ChantierAggItem) => {
    const pc =
      (typeof c.photo_count === "number" ? c.photo_count : undefined) ??
      ((c.session_ids || []).length || c.session_count || 0);

    // ✅ pour les chantiers, la “vraie activité”
    const u =
      c.type === "chantier"
        ? c.last_activity_at || c.updated_at || c.created_at || 0
        : c.updated_at || c.created_at || 0;

    return `${u}__${pc}`;
  };

  const markSeen = (c: ChantierAggItem) => {
    persistSeenSig({ ...seenSig, [c.group_key]: computeSig(c) });
  };

  const canAttach = useMemo(() => {
    const chantierId =
      (attachSelectedChantierId || "").trim() ||
      (attachNewChantierId || "").trim();
    return Boolean(attachTarget && attachSessionId && chantierId);
  }, [
    attachTarget,
    attachSessionId,
    attachSelectedChantierId,
    attachNewChantierId,
  ]);

  const fetchOverview = async () => {
    setError(null);

    if (!hasLoadedOnce) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch(buildUrl("/sav/overview"), { cache: "no-store" });
      if (!res.ok) {
        setError("Erreur lors du chargement de l’inbox SAV.");
        return;
      }

      const data = (await res.json()) as SavOverviewResponse;

      // 1) Unattached (déjà en format agrégé)
      const nextUnattached = Array.isArray(data?.unattached_groups)
        ? data.unattached_groups.map((g) => ({
            ...g,
            type: "inbox",
            group_key: String(g.group_key || g.session_ids?.[0] || ""),
          }))
        : [];

      // tri: plus récent en haut (inbox)
      nextUnattached.sort(
        (a, b) =>
          (b.updated_at || b.created_at || 0) -
          (a.updated_at || a.created_at || 0)
      );

      // 2) Chantiers (JSON) -> projection
      const rawChantiers = Array.isArray(data?.chantiers) ? data.chantiers : [];
      const nextChantiers = rawChantiers
        .map(buildRowFromChantierJson)
        .filter((x) => (x.chantier_id || "").trim() !== "");

      // ✅ tri: activité réelle en haut
      nextChantiers.sort(
        (a, b) =>
          (b.last_activity_at || b.updated_at || b.created_at || 0) -
          (a.last_activity_at || a.updated_at || a.created_at || 0)
      );

      setUnattached(nextUnattached);
      setChantiers(nextChantiers);
    } catch (e) {
      console.error("fetch /sav/overview error", e);
      setError("Erreur réseau lors du chargement de l’inbox SAV.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUnattached = useMemo(() => {
    const q = search.trim();
    const qn = normalizeStr(q);
    const statusNorm = (statusFilter || "").trim().toUpperCase();

    return unattached.filter((c) => {
      if (statusNorm) {
        const st = normalizeStatusForFilter(c.status);
        if (st !== statusNorm) return false;
      }

      if (!qn) return true;

      const hay = [
        c.group_key,
        c.chantier_id,
        c.status,
        c.type,
        ...(c.session_ids || []),
        ...(c.sender_numbers || []),
        c.installateur || "",
        c.report_recipient_number || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qn);
    });
  }, [unattached, search, statusFilter]);

  const filteredChantiers = useMemo(() => {
    const q = search.trim();
    const qn = normalizeStr(q);
    const statusNorm = (statusFilter || "").trim().toUpperCase();
    const ownerNorm = (ownerFilter || "").trim().toLowerCase();

    return chantiers.filter((c) => {
      if (statusNorm) {
        const st = normalizeStatusForFilter(c.status);
        if (st !== statusNorm) return false;
      }

      if (ownerNorm) {
        const o = (c.owner || "Xavier Briffa").toString().trim().toLowerCase();
        if (o !== ownerNorm) return false;
      }

      if (!qn) return true;

      const hay = [
        c.group_key,
        c.chantier_id,
        c.status,
        c.type,
        c.owner || "",
        ...(c.session_ids || []),
        ...(c.sender_numbers || []),
        c.installateur || "",
        c.report_recipient_number || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qn);
    });
  }, [chantiers, search, statusFilter, ownerFilter]);

  const openAttachModal = (row: ChantierAggItem) => {
    setAttachTarget(row);
    setAttachOpen(true);

    const sids = row.session_ids || [];
    setAttachSessionId(sids[0] || "");

    setAttachQuery("");
    setAttachResults([]);
    setAttachError(null);
    setAttachSelectedChantierId("");
    setAttachNewChantierId("");
  };

  const closeAttachModal = () => {
    setAttachOpen(false);
    setAttachTarget(null);
    setAttachSessionId("");
    setAttachQuery("");
    setAttachResults([]);
    setAttachError(null);
    setAttachSelectedChantierId("");
    setAttachNewChantierId("");
  };

  const searchChantiersForAttach = async () => {
    const q = attachQuery.trim();
    if (!q) {
      setAttachResults([]);
      return;
    }

    setAttachLoading(true);
    setAttachError(null);

    try {
      const res = await fetch(buildUrl("/sav/overview"), { cache: "no-store" });
      if (!res.ok) {
        setAttachError("Erreur lors de la recherche chantier.");
        setAttachResults([]);
        return;
      }

      const data = (await res.json()) as SavOverviewResponse;
      const rawChantiers = Array.isArray(data?.chantiers) ? data.chantiers : [];
      const rows = rawChantiers
        .map(buildRowFromChantierJson)
        .filter((x) => (x.chantier_id || "").trim() !== "");

      const qn = normalizeStr(q);
      const filtered = rows.filter((r) => {
        const hay = [
          r.chantier_id || "",
          ...(r.sender_numbers || []),
          ...(r.session_ids || []),
          r.installateur || "",
          r.report_recipient_number || "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(qn);
      });

      setAttachResults(filtered.slice(0, 20));
    } catch (e) {
      console.error("search attach /sav/overview error", e);
      setAttachError("Erreur réseau lors de la recherche chantier.");
      setAttachResults([]);
    } finally {
      setAttachLoading(false);
    }
  };

  const doAttach = async () => {
    if (!attachTarget) return;

    const chantierId =
      (attachSelectedChantierId || "").trim() ||
      (attachNewChantierId || "").trim();
    if (!chantierId) {
      setAttachError("Veuillez saisir ou sélectionner une référence chantier.");
      return;
    }
    if (!attachSessionId) {
      setAttachError("Veuillez sélectionner une session à rattacher.");
      return;
    }

    setAttachLoading(true);
    setAttachError(null);

    try {
      const res = await fetch(
        buildUrl(`/sessions/${encodeURIComponent(attachSessionId)}/attach`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chantier_id: chantierId, actor: currentUser }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setAttachError(
          txt && txt.length < 180
            ? `Erreur rattachement: ${txt}`
            : "Erreur lors du rattachement."
        );
        return;
      }

      markSeen(attachTarget);
      closeAttachModal();
      await fetchOverview();
    } catch (e) {
      console.error("attach error", e);
      setAttachError("Erreur réseau lors du rattachement.");
    } finally {
      setAttachLoading(false);
    }
  };

  const handleDeleteRow = async (row: ChantierAggItem, isUnattached: boolean) => {
    setDeleteError(null);

    if (deletingKey) return;

    if (isUnattached) {
      const sids = row.session_ids || [];
      const count = sids.length || 0;

      if (count === 0) {
        setDeleteError("Impossible de supprimer: aucune session détectée.");
        return;
      }

      const ok = window.confirm(
        count === 1
          ? "Supprimer cette session ? Cette action est irréversible."
          : `Supprimer ces ${count} sessions ? Cette action est irréversible.`
      );
      if (!ok) return;

      setDeletingKey(row.group_key);

      try {
        for (const sid of sids) {
          const res = await fetch(buildUrl(`/sessions/${encodeURIComponent(sid)}`), {
            method: "DELETE",
            cache: "no-store",
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(
              txt && txt.length < 220 ? txt : `Erreur suppression session ${sid}`
            );
          }
        }

        await fetchOverview();
      } catch (e: any) {
        console.error("delete session(s) error", e);
        setDeleteError(
          e?.message ? `Suppression impossible: ${e.message}` : "Suppression impossible."
        );
      } finally {
        setDeletingKey(null);
      }
      return;
    }

    // Chantier
    const chantierId = (row.chantier_id || "").trim();
    if (!chantierId) {
      setDeleteError("Impossible de supprimer: chantier_id manquant.");
      return;
    }

    const ok = window.confirm(
      "Supprimer ce chantier ?\n\nLes sessions liées seront détachées (elles resteront visibles dans 'Sessions non rattachées').\n\nCette action est irréversible."
    );
    if (!ok) return;

    setDeletingKey(row.group_key);

    try {
      const res = await fetch(buildUrl(`/chantiers/${encodeURIComponent(chantierId)}`), {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt && txt.length < 220 ? txt : "Erreur suppression chantier");
      }

      await fetchOverview();
    } catch (e: any) {
      console.error("delete chantier error", e);
      setDeleteError(
        e?.message ? `Suppression impossible: ${e.message}` : "Suppression impossible."
      );
    } finally {
      setDeletingKey(null);
    }
  };

  const Table = ({
    rows,
    emptyLabel,
    showAttachForUnattached,
    showOwnerColumn,
  }: {
    rows: ChantierAggItem[];
    emptyLabel: string;
    showAttachForUnattached: boolean;
    showOwnerColumn: boolean;
  }) => {
    if (rows.length === 0) {
      return <div className="text-sm text-neutral-500">{emptyLabel}</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[170px]" />
            <col className="w-[120px]" />
            {showOwnerColumn ? <col className="w-[180px]" /> : null}
            <col className="w-[260px]" />
            <col className="w-[170px]" />
            <col className="w-[170px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[240px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left py-2 px-2">Dernière activité</th>
              <th className="text-left py-2 px-2">Statut</th>
              {showOwnerColumn ? (
                <th className="text-left py-2 px-2">Propriétaire</th>
              ) : null}
              <th className="text-left py-2 px-2">Installateur</th>
              <th className="text-left py-2 px-2">Chantier</th>
              <th className="text-left py-2 px-2">Numéros</th>
              <th className="text-left py-2 px-2">Sessions</th>
              <th className="text-left py-2 px-2">Photos</th>
              <th className="text-left py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const isRattachee = Boolean((c.chantier_id || "").trim());
              const nonRattachee = !isRattachee;

              const sidCount = (c.session_ids || []).length || c.session_count || 0;
              const photoCount = typeof c.photo_count === "number" ? c.photo_count : 0;

              const sig = computeSig(c);
              const isUnseen = (seenSig[c.group_key] || "") !== sig;

              const isUnattachedTable = showAttachForUnattached;
              const isDeleting = deletingKey === c.group_key;

              const lastTs =
                c.type === "chantier"
                  ? c.last_activity_at || c.updated_at || c.created_at
                  : c.updated_at || c.created_at;

              const isOwnerUpdating = ownerUpdatingKey === c.group_key;

              return (
                <tr
                  key={c.group_key}
                  className={[
                    "border-b border-neutral-100 hover:bg-neutral-50",
                    isUnseen ? "bg-blue-50" : "",
                  ].join(" ")}
                >
                  <td className="py-2 px-2 align-top">
                    <div className="flex flex-col gap-1">
                      <div>{formatTs(lastTs)}</div>
                      {c.type === "chantier" && c.last_activity_by ? (
                        <div className="text-[11px] text-neutral-500">par {c.last_activity_by}</div>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    {c.type === "chantier" && (c.chantier_id || "").trim() ? (
                      <select
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-transparent ${statusPillClass(
                          normalizeStatusForFilter(c.status)
                        )} ${statusUpdatingKey === c.group_key ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                        value={normalizeStatusForFilter(c.status) || "A_TRAITER"}
                        onChange={(e) =>
                          updateChantierStatus(
                            String(c.chantier_id || ""),
                            e.target.value,
                            c.group_key
                          )
                        }
                        disabled={statusUpdatingKey === c.group_key}
                        title="Modifier le statut du chantier"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${statusPillClass(
                          c.status
                        )}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                    )}
                  </td>

                  {showOwnerColumn ? (
                    <td className="py-2 px-2 align-top">
                      {c.type === "chantier" && (c.chantier_id || "").trim() ? (
                        <select
                          className={[
                            "rounded-lg border border-neutral-300 px-2 py-1 text-xs bg-white",
                            isOwnerUpdating ? "opacity-60 cursor-wait" : "cursor-pointer",
                          ].join(" ")}
                          value={(c.owner || "Xavier Briffa").toString()}
                          onChange={(e) =>
                            updateChantierOwner(
                              String(c.chantier_id || ""),
                              e.target.value,
                              c.group_key
                            )
                          }
                          disabled={isOwnerUpdating}
                          title="Modifier le propriétaire du chantier"
                        >
                          {USERS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                  ) : null}

                  <td className="py-2 px-2 align-top">
                    <div className="text-xs text-neutral-700">
                      {c.installateur ? String(c.installateur) : "—"}
                    </div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">{isRattachee ? c.chantier_id : "—"}</div>

                      {nonRattachee && (
                        <div className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 w-fit">
                          <span>⚠️</span>
                          <span>Non rattachée</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    <div className="text-xs text-neutral-700">
                      {(c.sender_numbers || []).slice(0, 2).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                      {(c.sender_numbers || []).length > 2 && (
                        <div className="text-neutral-500">
                          +{(c.sender_numbers || []).length - 2}…
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    <div className="text-xs text-neutral-700">{sidCount || 0}</div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    <div className="text-xs text-neutral-700">{photoCount}</div>
                  </td>

                  <td className="py-2 px-2 align-top">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sav/sessions/${encodeURIComponent(c.group_key)}`}
                        onClick={() => markSeen(c)}
                        className="inline-flex items-center text-xs px-2 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800"
                      >
                        Voir
                      </Link>

                      {showAttachForUnattached && nonRattachee && (
                        <button
                          onClick={() => openAttachModal(c)}
                          className="inline-flex items-center text-xs px-2 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800"
                          disabled={isDeleting}
                        >
                          Rattacher à un chantier
                        </button>
                      )}

                      <button
                        title="Supprimer"
                        onClick={() => handleDeleteRow(c, isUnattachedTable)}
                        disabled={isDeleting}
                        className={[
                          "inline-flex items-center justify-center rounded-lg border px-2 py-1",
                          "text-xs",
                          "border-red-200 bg-white hover:bg-red-50 text-red-700",
                          isDeleting ? "opacity-50 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Visual Assistant · Inbox SAV</h1>

        {/* ✅ header right: user dropdown + actions (Accueil supprimé) */}
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm bg-white"
            value={currentUser}
            onChange={(e) => persistCurrentUser(e.target.value)}
            title="Utilisateur courant (sert à attribuer les activités)"
          >
            {USERS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {isRefreshing && <span className="text-xs text-neutral-400">⟳</span>}
          <button
            onClick={fetchOverview}
            className="text-sm px-3 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50"
          >
            Actualiser
          </button>

          <Link
            href="/generateur"
            className="text-sm text-neutral-600 hover:text-neutral-900 underline-offset-2 hover:underline"
          >
            ← Retour générateur
          </Link>
        </div>
      </div>

      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-medium">SAV · Sessions & Chantiers</h2>
            <p className="text-sm text-neutral-500">
              Les sessions non rattachées sont affichées en premier (priorité).
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <label className="text-sm text-neutral-700">
              Statut :
              <select
                className="ml-2 rounded-lg border border-neutral-300 px-2 py-1 text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="A_TRAITER">À traiter</option>
                <option value="RESOLU">Résolu</option>
              </select>
            </label>

            <label className="text-sm text-neutral-700">
              Propriétaire :
              <select
                className="ml-2 rounded-lg border border-neutral-300 px-2 py-1 text-sm bg-white"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="">Tous</option>
                {USERS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <input
                className="rounded-lg border border-neutral-300 px-3 py-1 text-sm bg-white w-full md:w-64"
                placeholder="Recherche (chantier / installateur / numéro / session)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchOverview();
                }}
              />
              <button
                className="text-sm px-3 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50"
                onClick={fetchOverview}
              >
                Rechercher
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp block */}
        <div className="mt-1">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm text-neutral-700 font-medium">
              Envoyer WhatsApp
              <span className="ml-2 text-xs text-neutral-500 font-normal">
                (le client pourra envoyer les photos directement)
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <input
                className="rounded-lg border border-neutral-300 px-3 py-1 text-sm bg-white w-full md:w-56"
                placeholder="Téléphone (06… ou +33…)"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendWhatsAppTemplate();
                }}
              />
              <button
                className="text-sm px-3 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50"
                onClick={sendWhatsAppTemplate}
                disabled={waSending}
                title="Envoie le template WhatsApp pour demander les photos"
              >
                {waSending ? "Envoi…" : "Envoyer WhatsApp"}
              </button>

              {waMsg && (
                <div className="text-xs text-neutral-600 md:ml-2">{waMsg}</div>
              )}
            </div>
          </div>
        </div>

        {loading && <div className="text-sm text-neutral-500">Chargement…</div>}

        {!loading && error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && deleteError && (
          <div className="text-sm text-red-600">{deleteError}</div>
        )}

        {!loading && !error && statusError && (
          <div className="text-sm text-red-600">{statusError}</div>
        )}

        {!loading && !error && ownerError && (
          <div className="text-sm text-red-600">{ownerError}</div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {/* 1) Unattached FIRST */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="text-sm font-semibold text-neutral-900">
                    Sessions non rattachées
                  </div>
                  <div className="text-xs text-neutral-500">
                    À traiter en priorité (photos arrivées récemment).
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {filteredUnattached.length} élément(s)
                </div>
              </div>

              <Table
                rows={filteredUnattached}
                emptyLabel="Aucune session non rattachée."
                showAttachForUnattached={true}
                showOwnerColumn={false}
              />
            </div>

            <div className="border-t border-neutral-200" />

            {/* 2) Chantiers */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="text-sm font-semibold text-neutral-900">
                    Chantiers
                  </div>
                  <div className="text-xs text-neutral-500">
                    Regroupement par référence chantier.
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {filteredChantiers.length} élément(s)
                </div>
              </div>

              <Table
                rows={filteredChantiers}
                emptyLabel="Aucun chantier."
                showAttachForUnattached={false}
                showOwnerColumn={true}
              />
            </div>
          </div>
        )}
      </section>

      {/* MODAL RATTACHEMENT */}
      {attachOpen && attachTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Rattacher à un chantier</div>
                <div className="text-sm text-neutral-500">
                  Inbox non rattachée · {attachTarget.group_key}
                </div>
              </div>
              <button
                onClick={closeAttachModal}
                className="text-sm px-2 py-1 rounded-lg hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">Session à rattacher</div>
                <select
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm bg-white"
                  value={attachSessionId}
                  onChange={(e) => setAttachSessionId(e.target.value)}
                >
                  {(attachTarget.session_ids || []).map((sid) => (
                    <option key={sid} value={sid}>
                      {sid}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium">Trouver un chantier existant</div>
                <div className="flex items-center gap-2">
                  <input
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white w-full"
                    placeholder="Tape une ref / numéro / morceau…"
                    value={attachQuery}
                    onChange={(e) => setAttachQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") searchChantiersForAttach();
                    }}
                  />
                  <button
                    className="text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50"
                    onClick={searchChantiersForAttach}
                    disabled={attachLoading}
                  >
                    Chercher
                  </button>
                </div>

                {attachLoading && (
                  <div className="text-sm text-neutral-500">Recherche…</div>
                )}

                {!attachLoading && attachError && (
                  <div className="text-sm text-red-600">{attachError}</div>
                )}

                {!attachLoading && attachResults.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-neutral-500">
                      Sélectionne une ref chantier :
                    </div>
                    <div className="max-h-40 overflow-auto border border-neutral-200 rounded-xl">
                      {attachResults.map((r) => (
                        <button
                          key={r.group_key}
                          onClick={() => {
                            setAttachSelectedChantierId(String(r.chantier_id || ""));
                            setAttachNewChantierId("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                            attachSelectedChantierId === String(r.chantier_id || "")
                              ? "bg-neutral-50"
                              : ""
                          }`}
                        >
                          <div className="font-medium">{r.chantier_id}</div>
                          <div className="text-xs text-neutral-500">
                            {originLabel(r.origins, r.type)} · {statusLabel(r.status)} ·{" "}
                            {(r.sender_numbers || []).slice(0, 1)[0] || "—"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">Ou créer un nouveau chantier</div>
                <input
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
                  placeholder="Référence chantier (ex: SAV-2025-01234)"
                  value={attachNewChantierId}
                  onChange={(e) => {
                    setAttachNewChantierId(e.target.value);
                    if (e.target.value.trim()) setAttachSelectedChantierId("");
                  }}
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                onClick={closeAttachModal}
                className="text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50"
                disabled={attachLoading}
              >
                Annuler
              </button>
              <button
                onClick={doAttach}
                disabled={!canAttach || attachLoading}
                className="text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Rattacher
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
