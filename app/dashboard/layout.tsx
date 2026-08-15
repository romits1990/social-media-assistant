"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  {
    name: "Post Management",
    href: "/dashboard/posts",
    icon: "📋",
    description: "Review, approve & retry drafts",
  },
  {
    name: "Custom Post Generator",
    href: "/dashboard/create",
    icon: "✍️",
    description: "Generate AI posts on-demand",
  },
  {
    name: "Ingestion Jobs",
    href: "/dashboard/jobs",
    icon: "📊",
    description: "Monitor crawl & vector tasks",
  },
  {
    name: "Sitemap Ingest",
    href: "/dashboard/sources",
    icon: "🌐",
    description: "Batch crawl & ingest domains",
  },
  {
    name: "Single Page Ingest",
    href: "/dashboard/sources/single",
    icon: "⚡",
    description: "Direct single URL embedding",
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
        <span className="font-bold text-sm tracking-wide">🤖 AI Social Assistant</span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-300 hover:text-white text-lg p-1"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:block w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col border-r border-slate-800`}
      >
        {/* Brand */}
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
            <span>🤖</span>
            <span>Social Assistant</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">LangGraph & pgvector Engine</p>
        </div>

        {/* Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard/sources" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <div>
                  <div>{item.name}</div>
                  <div
                    className={`text-[10px] truncate max-w-[150px] ${
                      isActive ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* System Footer Status */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Ollama Ready</span>
          </span>
          <span className="font-mono text-[10px]">v1.0.0</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}