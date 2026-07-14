import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const PontoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const CalcSchema = z.object({
  origem: PontoSchema,
  destino: PontoSchema,
});

export const calcularRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CalcSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_MAPS_SERVER_KEY;
    if (!key) throw new Error("GOOGLE_MAPS_SERVER_KEY ausente");

    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
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
