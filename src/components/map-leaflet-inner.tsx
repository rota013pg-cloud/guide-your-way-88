import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { MapMotorista } from "./map-leaflet";

// Ícone customizado em formato de pin amarelo (marca Rota013)
const buildIcon = (status: string) => {
  const cor = status === "Em corrida" ? "#f59e0b" : "#facc15";
  const html = `
    <div style="position:relative;width:32px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
      <svg viewBox="0 0 32 40" width="32" height="40">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 24 16 24s16-13 16-24c0-8.8-7.2-16-16-16z" fill="${cor}"/>
        <circle cx="16" cy="16" r="6" fill="#1a1a1a"/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -38] });
};

// Santos / Baixada Santista como centro padrão
const CENTRO: [number, number] = [-23.9608, -46.3331];

export default function MapInner({ motoristas }: { motoristas: MapMotorista[] }) {
  const center: [number, number] =
    motoristas.length > 0 ? [Number(motoristas[0].lat), Number(motoristas[0].lng)] : CENTRO;

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem", background: "#1a1a1a" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {motoristas.map((m) => (
        <Marker key={m.codigo} position={[Number(m.lat), Number(m.lng)]} icon={buildIcon(m.status)}>
          <Popup>
            <div style={{ minWidth: 140 }}>
              <strong>{m.nome}</strong>
              <br />
              <small>{m.codigo}</small>
              <br />
              <span style={{ color: m.status === "Em corrida" ? "#f59e0b" : "#22c55e" }}>● {m.status}</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
