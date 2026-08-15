"use client";

import { useState, useEffect, useCallback } from "react";
import { getJobsListAction, checkJobStatusAction } from "@/actions/pipeline.actions";
import { IngestionJob, JobStatus } from "@/repositories/job.repository";
import Link from "next/link";

export default function JobsManagementPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshingJobId, setRefreshingJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);

  // 1. Fetch entire list on-demand
  const loadJobs = useCallback(async () => {
    setLoading(true);
    const res = await getJobsListAction(
      statusFilter === "ALL" ? undefined : (statusFilter as JobStatus)
    );
    if (res.success && res.jobs) {
      setJobs(res.jobs);
    }
    setLoading(false);
  }, [statusFilter]);

  // Initial load on page visit and filter tab changes ONLY (no interval polling)
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // 2. Refresh a single row on-demand
  const handleRefreshSingleJob = async (jobId: string) => {
    setRefreshingJobId(jobId);
    try {
      const res = await checkJobStatusAction(jobId);
      if (res.success && res.job) {
        setJobs((prevJobs) =>
          prevJobs.map((j) => (j.id === jobId ? res.job! : j))
        );
        // Also update modal inspection state if this job is currently opened
        setSelectedJob((prev) => (prev?.id === jobId ? res.job! : prev));
      }
    } finally {
      setRefreshingJobId(null);
    }
  };

  const filterTabs = ["ALL", "PROCESSING", "COMPLETED", "FAILED"];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingestion Job Monitor</h1>
          <p className="text-sm text-gray-500">
            Manual on-demand status tracking for sitemap crawls and single-page vectorization jobs.
          </p>
        </div>
        <div className="flex space-x-2">
          <Link
            href="/dashboard/sources"
            className="bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-blue-700 transition"
          >
            + Sitemap Ingest
          </Link>
          <Link
            href="/dashboard/sources/single"
            className="bg-gray-800 text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-gray-900 transition"
          >
            + Single URL Ingest
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Table-Level Manual Refresh */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === tab
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          <span>{loading ? "Refreshing..." : "Refresh Table"}</span>
        </button>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Target URL</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Progress</th>
              <th className="px-6 py-3">Created At</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-xs">
                  Loading jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-xs">
                  No jobs found matching filter &ldquo;{statusFilter}&rdquo;.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const isSingleRefreshing = refreshingJobId === job.id;
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    {/* Job Type Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          job.job_type === "SITEMAP_CRAWL"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {job.job_type === "SITEMAP_CRAWL" ? "Sitemap" : "Single Page"}
                      </span>
                    </td>

                    {/* Target URL */}
                    <td className="px-6 py-4 max-w-xs truncate font-mono text-xs text-gray-800">
                      <a
                        href={job.target_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-blue-600 truncate block"
                      >
                        {job.target_url}
                      </a>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded uppercase ${
                          job.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : job.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>

                    {/* Progress Bar & Item Count */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-28 space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                          <span>{job.progress_percentage}%</span>
                          <span>
                            {job.processed_items}/{job.total_items || "?"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              job.status === "FAILED" ? "bg-red-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${job.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Created At */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>

                    {/* 🎯 ACTIONS: Individual Job Sync + Inspector */}
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => handleRefreshSingleJob(job.id)}
                        disabled={isSingleRefreshing}
                        title="Check status update for this job only"
                        className="inline-flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded transition disabled:opacity-50"
                      >
                        <span className={isSingleRefreshing ? "animate-spin" : ""}>🔄</span>
                        <span>{isSingleRefreshing ? "Syncing..." : "Sync"}</span>
                      </button>

                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center text-xs text-blue-600 hover:underline font-medium px-1 py-1"
                      >
                        Inspect 🔍
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal / Drawer for Job Result Inspection */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Job Inspection</h3>
                <span className="text-xs text-gray-400 font-mono">ID: {selectedJob.id}</span>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border">
                <div>
                  <span className="text-gray-500 block">Job Type</span>
                  <span className="font-bold text-gray-900">{selectedJob.job_type}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Status</span>
                  <span className="font-bold text-gray-900">{selectedJob.status}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Created At</span>
                  <span className="text-gray-800">
                    {new Date(selectedJob.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Updated At</span>
                  <span className="text-gray-800">
                    {new Date(selectedJob.updated_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 block mb-1">Target URL</span>
                <p className="font-mono bg-gray-100 p-2 rounded truncate text-gray-800">
                  {selectedJob.target_url}
                </p>
              </div>

              {selectedJob.error_message && (
                <div>
                  <span className="text-red-600 font-semibold block mb-1">Error Message</span>
                  <pre className="bg-red-50 text-red-700 p-2.5 rounded border border-red-200 whitespace-pre-wrap font-mono">
                    {selectedJob.error_message}
                  </pre>
                </div>
              )}

              {selectedJob.result_data && (
                <div>
                  <span className="text-gray-500 block mb-1">Result Payload</span>
                  <pre className="bg-slate-900 text-emerald-400 p-3 rounded font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedJob.result_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex justify-between items-center">
              <button
                onClick={() => handleRefreshSingleJob(selectedJob.id)}
                disabled={refreshingJobId === selectedJob.id}
                className="text-xs text-gray-600 hover:text-gray-900 border px-2.5 py-1.5 rounded flex items-center space-x-1"
              >
                <span className={refreshingJobId === selectedJob.id ? "animate-spin" : ""}>🔄</span>
                <span>Refresh Status</span>
              </button>

              <div className="flex space-x-2">
                {selectedJob.status === "COMPLETED" && (
                  <Link
                    href="/dashboard/create"
                    className="bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded hover:bg-green-700 transition"
                  >
                    Create Social Post →
                  </Link>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="bg-gray-100 text-gray-700 text-xs px-3 py-2 rounded hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}