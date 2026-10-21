import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";

type CompanyLocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onChange: (latitude: number | null, longitude: number | null) => void;
};

/** Hanoi city centre — only used to frame the map before a point is chosen. */
const FALLBACK_CENTER: L.LatLngTuple = [21.02776, 105.83416];
const DEFAULT_ZOOM = 16;
const FALLBACK_ZOOM = 12;

/**
 * Leaflet renders its default marker from bundled PNGs, which break under Vite's
 * asset hashing. A div icon keeps the pin as plain markup instead.
 */
const pinIcon = L.divIcon({
  className: "company-location-pin",
  html: '<span class="company-location-pin__dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

export function CompanyLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange
}: CompanyLocationPickerProps) {
  const { tx } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const txRef = useRef(tx);
  const [locating, setLocating] = useState(false);

  // Map callbacks are bound once, so they read the latest handler through a ref
  // rather than forcing the map to be torn down on every render.
  useEffect(() => {
    onChangeRef.current = onChange;
    txRef.current = tx;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM
    });
    // tile.openstreetmap.org is DNS-blocked on some Vietnamese networks and
    // CARTO now watermarks keyless tiles, so both layers come from Esri, which
    // serves keyless tiles. Street tiles in Vietnam stop at z18 and are upscaled
    // past that; satellite imagery stays sharp to z19, which helps pick out the
    // actual building when placing the pin.
    const streetLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxNativeZoom: 18,
        maxZoom: 19
      }
    ).addTo(map);
    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19
      }
    );
    L.control
      .layers(
        {
          [txRef.current("Street map")]: streetLayer,
          [txRef.current("Satellite")]: satelliteLayer
        },
        undefined,
        { position: "topright" }
      )
      .addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      onChangeRef.current(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Keep the marker and the radius ring in sync with the form values, which can
  // also change when the settings query resolves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    const position: L.LatLngTuple = [latitude, longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      const marker = L.marker(position, { icon: pinIcon, draggable: true })
        .addTo(map)
        .on("dragend", () => {
          const next = marker.getLatLng();
          onChangeRef.current(next.lat, next.lng);
        });
      markerRef.current = marker;
      map.setView(position, DEFAULT_ZOOM);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(position).setRadius(radiusMeters);
    } else {
      circleRef.current = L.circle(position, {
        radius: radiusMeters,
        color: "#228be6",
        weight: 1,
        fillOpacity: 0.12
      }).addTo(map);
    }
  }, [latitude, longitude, radiusMeters]);

  const hasPoint = latitude !== null && longitude !== null;

  function locateMe() {
    if (!navigator.geolocation) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChangeRef.current(position.coords.latitude, position.coords.longitude);
        mapRef.current?.setView(
          [position.coords.latitude, position.coords.longitude],
          DEFAULT_ZOOM
        );
      },
      () => setLocating(false)
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {tx("Company location")}
      </Text>
      <Text size="xs" c="dimmed">
        {tx("Click the map or drag the pin to set the attendance location.")}
      </Text>
      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <div ref={containerRef} style={{ height: 320, width: "100%" }} />
      </Paper>
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap={6}>
          <MapPin size={16} />
          <Text size="sm" c={hasPoint ? undefined : "dimmed"}>
            {hasPoint
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : tx("No location selected")}
          </Text>
        </Group>
        <Group gap="xs">
          <Button
            variant="light"
            size="xs"
            leftSection={<Crosshair size={14} />}
            loading={locating}
            onClick={locateMe}
          >
            {tx("Use my location")}
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<Trash2 size={14} />}
            disabled={!hasPoint}
            onClick={() => onChange(null, null)}
          >
            {tx("Clear location")}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
