# 🛰️ Sample Drone Aerial Survey Images for Testing

You can use any of these sample drone images in this folder to test the **"Upload Drone"** feature in the web application:

---

### 📍 Image 1: `01_varanasi_pilot_drone_survey.png`
- **Location:** Varanasi Urban Cadastral Ward 07, Uttar Pradesh
- **Center Latitude:** `28.614400`
- **Center Longitude:** `77.232700`
- **Ground Width:** `300` meters
- **Ground Height:** `300` meters
- **Description:** Real drone pilot orthomosaic with organic sector roads, residential lots, and building footprints.

---

### 📍 Image 2: `02_delhi_central_drone_flight.jpg`
- **Location:** Central Vista / Connaught Place Sector, New Delhi
- **Center Latitude:** `28.614300`
- **Center Longitude:** `77.232700`
- **Ground Width:** `400` meters
- **Ground Height:** `400` meters
- **Description:** High-resolution urban grid flight with 4 quadrants of residential & commercial structures.

---

### 📍 Image 3: `03_bengaluru_tech_park_drone.jpg`
- **Location:** Whitefield / Electronic City Tech Corridor, Bengaluru, Karnataka
- **Center Latitude:** `12.969800`
- **Center Longitude:** `77.749900`
- **Ground Width:** `350` meters
- **Ground Height:** `350` meters
- **Description:** Large industrial & institutional building blocks with angled arterial access roads.

---

### 🚀 How to Upload & Test:
1. Open the web app at **`http://localhost:5173`**.
2. Click the **"Upload Drone"** button in the top navigation bar.
3. Click the upload box and select any of the images above from `e:\sihproject2026\sample_drone_images\`.
4. Enter the corresponding latitude/longitude and dimensions, or click **"📍 Use Current Center"**.
5. Click **"Ingest Drone Photo & Run GeoAI Pipeline"**.
6. The system will georeference the photo in EPSG:32643, execute RGB computer vision contour extraction, and render the newly delineated parcels on the map!
