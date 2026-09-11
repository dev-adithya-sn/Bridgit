"use client";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ReactNode } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string; // e.g. "#b91c1c"
  label?: string; // small letter/emoji inside the dot
  popup?: ReactNode;
}

// Jharkhand's rough center
export const JH_CENTER: [number, number] = [23.6, 85.6];

function dotIcon(color: string, label?: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:12px;font-weight:700;font-family:sans-serif;
    ">${label ?? ""}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapViewInner({
  markers,
  center = JH_CENTER,
  zoom = 7,
  height = "420px",
  onMapClick,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: "100%", borderRadius: "12px", zIndex: 0 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <ClickCatcher onClick={onMapClick} />}
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={dotIcon(m.color, m.label)}>
          {m.popup && <Popup>{m.popup}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
}
