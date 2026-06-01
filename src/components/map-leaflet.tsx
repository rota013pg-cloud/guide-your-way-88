import { lazy, Suspense, useEffect, useState } from "react";

export type MapMotorista = {
  codigo: string;
  nome: string;
  lat: number;
  lng: number;
  status: string;
};

const MapInner = lazy(() => import("./map-leaflet-inner"));

export function MapLeaflet({ motoristas }: { motoristas: MapMotorista[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-full w-full rounded-lg bg-muted/30 animate-pulse" />;
  }
  return (
    <Suspense fallback={<div className="h-full w-full rounded-lg bg-muted/30 animate-pulse" />}>
      <MapInner motoristas={motoristas} />
    </Suspense>
  );
}
