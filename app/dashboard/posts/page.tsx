import { getSocialPosts } from "@/repositories/post.repository";
import { publishOrRetryPostAction } from "@/actions/post.actions";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function PostsManagementPage({ searchParams }: PageProps) {
  const { status: statusFilter } = await searchParams;
  const posts = await getSocialPosts(statusFilter as any);

  const statuses = ["ALL", "AWAITING_APPROVAL", "PUBLISHED", "FAILED", "REJECTED_DUPLICATE"];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post Management</h1>
          <p className="text-sm text-gray-500">
            Monitor automated drafts, preview raw scraper buffer, and handle retry operations.
          </p>
        </div>
        <Link
          href="/dashboard/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition"
        >
          + Create Custom Post
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b pb-2">
        {statuses.map((st) => (
          <Link
            key={st}
            href={`/dashboard/posts${st === "ALL" ? "" : `?status=${st}`}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              (statusFilter ?? "ALL") === st
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {st.replace("_", " ")}
          </Link>
        ))}
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">Topic / Title</th>
              <th className="px-6 py-3">Platform</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Created At</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  No social posts found matching this filter.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                  {/* Topic & Title */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-md">{post.topic}</div>
                  </td>

                  {/* Social Platform Badge */}
                  <td className="px-6 py-4 uppercase text-xs font-bold text-gray-600">
                    {post.platform}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase ${
                        post.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : post.status === "AWAITING_APPROVAL"
                          ? "bg-amber-100 text-amber-800"
                          : post.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {post.status.replace("_", " ")}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {post.createdAt ? new Date(post.createdAt).toLocaleString() : "N/A"}
                  </td>

                  {/* 🎯 ACTION BUTTONS COLUMN */}
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    {/* 1. Redirect Link to Preview Inspector Page */}
                    <Link
                      href={`/dashboard/posts/${post.id}/preview`}
                      className="inline-flex items-center text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 px-2.5 py-1.5 rounded hover:bg-blue-100 transition"
                    >
                      🔍 Preview
                    </Link>

                    {/* 2. Approve or Retry Direct Form Server Action */}
                    {(post.status === "AWAITING_APPROVAL" || post.status === "FAILED") && (
                      <form
                        action={async () => {
                          "use server";
                          await publishOrRetryPostAction(post.id!);
                        }}
                        className="inline-block"
                      >
                        <button
                          type="submit"
                          className={`text-xs text-white font-medium px-3 py-1.5 rounded transition ${
                            post.status === "FAILED"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {post.status === "FAILED" ? "Retry Publish" : "Approve"}
                        </button>
                      </form>
                    )}
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