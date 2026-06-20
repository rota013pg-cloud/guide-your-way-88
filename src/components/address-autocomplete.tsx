import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { MapPin, Loader2, X } from "lucide-react";

export type AddressValue = {
  text: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  route?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (v: AddressValue) => void;
  placeholder?: string;
  /** Centro para enviesar resultados (default: Praia Grande/SP). */
  bias?: { lat: number; lng: number; radius?: number };
};

type Suggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

export function AddressAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  bias = { lat: -24.0122, lng: -46.4097, radius: 15000 },
}: Props) {
  const { ready, error } = useGoogleMaps();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const sessionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function fetchSuggestions(query: string) {
    if (!ready || !window.google?.maps?.places) return;
    setLoading(true);
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } =
        (await window.google.maps.importLibrary("places")) as any;
      if (!sessionRef.current) sessionRef.current = new AutocompleteSessionToken();
      const input = query.toLowerCase().includes("praia grande") ? query : `${query}, Praia Grande`;
      const { suggestions: sugs } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionRef.current,
        language: "pt-BR",
        region: "br",
        includedRegionCodes: ["br"],
        locationBias: {
          center: { lat: bias.lat, lng: bias.lng },
          radius: bias.radius ?? 15000,
        },
      });
      const list: Suggestion[] = (sugs || [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .slice(0, 6)
        .map((p: any) => ({
          placeId: p.placeId,
          main: p.mainText?.text ?? p.text?.text ?? "",
          secondary: p.secondaryText?.text ?? "",
        }));
      setSuggestions(list);
      setOpen(list.length > 0);
    } catch (e) {
      console.warn("autocomplete error", e);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(v: string) {
    onChange({ text: v });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (v.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timerRef.current = window.setTimeout(() => fetchSuggestions(v.trim()), 320);
  }

  async function selecionar(s: Suggestion) {
    setOpen(false);
    try {
      const { Place } = (await window.google.maps.importLibrary("places")) as any;
      const place = new Place({ id: s.placeId, requestedLanguage: "pt-BR" });
      await place.fetchFields({ fields: ["formattedAddress", "location", "addressComponents"] });
      sessionRef.current = null; // encerra sessão de billing
      const comps: any[] = place.addressComponents ?? [];
      const get = (type: string) =>
        comps.find((c) => (c.types ?? []).includes(type))?.longText ??
        comps.find((c) => (c.types ?? []).includes(type))?.shortText;
      onChange({
        text: place.formattedAddress ?? `${s.main} ${s.secondary}`.trim(),
        lat: place.location?.lat(),
        lng: place.location?.lng(),
        placeId: s.placeId,
        route: get("route"),
        streetNumber: get("street_number"),
        neighborhood: get("sublocality") ?? get("sublocality_level_1") ?? get("neighborhood"),
        city: get("administrative_area_level_2") ?? get("locality"),
        state: get("administrative_area_level_1"),
        postalCode: get("postal_code"),
      });
    } catch (e) {
      console.warn("place details error", e);
      onChange({ text: `${s.main}${s.secondary ? ", " + s.secondary : ""}`, placeId: s.placeId });
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
            </div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => selecionar(s)}
              className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2 text-sm"
            >
              <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{s.main}</div>
                {s.secondary && <div className="text-xs text-muted-foreground truncate">{s.secondary}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-destructive mt-1">Maps indisponível: {error}</div>}
    </div>
  );
}
