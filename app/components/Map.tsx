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
}: MapProps) {
  return (
    <MapContainer
      center={[24.997, 46.5]} // default center
      zoom={14}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
    >
      {/* Google Maps tiles */}
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
      />

      {/* Move map when coords change */}
      <ChangeView lat={caseLat} lng={caseLng} />

      {/* Patient marker */}
      {caseLat && caseLng && (
        <Marker position={[caseLat, caseLng]} icon={patientIcon}>
          <Popup>
            <strong>Patient</strong>
            <br />
            {caseName}
          </Popup>
        </Marker>
      )}

      {/* Ambulances */}
      {ambulances.map(
        (a) =>
          a.lat &&
          a.lng && (
            <Marker key={a.id} position={[a.lat, a.lng]}>
              <Popup>🚑 {a.code || a.id}</Popup>
            </Marker>
          )
      )}

      {/* Clinics */}
      {clinics.map(
        (c) =>
          c.lat &&
          c.lng && (
            <Marker key={c.id} position={[c.lat, c.lng]}>
              <Popup>🏥 {c.name || c.id}</Popup>
            </Marker>
          )
      )}

      {/* Roaming */}
      {roaming.map(
        (r) =>
          r.lat &&
          r.lng && (
            <Marker key={r.id} position={[r.lat, r.lng]}>
              <Popup>🚶 {r.code || r.id}</Popup>
            </Marker>
          )
      )}
    </MapContainer>
  );
}
