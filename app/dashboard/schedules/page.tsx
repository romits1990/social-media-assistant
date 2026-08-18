"use client";

import { useState, useEffect } from "react";
import {
  getSchedulesAction,
  createScheduleAction,
  toggleScheduleAction,
  triggerScheduleNowAction,
  deleteScheduleAction,
} from "@/actions/schedule.actions";
import { getAvailableDomainsAction } from "@/actions/post.actions";
import { RecurringScheduleEntity } from "@/repositories/schedule.repository";
import { SocialPlatform } from "@/agents/agent.state";

const CRON_PRESETS = [
  { label: "Twice Daily (9 AM & 6 PM)", value: "0 9,18 * * *" },
  { label: "Once Daily (Morning 9 AM)", value: "0 9 * * *" },
  { label: "Every 6 Hours", value: "0 */6 * * *" },
  { label: "Every Monday 10 AM", value: "0 10 * * 1" },
  { label: "Every 15 Minutes (Testing)", value: "*/15 * * * *" },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<RecurringScheduleEntity[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [cronExp, setCronExp] = useState(CRON_PRESETS[0].value);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("linkedin");
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [autoPublish, setAutoPublish] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [schedRes, domRes] = await Promise.all([
      getSchedulesAction(),
      getAvailableDomainsAction(),
    ]);

    if (schedRes.success && schedRes.schedules) setSchedules(schedRes.schedules);
    if (domRes.success && domRes.domains) setDomains(domRes.domains);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !topic || !cronExp) return;

    setCreating(true);
    const res = await createScheduleAction({
      name,
      cron_expression: cronExp,
      platform,
      target_topic: topic,
      target_domain: selectedDomain,
      auto_publish: autoPublish,
    });
    setCreating(false);

    if (res.success) {
      setName("");
      setTopic("");
      loadData();
    }
  };

  const handleToggle = async (schedule: RecurringScheduleEntity) => {
    await toggleScheduleAction(schedule.id, schedule.is_active, schedule);
    loadData();
  };

  const handleTriggerNow = async (schedule: RecurringScheduleEntity) => {
    setTriggeringId(schedule.id);
    await triggerScheduleNowAction(schedule);
    setTriggeringId(null);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    await deleteScheduleAction(id);
    loadData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation & Cron Scheduler</h1>
        <p className="text-sm text-gray-500">
          Configure recurring autonomous agents to vector search, generate, and publish posts automatically.
        </p>
      </div>

      {/* Schedule Builder Form */}
      <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Create Recurring Post Schedule</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Schedule Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Daily Tech Tips"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Target Topic / Prompt Seed</label>
            <input
              type="text"
              required
              placeholder="e.g. Frontend Architecture Best Practices"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Cron Preset / Expression */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Frequency (Cron)</label>
            <select
              value={cronExp}
              onChange={(e) => setCronExp(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white capitalize"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          {/* Domain Scope */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Source Website Domain</label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white"
            >
              <option value="ALL">🌐 All Ingested Websites</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Auto-Publish Checkbox */}
          <div className="flex items-center pt-5">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span className="text-xs font-semibold text-gray-700">Auto-Publish</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {creating ? "Adding..." : "+ Save Recurring Schedule"}
        </button>
      </form>

      {/* Schedules Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">
            <tr>
              <th className="px-6 py-3">Schedule Name & Topic</th>
              <th className="px-6 py-3">Platform</th>
              <th className="px-6 py-3">Cron & Domain</th>
              <th className="px-6 py-3">Last Run</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs text-gray-400">Loading schedules...</td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs text-gray-400">No recurring schedules configured yet.</td>
              </tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900 text-xs">{s.name}</div>
                    <div className="text-gray-500 text-[11px] truncate max-w-xs">{s.target_topic}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 capitalize">
                      {s.platform}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-xs text-gray-700">{s.cron_expression}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{s.target_domain}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(s)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded transition ${
                        s.is_active
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.is_active ? "● ACTIVE" : "○ PAUSED"}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-2 text-xs">
                    <button
                      onClick={() => handleTriggerNow(s)}
                      disabled={triggeringId === s.id}
                      className="text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {triggeringId === s.id ? "Running..." : "Run Now ⚡"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}