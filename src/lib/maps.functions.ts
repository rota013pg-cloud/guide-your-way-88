import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const PontoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const CalcSchema = z.object({
  origem: PontoSchema,
  destino: PontoSchema,
});

export const calcularRota = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CalcSchema.parse(d))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente");
    if (!connKey) throw new Error("GOOGLE_MAPS_API_KEY ausente (connector Google Maps não conectado)");

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.origem.lat, longitude: data.origem.lng } } },
        destination: { location: { latLng: { latitude: data.destino.lat, longitude: data.destino.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-BR",
        regionCode: "BR",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Routes API ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { routes?: Array<{ distanceMeters?: number; duration?: string }> };
    const r = json.routes?.[0];
    if (!r?.distanceMeters) return { km: 0, segundos: 0 };
    const segundos = r.duration ? parseInt(String(r.duration).replace(/s$/, ""), 10) || 0 : 0;
    return { km: r.distanceMeters / 1000, segundos };
  });
