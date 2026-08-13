import { getSocialPostById } from "@/repositories/post.repository";
import { publishOrRetryPostAction } from "@/actions/post.actions";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const post = await getSocialPostById(id);

  if (!post) {
    notFound();
  }

  // Detect if content contains unstripped HTML tags
  const containsHtml = /<[a-z][\s\S]*>/i.test(post.content);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header / Breadcrumb Navigation */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Link href="/dashboard/posts" className="text-xs text-blue-600 hover:underline font-medium">
            ← Back to Posts Management
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{post.title}</h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Post ID: {post.id}</p>
        </div>

        {/* Action Button */}
        {(post.status === "AWAITING_APPROVAL" || post.status === "FAILED") && (
          <form action={async () => {
            "use server";
            await publishOrRetryPostAction(post.id!);
          }}>
            <button
              type="submit"
              className="bg-green-600 text-white font-medium px-4 py-2 rounded-md hover:bg-green-700 transition text-sm"
            >
              {post.status === "FAILED" ? "Retry Publish" : "Approve & Publish"}
            </button>
          </form>
        )}
      </div>

      {/* HTML Tag Warning Alert */}
      {containsHtml && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-md text-amber-800 text-sm flex items-start space-x-2">
          <span className="text-lg">⚠️</span>
          <div>
            <span className="font-semibold">Unstripped HTML Detected in Post Body!</span>
            <p className="text-xs text-amber-700 mt-0.5">
              The scraper or retriever chunk did not strip HTML tags before passing context to the LLM. Social media APIs will render raw tags or reject this post.
            </p>
          </div>
        </div>
      )}

      {/* Metadata Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs">
        <div>
          <span className="text-gray-500 font-medium block">Platform</span>
          <span className="font-bold text-gray-900 uppercase">{post.platform}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium block">Status</span>
          <span className={`font-semibold uppercase ${
            post.status === "PUBLISHED" ? "text-green-700" :
            post.status === "FAILED" ? "text-red-700" : "text-amber-700"
          }`}>
            {post.status.replace("_", " ")}
          </span>
        </div>
        <div>
          <span className="text-gray-500 font-medium block">Target Topic</span>
          <span className="text-gray-800 truncate block">{post.topic}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium block">Source Page URL</span>
          {post.sourceUrl ? (
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline truncate block"
            >
              {post.sourceUrl}
            </a>
          ) : (
            <span className="text-gray-400">N/A</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Visual Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 border-b pb-2 uppercase tracking-wide">
            🖼️ Visual Rendered Preview
          </h2>

          {post.heroImage && (
            <div className="rounded-md overflow-hidden bg-gray-100 max-h-72 border flex justify-center items-center">
              <img src={post.heroImage} alt="Hero Candidate" className="object-cover h-full w-full" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-bold text-gray-900 text-base">{post.title}</h3>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed font-sans">
              {post.content}
            </p>
          </div>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs text-blue-600 font-medium pt-2 border-t">
              {post.hashtags.map((tag, i) => (
                <span key={i}>{tag.startsWith("#") ? tag : `#${tag}`}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Raw String Inspection (Scraper / Storage Debugger) */}
        <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-5 shadow-sm space-y-3 font-mono text-xs overflow-x-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
              🛠️ Raw Content Buffer
            </h2>
            <span className="text-slate-400 text-[10px]">
              Length: {post.content.length} chars
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">// Raw DB Content Field:</span>
            <pre className="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {JSON.stringify(post.content, null, 2)}
            </pre>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">// Raw DB Title Field:</span>
            <pre className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-200">
              {JSON.stringify(post.title)}
            </pre>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">// Raw Hashtags Array:</span>
            <pre className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-200">
              {JSON.stringify(post.hashtags)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}