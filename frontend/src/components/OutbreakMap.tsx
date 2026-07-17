import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface OutbreakLocation {
    location: string;
    riskLevel: string;
    status: string;
    alertCount: number;
    activeCount?: number;
    resolvedCount?: number;
    reasons?: string[];
    lastUpdated: string;
    lat: number;
    lng: number;
}

interface OutbreakMapProps {
    token: string;
    userRole: string;
}

const API_URL = "http://127.0.0.1:5000";

const RISK_COLORS: Record<string, string> = {
    HIGH: "#dc2626",
    MEDIUM: "#d97706",
    LOW: "#16a34a",
};

const OutbreakMap: React.FC<OutbreakMapProps> = ({ token, userRole }) => {
    const [locations, setLocations] = useState<OutbreakLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const headers: HeadersInit = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const params = new URLSearchParams();
            if (userRole === "ADMIN" || userRole === "OPERATOR") {
                params.set("status", statusFilter);
            }

            const res = await fetch(`${API_URL}/api/alerts/map/locations?${params.toString()}`, { headers });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            setLocations(data.locations || []);
            setError("");
        } catch (err) {
            console.error("Error fetching outbreak map locations:", err);
            setError("🔴 Failed to load outbreak map");
            setLocations([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
        const interval = setInterval(fetchLocations, 60000); // refresh every minute
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, statusFilter]);

    // Roughly centered on Telangana
    const center: [number, number] = [17.9, 79.3];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Outbreak Map</h1>
                    <p className="text-gray-600">
                        {userRole === "OPERATOR"
                            ? "Outbreak locations in your assigned district"
                            : userRole === "ADMIN"
                                ? "Outbreak locations across all districts"
                                : "Public outbreak locations"}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {(userRole === "ADMIN" || userRole === "OPERATOR") && (
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as "active" | "all")}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="active">Active only</option>
                            <option value="all">Include resolved</option>
                        </select>
                    )}
                    <button
                        onClick={fetchLocations}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        🔄 {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <MapContainer center={center} zoom={7} style={{ height: "600px", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {locations.map((loc) => (
                        <CircleMarker
                            key={loc.location}
                            center={[loc.lat, loc.lng]}
                            radius={loc.riskLevel === "HIGH" ? 16 : loc.riskLevel === "MEDIUM" ? 12 : 8}
                            pathOptions={{
                                color: RISK_COLORS[loc.riskLevel] || RISK_COLORS.LOW,
                                fillColor: RISK_COLORS[loc.riskLevel] || RISK_COLORS.LOW,
                                fillOpacity: 0.5,
                                weight: 2,
                            }}
                        >
                            <Popup>
                                <div className="text-sm space-y-1">
                                    <p className="font-bold text-base">{loc.location}</p>
                                    <p>
                                        Risk level:{" "}
                                        <span className="font-semibold" style={{ color: RISK_COLORS[loc.riskLevel] }}>
                                            {loc.riskLevel}
                                        </span>
                                    </p>
                                    <p>Status: {loc.status.toUpperCase()}</p>
                                    <p>
                                        {loc.alertCount} alert{loc.alertCount === 1 ? "" : "s"}
                                    </p>
                                    {(userRole === "ADMIN" || userRole === "OPERATOR") &&
                                        loc.reasons &&
                                        loc.reasons.length > 0 && (
                                            <div className="pt-1 border-t border-gray-200 mt-1">
                                                {loc.reasons.map((r, i) => (
                                                    <p key={i} className="text-xs text-gray-600">
                                                        {r}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    <p className="text-xs text-gray-500 pt-1">
                                        Updated {new Date(loc.lastUpdated).toLocaleString()}
                                    </p>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>
            </div>

            {!loading && locations.length === 0 && !error && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                    <p className="text-green-700 font-semibold">✅ No outbreak locations to show</p>
                </div>
            )}

            <p className="text-xs text-gray-400">
                Markers are placed at district-level centroids only, for privacy — exact patient or case
                coordinates are never shown on this map.
            </p>
        </div>
    );
};

export default OutbreakMap;