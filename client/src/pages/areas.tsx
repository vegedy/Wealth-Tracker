import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Package, Coins, BarChart3 } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";
import type { Area, Asset, Holding } from "@shared/schema";

const CHART_COLORS = [
  "hsl(183, 55%, 42%)", "hsl(20, 60%, 55%)", "hsl(188, 55%, 38%)",
  "hsl(43, 74%, 60%)", "hsl(320, 45%, 58%)", "hsl(103, 43%, 47%)",
];

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

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

export default function AreasPage() {
  const { toast } = useToast();

  const { data: allAreas, isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: allAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: allHoldings } = useQuery<Holding[]>({
    queryKey: ["/api/holdings"],
  });

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas" data-testid="tab-areas">Bereiche</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
          <TabsTrigger value="prices" data-testid="tab-prices">Preise</TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="space-y-4 mt-4">
          <AreasTab areas={allAreas} isLoading={areasLoading} />
        </TabsContent>

        <TabsContent value="assets" className="space-y-4 mt-4">
          <AssetsTab assets={allAssets} />
        </TabsContent>

        <TabsContent value="holdings" className="space-y-4 mt-4">
          <HoldingsTab holdings={allHoldings} areas={allAreas} assets={allAssets} />
        </TabsContent>

        <TabsContent value="prices" className="space-y-4 mt-4">
          <PricePointsTab assets={allAssets} />
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
      setNewName("");
      setNewDesc("");
      toast({ title: "Bereich erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/areas/${id}`);
    },
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
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Neuen Bereich anlegen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Name (z.B. Tresor)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              data-testid="input-area-name"
            />
            <Input
              placeholder="Beschreibung (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              data-testid="input-area-desc"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              data-testid="button-create-area"
            >
              Erstellen
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {areas?.map((area) => (
            <Card key={area.id} data-testid={`card-area-${area.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium">{area.name}</div>
                  {area.description && <div className="text-sm text-muted-foreground">{area.description}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(area.id)}
                  data-testid={`button-delete-area-${area.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {areas?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Bereiche angelegt.</p>
          )}
        </div>
      )}
    </>
  );
}

// ─── Assets Tab ──────────────────────────────────────────────────────
function AssetsTab({ assets }: { assets?: Asset[] }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [symbol, setSymbol] = useState("");
  const [sourceType, setSourceType] = useState("custom_manual");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/assets", {
        name,
        category,
        symbol: symbol || null,
        sourceType,
        metadata: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setName("");
      setSymbol("");
      toast({ title: "Asset erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Asset gelöscht" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Neues Asset anlegen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-asset-name" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-asset-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Symbol/Ticker" value={symbol} onChange={(e) => setSymbol(e.target.value)} data-testid="input-asset-symbol" />
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger data-testid="select-asset-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} data-testid="button-create-asset">
              Erstellen
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {assets?.map((asset) => (
          <Card key={asset.id} data-testid={`card-asset-${asset.id}`}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {asset.sourceType === "cash" ? <Coins className="h-4 w-4 text-muted-foreground" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <div className="font-medium text-sm">{asset.name}</div>
                  <div className="flex gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">{CATEGORIES.find(c => c.value === asset.category)?.label || asset.category}</Badge>
                    {asset.symbol && <Badge variant="outline" className="text-xs">{asset.symbol}</Badge>}
                    <Badge variant="outline" className="text-xs">{SOURCE_TYPES.find(s => s.value === asset.sourceType)?.label || asset.sourceType}</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(asset.id)} data-testid={`button-delete-asset-${asset.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!assets || assets.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-8">Noch keine Assets angelegt.</p>
        )}
      </div>
    </>
  );
}

// ─── Holdings Tab ────────────────────────────────────────────────────
function HoldingsTab({ holdings, areas, assets }: { holdings?: Holding[]; areas?: Area[]; assets?: Asset[] }) {
  const { toast } = useToast();
  const [areaId, setAreaId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Stück");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("all");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/holdings", {
        areaId: Number(areaId),
        assetId: Number(assetId),
        quantity: Number(quantity),
        unit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      setQuantity("");
      toast({ title: "Holding erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/holdings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Holding gelöscht" });
    },
  });

  // Asset distribution chart for selected area
  const filteredHoldings = selectedAreaFilter === "all"
    ? holdings
    : holdings?.filter((h) => h.areaId === Number(selectedAreaFilter));

  const { data: areaDistData } = useQuery<{ assetId: number; assetName: string; value: number; percent: number }[]>({
    queryKey: ["/api/distribution/area", selectedAreaFilter, `?date=${new Date().toISOString().slice(0, 10)}`],
    queryFn: async () => {
      if (selectedAreaFilter === "all") return [];
      const res = await apiRequest("GET", `/api/distribution/area/${selectedAreaFilter}?date=${new Date().toISOString().slice(0, 10)}`);
      return res.json();
    },
    enabled: selectedAreaFilter !== "all",
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Neues Holding anlegen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger data-testid="select-holding-area"><SelectValue placeholder="Bereich" /></SelectTrigger>
              <SelectContent>
                {areas?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger data-testid="select-holding-asset"><SelectValue placeholder="Asset" /></SelectTrigger>
              <SelectContent>
                {assets?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Menge" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-holding-quantity" />
            <Input placeholder="Einheit" value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="input-holding-unit" />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!areaId || !assetId || !quantity || createMutation.isPending}
              data-testid="button-create-holding"
            >
              Erstellen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Area filter + distribution chart */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Filter:</Label>
            <Select value={selectedAreaFilter} onValueChange={setSelectedAreaFilter}>
              <SelectTrigger className="w-48" data-testid="select-holding-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Bereiche</SelectItem>
                {areas?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filteredHoldings?.map((h) => {
              const area = areas?.find((a) => a.id === h.areaId);
              const asset = assets?.find((a) => a.id === h.assetId);
              return (
                <Card key={h.id} data-testid={`card-holding-${h.id}`}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-sm">{h.quantity} {h.unit} {asset?.name || `Asset #${h.assetId}`}</div>
                      <div className="text-xs text-muted-foreground">{area?.name || `Bereich #${h.areaId}`}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(h.id)} data-testid={`button-delete-holding-${h.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {(!filteredHoldings || filteredHoldings.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Holdings vorhanden.</p>
            )}
          </div>
        </div>

        {/* Asset distribution in area */}
        {selectedAreaFilter !== "all" && areaDistData && areaDistData.length > 0 && (
          <Card className="md:w-[360px]">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Verteilung im Bereich
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={areaDistData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="assetName"
                  >
                    {areaDistData.filter(d => d.value > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number, name: string) => [formatEur(value), name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
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

// ─── Price Points Tab ────────────────────────────────────────────────
function PricePointsTab({ assets }: { assets?: Asset[] }) {
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
      setPrice("");
      setTimestamp("");
      toast({ title: "Preispunkt erstellt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/price-points/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-points/asset", assetId] });
      toast({ title: "Preispunkt gelöscht" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Manuellen Preispunkt hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger data-testid="select-pp-asset"><SelectValue placeholder="Asset wählen" /></SelectTrigger>
              <SelectContent>
                {assets?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} data-testid="input-pp-timestamp" />
            <Input type="number" step="0.01" placeholder="Preis/Einheit (EUR)" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="input-pp-price" />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!assetId || !timestamp || !price || createMutation.isPending}
              data-testid="button-create-pp"
            >
              Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      {assetId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Preishistorie: {assets?.find(a => a.id === Number(assetId))?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
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
                {(!pricePoints || pricePoints.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Preispunkte vorhanden.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
