# Master Prompt: AI-Based Automated Urban Parcel Mapping and Cadastral Feature Extraction System

Use this as a single "master prompt" — feed it to an AI coding assistant (Claude Code, GPT, etc.), paste it into your team's project charter, or use it section-by-section as sprint briefs. It is written so that an AI system or a development team can execute the project end to end without needing the original problem statement re-explained.

---

## 0. Role and Objective (paste this first if prompting an AI assistant)

> You are acting as a lead GeoAI / Computer Vision engineer and full-stack GIS architect. Design and build, end to end, an **AI-enabled Automated Cadastral Mapping Platform** that ingests drone/orthorectified imagery and elevation data, automatically extracts urban parcel boundaries, building footprints, roads, and land-use classes, converts these into topologically valid GIS-ready vector layers, flags conflicts with existing parcel records, and exposes everything through a Web-GIS dashboard for review, editing, and Ground Truthing (GT) sign-off. Work module by module, produce runnable code, explain trade-offs, and default to open-source/GDAL/QGIS-compatible geospatial standards unless told otherwise.

---

## 1. Problem Context (for reference / grounding)

- Cadastral mapping today is manual: drone imagery is visually interpreted, parcel boundaries are hand-digitized, and Ground Truthing is field-heavy.
- Dense urban fabric — irregular parcels, encroachments, overlapping structures, narrow lanes, mixed land use — makes manual digitization slow and error-prone.
- Inputs now available at scale: high-resolution drone imagery, Orthorectified Imagery (ORI), DSM/DTM, existing GIS parcel layers, GT datasets, GNSS/CORS survey points.
- Goal: use AI/Computer Vision/GeoAI to automate 70–90% of feature extraction, leaving humans to review, correct, and approve rather than draw from scratch.

---

## 2. System Architecture (target end state)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION LAYER                          │
│  Drone imagery │ ORI (tiled) │ DSM/DTM (raster) │ GT points/polygons │
│  Existing parcel GIS layers │ GNSS/CORS survey data                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PREPROCESSING & DATA ENGINEERING                 │
│  Orthorectification check │ Tiling/chipping │ CRS normalization      │
│  Radiometric correction │ DSM-DTM → nDSM (building height raster)    │
│  Georeferencing GT to imagery │ Train/val/test split by geography    │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI / DEEP LEARNING CORE                         │
│  1. Building footprint segmentation (instance segmentation)          │
│  2. Road/pathway extraction (semantic seg + skeletonization)         │
│  3. Parcel boundary delineation (edge/line detection + graph infer.) │
│  4. Land-use / land-cover classification (patch or pixel classifier) │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                POST-PROCESSING & VECTORIZATION ENGINE                │
│  Raster→vector (polygonize) │ Regularization (right-angle snapping)  │
│  Topology build (nodes, edges, faces) │ Overlap/gap/sliver detection │
│  Conflation with existing parcel layer │ Conflict flagging            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GIS DATA / SERVICES LAYER                        │
│  PostGIS (parcels, buildings, roads, land-use, GT, audit log)        │
│  GeoServer/pg_tileserv → WMS/WFS/vector tiles                        │
│  Versioning: parcel_id, geometry history, edit provenance             │
└───────────────────────────────┬───────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WEB-GIS DASHBOARD (frontend)                      │
│  Map viewer (imagery + AI layers + existing cadastre overlay)        │
│  Editing tools (split/merge/reshape parcel, accept/reject AI polygon)│
│  GT/field verification workflow, QA/QC review queue, exports         │
│  Analytics: coverage %, conflict counts, extraction accuracy         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Recommended Technology Stack

| Layer | Recommended tools |
|---|---|
| Imagery/geospatial processing | GDAL/OGR, Rasterio, PDAL (for DSM/DTM point clouds), OpenDroneMap for raw drone processing |
| AI/ML frameworks | PyTorch, `segmentation-models-pytorch`, Detectron2/MMDetection (instance seg), Meta's SAM/SAM2 (assisted segmentation), U-Net/DeepLabV3+/HRNet (semantic seg) |
| Vectorization/geometry | Shapely, GeoPandas, `rasterio.features`, `simplification`/`buildingregulariser` for right-angle regularization, `topojson`/`networkx` for topology graphs |
| Database | PostgreSQL + PostGIS |
| Tile/map services | GeoServer or `pg_tileserv` + `martin` (vector tiles), MapProxy for imagery tiling |
| Backend API | FastAPI (Python) or Node/Express, with async task queue (Celery/RQ) for long-running inference jobs |
| Frontend Web-GIS | React + MapLibre GL JS or OpenLayers (open standards, avoids vendor lock-in); Leaflet acceptable for lighter needs |
| Editing tools | Mapbox GL Draw / OpenLayers Draw + custom topology-aware snapping |
| Orchestration/MLOps | Docker + Docker Compose (or Kubernetes for scale), MLflow for experiment tracking, DVC for dataset versioning |
| GT/field app (optional) | QField or a lightweight PWA syncing to PostGIS via QGIS server |

---

## 4. Execution Plan — Module by Module

### Module 1: Data Ingestion & Preprocessing
- Build ingestion pipelines for drone imagery, ORI, DSM, DTM, GT shapefiles/GeoJSON, and GNSS/CORS point data.
- Normalize all layers to a common CRS (e.g., local UTM zone or national grid, e.g. EPSG:32643 for parts of India).
- Compute **nDSM = DSM − DTM** to isolate above-ground structures (key input for building height/footprint inference).
- Tile large ORI/DSM into overlapping chips (e.g., 512×512 or 1024×1024 px) with sufficient overlap (10–20%) for seamless stitching later.
- Automate quality checks: resolution consistency, no-data gaps, misalignment between ORI and DSM/DTM.

**Deliverable:** a reproducible ETL pipeline (script/DAG) that takes raw drone/ORI/DSM/DTM/GT inputs and outputs clean, tiled, CRS-aligned training-ready datasets.

### Module 2: Building Footprint Extraction
- Train an instance segmentation model (Mask R-CNN, HRNet, or fine-tuned SAM with prompts derived from nDSM height peaks) on ORI + nDSM as multi-channel input.
- Use existing GT/parcel layers as weak supervision or for fine-tuning where labeled footprints exist.
- Post-process: polygon regularization to enforce orthogonal/rectilinear corners typical of buildings, remove small artifacts, merge over-segmented rooftops.

**Deliverable:** building footprint vector layer with confidence scores per polygon.

### Module 3: Road & Access Corridor Detection
- Semantic segmentation (U-Net/DeepLabV3+) trained on ORI to classify road/pathway pixels, including narrow access lanes typical of dense settlements.
- Skeletonize the road mask (morphological thinning) to derive centerlines, then vectorize into a routable road network graph.
- Classify road hierarchy (main road / access lane / footpath) using width and connectivity heuristics.

**Deliverable:** road centerline network as a topologically connected vector layer.

### Module 4: Parcel Boundary Delineation
- This is the hardest module because parcel lines are often not visually distinguishable from imagery alone (they're legal boundaries, not always physical features).
- Approach: combine (a) physical cues — boundary walls, fences, building alignments, edge detection (HED/Canny+ML) — with (b) inference from existing GIS parcel layers and cadastral rules, and (c) GNSS/CORS survey points as anchor/control points to correct and validate boundaries.
- Use a graph-based approach: extracted building footprints + roads + physical edges become constraints; parcels are inferred as the polygonal partition of blocks bounded by roads, subdivided using detected boundary walls/fences and conflated with legacy parcel records.
- Where imagery-only inference is unreliable, flag the parcel as "AI-suggested — needs GT verification" rather than asserting a boundary with false confidence.

**Deliverable:** preliminary parcel polygon layer with a per-parcel confidence/verification-needed flag.

### Module 5: Land-Use Classification
- Patch-based or pixel-based classifier (ResNet/EfficientNet backbone or semantic segmentation) to classify parcels/regions into classes: residential, commercial, mixed-use, vacant, institutional, road/ROW, water body, green space, etc.
- Aggregate pixel-level predictions to parcel-level majority class once parcel polygons exist (Module 4 output).

**Deliverable:** land-use attribute appended to each parcel record.

### Module 6: Topology Generation & Conflict Detection
- Build a planar topology (nodes, edges, faces) from parcel + road + building layers using a library like `topojson`, PostGIS topology extension, or custom graph construction.
- Detect and flag: overlapping parcels, gaps/slivers between adjacent parcels, dangling boundaries, parcels inconsistent with existing legacy GIS layer, buildings crossing parcel boundaries.
- Auto-generate a "conflict report" per zone/ward with severity ranking to prioritize field verification.

**Deliverable:** automated topology validation module producing a structured conflict/exception report.

### Module 7: GIS Data Layer & APIs
- Load all outputs into PostGIS with versioned schemas: `parcels`, `buildings`, `roads`, `landuse`, `gt_points`, `conflicts`, `edit_audit_log`.
- Expose via WMS/WFS (GeoServer) and vector tiles (pg_tileserv/Martin) for fast web rendering.
- REST/GraphQL API (FastAPI) for: triggering inference jobs, fetching layers, submitting edits, exporting to Shapefile/GeoJSON/CAD-compatible formats.

**Deliverable:** running GIS backend + API layer with authentication and role-based access (surveyor / reviewer / admin).

### Module 8: Web-GIS Visualization & Editing Dashboard
- Map view: toggle ORI, DSM hillshade, AI-extracted layers, existing cadastre, conflict overlays.
- Editing tools: accept/reject/edit AI-suggested parcel, split/merge polygons, snap-to-boundary editing, attribute editing (land-use, ownership placeholder fields).
- GT/field verification workflow: assign parcels to field teams, capture GNSS-confirmed corrections, sync back into PostGIS.
- Dashboard analytics: % area auto-mapped, parcel count by confidence tier, conflict counts by ward, processing throughput.

**Deliverable:** a working Web-GIS application (React + MapLibre/OpenLayers) connected to the API layer.

### Module 9: Evaluation & Accuracy Benchmarking
- Metrics to report:
  - Building footprint: IoU, F1 @ IoU thresholds (0.5/0.7), boundary displacement error (meters).
  - Road extraction: IoU, connectivity/APLS (Average Path Length Similarity) score.
  - Parcel boundaries: positional accuracy vs GT/GNSS control points (RMSE in meters), topological correctness rate.
  - Land-use classification: overall accuracy, per-class F1, confusion matrix.
  - End-to-end: % reduction in manual digitization time vs baseline manual workflow, throughput (parcels/hour processed).
- Validate against a held-out GT sample and independently against GNSS/CORS survey points as ground truth control.

**Deliverable:** an evaluation report/benchmark suite runnable on any new dataset.

### Module 10: Deployment & Scaling
- Containerize each service (ingestion, inference, vectorization, API, frontend) with Docker Compose for a pilot; move to Kubernetes for city/state-scale rollout.
- Batch inference pipeline for new drone survey zones (queue-based, e.g., Celery + Redis).
- CI/CD for model retraining as more GT data becomes available (active learning loop: low-confidence parcels reviewed by humans feed back into training data).

**Deliverable:** deployable, documented, containerized system with a retraining/active-learning loop.

---

## 5. Suggested Build Order (for a hackathon/PoC timeline)

1. Data pipeline + one pilot AOI (area of interest) prepared (Module 1).
2. Building footprint model trained and vectorized (Module 2) — quick visible win.
3. Road extraction (Module 3).
4. Basic Web-GIS viewer showing imagery + buildings + roads (partial Module 8) — demoable early.
5. Parcel boundary inference using blocks-minus-buildings-minus-roads heuristic + legacy layer conflation (Module 4, simplified version first).
6. Topology/conflict detection (Module 6).
7. Land-use classification (Module 5).
8. Full editing workflow + GT sync + analytics (finish Module 8, add Module 9 metrics).
9. Packaging, deployment, and a short demo video/report (Module 10 + presentation).

---

## 6. How to Use This Prompt

- **With an AI coding assistant:** paste Section 0 as the system/role instruction, then work through Modules 1–10 in order in separate turns, asking for code, then for tests, then for the next module — this keeps context manageable and output high quality.
- **As a hackathon submission (e.g., SIH-style):** Sections 1–4 map directly onto "Problem Understanding," "Proposed Solution," and "Technical Approach" slides; Section 5 gives you a realistic sprint plan; Section 9-equivalent metrics give you a strong "impact/evaluation" slide.
- **As a team charter:** assign one module per pod (Data, CV/AI, GIS backend, Frontend) and use Module deliverables as sprint acceptance criteria.

---

## 7. Key Risks to Call Out Explicitly

- Legal parcel boundaries are not always visible in imagery — the system must be transparent about confidence and never silently assert unverified boundaries as authoritative.
- Dense/informal settlements will have lower automatic accuracy; budget for a higher proportion of manual GT review there.
- DSM/DTM quality directly drives nDSM/building-height accuracy — garbage in, garbage out.
- Conflation with legacy GIS parcel layers needs careful handling of coordinate system and vintage/accuracy mismatches.
