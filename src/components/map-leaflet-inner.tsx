import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapMotorista } from "./map-leaflet";

// Faz o mapa acompanhar o pin: dá pan pra posição sempre que ela muda.
// Mantém o zoom atual (deixa o usuário aproximar/afastar à vontade).
function SeguirPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

// Pin de moto com ID acima (opcionalmente sem rótulo)
const buildIcon = (codigo: string, status: string, hideLabel: boolean) => {
  const cor =
    status === "Em corrida" ? "#f59e0b" :
    status === "Online" ? "#22c55e" : "#94a3b8";
  const html = `
    <div class="moto-marker">
      ${hideLabel ? "" : `<div class="moto-id" style="background:${cor}">${codigo}</div>`}
      <div class="moto-pin" style="background:${cor}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
          <path d="M19.44 9.03 15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zM19 17c-1.63 0-3-1.37-3-3s1.37-3 3-3 3 1.37 3 3-1.37 3-3 3z"/>
        </svg>
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: "moto-anim",
    iconSize: [56, 56],
    iconAnchor: [28, 52],
    popupAnchor: [0, -50],
  });
};

// Praia Grande / Baixada Santista
const CENTRO: [number, number] = [-24.0122, -46.4097];

export default function MapInner({
  motoristas,
  hideLabels,
  seguir,
}: {
  motoristas: MapMotorista[];
  hideLabels?: boolean;
  seguir?: boolean;
}) {
  const center: [number, number] =
    motoristas.length > 0 ? [Number(motoristas[0].lat), Number(motoristas[0].lng)] : CENTRO;

  return (
    <MapContainer
      center={center}
      zoom={seguir ? 15 : 13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem", background: "#eaeaea", zIndex: 0 }}
    >
      {seguir && motoristas.length > 0 && (
        <SeguirPin lat={Number(motoristas[0].lat)} lng={Number(motoristas[0].lng)} />
      )}
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {motoristas.map((m) => (
        <Marker key={m.codigo} position={[Number(m.lat), Number(m.lng)]} icon={buildIcon(m.codigo, m.status, !!hideLabels)}>
          {!hideLabels && (
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong>{m.nome}</strong>
                <br />
                <small>{m.codigo}</small>
                <br />
                <span style={{ color: m.status === "Em corrida" ? "#f59e0b" : "#22c55e" }}>● {m.status}</span>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
