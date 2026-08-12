"use client";

import { useState } from "react";
import { generateCustomPostAction, publishOrRetryPostAction } from "@/actions/post.actions";
import { SocialPlatform } from "@/agents/agent.state";

export default function CreatePostPage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Preview state
  const [generatedResult, setGeneratedResult] = useState<{
    postId?: string;
    title: string;
    content: string;
    hashtags: string[];
    heroImage: string | null;
    status: string;
  } | null>(null);

  const handleGenerate = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setGeneratedResult(null);

    const res = await generateCustomPostAction({
      targetTopic: topic,
      platform,
      autoPublishEnabled: autoPublish,
    });

    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Generation failed.");
      return;
    }

    if (res.draftPost) {
      setGeneratedResult({
        postId: res.postId ?? undefined,
        title: res.draftPost.title,
        content: res.draftPost.content,
        hashtags: res.draftPost.hashtags,
        heroImage: res.heroImage ?? null,
        status: res.status,
      });
    }
  };

  const handleApproveAndPublish = async () => {
    if (!generatedResult?.postId) return;

    setPublishing(true);
    setErrorMessage(null);

    const res = await publishOrRetryPostAction(generatedResult.postId);
    setPublishing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to publish post.");
      return;
    }

    setGeneratedResult((prev) => prev ? { ...prev, status: "PUBLISHED" } : null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Post Generator</h1>
        <p className="text-sm text-gray-500">
          Draft and preview AI-generated content using custom topics from your scraped knowledge base.
        </p>
      </div>

      {/* Generator Form */}
      <form onSubmit={handleGenerate} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Topic / Keyword</label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Fine Arts Virtual Museum Tour"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Social Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
            >
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter / X</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Auto-Publish Immediately</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "🤖 Running Agent Pipeline..." : "Generate Post Draft"}
        </button>
      </form>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          ⛔ {errorMessage}
        </div>
      )}

      {/* Live Preview Card */}
      {generatedResult && (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-blue-100 text-blue-800">
              Platform: {platform}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded uppercase ${
              generatedResult.status === "PUBLISHED" 
                ? "bg-green-100 text-green-800" 
                : "bg-amber-100 text-amber-800"
            }`}>
              Status: {generatedResult.status}
            </span>
          </div>

          {generatedResult.heroImage && (
            <div className="rounded-md overflow-hidden bg-gray-100 max-h-64 flex justify-center items-center">
              <img
                src={generatedResult.heroImage}
                alt="Selected Hero Candidate"
                className="object-cover h-full w-full"
              />
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-900">{generatedResult.title}</h2>
            <p className="mt-2 text-gray-700 whitespace-pre-wrap">{generatedResult.content}</p>
          </div>

          {generatedResult.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 text-sm text-blue-600">
              {generatedResult.hashtags.map((tag, i) => (
                <span key={i}>{tag.startsWith("#") ? tag : `#${tag}`}</span>
              ))}
            </div>
          )}

          {generatedResult.status === "AWAITING_APPROVAL" && generatedResult.postId && (
            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={handleApproveAndPublish}
                disabled={publishing}
                className="bg-green-600 text-white font-medium px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Approve & Publish Now"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}