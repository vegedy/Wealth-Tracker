import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, AlertTriangle, CheckCircle } from "lucide-react";

export default function ImportExportPage() {
  const { toast } = useToast();
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const res = await apiRequest("GET", "/api/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wealth-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export erfolgreich", description: "JSON-Datei wurde heruntergeladen." });
    } catch (err: any) {
      toast({ title: "Export fehlgeschlagen", description: err.message, variant: "destructive" });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Ungültige JSON-Datei.");
      }

      // Validate — holdingEntries is optional (v2.0+), holdings is required
      if (!data.areas || !data.assets || !data.holdings || !data.pricePoints) {
        throw new Error("Ungültiges Format: areas, assets, holdings und pricePoints werden erwartet.");
      }
      // Warn if holdingEntries is missing (old v1 export) — import will still work
      if (!data.holdingEntries || data.holdingEntries.length === 0) {
        console.warn("Import: holdingEntries fehlt oder leer. Holdings werden ohne Mengen-Historie importiert.");
      }

      const res = await apiRequest("POST", `/api/import?mode=${importMode}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setImportResult({ success: true, message: data.message || "Import erfolgreich!" });
      // Invalidate all queries
      queryClient.invalidateQueries();
      toast({ title: "Import erfolgreich" });
    },
    onError: (err: Error) => {
      setImportResult({ success: false, message: err.message });
      toast({ title: "Import fehlgeschlagen", description: err.message, variant: "destructive" });
    },
  });

  const handleImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Keine Datei ausgewählt", variant: "destructive" });
      return;
    }
    importMutation.mutate(file);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full max-w-2xl">
      {/* Export */}
      <Card data-testid="card-export">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" /> Daten exportieren
          </CardTitle>
          <CardDescription className="text-xs">
            Exportiere alle Bereiche, Assets, Holdings und Preispunkte als JSON-Datei.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            JSON herunterladen
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card data-testid="card-import">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Daten importieren
          </CardTitle>
          <CardDescription className="text-xs">
            Importiere eine zuvor exportierte JSON-Datei. Alle Werte sind in EUR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Importmodus</Label>
            <Select value={importMode} onValueChange={(v) => setImportMode(v as "replace" | "append")}>
              <SelectTrigger className="w-64" data-testid="select-import-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Ersetzen (bestehende Daten löschen)</SelectItem>
                <SelectItem value="append">Hinzufügen (zu bestehenden Daten)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">JSON-Datei auswählen</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              data-testid="input-import-file"
            />
          </div>

          {importMode === "replace" && (
            <div className="flex items-center gap-2 text-sm text-amber-500">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Achtung: Alle bestehenden Daten werden gelöscht und durch die importierten Daten ersetzt.</span>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={importMutation.isPending}
            data-testid="button-import"
          >
            <Upload className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importiere..." : "Importieren"}
          </Button>

          {importResult && (
            <div className={`flex items-center gap-2 text-sm mt-2 ${importResult.success ? "text-green-500" : "text-destructive"}`}>
              {importResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{importResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Datenformat</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-x-auto">
{`{
  "version": "2.0",
  "currency": "EUR",
  "areas": [{ "name": "...", "description": "..." }],
  "assets": [{
    "name": "...",
    "category": "stock|etf|crypto|metal|cash|custom",
    "symbol": "GOOGL",
    "sourceType": "known_market_asset|custom_manual|cash"
  }],
  "holdings": [{
    "areaId": 1,
    "assetId": 1,
    "unit": "g"
  }],
  "holdingEntries": [{
    "holdingId": 1,
    "quantity": 200,
    "validFrom": "2025-06-01",
    "validTo": null,
    "note": "Kauf"
  }],
  "pricePoints": [{
    "assetId": 1,
    "timestamp": "2025-01-01T12:00:00Z",
    "pricePerUnit": 85.20,
    "source": "manual"
  }]
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
