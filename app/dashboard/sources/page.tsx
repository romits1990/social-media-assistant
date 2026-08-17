"use client";

import { useState, useEffect } from "react";
import {
  generateCustomPostAction,
  publishOrRetryPostAction,
  getAvailableDomainsAction,
} from "@/actions/post.actions";
import { SocialPlatform } from "@/agents/agent.state";

export default function CreatePostPage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable draft preview state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [generatedResult, setGeneratedResult] = useState<{
    postId?: string;
    title: string;
    hashtags: string[];
    heroImage: string | null;
    status: string;
  } | null>(null);

  // Load distinct domains on mount
  useEffect(() => {
    async function loadDomains() {
      const res = await getAvailableDomainsAction();
      if (res.success && res.domains) {
        setAvailableDomains(res.domains);
      }
    }
    loadDomains();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setGeneratedResult(null);

    const res = await generateCustomPostAction({
      targetTopic: topic,
      platform,
      targetDomain: selectedDomain,
      autoPublishEnabled: autoPublish,
    });

    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to generate post for this topic.");
      return;
    }

    if (res.draftPost) {
      setGeneratedResult({
        postId: res.postId ?? undefined,
        title: res.draftPost.title,
        hashtags: res.draftPost.hashtags,
        heroImage: res.heroImage ?? null,
        status: res.status,
      });
      setEditedContent(res.draftPost.content);
    }
  };

  const handleApproveAndPublish = async () => {
    if (!generatedResult?.postId) return;

    setPublishing(true);
    setErrorMessage(null);

    const res = await publishOrRetryPostAction(
      generatedResult.postId,
      editedContent,
      generatedResult.hashtags
    );
    setPublishing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to publish post.");
      return;
    }

    setGeneratedResult((prev) => (prev ? { ...prev, status: "PUBLISHED" } : null));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Post Generator</h1>
        <p className="text-sm text-gray-500">
          Filter by source domain and draft targeted AI social posts on demand.
        </p>
      </div>

      {/* Generator Form */}
      <form onSubmit={handleGenerate} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Topic / Goal
          </label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Shel Silverstein 20th Anniversary Edition"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Domain Filter Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Website Domain
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
            >
              <option value="ALL">🌐 All Ingested Websites</option>
              {availableDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          {/* Social Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Social Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize text-sm bg-white"
            >
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          {/* Auto Publish Toggle */}
          <div className="flex items-center pt-2 md:pt-6">
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-Publish</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 text-sm"
        >
          {loading ? "🤖 Running Scoped Vector Retrieval..." : "Generate Post Draft"}
        </button>
      </form>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          ⛔ {errorMessage}
        </div>
      )}

      {/* Live Preview & Editor Card */}
      {generatedResult && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs font-semibold uppercase px-2.5 py-1 rounded bg-blue-100 text-blue-800">
              {platform} {selectedDomain !== "ALL" ? `(${selectedDomain})` : ""}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              {isEditing ? "Done Editing" : "✏️ Edit Draft"}
            </button>
          </div>

          {/* Hero Image */}
          {generatedResult.heroImage && (
            <div className="rounded-md overflow-hidden bg-gray-100 max-h-80 flex justify-center items-center border">
              <img
                src={generatedResult.heroImage}
                alt="Selected Hero Candidate"
                className="object-cover h-full w-full"
              />
            </div>
          )}

          {/* Post Copy */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{generatedResult.title}</h2>
            {isEditing ? (
              <textarea
                rows={6}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full mt-2 p-3 border rounded-md text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-sans"
              />
            ) : (
              <p className="mt-2 text-gray-700 whitespace-pre-wrap text-sm leading-relaxed font-sans">
                {editedContent}
              </p>
            )}
          </div>

          {/* Hashtags */}
          {generatedResult.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-sm text-blue-600 font-medium">
              {generatedResult.hashtags.map((tag, i) => (
                <span key={i}>{tag.startsWith("#") ? tag : `#${tag}`}</span>
              ))}
            </div>
          )}

          {/* Action Footer */}
          {generatedResult.status === "AWAITING_APPROVAL" && generatedResult.postId && (
            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={handleApproveAndPublish}
                disabled={publishing}
                className="bg-green-600 text-white font-medium px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50 text-sm"
              >
                {publishing ? "Publishing to API..." : "Approve & Publish Now"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}