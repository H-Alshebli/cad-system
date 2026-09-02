"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCircle2, Volume2, VolumeX } from "lucide-react";

const ALERT_AUDIO_PATH = "/sounds/alert.mp3";
const ALERT_AUDIO_STORAGE_KEY = "hcad-alert-audio-enabled";
const ALERT_AUDIO_EVENT = "hcad-alert-audio-setting";

type BrowserPermission = NotificationPermission | "unsupported";

export default function NotificationSettingsPage() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [permission, setPermission] = useState<BrowserPermission>("default");
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAudioEnabled(window.localStorage.getItem(ALERT_AUDIO_STORAGE_KEY) === "true");
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  function saveAudioSetting(enabled: boolean) {
    window.localStorage.setItem(ALERT_AUDIO_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(ALERT_AUDIO_EVENT, { detail: { enabled } }));
    setAudioEnabled(enabled);
  }

  async function enableAudio() {
    setWorking("audio"); setMessage("");
    try {
      const audio = new Audio(ALERT_AUDIO_PATH);
      audio.volume = 1;
      await audio.play();
      window.setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 900);
      saveAudioSetting(true);
      setMessage("Case alert sound is enabled on this browser.");
    } catch {
      saveAudioSetting(false);
      setMessage("The browser blocked audio. Check the site sound permission, then try again.");
    } finally { setWorking(""); }
  }

  function disableAudio() {
    saveAudioSetting(false);
    setMessage("Case alert sound is disabled. In-app alert windows will still appear.");
  }

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") { setPermission("unsupported"); return; }
    setWorking("browser"); setMessage("");
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      setMessage(next === "granted" ? "Browser notifications are enabled." : next === "denied" ? "Notifications are blocked in the browser site settings." : "Notification permission was not granted.");
    } finally { setWorking(""); }
  }

  async function sendTest() {
    setWorking("test"); setMessage("");
    try {
      if (audioEnabled) {
        const audio = new Audio(ALERT_AUDIO_PATH);
        audio.volume = 1;
        await audio.play();
        window.setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1200);
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("HCAD Test Alert", { body: "Your browser notifications are working correctly.", tag: "hcad-test-alert" });
      }
      setMessage("Test completed. Check the sound and browser notification.");
    } catch { setMessage("The test was blocked by the browser. Review the permissions shown below."); }
    finally { setWorking(""); }
  }

  const permissionText = permission === "granted" ? "Enabled" : permission === "denied" ? "Blocked by browser" : permission === "unsupported" ? "Not supported" : "Not enabled";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-3xl bg-[#274C5A] p-6 text-white shadow-sm">
        <div className="flex items-center gap-3"><BellRing size={28} /><div><div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Settings</div><h1 className="mt-1 text-2xl font-black">Notification Settings</h1></div></div>
        <p className="mt-3 max-w-2xl text-sm font-semibold text-cyan-50/85">Manage case alert sounds and browser notifications on this device. These preferences apply only to this browser.</p>
      </div>

      {message && <div className="rounded-2xl border border-[#86A7B2]/30 bg-white p-4 text-sm font-bold text-[#274C5A] shadow-sm">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3">{audioEnabled ? <Volume2 className="text-emerald-600" /> : <VolumeX className="text-slate-400" />}<div><h2 className="font-black">Case Alert Sound</h2><p className="mt-1 text-sm text-[#607482]">Alarm sound for new or assigned cases.</p></div></div><Status enabled={audioEnabled} label={audioEnabled ? "Enabled" : "Disabled"} /></div>
          <div className="mt-5 flex flex-wrap gap-2">{audioEnabled ? <button type="button" onClick={disableAudio} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700">Disable Sound</button> : <button type="button" disabled={Boolean(working)} onClick={() => void enableAudio()} className="rounded-xl bg-[#274C5A] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{working === "audio" ? "Enabling..." : "Enable Sound"}</button>}</div>
        </section>

        <section className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Bell className={permission === "granted" ? "text-emerald-600" : "text-slate-400"} /><div><h2 className="font-black">Browser Notifications</h2><p className="mt-1 text-sm text-[#607482]">Desktop notification when an HCAD case alert arrives.</p></div></div><Status enabled={permission === "granted"} label={permissionText} /></div>
          <div className="mt-5">{permission !== "granted" && permission !== "unsupported" && <button type="button" disabled={Boolean(working) || permission === "denied"} onClick={() => void enableBrowserNotifications()} className="rounded-xl bg-[#274C5A] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{working === "browser" ? "Requesting..." : "Enable Browser Notifications"}</button>}{permission === "denied" && <p className="text-xs font-semibold text-amber-700">Open the browser site settings for hcad.lazem.sa, change Notifications to Allow, then reload this page.</p>}</div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-black">Test Notifications</h2><p className="mt-1 text-sm text-[#607482]">Run a test without creating a real case.</p></div><button type="button" disabled={Boolean(working)} onClick={() => void sendTest()} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{working === "test" ? "Testing..." : "Send Test Alert"}</button></div>
      </section>
    </div>
  );
}

function Status({ enabled, label }: { enabled: boolean; label: string }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${enabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-600"}`}>{enabled && <CheckCircle2 size={13} />}{label}</span>;
}
