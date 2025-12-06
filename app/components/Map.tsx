"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Map({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name?: string;
}) {
  return (
    <div className="w-full h-72 rounded-lg overflow-hidden">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker
          position={[lat, lng]}
          eventHandlers={{
            click: () => {
              window.open(
                `https://www.google.com/maps?q=${lat},${lng}`,
                "_blank"
              );
            },
          }}
        >
          {name && <Popup>{name}</Popup>}
        </Marker>
      </MapContainer>
    </div>
  );
}
