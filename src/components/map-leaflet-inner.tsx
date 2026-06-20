import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { MapMotorista } from "./map-leaflet";

// Pin de moto com ID acima (opcionalmente sem rótulo)
const buildIcon = (codigo: string, status: string, hideLabel: boolean) => {
  const cor =
    status === "Em corrida" ? "#f59e0b" :
    status === "Online" ? "#22c55e" : "#94a3b8";
  const html = `
    <div class="moto-marker">
      ${hideLabel ? "" : `<div class="moto-id" style="background:${cor}">${codigo}</div>`}
      <div class="moto-pin" style="background:${cor}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18.5" cy="17.5" r="3.5"/>
          <circle cx="5.5" cy="17.5" r="3.5"/>
          <circle cx="15" cy="5" r="1"/>
          <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
        </svg>
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [56, 56],
    iconAnchor: [28, 52],
    popupAnchor: [0, -50],
  });
};

// Praia Grande / Baixada Santista
const CENTRO: [number, number] = [-24.0122, -46.4097];

export default function MapInner({ motoristas, hideLabels }: { motoristas: MapMotorista[]; hideLabels?: boolean }) {
  const center: [number, number] =
    motoristas.length > 0 ? [Number(motoristas[0].lat), Number(motoristas[0].lng)] : CENTRO;

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem", background: "#eaeaea", zIndex: 0 }}
    >
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
