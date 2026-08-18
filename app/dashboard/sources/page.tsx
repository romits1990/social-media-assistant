"use client";

import { useState, useEffect } from "react";
import { startAsyncSitemapPipelineAction, checkJobStatusAction } from "@/actions/pipeline.actions";
import { IngestionJob } from "@/repositories/job.repository";
import Link from "next/link";

export default function AsyncSourceIngestionPage() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [fileLimit, setFileLimit] = useState<number | undefined>(undefined);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<IngestionJob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      const res = await checkJobStatusAction(activeJobId);
      if (res.success && res.job) {
        setJobData(res.job);
        if (res.job.status === "COMPLETED" || res.job.status === "FAILED") {
          clearInterval(interval);
          setActiveJobId(null);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapUrl.trim()) return;

    setSubmitting(true);
    setJobData(null);

    const res = await startAsyncSitemapPipelineAction(sitemapUrl, fileLimit);
    setSubmitting(false);

    if (res.success && res.jobId) {
      setActiveJobId(res.jobId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sitemap Ingestion Pipeline</h1>
          <p className="text-sm text-gray-500">
            Crawl, scrape, and vectorize multiple pages asynchronously with real-time job monitoring.
          </p>
        </div>
        <Link
          href="/dashboard/sources/single"
          className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md hover:bg-blue-100 transition"
        >
          Single Page Ingest →
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sitemap URL (XML or Index)
          </label>
          <input
            type="url"
            required
            disabled={!!activeJobId}
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Page Processing Limit <span className="text-gray-400 font-normal">(Optional, for batch testing)</span>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            disabled={!!activeJobId}
            value={fileLimit || ""}
            onChange={(e) => setFileLimit(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="e.g. 10"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm disabled:bg-gray-50"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !!activeJobId}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 text-sm flex justify-center items-center space-x-2"
        >
          {activeJobId ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              <span>Job Running in Background...</span>
            </>
          ) : (
            <span>🚀 Queue Sitemap Ingestion Job</span>
          )}
        </button>
      </form>

      {jobData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <span className="text-xs font-mono text-gray-400">Job ID: {jobData.id}</span>
              <h3 className="font-bold text-gray-900 text-sm mt-0.5">Target: {jobData.target_url}</h3>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded uppercase ${
                jobData.status === "COMPLETED"
                  ? "bg-green-100 text-green-800"
                  : jobData.status === "FAILED"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800 animate-pulse"
              }`}
            >
              {jobData.status}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-gray-600">
              <span>
                Processed {jobData.processed_items} of {jobData.total_items || "?"} steps
              </span>
              <span>{jobData.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border">
              <div
                className={`h-full transition-all duration-500 ${
                  jobData.status === "FAILED" ? "bg-red-500" : "bg-blue-600"
                }`}
                style={{ width: `${jobData.progress_percentage}%` }}
              />
            </div>
          </div>

          {jobData.status === "FAILED" && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              ⛔ {jobData.error_message || "An unexpected error halted pipeline execution."}
            </div>
          )}

          {jobData.status === "COMPLETED" && jobData.result_data && (
            <div className="bg-green-50 p-4 rounded-md border border-green-200 text-xs space-y-3">
              <div className="font-bold text-green-800 flex items-center space-x-1.5">
                <span>🎉</span>
                <span>Ingestion Pipeline Completed Successfully!</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-gray-700">
                <div className="bg-white p-2.5 rounded border border-green-100">
                  <span className="text-gray-500 block">Tenant Hostname</span>
                  <span className="font-bold text-gray-900 mt-0.5 block truncate">
                    {jobData.result_data.hostname}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-green-100">
                  <span className="text-gray-500 block">Pages Scraped</span>
                  <span className="font-bold text-gray-900 mt-0.5 block">
                    {jobData.result_data.pagesScraped} files
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-green-100">
                  <span className="text-gray-500 block">Pages Vectorized</span>
                  <span className="font-bold text-gray-900 mt-0.5 block">
                    {jobData.result_data.pagesIngested} pages
                  </span>
                </div>
              </div>
              <div className="pt-1 flex justify-end">
                <Link
                  href="/dashboard/create"
                  className="bg-green-700 text-white px-3 py-1.5 rounded font-semibold text-xs hover:bg-green-800 transition"
                >
                  Draft Social Posts Now →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}