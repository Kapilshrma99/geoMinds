import { useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

export function AdminPage() {
  const { user } = useAuth();
  const [geoServer, setGeoServer] = useState(null);

  useEffect(() => {
    api.get("/gis/geoserver/publish").then((res) => setGeoServer(res.data));
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Admin Control Plane" subtitle="Role-aware operational tooling and integration status">
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <div>User Role: {user?.role}</div>
          <div>GeoServer Layer Publication: {geoServer?.status || "Loading..."}</div>
          <div>Workspace: {geoServer?.workspace || "geomind"}</div>
          <div>Store: {geoServer?.store || "geomind-postgis"}</div>
        </div>
      </SectionCard>

      <SectionCard title="Layer URLs" subtitle="Use these endpoints to connect WMS/WFS layers into external GIS tools">
        <pre className="overflow-auto rounded-[1.75rem] bg-slate-950 p-5 text-sm text-green-300">
          {JSON.stringify(geoServer, null, 2)}
        </pre>
      </SectionCard>
    </div>
  );
}
