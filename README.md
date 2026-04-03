# Wealth Tracker

Vollständige Web-Applikation zum Tracken des persönlichen Vermögens in **EUR**. Verwalte Bereiche (z.B. Tresor, Trade Republic, Tagesgeld) und ordne diesen beliebig viele Assets/Positionen zu.

## Features

- **Bereiche & Holdings**: Erstelle Bereiche und ordne ihnen Assets mit Mengen und Einheiten zu
- **Holding-Gültigkeit**: Jedes Holding hat ein Startdatum (Pflicht) und optionales Enddatum — nur im gültigen Zeitraum fließt es in die Berechnung ein
- **Asset-Typen**: Aktien, ETFs, Krypto, Edelmetalle, Cash und benutzerdefinierte Assets
- **Drei Bewertungs-Modi**:
  - `known_market_asset`: Automatische Marktpreise über Yahoo Finance API
  - `custom_manual`: Manuell eingegebene Preispunkte
  - `cash`: Automatisch 1 EUR pro Einheit (keine API-Abfrage nötig)
- **Yahoo Finance Integration**: Automatischer Abruf historischer und aktueller Preise beim Serverstart + manueller Abruf über UI-Button
- **Preisstatus-Anzeige**: Sofort sichtbar, welche Assets Preisdaten haben und welche nicht (Warnungen bei fehlenden Daten)
- **Interaktive Charts**: Recharts-basierte Line-Charts und Donut-Charts
- **Zeitraum-Picker**: 7 Tage, 1/3/6 Monate, 1 Jahr, Gesamt
- **Verteilungsanalyse**: Prozentuale Aufteilung nach Bereich und nach Asset
- **Import/Export**: Vollständiger JSON-Export/-Import der Datenbank
- **Dark Theme**: Modernes, poliertes Finance-Dashboard-Design

## Tech Stack

| Komponente | Technologie |
|---|---|
| Frontend | React 18 + TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Express.js (TypeScript) |
| Datenbank | SQLite (better-sqlite3) mit Drizzle ORM |
| Preisdaten | yahoo-finance2 v3 (automatisch, kein API-Key nötig) |
| Routing | wouter (hash-basiert) |
| State | TanStack React Query v5 |

## Datenmodell

### Area (Bereich)
- `id`, `name`, `description`, `createdAt`, `updatedAt`

### Asset (Anlage-Art)
- `id`, `name`, `category` (stock/etf/crypto/metal/cash/custom)
- `symbol` (Ticker, z.B. GOOGL, XAU, AAPL)
- `sourceType` (known_market_asset / custom_manual / cash)
- `metadata` (JSON, z.B. ISIN)

### Holding (konkrete Position)
- `id`, `areaId`, `assetId`, `quantity`, `unit`
- `validFrom` (YYYY-MM-DD, Pflicht) — ab wann das Holding aktiv ist
- `validTo` (YYYY-MM-DD, optional) — bis wann das Holding aktiv war (null = noch gehalten)

### PricePoint (Preiszeitreihe)
- `id`, `assetId`, `timestamp`, `pricePerUnit` (EUR), `source` (yahoo/manual)

## Holding-Gültigkeit

Holdings haben einen definierten Gültigkeitszeitraum:
- **validFrom** (Pflicht): Das Datum, ab dem das Holding in Berechnungen einfließt
- **validTo** (optional): Das Datum, bis zu dem das Holding aktiv ist. Ist kein Enddatum gesetzt, gilt es als "noch gehalten"
- In der Zeitreihenberechnung wird für jeden Tag geprüft: `date >= validFrom AND (validTo IS NULL OR date <= validTo)`
- Legacy-Holdings ohne Startdatum werden als "immer aktiv" behandelt (Abwärtskompatibilität)

## Yahoo Finance Integration

Preise werden automatisch über die Yahoo Finance API abgerufen:

- **Automatisch beim Serverstart**: Alle `known_market_asset`-Assets werden im Hintergrund aktualisiert
- **Manuell per Button**: Im Tab "Preise" kann der Abruf jederzeit ausgelöst werden
- **Einzeln pro Asset**: Jedes Market-Asset hat einen eigenen Aktualisierungs-Button

### Unterstützte Ticker/Symbole

| Typ | Symbol-Format | Beispiel | EUR-Konvertierung |
|---|---|---|---|
| US-Aktien | Ticker | AAPL, GOOGL, AMZN | Automatisch via EURUSD=X |
| DE-Aktien | Ticker.DE | SAP.DE, BMW.DE | Bereits in EUR |
| Gold (pro g) | XAU | XAU | GC=F ÷ 31.1035, USD→EUR |
| Silber (pro g) | XAG | XAG | SI=F ÷ 31.1035, USD→EUR |
| Krypto | Ticker-USD | BTC-USD | USD→EUR |

Beim ersten Abruf werden bis zu 1 Jahr historische Tagesdaten geladen. Danach werden nur neue Tage nachgeholt.

## Interpolationslogik

Die Zeitreihenberechnung (`server/timeseries.ts`) verwendet piecewise linear interpolation:

1. **Cash-Assets**: Preis ist immer 1.00 EUR/Einheit, keine Interpolation nötig.
2. **Mehrere Preispunkte**: Lineare Interpolation zwischen zwei bekannten Punkten:
   ```
   p(t) = p1 + (p2 - p1) * (t - t1) / (t2 - t1)
   ```
3. **Ein Preispunkt**: Konstanter Wert für alle Zeitpunkte.
4. **Außerhalb des bekannten Bereichs**: Flat Extrapolation (erster/letzter bekannter Wert).

Alle Zeitreihen werden auf ein tägliches Raster gemappt. Pro Tag wird für jedes aktive Holding der interpolierte EUR-Wert berechnet: `quantity * pricePerUnit`.

## Prozentberechnung

- **Bereichsverteilung**: Für jeden Bereich wird die Summe aller aktiven Holdings berechnet. Der Prozentanteil = (Bereichswert / Gesamtwert) * 100.
- **Asset-Verteilung im Bereich**: Für jedes aktive Holding wird der aktuelle Wert berechnet. Prozentanteil = (Holding-Wert / Bereichswert) * 100.

Alle Werte sind ausschließlich in EUR.

## Setup & Start

```bash
# Dependencies installieren
npm install

# Entwicklungsserver starten (Backend + Frontend auf Port 5000)
npm run dev
```

Die App startet auf `http://localhost:5000`. Beim ersten Start werden automatisch Seed-Daten geladen und Marktpreise abgerufen.

**Hinweis**: yahoo-finance2 v3 empfiehlt Node.js >= 22. Mit Node.js 20 funktioniert es ebenfalls, es erscheint lediglich eine Warnung.

## Seed-Daten

Die App kommt mit Beispieldaten:

| Bereich | Assets | Gültig ab |
|---|---|---|
| Tresor | 200g Gold, 1000g Silber, Sammlermünze Phoenix | Juni–September 2025 |
| Trade Republic | 3× Alphabet (GOOGL), 1× Amazon (AMZN) | Juli–August 2025 |
| Tagesgeld | 5.000 EUR Cash | Juni 2025 |

Manuelle Preishistorie für 6 Monate (Oktober 2025 – März 2026) + automatische Yahoo Finance Preise ab dem letzten manuellen Punkt.

## API-Endpunkte

### CRUD
- `GET/POST /api/areas` — Bereiche
- `GET/PATCH/DELETE /api/areas/:id`
- `GET/POST /api/assets` — Assets
- `GET/PATCH/DELETE /api/assets/:id`
- `GET/POST /api/holdings` — Holdings (mit validFrom/validTo)
- `GET/PATCH/DELETE /api/holdings/:id`
- `GET /api/holdings/area/:areaId` — Holdings eines Bereichs
- `GET /api/price-points/asset/:assetId` — Preispunkte
- `POST /api/price-points` — Neuen Preispunkt anlegen
- `DELETE /api/price-points/:id`

### Zeitreihen & Verteilung
- `GET /api/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD` — Wertverlauf (Area + Gesamt)
- `GET /api/distribution/areas?date=YYYY-MM-DD` — Bereichsverteilung (%)
- `GET /api/distribution/area/:areaId?date=YYYY-MM-DD` — Asset-Verteilung im Bereich (%)

### Preisabruf
- `POST /api/prices/fetch-all` — Alle Marktpreise aktualisieren
- `POST /api/prices/fetch/:assetId` — Preise für ein einzelnes Asset abrufen
- `GET /api/prices/status` — Preisstatus aller Assets (Anzahl Punkte, letzter Preis, etc.)

### Import/Export
- `GET /api/export` — JSON-Download der gesamten Datenbank
- `POST /api/import?mode=replace|append` — JSON-Import

## Projektstruktur

```
wealth-tracker/
├── client/src/
│   ├── App.tsx              # Routing, Layout, Sidebar
│   ├── pages/
│   │   ├── dashboard.tsx    # Dashboard mit KPIs, Line-Chart, Donut
│   │   ├── areas.tsx        # Bereiche, Assets, Holdings, Preise
│   │   └── import-export.tsx
│   ├── components/
│   │   ├── app-sidebar.tsx  # Navigation
│   │   ├── theme-provider.tsx
│   │   └── ui/              # shadcn/ui Komponenten
│   └── index.css            # Dark/Light Theme (Finance)
├── server/
│   ├── routes.ts            # API-Routen
│   ├── storage.ts           # Datenbank-Layer (Drizzle ORM)
│   ├── timeseries.ts        # Zeitreihen, Interpolation, Prozente
│   ├── price-fetcher.ts     # Yahoo Finance Integration
│   └── seed.ts              # Beispieldaten
├── shared/
│   └── schema.ts            # Datenmodell (Drizzle + Zod)
└── README.md
```

## Währung

Alle Werte (PricePoints, Summen, Prozentangaben) sind **ausschließlich in EUR**. Dies gilt für die gesamte Anwendung, einschließlich Import/Export und API-Responses.
