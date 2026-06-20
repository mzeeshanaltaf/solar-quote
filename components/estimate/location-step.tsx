"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  MapPinIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// AdvancedMarker requires a map style ID; a vector map id is needed for the
// real thing, but Google's reserved "DEMO_MAP_ID" works for development.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

interface Pin {
  lat: number;
  lng: number;
}

interface Candidate {
  formattedAddress: string;
  lat: number;
  lng: number;
  locationType: string;
  partialMatch: boolean;
  confidence: "high" | "medium" | "low";
}

interface GeocodeResponse {
  success?: boolean;
  error?: string;
  message?: string;
  candidates?: Candidate[];
}

interface LocationStepProps {
  sessionId: string;
  onConfirmed: () => void;
  onReset: () => void;
  /** Proceed without a confirmed pin — the estimate falls back to a regional
   *  yield. Keeps the funnel moving when the map is unavailable or the user
   *  simply can't find their roof. */
  onSkip: () => void;
}

// Imperatively re-centers the map whenever `target` changes (initial geocode or
// a successful search). Dragging the pin updates `pin` only, so we never yank
// the camera out from under the user mid-drag.
function MapPanner({ target }: { target: Pin | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    map.setZoom(19);
  }, [map, target]);
  return null;
}

export function LocationStep({
  sessionId,
  onConfirmed,
  onReset,
  onSkip,
}: LocationStepProps) {
  const [pin, setPin] = useState<Pin | null>(null);
  const [flyTarget, setFlyTarget] = useState<Pin | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);

  // "locating" while the initial address geocode runs; "ready" once we have a
  // pin; "no-pin" when we have no address to start from (search-box-first).
  const [phase, setPhase] = useState<"locating" | "ready" | "no-pin">("locating");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const applyTopCandidate = useCallback((candidates: Candidate[]) => {
    const top = candidates[0];
    const next = { lat: top.lat, lng: top.lng };
    setPin(next);
    setFlyTarget(next);
    setFormattedAddress(top.formattedAddress);
    setPhase("ready");
  }, []);

  // Initial geocode from the address extraction gave us. Runs once.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as GeocodeResponse;
        if (data.success && data.candidates?.length) {
          applyTopCandidate(data.candidates);
        } else {
          // no_address / no_results / failure — fall back to search-first.
          setPhase("no-pin");
        }
      } catch {
        setPhase("no-pin");
      }
    })();
  }, [sessionId, applyTopCandidate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query }),
      });
      const data = (await res.json()) as GeocodeResponse;
      if (data.success && data.candidates?.length) {
        applyTopCandidate(data.candidates);
      } else {
        setSearchError(
          data.message ?? "We couldn't find that address. Try adding the city and country."
        );
      }
    } catch {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!pin) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/geocode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          lat: pin.lat,
          lng: pin.lng,
          formattedAddress,
        }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!data.success) {
        setSaveError(data.message ?? "We couldn't save your location. Please try again.");
        setSaveStatus("error");
        return;
      }
      onConfirmed();
    } catch {
      setSaveError("Failed to save. Check your connection and try again.");
      setSaveStatus("error");
    }
  };

  // The browser map key is required to render the map. Without it we can't pin
  // the roof — but the estimate still works off a regional sunlight average, so
  // we offer to continue rather than dead-end the funnel.
  if (!MAPS_API_KEY) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Find your roof</CardTitle>
          <CardDescription>
            We couldn&apos;t load the map here — but we can still estimate your savings
            from the sunlight typical for your area.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Alert className="border-primary/30 bg-primary/4 text-foreground">
            <MapPinIcon className="text-primary" />
            <AlertTitle>Map unavailable right now</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              No need to pinpoint your roof — we&apos;ll use the average sunlight for your
              region. The numbers stay close; a precise pin only fine-tunes them.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={onReset}>
              <RotateCcwIcon data-icon="inline-start" />
              Start over
            </Button>
            <Button type="button" size="lg" onClick={onSkip}>
              Continue to my estimate
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Is this your roof?</CardTitle>
        <CardDescription>
          We placed a pin from your bill&apos;s address. Drag it onto your actual roof so
          we size the system for the right amount of sun.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {phase === "locating" && (
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-muted/40 py-20 text-muted-foreground">
            <Spinner />
            <span className="text-sm">Finding your address…</span>
          </div>
        )}

        {phase === "no-pin" && (
          <Alert className="border-primary/30 bg-primary/4 text-foreground">
            <MapPinIcon className="text-primary" />
            <AlertTitle>Let&apos;s find your address</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              We couldn&apos;t place a pin from your bill. Search for your address below and
              we&apos;ll drop one on the map.
            </AlertDescription>
          </Alert>
        )}

        {phase === "ready" && pin && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl border border-border">
              <APIProvider apiKey={MAPS_API_KEY}>
                <Map
                  mapId={MAP_ID}
                  className="h-[clamp(18rem,45vh,28rem)] w-full"
                  defaultCenter={pin}
                  defaultZoom={19}
                  mapTypeId="satellite"
                  gestureHandling="greedy"
                  disableDefaultUI
                  zoomControl
                >
                  <MapPanner target={flyTarget} />
                  <AdvancedMarker
                    position={pin}
                    draggable
                    onDragEnd={(e) => {
                      const lat = e.latLng?.lat();
                      const lng = e.latLng?.lng();
                      if (lat != null && lng != null) setPin({ lat, lng });
                    }}
                  />
                </Map>
              </APIProvider>
            </div>
            {formattedAddress && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{formattedAddress}</span>
              </p>
            )}
          </div>
        )}

        {/* Search box — always available so a wrong pin is one search away. */}
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            placeholder="Search a different address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search for an address"
          />
          <Button type="submit" variant="outline" disabled={searching || !searchQuery.trim()}>
            {searching ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SearchIcon data-icon="inline-start" />
            )}
            Search
          </Button>
        </form>

        {searchError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        )}

        {saveStatus === "error" && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Not saved</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={saveStatus === "saving"}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Start over
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleConfirm}
            disabled={!pin || saveStatus === "saving"}
          >
            {saveStatus === "saving" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CheckCircle2Icon data-icon="inline-start" />
            )}
            {saveStatus === "saving" ? "Saving" : "This is my roof"}
          </Button>
        </div>

        {/* Last-resort escape so a roof you can't find never blocks the estimate;
            sizing falls back to the average sunlight for your region. */}
        <button
          type="button"
          onClick={onSkip}
          disabled={saveStatus === "saving"}
          className="self-center text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
        >
          Can&apos;t find your roof? Estimate from my area instead
        </button>
      </CardContent>
    </Card>
  );
}
