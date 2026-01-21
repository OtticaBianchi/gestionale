"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  NotebookText,
  Plus,
  Save,
  X,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useUser } from "@/context/UserContext";

type Categoria = "lenti" | "montature" | "lac" | "sport" | "lab_esterno" | "accessori";

type Supplier = {
  id?: string;
  nome: string;
  referente_nome?: string | null;
  telefono?: string | null;
  email?: string | null;
  web_address?: string | null;
  tempi_consegna_medi?: number | null;
  note?: string | null;
};

const CATEGORIE: { key: Categoria; label: string }[] = [
  { key: "lenti", label: "Lenti" },
  { key: "montature", label: "Montature" },
  { key: "lac", label: "Lenti a Contatto" },
  { key: "accessori", label: "Accessori e Liquidi" },
  { key: "sport", label: "Sport" },
  { key: "lab_esterno", label: "Laboratorio Esterno" },
];

export default function FornitoriManagerPage() {
  const { profile } = useUser();
  const isAdmin = profile?.role === "admin";

  const [active, setActive] = useState<Categoria>("lenti");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Supplier>({ nome: "" });

  const load = async (cat: Categoria) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fornitori?tipo=${cat}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore caricamento fornitori");
      setSuppliers(json.items || []);
    } catch (e: any) {
      console.error(e);
      setSuppliers([]);
    } finally {
      setLoading(false);
      setEditingId(null);
      setDraft(null);
    }
  };

  useEffect(() => {
    load(active);
  }, [active]);

  const onEdit = (s: Supplier) => {
    setEditingId(s.id || null);
    setDraft({ ...s });
  };

  const onCancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const onSave = async () => {
    if (!editingId || !draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fornitori/${editingId}?tipo=${active}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore salvataggio");
      setSuppliers((prev) => prev.map((x) => (x.id === editingId ? json.item : x)));
      setEditingId(null);
      setDraft(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onCreate = async () => {
    if (!newSupplier.nome.trim()) {
      alert("Inserisci il nome del fornitore");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/fornitori?tipo=${active}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSupplier),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore creazione fornitore");
      setSuppliers((prev) => [json.item, ...prev]);
      setNewSupplier({ nome: "" });
      setCreating(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (supplier: Supplier) => {
    if (!supplier.id) return;
    if (!confirm(`Sei sicuro di voler eliminare il fornitore "${supplier.nome}"? Questa azione è irreversibile.`)) {
      return;
    }
    setDeleting(supplier.id);
    try {
      const res = await fetch(`/api/fornitori/${supplier.id}?tipo=${active}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore eliminazione fornitore");
      setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const Header = (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>← Torna alla Dashboard</span>
        </Link>
        <div className="flex items-center space-x-3">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Gestione Fornitori</h1>
        </div>
      </div>
    </div>
  );

  const Tabs = (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIE.map((c) => (
        <button
          key={c.key}
          onClick={() => setActive(c.key)}
          className={`px-3 py-2 text-sm rounded-md border transition-colors ${
            active === c.key
              ? "bg-blue-600 text-white border-blue-700"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  const CreateBar = (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-blue-800 font-medium">
          {creating ? "Nuovo fornitore" : "Aggiungi un fornitore"}
        </span>
        <div className="flex gap-2">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nuovo
            </button>
          ) : (
            <>
              <button
                onClick={onCreate}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewSupplier({ nome: "" });
                }}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
            </>
          )}
        </div>
      </div>

      {creating && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-4">
          <input
            placeholder="Nome"
            value={newSupplier.nome}
            onChange={(e) => setNewSupplier({ ...newSupplier, nome: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="Referente"
            value={newSupplier.referente_nome || ""}
            onChange={(e) => setNewSupplier({ ...newSupplier, referente_nome: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="Telefono"
            value={newSupplier.telefono || ""}
            onChange={(e) => setNewSupplier({ ...newSupplier, telefono: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="Email"
            type="email"
            value={newSupplier.email || ""}
            onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="URL portale"
            value={newSupplier.web_address || ""}
            onChange={(e) => setNewSupplier({ ...newSupplier, web_address: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="Tempi medi (gg)"
            value={newSupplier.tempi_consegna_medi ?? ""}
            onChange={(e) =>
              setNewSupplier({
                ...newSupplier,
                tempi_consegna_medi: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="border rounded px-3 py-2"
          />
          <input
            placeholder="Note"
            value={newSupplier.note || ""}
            onChange={(e) => setNewSupplier({ ...newSupplier, note: e.target.value })}
            className="md:col-span-6 border rounded px-3 py-2"
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {Header}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Intro */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Gestisci dati fornitori
              </h2>
              <p className="text-gray-600 mt-1">
                Aggiorna referente, contatti, URL del portale e note. I link ai portali vengono usati in Filtri Ordini.
              </p>
            </div>
          </div>
          <div className="mt-4">{Tabs}</div>
        </div>

        {CreateBar}

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="font-medium text-gray-900">
              {CATEGORIE.find((c) => c.key === active)?.label} – {suppliers.length} fornitori
            </div>
            <button
              onClick={() => load(active)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aggiorna
            </button>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-6 text-gray-500">Caricamento fornitori...</div>
            ) : suppliers.length === 0 ? (
              <div className="p-6 text-gray-500">Nessun fornitore trovato</div>
            ) : (
              suppliers.map((s) => (
                <div key={s.id} className="p-4">
                  {editingId === s.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <input
                        className="border rounded px-3 py-2"
                        value={draft?.nome || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), nome: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="Referente"
                        value={draft?.referente_nome || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), referente_nome: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="Telefono"
                        value={draft?.telefono || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), telefono: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="Email"
                        type="email"
                        value={draft?.email || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), email: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="URL portale"
                        value={draft?.web_address || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), web_address: e.target.value })}
                      />
                      <input
                        className="border rounded px-3 py-2"
                        placeholder="Tempi medi (gg)"
                        value={draft?.tempi_consegna_medi ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...(draft as Supplier),
                            tempi_consegna_medi: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                      <input
                        className="md:col-span-6 border rounded px-3 py-2"
                        placeholder="Note"
                        value={draft?.note || ""}
                        onChange={(e) => setDraft({ ...(draft as Supplier), note: e.target.value })}
                      />
                      <div className="md:col-span-6 flex gap-2 justify-end">
                        <button
                          onClick={onSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salva
                        </button>
                        <button onClick={onCancel} className="px-3 py-2 text-gray-600 hover:text-gray-800">
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">{s.nome}</div>
                        <div className="text-sm text-gray-600 flex flex-wrap gap-4">
                          {s.referente_nome && (
                            <span className="flex items-center gap-1"><NotebookText className="w-3 h-3" /> {s.referente_nome}</span>
                          )}
                          {s.telefono && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.telefono}</span>
                          )}
                          {s.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.email}</span>
                          )}
                          {s.web_address && (
                            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {s.web_address}</span>
                          )}
                          {s.tempi_consegna_medi != null && (
                            <span>{s.tempi_consegna_medi} gg medi</span>
                          )}
                        </div>
                        {s.note && <div className="text-sm text-gray-500">Note: {s.note}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(s)}
                          className="px-3 py-2 border rounded hover:bg-gray-50"
                        >
                          Modifica
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDelete(s)}
                            disabled={deleting === s.id}
                            className="px-3 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                            title="Elimina fornitore"
                          >
                            {deleting === s.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

