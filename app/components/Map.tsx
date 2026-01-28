"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
function openGoogleMaps(lat: number, lng: number, label?: string) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  window.open(url, "_blank");
}

/* ---------------------------------------------------------
   FIX DEFAULT ICON ISSUE
--------------------------------------------------------- */
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ---------------------------------------------------------
   ICONS
--------------------------------------------------------- */
const patientIcon = L.icon({
  iconUrl: "/icons/patient.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function ChangeView({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [lat, lng, map]);

  return null;
}

/* ---------------------------------------------------------
   TYPES
--------------------------------------------------------- */
interface Unit {
  id: string;
  code?: string;
  name?: string;
  lat?: number;
  lng?: number;
}

interface MapProps {
  caseLat?: number;
  caseLng?: number;
  caseName?: string;

  ambulances?: Unit[];
  clinics?: Unit[];
  roaming?: Unit[];

  // ✅ ADD THESE
  centerLat?: number;
  centerLng?: number;
}


/* ---------------------------------------------------------
   MAP COMPONENT
--------------------------------------------------------- */
export default function Map({
  caseLat,
  caseLng,
  caseName = "Patient Location",
  ambulances = [],
  clinics = [],
  roaming = [],

  // ✅ ADD THESE
  centerLat,
  centerLng,
}: MapProps) {

  return (
  <MapContainer
  center={[
    centerLat ?? caseLat ?? 24.997,
    centerLng ?? caseLng ?? 46.5,
  ]}
  zoom={15}
  scrollWheelZoom
  style={{ width: "100%", height: "100%" }}
>

      {/* Google Maps tiles */}
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
      />

      {/* Move map when coords change */}
     <ChangeView
  lat={centerLat ?? caseLat}
  lng={centerLng ?? caseLng}
/>


      {/* Patient marker */}
      {caseLat && caseLng && (
       <Marker
  position={[caseLat, caseLng]}
  icon={patientIcon}
  eventHandlers={{
    click: () => openGoogleMaps(caseLat, caseLng, caseName),
  }}
>

          <Popup>
            <strong>Patient</strong>
            <br />
            {caseName}
          </Popup>
        </Marker>
      )}

      {/* Ambulances */}
      {ambulances.map((a) => {
  if (a.lat == null || a.lng == null) return null;

  const lat = a.lat;
  const lng = a.lng;

  return (
    <Marker
      key={a.id}
      position={[lat, lng]}
      eventHandlers={{
        click: () => openGoogleMaps(lat, lng, a.code),
      }}
    >
      <Popup>🚑 {a.code || a.id}</Popup>
    </Marker>
  );
})}


     {clinics.map((c) => {
  if (c.lat == null || c.lng == null) return null;

  const lat = c.lat;
  const lng = c.lng;

  return (
    <Marker
      key={c.id}
      position={[lat, lng]}
      eventHandlers={{
        click: () => openGoogleMaps(lat, lng, c.name),
      }}
    >
      <Popup>🏥 {c.name || c.id}</Popup>
    </Marker>
  );
})}

      {/* Roaming */}
      {roaming.map((r) => {
  if (r.lat == null || r.lng == null) return null;

  const lat = r.lat;
  const lng = r.lng;

  return (
    <Marker
      key={r.id}
      position={[lat, lng]}
      eventHandlers={{
        click: () => openGoogleMaps(lat, lng, r.code),
      }}
    >
      <Popup>🚶 {r.code || r.id}</Popup>
    </Marker>
  );
})}

    </MapContainer>
  );
}
