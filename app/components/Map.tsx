"use client";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    },
  });

  return null;
}

export default function Map({
  lat,
  lng,
  name,              // ✅ include name
}: {
  lat: number;
  lng: number;
  name?: string;      // ✅ include name
}) {
  return (
    <div className="w-full h-72 rounded-lg overflow-hidden">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker position={[lat, lng]}>
          {name && <Popup>{name}</Popup>}   {/* ✅ allow popup */}
        </Marker>

        <OpenGoogleMapsOnClick />
      </MapContainer>
    </div>
  );
}
