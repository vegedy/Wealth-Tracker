import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Package, Coins, BarChart3, RefreshCw,
  CheckCircle2, AlertTriangle, Calendar, XCircle, ChevronDown,
  ChevronUp, Pencil, X, Check, History
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";
import type { Area, Asset, Holding, HoldingEntry } from "@shared/schema";

const CHART_COLORS = [
  "hsl(183, 55%, 42%)", "hsl(20, 60%, 55%)", "hsl(188, 55%, 38%)",
  "hsl(43, 74%, 60%)", "hsl(320, 45%, 58%)", "hsl(103, 43%, 47%)",
];

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("de-DE");
}

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = [
  { value: "stock", label: "Aktie" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Krypto" },
  { value: "metal", label: "Edelmetall" },
  { value: "cash", label: "Cash" },
  { value: "custom", label: "Sonstiges" },
];

const SOURCE_TYPES = [
  { value: "known_market_asset", label: "Marktpreis (API)" },
  { value: "custom_manual", label: "Manuell" },
  { value: "cash", label: "Cash (1 EUR)" },
];

interface PriceStatus {
  assetId: number;
  assetName: string;
  sourceType: string;
  symbol: string | null;
  hasPriceData: boolean;
  latestPrice: number | null;
  latestDate: string | null;
  totalPoints: number;
}

export default function AreasPage() {
  const { data: allAreas, isLoading: areasLoading } = useQuery<Area[]>({ queryKey: ["/api/areas"] });
  const { data: allAssets } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: allHoldings } = useQuery<Holding[]>({ queryKey: ["/api/holdings"] });
  const { data: priceStatus } = useQuery<PriceStatus[]>({ queryKey: ["/api/prices/status"] });

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas" data-testid="tab-areas">Bereiche</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">
            Assets
            {priceStatus && priceStatus.some(s => !s.hasPriceData) && (
              <AlertTriangle className="h-3.5 w-3.5 ml-1.5 text-yellow-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
          <TabsTrigger value="prices" data-testid="tab-prices">Preise</TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="space-y-4 mt-4">
          <AreasTab areas={allAreas} isLoading={areasLoading} />
        </TabsContent>
        <TabsContent value="assets" className="space-y-4 mt-4">
          <AssetsTab assets={allAssets} priceStatus={priceStatus} />
        </TabsContent>
        <TabsContent value="holdings" className="space-y-4 mt-4">
          <HoldingsTab holdings={allHoldings} areas={allAreas} assets={allAssets} />
        </TabsContent>
        <TabsContent value="prices" className="space-y-4 mt-4">
          <PricePointsTab assets={allAssets} priceStatus={priceStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Areas Tab ───────────────────────────────────────────────────────
function AreasTab({ areas, isLoading }: { areas?: Area[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/areas", { name: newName, description: newDesc || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setNewName(""); setNewDesc("");
      toast({ title: "Bereich erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/areas/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Bereich gelöscht" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Neuen Bereich anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Name (z.B. Tresor)" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-area-name" />
            <Input placeholder="Beschreibung (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} data-testid="input-area-desc" />
            <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} data-testid="button-create-area">Erstellen</Button>
          </div>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {areas?.map(area => (
            <Card key={area.id} data-testid={`card-area-${area.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium">{area.name}</div>
                  {area.description && <div className="text-sm text-muted-foreground">{area.description}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(area.id)} data-testid={`button-delete-area-${area.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {areas?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Noch keine Bereiche angelegt.</p>}
        </div>
      )}
    </>
  );
}

// ─── Assets Tab ──────────────────────────────────────────────────────
function AssetsTab({ assets, priceStatus }: { assets?: Asset[]; priceStatus?: PriceStatus[] }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [symbol, setSymbol] = useState("");
  const [sourceType, setSourceType] = useState("custom_manual");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/assets", { name, category, symbol: symbol || null, sourceType, metadata: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      setName(""); setSymbol("");
      toast({ title: "Asset erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/assets/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      toast({ title: "Asset gelöscht" });
    },
  });

  function getStatus(assetId: number) {
    return priceStatus?.find(s => s.assetId === assetId);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Neues Asset anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-asset-name" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-asset-category"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Symbol/Ticker" value={symbol} onChange={e => setSymbol(e.target.value)} data-testid="input-asset-symbol" />
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger data-testid="select-asset-source"><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} data-testid="button-create-asset">Erstellen</Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {assets?.map(asset => {
          const status = getStatus(asset.id);
          return (
            <Card key={asset.id} data-testid={`card-asset-${asset.id}`}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {asset.sourceType === "cash" ? <Coins className="h-4 w-4 text-muted-foreground" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {asset.name}
                      {status && asset.sourceType !== "cash" && (
                        status.hasPriceData
                          ? <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />{status.totalPoints} Preispunkte</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"><AlertTriangle className="h-3.5 w-3.5" />Keine Preisdaten</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{CATEGORIES.find(c => c.value === asset.category)?.label || asset.category}</Badge>
                      {asset.symbol && <Badge variant="outline" className="text-xs">{asset.symbol}</Badge>}
                      <Badge variant="outline" className="text-xs">{SOURCE_TYPES.find(s => s.value === asset.sourceType)?.label || asset.sourceType}</Badge>
                      {status?.latestDate && status.latestDate !== "immer" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Letzter Preis: {formatEur(status.latestPrice || 0)} ({status.latestDate})</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(asset.id)} data-testid={`button-delete-asset-${asset.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {(!assets || assets.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">Noch keine Assets angelegt.</p>}
      </div>
    </>
  );
}

// ─── Holdings Tab ────────────────────────────────────────────────────
function HoldingsTab({ holdings, areas, assets }: { holdings?: Holding[]; areas?: Area[]; assets?: Asset[] }) {
  const { toast } = useToast();
  const [areaId, setAreaId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [unit, setUnit] = useState("Stück");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("all");

  // New holding creation (container only — no entries yet)
  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/holdings", {
        areaId: Number(areaId),
        assetId: Number(assetId),
        quantity: 0,
        unit,
        validFrom: "",
        validTo: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Holding erstellt – füge jetzt Einträge in der Historien-Ansicht hinzu." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/holdings/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Holding gelöscht" });
    },
  });

  const filteredHoldings = selectedAreaFilter === "all"
    ? holdings
    : holdings?.filter(h => h.areaId === Number(selectedAreaFilter));

  const { data: areaDistData } = useQuery<{ assetId: number; assetName: string; value: number; percent: number }[]>({
    queryKey: ["/api/distribution/area", selectedAreaFilter, today()],
    queryFn: async () => {
      if (selectedAreaFilter === "all") return [];
      const res = await apiRequest("GET", `/api/distribution/area/${selectedAreaFilter}?date=${today()}`);
      return res.json();
    },
    enabled: selectedAreaFilter !== "all",
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Neues Holding anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Ein Holding verknüpft einen Bereich mit einem Asset. Die Mengen-Historie verwaltest du direkt in der Holding-Karte.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger data-testid="select-holding-area"><SelectValue placeholder="Bereich" /></SelectTrigger>
              <SelectContent>{areas?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger data-testid="select-holding-asset"><SelectValue placeholder="Asset" /></SelectTrigger>
              <SelectContent>{assets?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Einheit (z.B. Stück, g, EUR)" value={unit} onChange={e => setUnit(e.target.value)} className="max-w-44" data-testid="input-holding-unit" />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!areaId || !assetId || createMutation.isPending}
              data-testid="button-create-holding"
            >Anlegen</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Filter:</Label>
        <Select value={selectedAreaFilter} onValueChange={setSelectedAreaFilter}>
          <SelectTrigger className="w-48" data-testid="select-holding-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Bereiche</SelectItem>
            {areas?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3">
          {filteredHoldings?.map(h => {
            const area = areas?.find(a => a.id === h.areaId);
            const asset = assets?.find(a => a.id === h.assetId);
            return (
              <HoldingCard
                key={h.id}
                holding={h}
                area={area}
                asset={asset}
                onDelete={() => deleteMutation.mutate(h.id)}
              />
            );
          })}
          {(!filteredHoldings || filteredHoldings.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Holdings vorhanden.</p>
          )}
        </div>

        {selectedAreaFilter !== "all" && areaDistData && areaDistData.length > 0 && (
          <Card className="md:w-[340px] self-start">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Aktuelle Verteilung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={areaDistData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} dataKey="value" nameKey="assetName">
                    {areaDistData.filter(d => d.value > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 12, color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [formatEur(value), name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {areaDistData.filter(d => d.value > 0).map((d, i) => (
                  <div key={d.assetId} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground flex-1">{d.assetName}</span>
                    <span className="font-medium tabular-nums">{d.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

// ─── Holding Card with expandable history ────────────────────────────
function HoldingCard({
  holding, area, asset, onDelete
}: {
  holding: Holding;
  area?: Area;
  asset?: Asset;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [closeDialogId, setCloseDialogId] = useState<number | null>(null);
  const [closeDate, setCloseDate] = useState(today());

  // New entry form state
  const [newQty, setNewQty] = useState("");
  const [newFrom, setNewFrom] = useState(today());
  const [newTo, setNewTo] = useState("");
  const [newNote, setNewNote] = useState("");

  // Edit entry form state
  const [editQty, setEditQty] = useState("");
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: entries, isLoading } = useQuery<HoldingEntry[]>({
    queryKey: ["/api/holding-entries/holding", holding.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/holding-entries/holding/${holding.id}`);
      return res.json();
    },
    enabled: expanded,
  });

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/holding-entries", {
        holdingId: holding.id,
        quantity: Number(newQty),
        validFrom: newFrom,
        validTo: newTo || null,
        note: newNote || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holding-entries/holding", holding.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeseries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/distribution"] });
      setNewQty(""); setNewFrom(today()); setNewTo(""); setNewNote("");
      setShowAddEntry(false);
      toast({ title: "Eintrag hinzugefügt" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/holding-entries/${id}`, {
        quantity: Number(editQty),
        validFrom: editFrom,
        validTo: editTo || null,
        note: editNote || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holding-entries/holding", holding.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeseries"] });
      setEditingId(null);
      toast({ title: "Eintrag aktualisiert" });
    },
  });

  const closeEntryMutation = useMutation({
    mutationFn: async ({ id, validTo }: { id: number; validTo: string }) => {
      await apiRequest("POST", `/api/holding-entries/${id}/close`, { validTo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holding-entries/holding", holding.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeseries"] });
      setCloseDialogId(null);
      toast({ title: "Eintrag geschlossen" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/holding-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holding-entries/holding", holding.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeseries"] });
      toast({ title: "Eintrag gelöscht" });
    },
  });

  function startEdit(entry: HoldingEntry) {
    setEditingId(entry.id);
    setEditQty(String(entry.quantity));
    setEditFrom(entry.validFrom);
    setEditTo(entry.validTo || "");
    setEditNote(entry.note || "");
  }

  // Summary: active entries
  const activeEntries = entries?.filter(e => !e.validTo || e.validTo >= today()) || [];
  const totalActiveQty = activeEntries.reduce((s, e) => s + e.quantity, 0);

  return (
    <Card data-testid={`card-holding-${holding.id}`}>
      <CardContent className="py-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
              data-testid={`button-expand-holding-${holding.id}`}
            >
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {asset?.name || `Asset #${holding.assetId}`}
                  <Badge variant="outline" className="text-xs">{holding.unit}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  {area?.name || `Bereich #${holding.areaId}`}
                  {expanded && entries !== undefined && (
                    <span className="text-muted-foreground/60">
                      · {entries.length} Einträge
                      {totalActiveQty > 0 && <>, aktuell <span className="font-medium text-foreground">{totalActiveQty} {holding.unit}</span></>}
                    </span>
                  )}
                </div>
              </div>
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setExpanded(e => !e)}
                data-testid={`button-toggle-holding-${holding.id}`}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={onDelete}
                data-testid={`button-delete-holding-${holding.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded history */}
        {expanded && (
          <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Mengen-Historie
              </span>
              <Button
                variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => setShowAddEntry(e => !e)}
                data-testid={`button-add-entry-${holding.id}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Neuer Eintrag
              </Button>
            </div>

            {/* Add entry form */}
            {showAddEntry && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 mb-2">
                <p className="text-xs font-medium text-muted-foreground">Neuer Eintrag</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Menge</Label>
                    <Input type="number" step="any" placeholder="0" value={newQty} onChange={e => setNewQty(e.target.value)} className="h-8 text-sm" data-testid="input-entry-qty" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notiz (optional)</Label>
                    <Input placeholder="z.B. Kauf, Verkauf" value={newNote} onChange={e => setNewNote(e.target.value)} className="h-8 text-sm" data-testid="input-entry-note" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Gültig ab</Label>
                    <Input type="date" value={newFrom} onChange={e => setNewFrom(e.target.value)} className="h-8 text-sm" data-testid="input-entry-from" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Gültig bis (optional)</Label>
                    <Input type="date" value={newTo} onChange={e => setNewTo(e.target.value)} className="h-8 text-sm" data-testid="input-entry-to" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowAddEntry(false)}>Abbrechen</Button>
                  <Button size="sm" className="h-7" onClick={() => createEntryMutation.mutate()} disabled={!newQty || !newFrom || createEntryMutation.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Hinzufügen
                  </Button>
                </div>
              </div>
            )}

            {/* Entry list */}
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : entries && entries.length > 0 ? (
              <div className="space-y-1.5">
                {entries.map(entry => {
                  const isActive = !entry.validTo || entry.validTo >= today();
                  const isEditing = editingId === entry.id;

                  if (isEditing) {
                    return (
                      <div key={entry.id} className="rounded-md border border-primary/40 bg-muted/40 p-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Menge</Label>
                            <Input type="number" step="any" value={editQty} onChange={e => setEditQty(e.target.value)} className="h-7 text-sm" data-testid={`input-edit-qty-${entry.id}`} />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Notiz</Label>
                            <Input value={editNote} onChange={e => setEditNote(e.target.value)} className="h-7 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Gültig ab</Label>
                            <Input type="date" value={editFrom} onChange={e => setEditFrom(e.target.value)} className="h-7 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Gültig bis</Label>
                            <Input type="date" value={editTo} onChange={e => setEditTo(e.target.value)} className="h-7 text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" className="h-7" onClick={() => updateEntryMutation.mutate(entry.id)} disabled={updateEntryMutation.isPending}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Speichern
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={entry.id} className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm border ${isActive ? "border-green-500/20 bg-green-500/5" : "border-border/40 bg-muted/20 opacity-70"}`} data-testid={`row-entry-${entry.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium tabular-nums">{entry.quantity} {holding.unit}</span>
                          {isActive
                            ? <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-500/40">aktiv</Badge>
                            : <Badge variant="outline" className="text-xs text-muted-foreground">abgeschlossen</Badge>
                          }
                          {entry.note && <span className="text-xs text-muted-foreground truncate">{entry.note}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(entry.validFrom)}
                          {" → "}
                          {entry.validTo ? formatDate(entry.validTo) : <span className="text-green-600 dark:text-green-400">offen</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Close (set validTo to today) */}
                        {isActive && !entry.validTo && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Eintrag schließen"
                            onClick={() => { setCloseDialogId(entry.id); setCloseDate(today()); }}
                            data-testid={`button-close-entry-${entry.id}`}
                          >
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                        )}
                        {/* Edit */}
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => startEdit(entry)}
                          data-testid={`button-edit-entry-${entry.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => deleteEntryMutation.mutate(entry.id)}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">
                Noch keine Einträge. Klicke auf „Neuer Eintrag" um die erste Menge zu erfassen.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Close entry dialog */}
      <Dialog open={closeDialogId !== null} onOpenChange={open => !open && setCloseDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag schließen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bis wann gilt dieser Eintrag? Das heutige Datum ist vorausgefüllt.</p>
          <div className="space-y-2">
            <Label>Gültig bis</Label>
            <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} data-testid="input-close-date" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseDialogId(null)}>Abbrechen</Button>
            <Button
              onClick={() => closeDialogId !== null && closeEntryMutation.mutate({ id: closeDialogId, validTo: closeDate })}
              disabled={closeEntryMutation.isPending}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Price Points Tab ────────────────────────────────────────────────
function PricePointsTab({ assets, priceStatus }: { assets?: Asset[]; priceStatus?: PriceStatus[] }) {
  const { toast } = useToast();
  const [assetId, setAssetId] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [price, setPrice] = useState("");

  const { data: pricePoints, isLoading } = useQuery<any[]>({
    queryKey: ["/api/price-points/asset", assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const res = await apiRequest("GET", `/api/price-points/asset/${assetId}`);
      return res.json();
    },
    enabled: !!assetId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/price-points", {
        assetId: Number(assetId),
        timestamp: new Date(timestamp).toISOString(),
        pricePerUnit: Number(price),
        source: "manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-points/asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      setPrice(""); setTimestamp("");
      toast({ title: "Preispunkt erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/price-points/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-points/asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      toast({ title: "Preispunkt gelöscht" });
    },
  });

  const fetchAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prices/fetch-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-points/asset"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeseries"] });
      const fetched = data?.results?.filter((r: any) => r.added > 0) ?? [];
      const errors = data?.results?.filter((r: any) => r.error) ?? [];
      if (fetched.length > 0) {
        toast({ title: "Preise aktualisiert", description: fetched.map((r: any) => `${r.assetName}: +${r.added}`).join(", ") });
      } else if (errors.length > 0) {
        toast({ title: "Fehler beim Abrufen", description: errors.map((r: any) => `${r.assetName}: ${r.error}`).join("; "), variant: "destructive" });
      } else {
        toast({ title: "Preise bereits aktuell" });
      }
    },
    onError: () => toast({ title: "Fehler", description: "Preise konnten nicht abgerufen werden.", variant: "destructive" }),
  });

  const fetchSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/prices/fetch/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-points/asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/status"] });
      if (data.added > 0) toast({ title: "Preise abgerufen", description: `${data.added} neue Preispunkte hinzugefügt` });
      else if (data.error) toast({ title: "Fehler", description: data.error, variant: "destructive" });
      else toast({ title: "Bereits aktuell" });
    },
  });

  const missingPriceAssets = priceStatus?.filter(s => s.sourceType === "known_market_asset" && !s.hasPriceData) ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> API-Preise verwalten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => fetchAllMutation.mutate()} disabled={fetchAllMutation.isPending} data-testid="button-fetch-all-prices">
              <RefreshCw className={`h-4 w-4 mr-2 ${fetchAllMutation.isPending ? "animate-spin" : ""}`} />
              {fetchAllMutation.isPending ? "Wird abgerufen..." : "Alle Preise aktualisieren"}
            </Button>
            <span className="text-xs text-muted-foreground">Ruft aktuelle Kurse für alle Marktpreis-Assets via Yahoo Finance ab.</span>
          </div>
          {missingPriceAssets.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-yellow-700 dark:text-yellow-400">{missingPriceAssets.length} Asset(s) ohne Preisdaten: </span>
                <span className="text-muted-foreground">{missingPriceAssets.map(a => a.assetName).join(", ")}</span>
              </div>
            </div>
          )}
          {priceStatus && priceStatus.length > 0 && (
            <div className="space-y-1.5">
              {priceStatus.map(s => (
                <div key={s.assetId} className="flex items-center justify-between py-1.5 text-sm border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {s.hasPriceData ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-yellow-500" />}
                    <span className="font-medium">{s.assetName}</span>
                    {s.symbol && <Badge variant="outline" className="text-xs">{s.symbol}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.sourceType === "cash"
                      ? <span className="text-xs text-muted-foreground">1,00 EUR (fest)</span>
                      : s.hasPriceData
                        ? <span className="text-xs text-muted-foreground tabular-nums">{formatEur(s.latestPrice || 0)} ({s.latestDate}) · {s.totalPoints} Punkte</span>
                        : <span className="text-xs text-yellow-600 dark:text-yellow-400">Keine Daten</span>
                    }
                    {s.sourceType === "known_market_asset" && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fetchSingleMutation.mutate(s.assetId)} disabled={fetchSingleMutation.isPending} data-testid={`button-fetch-price-${s.assetId}`}>
                        <RefreshCw className={`h-3 w-3 ${fetchSingleMutation.isPending ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Manuellen Preispunkt hinzufügen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger data-testid="select-pp-asset"><SelectValue placeholder="Asset wählen" /></SelectTrigger>
              <SelectContent>{assets?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="datetime-local" value={timestamp} onChange={e => setTimestamp(e.target.value)} data-testid="input-pp-timestamp" />
            <Input type="number" step="0.01" placeholder="Preis/Einheit (EUR)" value={price} onChange={e => setPrice(e.target.value)} data-testid="input-pp-price" />
            <Button onClick={() => createMutation.mutate()} disabled={!assetId || !timestamp || !price || createMutation.isPending} data-testid="button-create-pp">Hinzufügen</Button>
          </div>
        </CardContent>
      </Card>

      {assetId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Preishistorie: {assets?.find(a => a.id === Number(assetId))?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-1">
                {pricePoints?.map((pp: any) => (
                  <div key={pp.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0" data-testid={`row-pp-${pp.id}`}>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{new Date(pp.timestamp).toLocaleDateString("de-DE")} {new Date(pp.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="ml-3 font-medium tabular-nums">{formatEur(pp.pricePerUnit)}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{pp.source}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(pp.id)} data-testid={`button-delete-pp-${pp.id}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                {(!pricePoints || pricePoints.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">Keine Preispunkte vorhanden.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
