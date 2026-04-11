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

function openGoogleMaps(lat: number, lng: number) {
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
  iconRetinaUrl: "/icons/patient.png",
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -36],
});

const destinationIcon = L.icon({
  iconUrl: "/icons/clinic.png",
  iconRetinaUrl: "/icons/clinic.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -32],
});

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function ChangeView({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();

  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [lat, lng, map]);

  return null;
}

function RecenterButton({
  lat,
  lng,
  label,
}: {
  lat?: number;
  lng?: number;
  label: string;
}) {
  const map = useMap();

  if (lat == null || lng == null) return null;

  return (
    <div className="absolute top-3 right-3 z-[9999]">
      <button
        type="button"
        onClick={() => map.setView([lat, lng], 16, { animate: true })}
        className="px-3 py-2 rounded-md bg-slate-900/95 text-white text-xs font-medium border border-slate-600 shadow-lg hover:bg-slate-800"
      >
        {label}
      </button>
    </div>
  );
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

  centerLat?: number;
  centerLng?: number;

  showRecenterButton?: boolean;
  recenterLabel?: string;
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
  centerLat,
  centerLng,
  showRecenterButton = true,
  recenterLabel = "Back to point",
}: MapProps) {
  const focusLat = centerLat ?? caseLat ?? 24.7136;
  const focusLng = centerLng ?? caseLng ?? 46.6753;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[focusLat, focusLng]}
        zoom={15}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={["mt0", "mt1", "mt2", "mt3"]}
        />

        <ChangeView lat={focusLat} lng={focusLng} />

        {showRecenterButton && (
          <RecenterButton
            lat={focusLat}
            lng={focusLng}
            label={recenterLabel}
          />
        )}

        {/* Patient marker */}
        {caseLat != null && caseLng != null && (
          <Marker
            position={[caseLat, caseLng]}
            icon={patientIcon}
            eventHandlers={{
              click: () => openGoogleMaps(caseLat, caseLng),
            }}
          >
            <Popup>
              <strong>Patient</strong>
              <br />
              {caseName}
            </Popup>
          </Marker>
        )}

        {/* Clinics / Destination */}
        {clinics.map((c) => {
          if (c.lat == null || c.lng == null) return null;

          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={destinationIcon}
              eventHandlers={{
                click: () => openGoogleMaps(c.lat!, c.lng!),
              }}
            >
              <Popup>🏥 {c.name || c.id}</Popup>
            </Marker>
          );
        })}

        {/* Ambulances */}
        {ambulances.map((a) => {
          if (a.lat == null || a.lng == null) return null;

          return (
            <Marker
              key={a.id}
              position={[a.lat, a.lng]}
              eventHandlers={{
                click: () => openGoogleMaps(a.lat!, a.lng!),
              }}
            >
              <Popup>🚑 {a.code || a.id}</Popup>
            </Marker>
          );
        })}

        {/* Roaming */}
        {roaming.map((r) => {
          if (r.lat == null || r.lng == null) return null;

          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              eventHandlers={{
                click: () => openGoogleMaps(r.lat!, r.lng!),
              }}
            >
              <Popup>🚶 {r.code || r.id}</Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}