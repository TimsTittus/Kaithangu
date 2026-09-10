'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

// OpenFreeMap vector tiles (AGENTS.md 3): free, no API key.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ZOOM = 16;

interface Props {
  lat: number;
  lng: number;
  onMove: (point: { lat: number; lng: number }) => void;
  label: string;
  unavailable: string;
}

/** Map with a draggable pin. Loaded with next/dynamic only on the location step. */
export default function MapPicker({ lat, lng, onMove, label, unavailable }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<Marker | null>(null);
  const onMoveRef = useRef(onMove);
  const initial = useRef({ lat, lng });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (container.current === null) return;
    let map: MapLibreMap | undefined;
    try {
      const start: [number, number] = [initial.current.lng, initial.current.lat];
      map = new MapLibreMap({
        container: container.current,
        style: STYLE_URL,
        center: start,
        zoom: ZOOM,
        attributionControl: { compact: true },
      });
      const pin = new Marker({ draggable: true, color: '#047857' }).setLngLat(start).addTo(map);
      pin.on('dragend', () => {
        const point = pin.getLngLat();
        onMoveRef.current({ lat: point.lat, lng: point.lng });
      });
      marker.current = pin;
    } catch {
      // No WebGL (old or low-end devices): the pincode is used instead.
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      marker.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    marker.current?.setLngLat([lng, lat]);
  }, [lat, lng]);

  if (failed)
    return <p className="text-base text-neutral-700 dark:text-neutral-300">{unavailable}</p>;
  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className="h-56 w-full overflow-hidden rounded-xl border-2 border-neutral-300"
      data-testid="map"
    />
  );
}
