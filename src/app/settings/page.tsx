"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import AppShell from "../../components/AppShell";

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

type CatalogValue = string | { code?: string | null; label?: string | null };

type ProductDocumentCatalog = {
  document_types?: CatalogValue[];
  statuses?: CatalogValue[];
  indexing_statuses?: CatalogValue[];
  source_kinds?: CatalogValue[];
  suggested_tags?: CatalogValue[];
};

type ProductDocument = {
  document_id?: string | null;
  id?: string | null;
  product_code?: string | null;
  product_label?: string | null;
  product?: string | null;
  title?: string | null;
  document_type?: string | null;
  version?: string | null;
  status?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  source?: {
    url?: string | null;
    kind?: string | null;
    filename?: string | null;
    file_name?: string | null;
    mime_type?: string | null;
  } | null;
  indexing?: {
    status?: string | null;
    updated_at?: number | string | null;
    last_error?: string | null;
  } | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
};

type DocumentFormState = {
  product: string;
  title: string;
  document_type: string;
  version: string;
  status: string;
  tags: string[];
  notes: string;
};

const EMPTY_FORM: DocumentFormState = {
  product: "",
  title: "",
  document_type: "",
  version: "",
  status: "",
  tags: [],
  notes: "",
};

const FALLBACK_PRODUCTS = [
  { code: "pac_hybride", label: "PAC hybride" },
  { code: "pac", label: "PAC" },
  { code: "optipellet", label: "OptiPellet" },
  { code: "optitherm_biofioul", label: "Optitherm biofioul" },
  { code: "opticondens", label: "OptiCondens" },
  { code: "optiduo", label: "OptiDuo" },
  { code: "mc_classique", label: "MC Classique" },
  { code: "mc_ci", label: "MC CI" },
  { code: "gfi", label: "GFI" },
  { code: "bruleur_f100", label: "Brûleur F100" },
  { code: "rc7", label: "Régulation RC7" },
  { code: "mr32", label: "MR32" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeStr(v: unknown, fallback = "") {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}

function docId(doc: ProductDocument) {
  return safeStr(doc.document_id || doc.id);
}

function optionCode(value: CatalogValue) {
  return typeof value === "string" ? value : safeStr(value.code || value.label);
}

function optionLabel(value: CatalogValue) {
  if (typeof value === "string") return humanLabel(value);
  return safeStr(value.label || value.code);
}

function normalizeOptions(values?: CatalogValue[]) {
  const seen = new Set<string>();
  const options: Array<{ code: string; label: string }> = [];

  for (const value of values || []) {
    const code = optionCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    options.push({ code, label: optionLabel(value) || code });
  }

  return options;
}

function humanLabel(value?: string | null) {
  const raw = safeStr(value);
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function productLabel(code?: string | null) {
  const raw = safeStr(code);
  return FALLBACK_PRODUCTS.find((p) => p.code === raw)?.label || humanLabel(raw);
}

function docProductCode(doc: ProductDocument) {
  return safeStr(doc.product_code || doc.product);
}

function docProductLabel(doc: ProductDocument) {
  return safeStr(doc.product_label) || productLabel(docProductCode(doc));
}

function unwrapDocumentResponse(data: unknown): ProductDocument | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.document && typeof record.document === "object") {
    return record.document as ProductDocument;
  }
  return record as ProductDocument;
}

function uniqStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const s = value.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function statusBadgeClass(status?: string | null) {
  const s = safeStr(status).toLowerCase();
  if (["active", "actif", "published", "reference"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["obsolete", "obsolète", "obsoletee", "archived"].includes(s)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (["draft", "a_verifier", "à vérifier", "to_check"].includes(s)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function indexingBadgeClass(status?: string | null) {
  const s = safeStr(status).toLowerCase();
  if (["indexed", "done", "ready", "success"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["failed", "error"].includes(s)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (["pending", "processing", "queued", "in_progress"].includes(s)) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        className
      )}
    >
      {children}
    </span>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

function documentToForm(doc: ProductDocument): DocumentFormState {
  return {
    product: docProductCode(doc),
    title: safeStr(doc.title),
    document_type: safeStr(doc.document_type),
    version: safeStr(doc.version),
    status: safeStr(doc.status),
    tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    notes: safeStr(doc.notes),
  };
}

function formPayload(form: DocumentFormState) {
  return {
    product_code: form.product.trim(),
    product_label: productLabel(form.product),
    title: form.title.trim(),
    document_type: form.document_type.trim(),
    version: form.version.trim() || null,
    status: form.status.trim() || null,
    tags: uniqStrings(form.tags),
    notes: form.notes.trim() || null,
  };
}

export default function SettingsPage() {
  const [catalog, setCatalog] = useState<ProductDocumentCatalog | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<DocumentFormState>(EMPTY_FORM);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [partialUploadError, setPartialUploadError] = useState<string | null>(
    null
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DocumentFormState>(EMPTY_FORM);
  const [editTagDraft, setEditTagDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const documentTypeOptions = useMemo(
    () => normalizeOptions(catalog?.document_types),
    [catalog]
  );
  const statusOptions = useMemo(
    () => normalizeOptions(catalog?.statuses),
    [catalog]
  );
  const suggestedTags = useMemo(
    () => normalizeOptions(catalog?.suggested_tags).map((t) => t.code),
    [catalog]
  );

  const productOptions = useMemo(() => {
    const fromDocs = documents
      .map((doc) => docProductCode(doc))
      .filter(Boolean)
      .map((code) => ({ code, label: productLabel(code) }));

    const merged = [...FALLBACK_PRODUCTS, ...fromDocs];
    const seen = new Set<string>();
    return merged.filter((p) => {
      if (!p.code || seen.has(p.code)) return false;
      seen.add(p.code);
      return true;
    });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!productFilter) return documents;
    return documents.filter((doc) => docProductCode(doc) === productFilter);
  }, [documents, productFilter]);

  const fetchCatalog = async () => {
    const res = await fetch(buildUrl("/product-documents/catalog"), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Erreur lors du chargement du catalogue.");
    return (await res.json()) as ProductDocumentCatalog;
  };

  const fetchDocuments = async (product = productFilter) => {
    const res = await fetch(
      buildUrl("/product-documents", product ? { product } : undefined),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Erreur lors du chargement des documents.");
    const data = await res.json();
    if (Array.isArray(data)) return data as ProductDocument[];
    if (Array.isArray(data?.documents)) return data.documents as ProductDocument[];
    if (Array.isArray(data?.items)) return data.items as ProductDocument[];
    return [];
  };

  const refresh = async (initial = false) => {
    setError(null);
    if (initial) setLoading(true);
    else setRefreshing(true);

    try {
      const [catalogData, docsData] = await Promise.all([
        fetchCatalog(),
        fetchDocuments(),
      ]);
      setCatalog(catalogData);
      setDocuments(docsData);
    } catch (e) {
      console.error("product documents refresh error", e);
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    void (async () => {
      setRefreshing(true);
      setError(null);
      try {
        setDocuments(await fetchDocuments(productFilter));
      } catch (e) {
        console.error("product documents filter error", e);
        setError(e instanceof Error ? e.message : "Erreur réseau.");
      } finally {
        setRefreshing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productFilter]);

  useEffect(() => {
    setAddForm((prev) => ({
      ...prev,
      document_type: prev.document_type || documentTypeOptions[0]?.code || "",
      status: prev.status || statusOptions[0]?.code || "",
    }));
  }, [documentTypeOptions, statusOptions]);

  const resetAdd = () => {
    setAddForm({
      ...EMPTY_FORM,
      document_type: documentTypeOptions[0]?.code || "",
      status: statusOptions[0]?.code || "",
      product: productFilter || "",
    });
    setAddFile(null);
    setTagDraft("");
    setAddError(null);
    setPartialUploadError(null);
  };

  const openAdd = () => {
    resetAdd();
    setAddOpen(true);
  };

  const addTag = (
    value: string,
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>
  ) => {
    const tag = value.trim();
    if (!tag) return;
    setForm({ ...form, tags: uniqStrings([...form.tags, tag]) });
  };

  const removeTag = (
    tag: string,
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>
  ) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const submitAdd = async () => {
    setAddError(null);
    setPartialUploadError(null);

    if (!addForm.product.trim() || !addForm.title.trim() || !addForm.document_type.trim()) {
      setAddError("Produit, titre et type de document sont obligatoires.");
      return;
    }

    if (!addFile) {
      setAddError("Sélectionne un PDF avant d’ajouter le document.");
      return;
    }

    setAdding(true);
    try {
      const metaRes = await fetch(buildUrl("/product-documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(addForm)),
        cache: "no-store",
      });

      if (!metaRes.ok) {
        const text = await metaRes.text().catch(() => "");
        setAddError(
          text && text.length < 260
            ? `Erreur création metadata: ${text}`
            : "Erreur lors de la création de la metadata."
        );
        return;
      }

      const created = unwrapDocumentResponse(await metaRes.json());
      if (!created) {
        setPartialUploadError(
          "Metadata créée, mais la réponse ne contient pas de fiche document exploitable. Upload PDF impossible depuis l’UI."
        );
        await refresh();
        return;
      }
      const createdId = docId(created);

      if (!createdId) {
        setPartialUploadError(
          "Metadata créée, mais l’identifiant du document est absent dans la réponse. Upload PDF impossible depuis l’UI."
        );
        await refresh();
        return;
      }

      const fd = new FormData();
      fd.append("file", addFile);

      const fileRes = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(createdId)}/file`),
        {
          method: "POST",
          body: fd,
          cache: "no-store",
        }
      );

      if (!fileRes.ok) {
        const text = await fileRes.text().catch(() => "");
        setPartialUploadError(
          text && text.length < 260
            ? `Metadata créée (${createdId}), mais upload PDF échoué: ${text}`
            : `Metadata créée (${createdId}), mais upload PDF échoué.`
        );
        await refresh();
        return;
      }

      setAddOpen(false);
      resetAdd();
      await refresh();
    } catch (e) {
      console.error("product document add error", e);
      setAddError("Erreur réseau lors de l’ajout du document.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (doc: ProductDocument) => {
    setActionError(null);
    setEditingId(docId(doc));
    setEditForm(documentToForm(doc));
    setEditTagDraft("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingId(editingId);
    setActionError(null);

    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(editingId)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title.trim(),
            document_type: editForm.document_type.trim(),
            version: editForm.version.trim() || null,
            status: editForm.status.trim() || null,
            tags: uniqStrings(editForm.tags),
            notes: editForm.notes.trim() || null,
          }),
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setActionError(
          text && text.length < 260
            ? `Erreur modification: ${text}`
            : "Erreur lors de la modification du document."
        );
        return;
      }

      setEditingId(null);
      await refresh();
    } catch (e) {
      console.error("product document edit error", e);
      setActionError("Erreur réseau lors de la modification du document.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteDocument = async (doc: ProductDocument) => {
    const id = docId(doc);
    if (!id) return;
    const ok = window.confirm(
      `Supprimer la fiche document "${safeStr(doc.title, id)}" ?`
    );
    if (!ok) return;

    setDeletingId(id);
    setActionError(null);
    try {
      const res = await fetch(
        buildUrl(`/product-documents/${encodeURIComponent(id)}`),
        {
          method: "DELETE",
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setActionError(
          text && text.length < 260
            ? `Erreur suppression: ${text}`
            : "Erreur lors de la suppression du document."
        );
        return;
      }

      if (editingId === id) setEditingId(null);
      await refresh();
    } catch (e) {
      console.error("product document delete error", e);
      setActionError("Erreur réseau lors de la suppression du document.");
    } finally {
      setDeletingId(null);
    }
  };

  const renderTagEditor = (
    form: DocumentFormState,
    setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>,
    draft: string,
    setDraft: React.Dispatch<React.SetStateAction<string>>
  ) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {form.tags.length ? (
          form.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            >
              {tag}
              <button
                type="button"
                className="text-slate-400 hover:text-slate-900"
                onClick={() => removeTag(tag, form, setForm)}
                aria-label={`Retirer ${tag}`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Aucun tag.
          </div>
        )}
      </div>

      {suggestedTags.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestedTags.map((tag) => {
            const active = form.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  active
                    ? removeTag(tag, form, setForm)
                    : addTag(tag, form, setForm)
                }
                className={cx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          placeholder="Ajouter un tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft, form, setForm);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={() => {
            addTag(draft, form, setForm);
            setDraft("");
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-10 py-7 backdrop-blur">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Paramètres
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Administration de la documentation produit PRIA
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} />
              </button>

              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un document
              </button>
            </div>
          </div>
        </div>

        <section className="px-10 py-7">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    Documentation produits
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Associer les notices, schémas et guides PDF aux produits PERGE.
                  </p>
                </div>
              </div>

              <label className="flex min-w-[260px] flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">
                  Filtrer par produit
                </span>
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  <option value="">Tous les produits</option>
                  {productOptions.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Chargement des documents...
            </div>
          ) : error ? (
            <ErrorBox>{error}</ErrorBox>
          ) : (
            <div className="space-y-4">
              {actionError ? <ErrorBox>{actionError}</ErrorBox> : null}

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Documents existants
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {filteredDocuments.length} document
                      {filteredDocuments.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {refreshing ? (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Actualisation
                    </span>
                  ) : null}
                </div>

                {filteredDocuments.length === 0 ? (
                  <div className="p-6">
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-300" />
                      <div className="mt-3 font-semibold text-slate-900">
                        Aucun document produit
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Ajoute un premier PDF technique pour ce périmètre.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Document
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Produit
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Statut
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Tags
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Indexation
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            PDF
                          </th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((doc) => {
                          const id = docId(doc);
                          const isEditing = editingId === id;
                          const pdfUrl = safeStr(doc.source?.url);

                          return (
                            <React.Fragment key={id || safeStr(doc.title)}>
                              <tr className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                                <td className="px-5 py-4">
                                  <div className="font-semibold text-slate-950">
                                    {safeStr(doc.title, "Sans titre")}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
                                      {humanLabel(doc.document_type)}
                                    </Badge>
                                    {doc.version ? <span>{doc.version}</span> : null}
                                    {id ? <span className="font-mono">{id}</span> : null}
                                  </div>
                                  {doc.notes ? (
                                    <div className="mt-2 line-clamp-2 text-sm text-slate-500">
                                      {doc.notes}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-5 py-4 text-sm text-slate-700">
                                  {docProductLabel(doc)}
                                </td>
                                <td className="px-5 py-4">
                                  <Badge className={statusBadgeClass(doc.status)}>
                                    {humanLabel(doc.status)}
                                  </Badge>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex max-w-[240px] flex-wrap gap-1.5">
                                    {(doc.tags || []).length ? (
                                      (doc.tags || []).map((tag) => (
                                        <span
                                          key={tag}
                                          className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                                        >
                                          {tag}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-slate-400">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <Badge
                                    className={indexingBadgeClass(doc.indexing?.status)}
                                  >
                                    {humanLabel(doc.indexing?.status || "non_indexe")}
                                  </Badge>
                                  {doc.indexing?.last_error ? (
                                    <div className="mt-2 flex max-w-[220px] items-start gap-1.5 text-xs text-red-600">
                                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                      <span className="line-clamp-2">
                                        {doc.indexing.last_error}
                                      </span>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-5 py-4">
                                  {pdfUrl ? (
                                    <a
                                      href={pdfUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                                    >
                                      Ouvrir
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-sm text-amber-700">
                                      PDF absent
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        isEditing ? setEditingId(null) : startEdit(doc)
                                      }
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                                    >
                                      {isEditing ? "Fermer" : "Modifier"}
                                    </button>
                                    <button
                                      type="button"
                                      title="Supprimer"
                                      onClick={() => void deleteDocument(doc)}
                                      disabled={deletingId === id}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      {deletingId === id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {isEditing ? (
                                <tr className="border-b border-slate-100 bg-slate-50/70">
                                  <td colSpan={7} className="px-5 py-5">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                      <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                          <h4 className="font-semibold text-slate-950">
                                            Modifier la fiche document
                                          </h4>
                                          <p className="mt-1 text-sm text-slate-500">
                                            Le produit et le PDF ne sont pas modifiés ici.
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        <label className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-slate-700">
                                            Titre
                                          </span>
                                          <input
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                            value={editForm.title}
                                            onChange={(e) =>
                                              setEditForm({
                                                ...editForm,
                                                title: e.target.value,
                                              })
                                            }
                                          />
                                        </label>

                                        <label className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-slate-700">
                                            Type
                                          </span>
                                          <select
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                            value={editForm.document_type}
                                            onChange={(e) =>
                                              setEditForm({
                                                ...editForm,
                                                document_type: e.target.value,
                                              })
                                            }
                                          >
                                            {documentTypeOptions.map((opt) => (
                                              <option key={opt.code} value={opt.code}>
                                                {opt.label}
                                              </option>
                                            ))}
                                            {!documentTypeOptions.some(
                                              (o) => o.code === editForm.document_type
                                            ) && editForm.document_type ? (
                                              <option value={editForm.document_type}>
                                                {humanLabel(editForm.document_type)}
                                              </option>
                                            ) : null}
                                          </select>
                                        </label>

                                        <label className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-slate-700">
                                            Version
                                          </span>
                                          <input
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                            value={editForm.version}
                                            onChange={(e) =>
                                              setEditForm({
                                                ...editForm,
                                                version: e.target.value,
                                              })
                                            }
                                          />
                                        </label>

                                        <label className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-slate-700">
                                            Statut
                                          </span>
                                          <select
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                            value={editForm.status}
                                            onChange={(e) =>
                                              setEditForm({
                                                ...editForm,
                                                status: e.target.value,
                                              })
                                            }
                                          >
                                            {statusOptions.map((opt) => (
                                              <option key={opt.code} value={opt.code}>
                                                {opt.label}
                                              </option>
                                            ))}
                                            {!statusOptions.some(
                                              (o) => o.code === editForm.status
                                            ) && editForm.status ? (
                                              <option value={editForm.status}>
                                                {humanLabel(editForm.status)}
                                              </option>
                                            ) : null}
                                          </select>
                                        </label>
                                      </div>

                                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        <div>
                                          <div className="mb-2 text-sm font-medium text-slate-700">
                                            Tags
                                          </div>
                                          {renderTagEditor(
                                            editForm,
                                            setEditForm,
                                            editTagDraft,
                                            setEditTagDraft
                                          )}
                                        </div>

                                        <label className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-slate-700">
                                            Notes
                                          </span>
                                          <textarea
                                            className="min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                            value={editForm.notes}
                                            onChange={(e) =>
                                              setEditForm({
                                                ...editForm,
                                                notes: e.target.value,
                                              })
                                            }
                                          />
                                        </label>
                                      </div>

                                      <div className="mt-5 flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingId(null)}
                                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                                        >
                                          Annuler
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void saveEdit()}
                                          disabled={savingId === id}
                                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                        >
                                          {savingId === id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
                                          Enregistrer
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {addOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Ajouter un document produit
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Création de la metadata puis upload du PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                  title="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(92vh-150px)] overflow-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">
                      Produit <span className="text-red-500">*</span>
                    </span>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      value={addForm.product}
                      onChange={(e) =>
                        setAddForm({ ...addForm, product: e.target.value })
                      }
                    >
                      <option value="">Sélectionner un produit</option>
                      {productOptions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">
                      Type <span className="text-red-500">*</span>
                    </span>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      value={addForm.document_type}
                      onChange={(e) =>
                        setAddForm({
                          ...addForm,
                          document_type: e.target.value,
                        })
                      }
                    >
                      {documentTypeOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 lg:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Titre <span className="text-red-500">*</span>
                    </span>
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      placeholder="Ex : Notice installation PAC hybride"
                      value={addForm.title}
                      onChange={(e) =>
                        setAddForm({ ...addForm, title: e.target.value })
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">
                      Version
                    </span>
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      placeholder="Ex : v3.2"
                      value={addForm.version}
                      onChange={(e) =>
                        setAddForm({ ...addForm, version: e.target.value })
                      }
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">
                      Statut
                    </span>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      value={addForm.status}
                      onChange={(e) =>
                        setAddForm({ ...addForm, status: e.target.value })
                      }
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      PDF <span className="text-red-500">*</span>
                    </div>
                    <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center hover:border-orange-300 hover:bg-orange-50">
                      <Upload className="h-6 w-6 text-slate-400" />
                      <span className="mt-3 text-sm font-medium text-slate-800">
                        {addFile ? addFile.name : "Sélectionner un PDF"}
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        Upload via ImageKit côté backend
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Tags
                    </div>
                    {renderTagEditor(
                      addForm,
                      setAddForm,
                      tagDraft,
                      setTagDraft
                    )}
                  </div>
                </div>

                <label className="mt-5 flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700">
                    Notes
                  </span>
                  <textarea
                    className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    value={addForm.notes}
                    onChange={(e) =>
                      setAddForm({ ...addForm, notes: e.target.value })
                    }
                  />
                </label>

                {addError ? <div className="mt-4"><ErrorBox>{addError}</ErrorBox></div> : null}
                {partialUploadError ? (
                  <div className="mt-4">
                    <InfoBox>{partialUploadError}</InfoBox>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void submitAdd()}
                  disabled={adding}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Ajouter document
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
