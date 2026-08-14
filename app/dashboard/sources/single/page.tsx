"use client";

import { useState, useEffect } from "react";
import {
  startAsyncSinglePagePipelineAction,
  checkJobStatusAction,
} from "@/actions/pipeline.actions";
import { IngestionJob } from "@/repositories/job.repository";
import Link from "next/link";

export default function SinglePageIngestPage() {
  const [pageUrl, setPageUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<IngestionJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

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
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageUrl.trim()) return;

    setSubmitting(true);
    setErrorBanner(null);
    setJobData(null);

    const res = await startAsyncSinglePagePipelineAction(pageUrl);
    setSubmitting(false);

    if (!res.success || !res.jobId) {
      setErrorBanner(res.error || "Failed to start job.");
      return;
    }

    setActiveJobId(res.jobId);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Single Page Ingestion</h1>
          <p className="text-sm text-gray-500">
            Asynchronously scrape, chunk, and embed a specific webpage URL.
          </p>
        </div>
        <Link
          href="/dashboard/sources"
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          ← Sitemap Ingestion
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Page URL
          </label>
          <input
            type="url"
            required
            disabled={!!activeJobId}
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://example.com/blog/sample-article"
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
              <span>Processing Webpage in Background...</span>
            </>
          ) : (
            <span>⚡ Start Ingestion Job</span>
          )}
        </button>
      </form>

      {errorBanner && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          ⛔ {errorBanner}
        </div>
      )}

      {jobData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <span className="text-xs font-mono text-gray-400">Job ID: {jobData.id}</span>
              <h3 className="font-bold text-gray-900 text-sm mt-0.5 truncate max-w-lg">
                Target: {jobData.target_url}
              </h3>
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
              <span>Status: {jobData.status === "PROCESSING" ? "Scraping & Embedding" : jobData.status}</span>
              <span>{jobData.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border">
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
              ⛔ {jobData.error_message || "An unexpected error occurred."}
            </div>
          )}

          {jobData.status === "COMPLETED" && jobData.result_data && (
            <div className="bg-green-50 p-4 rounded-md border border-green-200 text-xs space-y-3">
              <div className="font-bold text-green-800 flex items-center space-x-1.5">
                <span>✅</span>
                <span>Webpage Successfully Ingested & Vectorized!</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
                <div className="bg-white p-2.5 rounded border border-green-100">
                  <span className="text-gray-500 block">Page Title</span>
                  <span className="font-bold text-gray-900 mt-0.5 block truncate">
                    {jobData.result_data.title}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-green-100">
                  <span className="text-gray-500 block">Text Length</span>
                  <span className="font-bold text-gray-900 mt-0.5 block">
                    {jobData.result_data.characterCount?.toLocaleString()} chars
                  </span>
                </div>
              </div>

              {jobData.result_data.heroImage && (
                <div>
                  <span className="text-gray-500 block mb-1">Hero Image Extracted:</span>
                  <div className="rounded border bg-white max-h-40 max-w-xs overflow-hidden">
                    <img
                      src={jobData.result_data.heroImage}
                      alt="Hero"
                      className="object-cover w-full h-full"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Link
                  href="/dashboard/create"
                  className="bg-green-700 text-white px-3.5 py-1.5 rounded font-semibold text-xs hover:bg-green-800 transition"
                >
                  Create Social Post for this Page →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}