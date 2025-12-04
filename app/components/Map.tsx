"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ✅ Custom event type (simple & 100% safe)
type LeafletClickEvent = {
  latlng: {
    lat: number;
    lng: number;
  };
};

function OpenGoogleMapsOnClick() {
  useMapEvents({
    click(e: LeafletClickEvent) {
      const { lat, lng } = e.latlng;

      window.open(
        `https://www.google.com/maps?q=${lat},${lng}`,
        "_blank"
      );
    },
  });

  return null;
}

export default function Map({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  return (
    <div className="w-full h-72 rounded-lg overflow-hidden">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
      >
        {/* OpenStreetMap Tile */}
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Marker Position */}
        <Marker position={[lat, lng]} />

        {/* Click-to-open-GoogleMaps handler */}
        <OpenGoogleMapsOnClick />
      </MapContainer>
    </div>
  );
}
