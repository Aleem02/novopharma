import React, { useState, useEffect } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { PrintingSettings } from "./PrintingSettings";
import { DatabaseSettings } from "./DatabaseSettings";
import { PrivacyPolicySettings } from "./PrivacyPolicySettings";
import { TermsSettings } from "./TermsSettings";
import { ReleaseNotesModal } from "../common/ReleaseNotesModal";

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "general" | "printing" | "database" | "privacy" | "terms"
  >("general");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [versionInfo, setVersionInfo] = useState<{
    version: string;
    build: string;
  }>({ version: "1.3.0", build: "Production Build" });
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Update check states
  const [updateStatus, setUpdateStatus] = useState<{
    state: 'IDLE' | 'CHECKING' | 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADED' | 'INSTALLING' | 'ERROR';
    version?: string;
    currentVersion?: string;
    percent?: number;
    transferred?: string;
    total?: string;
    speed?: string;
    message?: string;
  }>({ state: 'IDLE' });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();

    const handleUpdateState = (data: any) => {
      if (data && data.state) {
        setUpdateStatus(data);
        if (data.state !== 'CHECKING') {
          setIsCheckingUpdate(false);
          setLastCheckedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    };

    if (window.api && window.api.update) {
      window.api.update.onStateChange(handleUpdateState);
    }

    return () => {
      if (window.api && window.api.update) {
        window.api.update.removeStateChangeListeners();
      }
    };
  }, []);

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate || updateStatus.state === 'CHECKING' || updateStatus.state === 'DOWNLOADING') {
      return;
    }
    setIsCheckingUpdate(true);
    setUpdateStatus({ state: 'CHECKING' });
    try {
      if (window.api && window.api.update) {
        await window.api.update.check();
      }
    } catch (err: any) {
      setIsCheckingUpdate(false);
      setUpdateStatus({
        state: 'ERROR',
        message: err.message || 'Failed to check for updates.',
      });
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      if (window.api && window.api.update) {
        await window.api.update.download();
      }
    } catch (err: any) {
      setUpdateStatus({
        state: 'ERROR',
        message: err.message || 'Failed to download update.',
      });
    }
  };

  const loadSettings = async () => {
    try {
      const data = await window.api.settings.getAll();
      setSettings(data);
      if (data.app_version) {
        setVersionInfo({
          version: data.app_version,
          build: data.build_mode || "Production Build",
        });
      } else {
        const ver = await window.api.settings.getVersion();
        if (ver) setVersionInfo(ver);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await window.api.settings.update(settings);
      setSuccess("Settings saved successfully");
    } catch (e: any) {
      setError(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pharmacy Settings
          </h1>
          <p className="text-slate-500 mt-1">
            Configure your application preferences.
          </p>
        </div>
        {activeTab !== "privacy" && activeTab !== "terms" && (
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-lg font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 mb-4 bg-green-100 text-green-700 rounded-lg font-medium">
          {success}
        </div>
      )}

      <div className="flex gap-8">
        {/* Settings Navigation Sidebar */}
        <div className="w-64 shrink-0 flex flex-col justify-between">
          <nav className="flex flex-col space-y-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === "general" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              General Configuration
            </button>
            <button
              onClick={() => setActiveTab("printing")}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === "printing" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Printing
            </button>
            <button
              onClick={() => setActiveTab("database")}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === "database" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Database Management
            </button>

            <div className="pt-3 pb-1 border-t border-slate-100 my-2">
              <p className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Legal & Information
              </p>
            </div>

            <button
              onClick={() => setActiveTab("privacy")}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === "privacy" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === "terms" ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Terms & Conditions
            </button>
          </nav>

          {/* Build Version Badge (Clickable) */}
          <div className="pt-6 border-t border-slate-200 mt-6 space-y-2.5">
            <div
              onClick={() => setShowReleaseNotes(true)}
              className="bg-slate-50 hover:bg-teal-50/60 transition-colors rounded-lg p-3 border border-slate-200 hover:border-teal-300 cursor-pointer group"
              title="Click to view Release Notes"
            >
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold text-slate-700 group-hover:text-teal-700">
                  NovoPharma Desktop
                </div>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold">
                  Release Notes
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Version: v{versionInfo.version}
              </div>
              <div className="text-[10px] text-teal-700 font-medium uppercase tracking-wider mt-1">
                {versionInfo.build}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isCheckingUpdate || updateStatus.state === 'CHECKING'}
              disabled={isCheckingUpdate || updateStatus.state === 'CHECKING' || updateStatus.state === 'DOWNLOADING'}
              onClick={handleCheckForUpdates}
              className="w-full text-xs font-semibold py-1.5"
            >
              Check for Updates
            </Button>
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1">
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-800">
                    Application & Build Information
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isCheckingUpdate || updateStatus.state === 'CHECKING'}
                    disabled={isCheckingUpdate || updateStatus.state === 'CHECKING' || updateStatus.state === 'DOWNLOADING'}
                    onClick={handleCheckForUpdates}
                  >
                    Check for Updates
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setShowReleaseNotes(true)}
                    className="bg-slate-50 hover:bg-teal-50/60 transition-all rounded-lg p-3 border border-slate-200 hover:border-teal-300 cursor-pointer group"
                    title="Click to view Release Notes"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider group-hover:text-teal-700">
                        Application Version
                      </span>
                      <span className="text-[10px] text-teal-600 font-semibold group-hover:underline">
                        View Notes &rarr;
                      </span>
                    </div>
                    <span className="text-slate-900 font-bold text-base mt-0.5 block">
                      v{versionInfo.version}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">
                      Build Environment
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 mt-1">
                      {versionInfo.build}
                    </span>
                  </div>
                </div>

                {/* Real-time Update Status Feedback Banner */}
                {updateStatus.state === 'UP_TO_DATE' && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fade-in">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>NovoPharma is up to date (v{updateStatus.currentVersion || versionInfo.version}).</span>
                    {lastCheckedTime && <span className="text-emerald-600 ml-auto text-[11px]">Checked at {lastCheckedTime}</span>}
                  </div>
                )}

                {updateStatus.state === 'UPDATE_AVAILABLE' && (
                  <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="font-bold">New Version Available: v{updateStatus.version}</span>
                        <span className="text-amber-700 ml-1.5">(Current: v{updateStatus.currentVersion || versionInfo.version})</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleDownloadUpdate}
                      className="bg-amber-600 hover:bg-amber-700 text-white border-none py-1 px-3 text-xs"
                    >
                      Download & Update
                    </Button>
                  </div>
                )}

                {updateStatus.state === 'DOWNLOADING' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-700 font-medium">
                      <span>Downloading update v{updateStatus.version}...</span>
                      <span className="font-mono text-teal-700">{updateStatus.percent || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-600 h-2 transition-all duration-300"
                        style={{ width: `${updateStatus.percent || 0}%` }}
                      />
                    </div>
                    {updateStatus.speed && (
                      <p className="text-[11px] text-slate-500">
                        {updateStatus.transferred} MB / {updateStatus.total} MB ({updateStatus.speed} MB/s)
                      </p>
                    )}
                  </div>
                )}

                {updateStatus.state === 'DOWNLOADED' && (
                  <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs font-medium">
                    <svg className="w-4 h-4 text-teal-600 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Update v{updateStatus.version} downloaded. Creating safety backup and restarting...</span>
                  </div>
                )}

                {updateStatus.state === 'ERROR' && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                    <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{updateStatus.message || 'Unable to complete update check.'}</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Pharmacy Details
                </h2>
                <div className="space-y-4">
                  <Input
                    label="Pharmacy Name"
                    value={settings.pharmacy_name || ""}
                    onChange={(e) =>
                      handleChange("pharmacy_name", e.target.value)
                    }
                    placeholder="Enter pharmacy  name..."
                  />
                  <Input
                    label="Address"
                    value={settings.address || ""}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Enter address..."
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Phone"
                      value={settings.phone || ""}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="Enter phone..."
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={settings.email || ""}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="Enter email..."
                    />
                  </div>
                  <Input
                    label="GST Number"
                    value={settings.gst_number || ""}
                    onChange={(e) => handleChange("gst_number", e.target.value)}
                    placeholder="Enter g s t  number..."
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Invoice Configuration
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Invoice Prefix"
                    value={settings.invoice_prefix || ""}
                    onChange={(e) =>
                      handleChange("invoice_prefix", e.target.value)
                    }
                    placeholder="Enter invoice  prefix..."
                  />
                  <Input
                    label="Next Invoice Number"
                    type="number"
                    min="1"
                    value={settings.next_invoice_number || "1"}
                    onChange={(e) =>
                      handleChange("next_invoice_number", e.target.value)
                    }
                    placeholder="Enter next  invoice  number..."
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Warning: Changing the next invoice number may cause sequence
                  gaps or conflicts if not handled carefully.
                </p>
              </div>
            </div>
          )}

          {activeTab === "printing" && (
            <PrintingSettings settings={settings} handleChange={handleChange} />
          )}

          {activeTab === "database" && (
            <DatabaseSettings
              settings={settings}
              handleChange={handleChange}
              setError={setError}
              setSuccess={setSuccess}
            />
          )}

          {activeTab === "privacy" && <PrivacyPolicySettings />}

          {activeTab === "terms" && <TermsSettings />}
        </div>
      </div>

      <ReleaseNotesModal
        isOpen={showReleaseNotes}
        onClose={() => setShowReleaseNotes(false)}
        initialVersion={versionInfo.version}
      />
    </div>
  );
};
