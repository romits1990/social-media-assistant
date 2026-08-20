"use client";

import { useState, useEffect, useCallback } from "react";
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
  { label: "Every Minute (Dev Testing)", value: "* * * * *" },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<RecurringScheduleEntity[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Form State (targetTopic is now optional)
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState(CRON_PRESETS[0].value);
  const [targetTopic, setTargetTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("linkedin");
  const [targetDomain, setTargetDomain] = useState("ALL");
  const [autoPublish, setAutoPublish] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [schedRes, domRes] = await Promise.all([
      getSchedulesAction(),
      getAvailableDomainsAction(),
    ]);

    if (schedRes.success && schedRes.data) {
      setSchedules(schedRes.data);
    }
    if (domRes.success && domRes.domains) {
      setDomains(domRes.domains);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle schedule creation with optional topic
  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    const res = await createScheduleAction({
      name: name.trim(),
      cronExpression,
      platform,
      targetTopic: targetTopic.trim(),
      targetDomain,
      autoPublish,
    });
    setCreating(false);

    if (res.success && res.data) {
      setSchedules((prev) => [res.data!, ...prev]);
      setName("");
      setTargetTopic("");
      setAutoPublish(false);
    }
  };

  // Toggle active state
  const handleToggle = async (schedule: RecurringScheduleEntity) => {
    const originalStatus = schedule.isActive;
    const nextStatus = !originalStatus;

    setSchedules((prev) =>
      prev.map((item) =>
        item.id === schedule.id ? { ...item, isActive: nextStatus } : item
      )
    );

    const res = await toggleScheduleAction(schedule);
    if (!res.success) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === schedule.id ? { ...item, isActive: originalStatus } : item
        )
      );
    }
  };

  // Immediate manual run
  const handleTriggerNow = async (schedule: RecurringScheduleEntity) => {
    setTriggeringId(schedule.id);
    const res = await triggerScheduleNowAction(schedule);
    setTriggeringId(null);

    if (res.success) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === schedule.id
            ? { ...item, lastRunAt: new Date().toISOString() }
            : item
        )
      );
    }
  };

  // Delete schedule
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    const previousList = [...schedules];
    setSchedules((prev) => prev.filter((item) => item.id !== id));

    const res = await deleteScheduleAction(id);
    if (!res.success) {
      setSchedules(previousList);
    }
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
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Create Recurring Post Schedule
          </h2>
          <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">
            🤖 Fully Autonomous Mode Supported
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Schedule Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Daily Tech Insights"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Target Topic / Seed Prompt
              </label>
              <span className="text-[10px] text-gray-400 font-medium">Optional</span>
            </div>
            <input
              type="text"
              placeholder="Leave empty for Autonomous AI Topic Discovery ✨"
              value={targetTopic}
              onChange={(e) => setTargetTopic(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Frequency (Cron)</label>
            <select
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Target Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white capitalize focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Source Website Scope</label>
            <select
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">🌐 All Ingested Websites</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-gray-700">Auto-Publish</span>
            </label>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creating ? "Saving Schedule..." : "+ Save Recurring Schedule"}
          </button>
        </div>
      </form>

      {/* Schedules Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">
            <tr>
              <th className="px-6 py-3">Schedule & Topic Strategy</th>
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
                    {s.targetTopic && s.targetTopic.trim() ? (
                      <div className="text-gray-500 text-[11px] truncate max-w-xs mt-0.5">
                        📌 {s.targetTopic}
                      </div>
                    ) : (
                      <div className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-medium mt-0.5">
                        ✨ Autonomous Topic Discovery
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 capitalize">
                      {s.platform}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-xs text-gray-700">{s.cronExpression}</div>
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                      {s.targetDomain === "ALL" ? "🌐 All Websites" : `🔗 ${s.targetDomain}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(s)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded transition ${
                        s.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.isActive ? "● ACTIVE" : "○ PAUSED"}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-2 text-xs">
                    <button
                      onClick={() => handleTriggerNow(s)}
                      disabled={triggeringId === s.id}
                      className="text-blue-600 hover:underline disabled:opacity-50 font-medium"
                    >
                      {triggeringId === s.id ? "Running..." : "Run Now ⚡"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-600 hover:underline font-medium"
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