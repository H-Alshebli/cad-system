"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapProps {
  latitude: number;
  longitude: number;
}

const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map({ latitude, longitude }: MapProps) {
  return (
    <div style={{ height: "300px", width: "100%" }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup>Case Location</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
