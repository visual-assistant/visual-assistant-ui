"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";

/* =========================
   Types
   ========================= */

type ProductApi = {
  code: string;
  label: string;
  feuilles: Array<{
    sheetName: string;
    sections: string[];
    introFields: IntroField[];
  }>;
};

type IntroField = {
  key: string;
  label: string;
  type: string;
  options?: string[];
  mapTo?: Record<string, number>;
  showIf?: {
    sourceField: string;
    rule: string; // e.g. ">=2"
  };
};

type StepGroup = {
  label: string;
  /** Utilisé pour regrouper visuellement par section Excel */
  category: string; // ex: "Électrique", "Hydraulique", etc. (fallback "Autres")
  keys: string[];
  showIf?: {
    sourceField: string;
    allowedValues: string[];
  } | null;
};

// == Base URL de l'API ==
const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API || "http://localhost:8001";
const buildUrl = (path: string, params?: URLSearchParams | Record<string, string>) => {
  const url = new URL(path, API_BASE);
  if (params instanceof URLSearchParams) {
    // si tu passes déjà un URLSearchParams
    params.forEach((v, k) => url.searchParams.set(k, v));
  } else if (params) {
    // si tu passes un objet { k: v }
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
};


/* =========================
   Backend helpers
   ========================= */

async function fetchLookup(np: string, ns: string, em: string) {
  try {
    const res = await fetch(buildUrl("/people/lookup", { np: np || "", ns: ns || "", em: em || "" }));
    if (!res.ok) return { candidates: [], error: "bad_status" };
    const data = await res.json();
    return { candidates: data.candidates || [], error: null };
  } catch (e) {
    console.error("fetchLookup error", e);
    return { candidates: [], error: "network" };
  }
}


async function fetchContacts(q: string) {
  if (q.trim().length < 2) return [];
  try {
    const params = new URLSearchParams({ q });
    const res = await fetch(buildUrl("/contacts/search", params));
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("fetchContacts error", e);
    return [];
  }
}

async function fetchProducts() {
  try {
    const res = await fetch(buildUrl("/products"));
    if (!res.ok) return [];
    const data = await res.json();
    return data as ProductApi[];
  } catch (e) {
    console.error("fetchProducts error", e);
    return [];
  }
}

async function fetchSteps(prodCode: string, sheetName: string) {
  if (!prodCode || !sheetName) return { groups: [], error: null };
  const params = new URLSearchParams({ produit: prodCode, sheet: sheetName });
  try {
    const res = await fetch(buildUrl("/steps", params));
    if (!res.ok) return { groups: [], error: "bad_status" };
    const data = await res.json();
    return { groups: (data.groups || []) as StepGroup[], error: data.error || null };
  } catch (e) {
    console.error("fetchSteps error", e);
    return { groups: [], error: "network" };
  }
}


/* =========================
   UI helpers
   ========================= */

function shouldShowField(
  field: IntroField,
  ivData: Record<string, string>,
  allIntro: IntroField[]
) {
  if (!field.showIf) return true;
  const { sourceField, rule } = field.showIf;
  const valRaw = ivData[sourceField];
  if (!valRaw || !valRaw.trim()) return false;

  const src = allIntro.find((f) => f.key === sourceField);
  let numeric: number | null = null;

  if (src?.mapTo && src.mapTo[valRaw] !== undefined) numeric = src.mapTo[valRaw];
  if (numeric === null) {
    const parsed = parseFloat(valRaw);
    if (!Number.isNaN(parsed)) numeric = parsed;
  }
  if (numeric === null) return false;

  const m = rule.match(/^>=\s*([0-9]+)$/);
  if (m) return numeric >= parseFloat(m[1]);

  return true;
}

function shouldShowGroup(group: StepGroup, ivData: Record<string, string>) {
  if (!group.showIf?.sourceField) return true;
  const { sourceField, allowedValues } = group.showIf;
  const current = (ivData[sourceField] || "").toLowerCase().trim();
  if (!current) return false;
  return allowedValues.some((v) => v.toLowerCase().trim() === current);
}

/** Placeholder avant endpoint images d’exemple */
function getPreviewUrl(stepKey: string): string | null {
  // TODO: brancher sur un endpoint qui renvoie l’URL ImageKit de l’exemple.
  // Pour l’instant, on retourne null -> affiche un cadre grisé “Photo exemple (portrait)”.
  return null;
}

/* =========================
   Page
   ========================= */

export default function GenerateurPage() {
  /* ----- 1) Contact / CRM ----- */
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<
    Array<{ name: string; company: string; email: string; phone: string; display: string }>
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [blockSearch, setBlockSearch] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const [np, setNp] = useState("");
  const [ns, setNs] = useState("");
  const [em, setEm] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [matchingCandidates, setMatchingCandidates] = useState<any[]>([]);
  const [selectedUserData, setSelectedUserData] = useState<any | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [c, setC] = useState("");
  const refChantierInput = useRef<HTMLInputElement>(null);

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (blockSearch) {
      setIsLoadingContacts(false);
      setShowResults(false);
      return;
    }
    if (contactQuery.trim().length < 2) {
      setContactResults([]);
      setIsLoadingContacts(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setIsLoadingContacts(true);
      const results = await fetchContacts(contactQuery);
      setContactResults(results);
      setShowResults(true);
      setIsLoadingContacts(false);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [contactQuery, blockSearch]);

  async function handleSelectContact(cand: {
    name: string;
    company: string;
    email: string;
    phone: string;
    display: string;
  }) {
    setBlockSearch(true);
    const newNp = cand.name || "";
    const newNs = cand.company || "";
    const newEm = cand.email || "";
    setNp(newNp);
    setNs(newNs);
    setEm(newEm);
    setContactPhone(cand.phone || "");
    setContactQuery(cand.name || "");
    setShowResults(false);

    setMatchingCandidates([]);
    setSelectedUserData(null);
    setLookupError(null);
    setIsLookupLoading(true);
    const { candidates, error } = await fetchLookup(newNp, newNs, newEm);
    setIsLookupLoading(false);
    if (error) {
      setLookupError("Impossible de récupérer l'historique.");
      return;
    }
    setMatchingCandidates(candidates || []);
    if (candidates?.length === 1) {
      const unique = candidates[0];
      setSelectedUserData(unique);
      if (unique.user_id) setContactPhone(unique.user_id);
    }
  }

  /* ----- 2) Produits / Feuilles / Intro ----- */
  const [products, setProducts] = useState<ProductApi[]>([]);
  const [p, setP] = useState("");
  const [s, setS] = useState("");
  const [ivData, setIvData] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => setProducts(await fetchProducts()))();
  }, []);

  const currentProduct = useMemo(
    () => products.find((prod) => prod.code === p),
    [products, p]
  );

  const currentSheet = useMemo(() => {
    if (!currentProduct) return undefined;
    return currentProduct.feuilles.find((f) => f.sheetName === s);
  }, [currentProduct, s]);

  const [availableGroups, setAvailableGroups] = useState<StepGroup[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  function handleProductChange(newCode: string) {
    setP(newCode);
    setS("");
    setIvData({});
    setAvailableGroups([]);
    setIsLoadingSteps(false);
    setStepsError(null);
    setSelectedSteps([]);
    // reset preview
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewTitle(null);
  }

  function handleSheetChange(newSheet: string) {
    setS(newSheet);
    setIvData({});
    setAvailableGroups([]);
    setIsLoadingSteps(false);
    setStepsError(null);
    setSelectedSteps([]);
    // reset preview
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewTitle(null);
  }

  function handleIvChange(key: string, value: string) {
    setIvData((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      if (!p || !s) {
        setAvailableGroups([]);
        setSelectedSteps([]);
        setStepsError(null);
        return;
      }
      setIsLoadingSteps(true);
      setStepsError(null);
      const { groups, error } = await fetchSteps(p, s);
      setIsLoadingSteps(false);
      if (error) {
        setAvailableGroups([]);
        setSelectedSteps([]);
        setStepsError("Impossible de récupérer les étapes pour cette feuille.");
        return;
      }
      setAvailableGroups(groups || []);
      setSelectedSteps([]);
    })();
  }, [p, s]);

  function toggleGroup(group: StepGroup) {
    // Sélectionner/Désélectionner toutes les keys du groupe
    setSelectedSteps((prev) => {
      const all = group.keys;
      const allInside = all.every((k) => prev.includes(k));
      if (allInside) return prev.filter((k) => !all.includes(k));
      const next = [...prev];
      for (const k of all) if (!next.includes(k)) next.push(k);
      return next;
    });
  }

  function isGroupChecked(group: StepGroup) {
    if (group.keys.length === 0) return false;
    return group.keys.every((k) => selectedSteps.includes(k));
  }

  const visibleGroups = useMemo(
    () => availableGroups.filter((g) => shouldShowGroup(g, ivData)),
    [availableGroups, ivData]
  );

  const selectedPhotoCount = useMemo(() => {
    if (!visibleGroups.length) return 0;
    const set = new Set(selectedSteps);
    let count = 0;
    for (const g of visibleGroups) {
      if (g.keys.length && g.keys.every((k) => set.has(k))) count++;
    }
    return count;
  }, [visibleGroups, selectedSteps]);

  const whatsappStepCount = selectedSteps.length; // nb de keys

  /** Regroupement par section (category) */
  const groupsByCategory = useMemo(() => {
    const out = new Map<string, StepGroup[]>();
    for (const g of visibleGroups) {
      const cat = g.category?.trim() || "Autres";
      if (!out.has(cat)) out.set(cat, []);
      out.get(cat)!.push(g);
    }
    return out; // Map<section, StepGroup[]>
  }, [visibleGroups]);

  function selectAllInCategory(cat: string) {
    const bucket = groupsByCategory.get(cat) || [];
    const allKeys = bucket.flatMap((b) => b.keys);
    setSelectedSteps((prev) => {
      const next = [...prev];
      for (const k of allKeys) if (!next.includes(k)) next.push(k);
      return next;
    });
    // 👉 Preview : une photo aléatoire de la DERNIÈRE section cliquée
    pickRandomPreviewFromCategory(cat);
  }

  function clearAllInCategory(cat: string) {
    const bucket = groupsByCategory.get(cat) || [];
    const allKeys = new Set(bucket.flatMap((b) => b.keys));
    setSelectedSteps((prev) => prev.filter((k) => !allKeys.has(k)));
    // On ne change PAS le preview sur "Aucun" (comportement souhaité implicite)
  }

  // --- Preview d'exemple (photo) ---
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function fetchExamplePhotoForGroup(
  prodCode: string,
  sheetName: string,
  groupLabel: string
): Promise<boolean> {
  const qs = new URLSearchParams({ produit: prodCode, sheet: sheetName, group: groupLabel });
  try {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewTitle(groupLabel);

    const res = await fetch(buildUrl("/example-photo", qs));
    const data = await res.json();
    setPreviewLoading(false);
    if (res.ok && data?.ok && data?.url) {
      setPreviewUrl(data.url);
      setPreviewError(null);
      return true;
    } else {
      setPreviewUrl(null);
      setPreviewError(data?.message || "Pas d’exemple photo disponible.");
      return false;
    }
  } catch {
    setPreviewLoading(false);
    setPreviewUrl(null);
    setPreviewError("Pas d’exemple photo disponible.");
    return false;
  }
}


  function shuffleInPlace<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Choisit un groupe aléatoire d'une catégorie et tente d'afficher une photo.
   *  Si le 1er n’a pas d’exemple, on essaie les suivants jusqu’à trouver ou épuiser. */
  async function pickRandomPreviewFromCategory(cat: string) {
    const bucket = groupsByCategory.get(cat) || [];
    if (!bucket.length || !p || !s) {
      setPreviewUrl(null);
      setPreviewError("Pas d’exemple photo disponible.");
      setPreviewTitle(null);
      return;
    }
    const candidates = shuffleInPlace(bucket.slice());
    for (const g of candidates) {
      const ok = await fetchExamplePhotoForGroup(p, s, g.label);
      if (ok) return; // ✅ première photo trouvée
    }
    // rien trouvé : on garde le dernier message d'erreur déjà posé
  }


  /* ----- 3) URL / WhatsApp ----- */
  const generatedUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (c) params.set("c", c);

    // ✅ Correction : utiliser valeur legacy du produit
    if (p) {
      const legacyP =
        (currentProduct?.label ?? p)
          .toLowerCase()
          .replace(/_/g, " ")
          .trim()
          .replace(/\s+/g, " ");
      params.set("p", legacyP);
    }

    if (s) params.set("s", s);
    if (selectedSteps.length > 0) params.set("steps", selectedSteps.join(","));
    if (np) params.set("np", np);
    if (ns) params.set("ns", ns);
    if (em) params.set("em", em);
    Object.entries(ivData).forEach(([k, v]) => {
      if (v && v.trim()) params.set(k, v.trim());
    });
    return `/plan?${params.toString()}`;
  }, [c, p, s, selectedSteps, np, ns, em, ivData, currentProduct]);

  const whatsappUrl = useMemo(() => {
    const PHONE_PERGE = "33744866654";
    if (!generatedUrl) return "";
    return `https://wa.me/${PHONE_PERGE}?text=${encodeURIComponent(generatedUrl)}`;
  }, [generatedUrl]);

  const [copiedWhatsUrl, setCopiedWhatsUrl] = useState(false);
  const withCopyFeedback = useCallback(
    async (value: string, setFlag: (v: boolean) => void) => {
      if (!value) return;
      await copyToClipboard(value);
      setFlag(true);
      setTimeout(() => setFlag(false), 1200);
    },
    []
  );

  const isReady =
    ns.trim() &&
    np.trim() &&
    em.trim() &&
    c.trim() &&
    p.trim() &&
    s.trim() &&
    selectedSteps.length > 0;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  }

  /* ----- 4) Reset ----- */
  function handleResetAll() {
    // Contact
    setContactQuery("");
    setContactResults([]);
    setShowResults(false);
    setBlockSearch(false);
    setIsLoadingContacts(false);
    setContactPhone("");
    setNp("");
    setNs("");
    setEm("");

    // Lookup
    setMatchingCandidates([]);
    setSelectedUserData(null);
    setIsLookupLoading(false);
    setLookupError(null);

    // Chantier / Produit
    setC("");
    setP("");
    setS("");
    setIvData({});
    setSelectedSteps([]);
    setAvailableGroups([]);
    setIsLoadingSteps(false);
    setStepsError(null);
    setPreviewKey(null);

    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewTitle(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================
     Render
     ========================= */

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Visual Assistant · Générateur de lien</h1>
        <button
          onClick={handleResetAll}
          className="text-sm flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg bg-white hover:bg-neutral-100 shadow-sm text-neutral-700"
          title="Réinitialiser tous les champs"
        >
          {/* icône reset */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 3a9 9 0 109 9" />
          </svg>
          Effacer tout
        </button>
      </div>

      {/* === INFOS CHANTIER === */}
      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Infos chantier</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              {/* icône user */}
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M12 14c-4.418 0-8 1.79-8 4v2h16v-2c0-2.21-3.582-4-8-4z"/></svg>
              Client (np) *
            </label>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={contactQuery}
              onChange={(e) => {
                setContactQuery(e.target.value);
                setShowResults(true);
                setBlockSearch(false);
              }}
              placeholder="Commence à taper : 'cordie', 'olivier lesieur'..."
            />
            {isLoadingContacts && (
              <div className="absolute right-3 top-8 text-xs text-neutral-500 flex items-center gap-1">
                <svg className="animate-spin h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Recherche…</span>
              </div>
            )}
            {showResults && contactResults.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-neutral-300 bg-white shadow">
                {contactResults.map((cand, idx) => (
                  <li
                    key={idx}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-neutral-100"
                    onClick={() => handleSelectContact(cand)}
                  >
                    {cand.display}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Société */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21h18M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14M9 7V3h6v4"/></svg>
              Société (ns) *
            </label>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={ns}
              onChange={(e) => setNs(e.target.value)}
              placeholder="LESIEUR OLIVIER PLOMBERIE"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>
              Email PDF (em) *
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={em}
              onChange={(e) => setEm(e.target.value)}
              placeholder="olivierlesieur78@gmail.com"
            />
          </div>

          {/* Réf chantier */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
              Réf chantier (c) *
            </label>
            <input
              ref={refChantierInput}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={c}
              onChange={(e) => setC(e.target.value)}
              placeholder="TEST"
            />

            {/* Historique / lookup */}
            <div className="mt-2 text-xs flex flex-col gap-2">
              {isLookupLoading && (
                <div className="text-neutral-500 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3 text-neutral-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>Recherche chantiers existants…</span>
                </div>
              )}

              {!isLookupLoading && lookupError && (
                <div className="text-neutral-500">{lookupError}</div>
              )}

              {!isLookupLoading && !lookupError && matchingCandidates.length > 1 && !selectedUserData && (
                <div className="flex flex-col gap-1">
                  <div className="text-neutral-600">Plusieurs contacts possibles :</div>
                  <div className="flex flex-wrap gap-2">
                    {matchingCandidates.map((cand, idx) => (
                      <button
                        key={idx}
                        className="rounded-full border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 px-2 py-1 text-[11px] leading-none text-left shadow-sm"
                        onClick={() => {
                          setSelectedUserData(cand);
                          if (cand.user_id) setContactPhone(cand.user_id);
                        }}
                        title={`${cand.profil?.nomPersonne || "—"} · ${cand.profil?.nomSociete || "—"}`}
                      >
                        <div className="font-medium">{cand.profil?.nomPersonne || "—"}</div>
                        <div className="text-[10px] text-neutral-500">{cand.profil?.nomSociete || "—"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isLookupLoading && !lookupError && selectedUserData && (
                <div className="flex flex-col gap-1">
                  <div className="text-neutral-600 flex flex-wrap items-baseline gap-2">
                    <span>
                      Chantiers existants pour{" "}
                      <span className="font-medium">
                        {selectedUserData.profil?.nomPersonne || "—"}
                      </span>
                      :
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono leading-none border border-neutral-200 rounded px-1 py-[2px] bg-neutral-50">
                      {selectedUserData.user_id || contactPhone || "—"}
                    </span>
                  </div>

                  {selectedUserData.chantiers?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedUserData.chantiers.map((ch: any, idx: number) => (
                        <button
                          key={idx}
                          className="rounded-full border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 px-2 py-1 text-[11px] leading-none shadow-sm flex flex-col text-left"
                          onClick={() => setC(ch.ref || "")}
                          title={`${ch.ref || ""} (${ch.status || "in_progress"})`}
                        >
                          <span className="font-medium text-neutral-800">{ch.ref || "—"}</span>
                          <span className="text-[10px] text-neutral-500">
                            {ch.produit || "—"} · {ch.status || "in_progress"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-[11px]">Aucun chantier trouvé pour ce contact.</div>
                  )}

                  <button
                    className="rounded-full border border-neutral-300 bg-white hover:bg-neutral-100 px-2 py-1 text-[11px] leading-none text-neutral-700 shadow-sm w-fit"
                    onClick={() => {
                      setC("");
                      refChantierInput.current?.focus();
                    }}
                  >
                    + Nouveau chantier
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Numéro WhatsApp historique (lecture seule) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 text-neutral-500">
              Numéro WhatsApp historique (lecture seule)
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
              value={contactPhone || "—"}
              readOnly
            />
          </div>
        </div>
      </section>

      {/* === CONFIGURATION CHANTIER (Produit + Feuille + iv_*) === */}
      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Configuration chantier</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Produit */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
              Produit (p) *
            </label>
            <select
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
              value={p}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">-- Choisir --</option>
              {products.map((prod) => (
                <option key={prod.code} value={prod.code}>
                  {prod.label}
                </option>
              ))}
            </select>
          </div>

          {/* Feuille / Version */}
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/></svg>
              Feuille / Version (s) *
            </label>
            <select
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
              value={s}
              disabled={!currentProduct}
              onChange={(e) => handleSheetChange(e.target.value)}
            >
              <option value="">-- Choisir --</option>
              {currentProduct?.feuilles.map((f) => (
                <option key={f.sheetName} value={f.sheetName}>
                  {f.sheetName}
                </option>
              ))}
            </select>
            {currentSheet?.sections?.length ? (
              <div className="mt-1 text-[11px] text-neutral-500 flex flex-wrap gap-2">
                {currentSheet.sections.map((sec) => (
                  <span
                    key={sec}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-[2px] leading-none"
                  >
                    {sec}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Intro iv_* */}
          {!currentProduct || !currentSheet ? (
            <div className="md:col-span-2 text-sm text-neutral-500">
              Sélectionne un produit et une feuille interne pour afficher les paramètres (ballon ECS, sondes, hydraulique…).
            </div>
          ) : (
            currentSheet.introFields.map((field) => {
              const visible = shouldShowField(field, ivData, currentSheet.introFields);
              if (!visible) return null;

              const isSelect = field.type === "select" || field.type === "choix" || !!field.options;
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1">{field.label}</label>
                  {isSelect ? (
                    <select
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
                      value={ivData[field.key] || ""}
                      onChange={(e) => handleIvChange(field.key, e.target.value)}
                    >
                      <option value="">-- Choisir --</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      value={ivData[field.key] || ""}
                      onChange={(e) => handleIvChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* === PHOTOS À DEMANDER === */}
      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-4">
        {/* --- En-tête avec compteurs --- */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Photos à demander</h2>
          <div className="text-right">
            <div className="text-sm text-neutral-700">
              {selectedPhotoCount} sélectionné{selectedPhotoCount > 1 ? "s" : ""}
            </div>
            <div className="text-[11px] text-neutral-500">
              {whatsappStepCount} étape{whatsappStepCount > 1 ? "s" : ""} WhatsApp
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* --- Colonne gauche : Catégories / Groupes --- */}
          <div className="lg:col-span-2 border border-neutral-200 rounded-lg p-3">
            {!p || !s ? (
              <p className="text-sm text-neutral-400">Sélectionne d’abord un produit et une feuille.</p>
            ) : isLoadingSteps ? (
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-neutral-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Chargement des étapes…
              </p>
            ) : stepsError ? (
              <p className="text-sm text-red-600">{stepsError}</p>
            ) : visibleGroups.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Aucune étape proposée (vérifie les paramètres ci-dessus).
              </p>
            ) : (
              Array.from(groupsByCategory.entries()).map(([cat, groups]) => (
                <div key={cat} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-neutral-700">{cat}</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-[11px] border border-neutral-300 rounded px-2 py-1 hover:bg-neutral-100"
                        onClick={() => selectAllInCategory(cat)}
                      >
                        Tout
                      </button>
                      <button
                        className="text-[11px] border border-neutral-300 rounded px-2 py-1 hover:bg-neutral-100"
                        onClick={() => clearAllInCategory(cat)}
                      >
                        Aucun
                      </button>
                    </div>
                  </div>

                  <ul className="grid md:grid-cols-2 gap-2">
                    {groups.map((group, idx) => {
                      const checked = isGroupChecked(group);
                      return (
                        <li
                          key={`${cat}-${idx}`}
                          className={`flex items-start gap-2 rounded-lg border border-neutral-200 p-2 cursor-pointer ${
                            checked ? "bg-neutral-50" : "bg-white"
                          }`}
                          onClick={async () => {
                            toggleGroup(group);
                            if (p && s) {
                              await fetchExamplePhotoForGroup(p, s, group.label);
                            }
                          }}
                          title={group.label}
                        >
                          <input type="checkbox" className="mt-1" checked={checked} readOnly />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{group.label}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* --- Colonne droite : Aperçu exemple --- */}
          <div className="border border-neutral-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-neutral-700">Aperçu exemple</div>
              {previewTitle ? (
                <div
                  className="text-xs text-neutral-500 truncate max-w-[60%]"
                  title={previewTitle}
                >
                  {previewTitle}
                </div>
              ) : null}
            </div>

            <div className="aspect-[3/4] w-full rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center gap-2 text-neutral-500 text-xs">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Chargement…
                </div>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewTitle || "Aperçu photo exemple"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-neutral-400">
                  {previewError || "Pas d’exemple photo disponible"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* === LIEN WHATSAPP === */}
      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-3">
        <h2 className="text-lg font-medium">Lien WhatsApp</h2>

        <div className="flex flex-col md:flex-row gap-2">
          <input
            className={`flex-1 rounded-lg border px-3 py-2 text-sm bg-neutral-50 transition-colors
              ${copiedWhatsUrl ? "border-neutral-600" : "border-neutral-300"}`}
            value={whatsappUrl}
            readOnly
          />
          <button
            className={`text-sm rounded-lg border px-3 py-2 transition-colors min-w-[140px]
              ${
                copiedWhatsUrl
                  ? "bg-neutral-700 border-neutral-800 text-white"
                  : "bg-neutral-900 border-neutral-300 text-white hover:bg-neutral-800"
              }
              disabled:opacity-30`}
            disabled={!isReady || !whatsappUrl}
            onClick={() => withCopyFeedback(whatsappUrl, setCopiedWhatsUrl)}
          >
            {copiedWhatsUrl ? "✓ Copié" : "Copier le lien"}
          </button>
          <a
            className="text-sm rounded-lg border border-neutral-300 px-3 py-2 bg-white hover:bg-neutral-100 text-neutral-800 text-center"
            href={whatsappUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!isReady || !whatsappUrl}
            onClick={(e) => {
              if (!isReady || !whatsappUrl) e.preventDefault();
            }}
          >
            Ouvrir WhatsApp
          </a>
        </div>

        <p className="text-xs text-neutral-500">
          Ce lien ouvre WhatsApp sur le numéro PERGE avec <strong>uniquement</strong> l’URL du diagnostic préremplie. L’installateur n’a plus qu’à envoyer.
        </p>
      </section>

      {/* (Optionnel futur) Presets & historique */}
      <section className="bg-white shadow rounded-xl p-4 flex flex-col gap-2">
        <h2 className="text-lg font-medium">Presets & Historique (bientôt)</h2>
        <p className="text-sm text-neutral-500">
          Ici on affichera les presets (PAC Hybride Démarrage, OptiPellet Fumisterie, etc.) et les derniers liens générés.
        </p>
      </section>
    </main>
  );
}
