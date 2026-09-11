"use client";

import MapView from "./MapView";

/** A map you click to drop a pin — used in the posting forms. */
export default function LocationPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  return (
    <div>
      <MapView
        height="300px"
        markers={
          lat != null && lng != null
            ? [{ id: "picked", lat, lng, color: "#1d4ed8", label: "📍" }]
            : []
        }
        onMapClick={onPick}
      />
      <p className="mt-1 text-xs text-slate-500">
        {lat != null && lng != null
          ? `Pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)} — click again to move the pin.`
          : "Click on the map to mark the exact location."}
      </p>
    </div>
  );
}
