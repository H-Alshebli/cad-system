"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ImageOverlay,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";

/* ---------------------------------------------------------
   FIX DEFAULT LEAFLET ICON ISSUE (NEXT.JS)
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
   CUSTOM ICONS
--------------------------------------------------------- */
const patientIcon = L.icon({
  iconUrl: "/icons/patient.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const ambulanceIcon = L.icon({
  iconUrl: "/icons/ambulance.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -35],
});

const clinicIcon = L.icon({
  iconUrl: "/icons/clinic.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -35],
});

const roamingIcon = L.icon({
  iconUrl: "/icons/roaming.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -35],
});

/* ---------------------------------------------------------
   MDL BEAST IMAGE BOUNDS
--------------------------------------------------------- */
const mdlbBounds: [[number, number], [number, number]] = [
  [24.98399989984823, 46.47091013377153], // SW
  [25.01131580244805, 46.53256747037176], // NE
];

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
  caseLat?: number | null;
  caseLng?: number | null;
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
  /* 🔒 Stable center (prevents unnecessary re-init) */
  const center = useMemo<[number, number]>(() => {
    return caseLat && caseLng ? [caseLat, caseLng] : [24.997, 46.5];
  }, [caseLat, caseLng]);

  /* 🔑 Key forces safe Leaflet re-initialization */
  const mapKey = useMemo(
    () => `map-${caseLat ?? "x"}-${caseLng ?? "y"}`,
    [caseLat, caseLng]
  );

  return (
    <MapContainer
  key={mapKey}
  center={center}
  zoom={16}
  zoomControl
  scrollWheelZoom
  style={{ width: "100%", height: "100%" }}
>

      {/* GOOGLE MAP TILES */}
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
      />

      {/* MDL BEAST IMAGE OVERLAY */}
      <ImageOverlay
        url="/mdlb-base.jpg"
        bounds={mdlbBounds}
        opacity={1}
        zIndex={500}
      />

      {/* PATIENT MARKER */}
      {caseLat && caseLng && (
        <Marker
          position={[caseLat, caseLng]}
          icon={patientIcon}
          eventHandlers={{
            click: () =>
              window.open(
                `https://www.google.com/maps?q=${caseLat},${caseLng}`,
                "_blank"
              ),
          }}
        >
          <Popup>
            🧍 <strong>Patient</strong>
            <br />
            {caseName}
          </Popup>
        </Marker>
      )}

      {/* AMBULANCES */}
      {ambulances.map(
        (a) =>
          typeof a.lat === "number" &&
          typeof a.lng === "number" && (
            <Marker
              key={`amb-${a.id}`}
              position={[a.lat, a.lng]}
              icon={ambulanceIcon}
            >
              <Popup>
                🚑 <strong>Ambulance</strong>
                <br />
                Code: {a.code || a.id}
              </Popup>
            </Marker>
          )
      )}

      {/* CLINICS */}
      {clinics.map(
        (c) =>
          typeof c.lat === "number" &&
          typeof c.lng === "number" && (
            <Marker
              key={`clinic-${c.id}`}
              position={[c.lat, c.lng]}
              icon={clinicIcon}
            >
              <Popup>
                🏥 <strong>Clinic</strong>
                <br />
                {c.name || c.id}
              </Popup>
            </Marker>
          )
      )}

      {/* ROAMING TEAMS */}
      {roaming.map(
        (r) =>
          typeof r.lat === "number" &&
          typeof r.lng === "number" && (
            <Marker
              key={`roaming-${r.id}`}
              position={[r.lat, r.lng]}
              icon={roamingIcon}
            >
              <Popup>
                🚶 <strong>Roaming Team</strong>
                <br />
                Code: {r.code || r.id}
              </Popup>
            </Marker>
          )
      )}
    </MapContainer>
  );
}
