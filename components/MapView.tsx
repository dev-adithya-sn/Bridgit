"use client";

// Leaflet can only run in the browser, so the real map is loaded
// dynamically with server-side rendering turned off.
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default MapView;
export type { MapMarker } from "./MapViewInner";
