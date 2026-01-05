"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getDeviceData } from "@/lib/utils/rtdbHelper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Sprout, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";

type TabKey = "fields" | "devices" | "healthy" | "issues";

type PaddyWithStatus = {
  id: string;
  paddyName?: string;
  deviceId?: string;
  status: "offline" | "sensor-issue" | "ok";
};

type FieldWithDevices = {
  id: string;
  fieldName: string;
  riceVariety?: string;
  startDay?: string;
  status?: string;
  deviceStats?: {
    total: number;
    offline: number;
    issues: number;
    healthy: number;
  };
  paddies?: PaddyWithStatus[];
};

type DeviceRow = {
  deviceId: string;
  paddyName: string;
  fieldName: string;
  fieldId: string;
  status: "offline" | "sensor-issue" | "ok";
};

export default function OverviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") as TabKey) || "fields";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [fields, setFields] = useState<FieldWithDevices[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const tab = (searchParams.get("tab") as TabKey) || "fields";
    setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setFields([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const fieldsRef = collection(db, "users", user.uid, "fields");
        const q = query(fieldsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fieldsData: FieldWithDevices[] = [];

        for (const fieldDoc of querySnapshot.docs) {
          const fieldData = { id: fieldDoc.id, ...(fieldDoc.data() as any) } as FieldWithDevices;

          try {
            const paddiesRef = collection(db, "users", user.uid, "fields", fieldDoc.id, "paddies");
            const paddiesSnapshot = await getDocs(paddiesRef);

            let fieldTotalDevices = 0;
            let fieldOfflineDevices = 0;
            let fieldIssueDevices = 0;
            const paddies: PaddyWithStatus[] = [];

            for (const paddyDoc of paddiesSnapshot.docs) {
              const paddyData = { id: paddyDoc.id, ...(paddyDoc.data() as any) } as any;

              let hasHeartbeat = false;
              let hasReadings = false;

              if (paddyData.deviceId) {
                try {
                  const deviceData = await getDeviceData(paddyData.deviceId, "");

                  if (deviceData) {
                    hasHeartbeat =
                      deviceData.status === "connected" ||
                      deviceData.status === "alive" ||
                      (deviceData.npk?.timestamp && deviceData.npk.timestamp > Date.now() - 10 * 60 * 1000);

                    hasReadings = Boolean(
                      deviceData.npk &&
                        (deviceData.npk.n !== undefined ||
                          deviceData.npk.p !== undefined ||
                          deviceData.npk.k !== undefined)
                    );
                  }
                } catch (error) {
                  console.error("Error checking device status:", paddyData.deviceId, error);
                }
              }

              let status: "offline" | "sensor-issue" | "ok" = "offline";

              if (!paddyData.deviceId || !hasHeartbeat) {
                status = "offline";
                fieldOfflineDevices++;
              } else if (hasHeartbeat && !hasReadings) {
                status = "sensor-issue";
                fieldIssueDevices++;
              } else {
                status = "ok";
              }

              if (paddyData.deviceId) {
                fieldTotalDevices++;
              }

              paddies.push({
                id: paddyData.id,
                paddyName: paddyData.paddyName,
                deviceId: paddyData.deviceId,
                status,
              });
            }

            fieldsData.push({
              ...fieldData,
              paddies,
              deviceStats: {
                total: fieldTotalDevices,
                offline: fieldOfflineDevices,
                issues: fieldIssueDevices,
                healthy: fieldTotalDevices - fieldOfflineDevices - fieldIssueDevices,
              },
            });
          } catch (error) {
            console.error("Error fetching paddies for field:", fieldDoc.id, error);
            fieldsData.push(fieldData);
          }
        }

        setFields(fieldsData);
      } catch (error) {
        console.error("Error fetching overview fields:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const allDevices: DeviceRow[] = useMemo(() => {
    const devices: DeviceRow[] = [];
    fields.forEach((field) => {
      field.paddies?.forEach((paddy) => {
        if (!paddy.deviceId) return;
        devices.push({
          deviceId: paddy.deviceId,
          paddyName: paddy.paddyName || "",
          fieldName: field.fieldName,
          fieldId: field.id,
          status: paddy.status,
        });
      });
    });
    return devices;
  }, [fields]);

  const healthyDevices = useMemo(() => allDevices.filter((d) => d.status === "ok"), [allDevices]);
  const issueDevices = useMemo(
    () => allDevices.filter((d) => d.status === "offline" || d.status === "sensor-issue"),
    [allDevices]
  );

  const devicesByField = useMemo(() => {
    const map = new Map<string, { fieldId: string; fieldName: string; devices: DeviceRow[] }>();

    allDevices.forEach((device) => {
      if (!map.has(device.fieldId)) {
        map.set(device.fieldId, { fieldId: device.fieldId, fieldName: device.fieldName, devices: [] });
      }
      map.get(device.fieldId)!.devices.push(device);
    });

    return Array.from(map.values());
  }, [allDevices]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/overview?${params.toString()}`);
  };

  const renderStatusBadge = (status: "offline" | "sensor-issue" | "ok") => {
    if (status === "ok") {
      return (
        <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
          OK
        </span>
      );
    }

    if (status === "sensor-issue") {
      return (
        <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
          Sensor issue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Offline
      </span>
    );
  };

  const renderTabs = () => (
    <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
      <button
        className={`px-4 py-3 rounded-full text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-2 transition-all duration-200 min-h-[48px] ${
          activeTab === "fields" 
            ? "bg-green-600 text-white border-green-600 shadow-lg shadow-green-200" 
            : "bg-white text-gray-700 border-gray-300 hover:border-green-500 hover:shadow-md active:scale-95"
        }`}
        onClick={() => handleTabChange("fields")}
        aria-label="View all fields"
        aria-pressed={activeTab === "fields"}
      >
        <Sprout className="w-5 h-5" /> Fields
      </button>
      <button
        className={`px-4 py-3 rounded-full text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-2 transition-all duration-200 min-h-[48px] ${
          activeTab === "devices" 
            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" 
            : "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:shadow-md active:scale-95"
        }`}
        onClick={() => handleTabChange("devices")}
        aria-label="View all devices"
        aria-pressed={activeTab === "devices"}
      >
        <Smartphone className="w-5 h-5" /> Devices
      </button>
      <button
        className={`px-4 py-3 rounded-full text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-2 transition-all duration-200 min-h-[48px] ${
          activeTab === "healthy" 
            ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
            : "bg-white text-gray-700 border-gray-300 hover:border-emerald-500 hover:shadow-md active:scale-95"
        }`}
        onClick={() => handleTabChange("healthy")}
        aria-label="View healthy devices"
        aria-pressed={activeTab === "healthy"}
      >
        <CheckCircle className="w-5 h-5" /> Healthy
      </button>
      <button
        className={`px-4 py-3 rounded-full text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-2 transition-all duration-200 min-h-[48px] ${
          activeTab === "issues" 
            ? "bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200" 
            : "bg-white text-gray-700 border-gray-300 hover:border-orange-500 hover:shadow-md active:scale-95"
        }`}
        onClick={() => handleTabChange("issues")}
        aria-label="View devices with issues"
        aria-pressed={activeTab === "issues"}
      >
        <AlertTriangle className="w-5 h-5" /> Issues
      </button>
    </div>
  );

  const renderFieldsTab = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-20">
          <svg
            className="animate-spin h-10 w-10 text-green-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      );
    }

    if (fields.length === 0) {
      return (
        <Card className="border-0 shadow-md bg-white mt-4">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Sprout className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">No fields yet</p>
                <p className="text-sm text-gray-600">Create your first field to get started</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <Card
            key={field.id}
            className="border-0 shadow-md bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer active:scale-[0.98]"
            onClick={() => router.push(`/field/${field.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && router.push(`/field/${field.id}`)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900 mb-1">{field.fieldName}</p>
                  <p className="text-xs text-gray-600 font-medium">
                    {field.riceVariety || "Unknown variety"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-green-600">
                    {field.deviceStats?.total ?? 0}
                  </p>
                  <p className="text-xs text-gray-600 font-semibold">Devices</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                <span>
                  Started {field.startDay ? new Date(field.startDay).toLocaleDateString() : "N/A"}
                </span>
                {field.deviceStats && field.deviceStats.total > 0 && (
                  <span className="font-semibold">
                    {field.deviceStats.offline > 0
                      ? `${field.deviceStats.offline} offline`
                      : field.deviceStats.issues > 0
                      ? `${field.deviceStats.issues} issue${field.deviceStats.issues > 1 ? "s" : ""}`
                      : "All devices OK"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderDevicesGrouped = (devicesSource: DeviceRow[]) => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-20">
          <svg
            className="animate-spin h-10 w-10 text-green-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      );
    }

    if (devicesSource.length === 0) {
      return (
        <Card className="border-0 shadow-md bg-white mt-4">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">No devices found</p>
                <p className="text-sm text-gray-600">
                  {activeTab === 'healthy' && 'All devices are either offline or have issues'}
                  {activeTab === 'issues' && 'All devices are running smoothly'}
                  {activeTab === 'devices' && 'Add devices to your fields to see them here'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const filteredByField = new Map<string, { fieldName: string; fieldId: string; devices: DeviceRow[] }>();

    devicesSource.forEach((device) => {
      if (!filteredByField.has(device.fieldId)) {
        filteredByField.set(device.fieldId, {
          fieldId: device.fieldId,
          fieldName: device.fieldName,
          devices: [],
        });
      }
      filteredByField.get(device.fieldId)!.devices.push(device);
    });

    return (
      <div className="mt-4 space-y-4">
        {Array.from(filteredByField.values()).map((group) => (
          <Card
            key={group.fieldId}
            className="border-0 shadow-md bg-white"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-green-600" />
                  {group.fieldName}
                </CardTitle>
                <p className="text-xs text-gray-500">{group.devices.length} device(s)</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold min-h-[36px] hover:bg-green-50 hover:border-green-500 hover:text-green-700 transition-all active:scale-95"
                onClick={() => router.push(`/field/${group.fieldId}`)}
              >
                View field
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {group.devices.map((device) => (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-500" />
                      {device.deviceId}
                    </p>
                    <p className="text-xs text-gray-500">Paddy: {device.paddyName || "N/A"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {renderStatusBadge(device.status)}
                    <p className="text-[11px] text-gray-500">
                      {device.status === "ok"
                        ? "No issues"
                        : device.status === "sensor-issue"
                        ? "Sensor issue"
                        : "Device offline"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderActiveTab = () => {
    if (activeTab === "fields") return renderFieldsTab();
    if (activeTab === "devices") return renderDevicesGrouped(allDevices);
    if (activeTab === "healthy") return renderDevicesGrouped(healthyDevices);
    return renderDevicesGrouped(issueDevices);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <nav className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 sticky top-0 z-50 shadow-lg">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/")}
                  className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white p-1 mr-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-xl font-bold text-white">Device & Field Overview</h1>
              </div>
            </div>
          </div>
        </nav>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Details</h2>
              <p className="text-gray-600 text-base mt-2">
                View detailed lists of your fields and devices.
              </p>
            </div>
          </div>

          {renderTabs()}

          {renderActiveTab()}
        </main>
      </div>
    </ProtectedRoute>
  );
}
