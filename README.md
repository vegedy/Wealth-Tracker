# Wealth Tracker

Vollständige Web-Applikation zum Tracken des persönlichen Vermögens in **EUR**. Verwalte Bereiche (z.B. Tresor, Trade Republic, Tagesgeld) und ordne diesen beliebig viele Assets/Positionen zu.

## Features

- **Bereiche & Holdings**: Erstelle Bereiche und ordne ihnen Assets mit Mengen und Einheiten zu
- **Asset-Typen**: Aktien, ETFs, Krypto, Edelmetalle, Cash und benutzerdefinierte Assets
- **Drei Bewertungs-Modi**:
  - `known_market_asset`: Marktpreise (über externe API oder manuell)
  - `custom_manual`: Manuell eingegebene Preispunkte
  - `cash`: Automatisch 1 EUR pro Einheit (keine API-Abfrage nötig)
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
| Routing | wouter (hash-basiert) |
| State | TanStack React Query v5 |

## Datenmodell

### Area (Bereich)
- `id`, `name`, `description`, `createdAt`, `updatedAt`

### Asset (Anlage-Art)
- `id`, `name`, `category` (stock/etf/crypto/metal/cash/custom)
- `symbol` (Ticker, z.B. GOOGL, XAU)
- `sourceType` (known_market_asset / custom_manual / cash)
- `metadata` (JSON, z.B. ISIN)

### Holding (konkrete Position)
- `id`, `areaId`, `assetId`, `quantity`, `unit`

### PricePoint (Preiszeitreihe)
- `id`, `assetId`, `timestamp`, `pricePerUnit` (EUR), `source`

## Interpolationslogik

Die Zeitreihenberechnung (`server/timeseries.ts`) verwendet piecewise linear interpolation:

1. **Cash-Assets**: Preis ist immer 1.00 EUR/Einheit, keine Interpolation nötig.
2. **Mehrere Preispunkte**: Lineare Interpolation zwischen zwei bekannten Punkten:
   ```
   p(t) = p1 + (p2 - p1) * (t - t1) / (t2 - t1)
   ```
3. **Ein Preispunkt**: Konstanter Wert für alle Zeitpunkte.
4. **Außerhalb des bekannten Bereichs**: Flat Extrapolation (erster/letzter bekannter Wert).

Alle Zeitreihen werden auf ein tägliches Raster gemappt. Pro Tag wird für jedes Holding der interpolierte EUR-Wert berechnet: `quantity * pricePerUnit`.

## Prozentberechnung

- **Bereichsverteilung**: Für jeden Bereich wird die Summe aller Holdings berechnet. Der Prozentanteil = (Bereichswert / Gesamtwert) * 100.
- **Asset-Verteilung im Bereich**: Für jedes Holding wird der aktuelle Wert berechnet. Prozentanteil = (Holding-Wert / Bereichswert) * 100.

Alle Werte sind ausschließlich in EUR.

## Setup & Start

```bash
# Dependencies installieren
npm install

# Datenbank-Schema erstellen
npx drizzle-kit push

# Entwicklungsserver starten (Backend + Frontend auf Port 5000)
npm run dev
```

Die App startet auf `http://localhost:5000`. Beim ersten Start werden automatisch Seed-Daten geladen.

## Seed-Daten

Die App kommt mit Beispieldaten:

| Bereich | Assets |
|---|---|
| Tresor | 200g Gold, 1000g Silber, Sammlermünze Phoenix |
| Trade Republic | 3× Alphabet (GOOGL), 1× Amazon (AMZN) |
| Tagesgeld | 5.000 EUR Cash |

Preishistorie für 6 Monate (Oktober 2025 – März 2026).

## API-Endpunkte

### CRUD
- `GET/POST /api/areas` — Bereiche
- `GET/PATCH/DELETE /api/areas/:id`
- `GET/POST /api/assets` — Assets
- `GET/PATCH/DELETE /api/assets/:id`
- `GET/POST /api/holdings` — Holdings
- `GET/PATCH/DELETE /api/holdings/:id`
- `GET /api/holdings/area/:areaId` — Holdings eines Bereichs
- `GET /api/price-points/asset/:assetId` — Preispunkte
- `POST /api/price-points` — Neuen Preispunkt anlegen
- `DELETE /api/price-points/:id`

### Zeitreihen & Verteilung
- `GET /api/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD` — Wertverlauf (Area + Gesamt)
- `GET /api/distribution/areas?date=YYYY-MM-DD` — Bereichsverteilung (%)
- `GET /api/distribution/area/:areaId?date=YYYY-MM-DD` — Asset-Verteilung im Bereich (%)

### Import/Export
- `GET /api/export` — JSON-Download der gesamten Datenbank
- `POST /api/import?mode=replace|append` — JSON-Import

## Marktpreis-API (Erweiterung)

Die App ist vorbereitet für die Integration externer Preisdaten-APIs. Um z.B. Yahoo Finance einzubinden:

1. API-Key in `.env` konfigurieren
2. Cron-Job implementieren, der täglich Preise für `known_market_asset`-Assets abruft
3. Preise als PricePoints in die DB schreiben

Aktuell werden die Preise manuell über die UI oder Seed-Daten gepflegt.

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
│   └── seed.ts              # Beispieldaten
├── shared/
│   └── schema.ts            # Datenmodell (Drizzle + Zod)
└── README.md
```

## Währung

Alle Werte (PricePoints, Summen, Prozentangaben) sind **ausschließlich in EUR**. Dies gilt für die gesamte Anwendung, einschließlich Import/Export und API-Responses.
