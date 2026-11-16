const copy = { geoapify: "Powered by Geoapify", osm: "© OpenStreetMap contributors" };
/** Attribution for Geoapify's OSM-based places and routes. */
export function GeoAttribution({ source }: { source: string }) {
  if (source !== "geoapify") return null;
  return <p className="text-xs text-muted-foreground"><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline">{copy.geoapify}</a>{" · "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">{copy.osm}</a></p>;
}
