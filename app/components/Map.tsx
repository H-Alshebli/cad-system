"use client";

import { MapContainer, TileLayer, Marker, Popup, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ---------------------------------------------------------
   CUSTOM ICONS
---------------------------------------------------------*/

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
---------------------------------------------------------*/
const mdlbBounds: any = [
  [24.98399989984823, 46.47091013377153], // SW
  [25.01131580244805, 46.53256747037176], // NE
];

/* ---------------------------------------------------------
   PROPS
---------------------------------------------------------*/
interface MapProps {
  caseLat?: number | null;
  caseLng?: number | null;
  caseName?: string;

  ambulances?: any[];
  clinics?: any[];
  roaming?: any[];
}

/* ---------------------------------------------------------
   MAP COMPONENT
---------------------------------------------------------*/
export default function Map({
  caseLat,
  caseLng,
  caseName = "Patient Location",
  ambulances = [],
  clinics = [],
  roaming = [],
}: MapProps) {
  const center = caseLat && caseLng ? [caseLat, caseLng] : [24.997, 46.50];

  return (
    <MapContainer center={center} zoom={15} style={{ width: "100%", height: "100%" }}>
      
      {/* GOOGLE MAP */}
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={["mt0", "mt1", "mt2", "mt3"]}
      />

      {/* MDL BEAST OVERLAY */}
      <ImageOverlay
        url="/mdlb-base.jpg"
        bounds={mdlbBounds}
        opacity={0.55}
      />

      {/* PATIENT ICON */}
      {caseLat && caseLng && (
        <Marker
          position={[caseLat, caseLng]}
          icon={patientIcon}
          eventHandlers={{
            click: () =>
              window.open(`https://www.google.com/maps?q=${caseLat},${caseLng}`, "_blank"),
          }}
        >
          <Popup>🧍 Patient<br />{caseName}</Popup>
        </Marker>
      )}

      {/* AMBULANCES */}
      {ambulances.map((a: any) =>
        typeof a.lat === "number" && typeof a.lng === "number" ? (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={ambulanceIcon}
          >
            <Popup>🚑 Ambulance<br />Code: {a.code}</Popup>
          </Marker>
        ) : null
      )}

      {/* CLINICS */}
      {clinics.map((c: any) =>
        typeof c.lat === "number" && typeof c.lng === "number" ? (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={clinicIcon}
          >
            <Popup>🏥 Clinic<br />{c.name}</Popup>
          </Marker>
        ) : null
      )}

      {/* ROAMING TEAM */}
      {roaming.map((r: any) =>
        typeof r.lat === "number" && typeof r.lng === "number" ? (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={roamingIcon}
          >
            <Popup>🚶 Roaming Team</Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
