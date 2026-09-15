// Shim kecil untuk API Turf yang benar-benar dipakai DashboardKaryawan.
// Tujuannya menghindari membawa seluruh paket @turf/turf ke bundle halaman karyawan.

export function point(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error("Koordinat point tidak valid.");
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates },
  };
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const berpotongan =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (berpotongan) inside = !inside;
  }
  return inside;
}

function pointInPolygon(coordinates, polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  if (!pointInRing(coordinates, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(coordinates, polygon[i])) return false;
  }
  return true;
}

export function booleanPointInPolygon(pt, feature) {
  const coordinates = pt?.geometry?.coordinates;
  const geometry = feature?.geometry || feature;
  if (!Array.isArray(coordinates) || !geometry) return false;

  if (geometry.type === "Polygon") {
    return pointInPolygon(coordinates, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(coordinates, polygon));
  }

  return false;
}
