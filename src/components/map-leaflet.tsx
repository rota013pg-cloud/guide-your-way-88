import { lazy, Suspense, useEffect, useState } from "react";

export type MapMotorista = {
  codigo: string;
  nome: string;
  lat: number;
  lng: number;
  status: string;
};

const MapInner = lazy(() => import("./map-leaflet-inner"));

export function MapLeaflet({
  motoristas,
  hideLabels,
  seguir,
  centro,
}: {
  motoristas: MapMotorista[];
  hideLabels?: boolean;
  /** Faz o mapa acompanhar (pan) o primeiro motorista sempre que ele se move. */
  seguir?: boolean;
  /** Centro fixo do mapa [lat, lng] (ex.: local de partida do cliente). */
  centro?: [number, number];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-full w-full rounded-lg bg-muted/30 animate-pulse" />;
  }
  return (
    <Suspense fallback={<div className="h-full w-full rounded-lg bg-muted/30 animate-pulse" />}>
      <MapInner motoristas={motoristas} hideLabels={hideLabels} seguir={seguir} centro={centro} />
    </Suspense>
  );
}
