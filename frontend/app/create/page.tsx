"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SERVER_URL = "http://localhost:3001";

interface Profile {
    id: string;
    name: string;
}

export default function CreateJobPage() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [formName, setFormName] = useState("");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState("");
    const [customData, setCustomData] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    // Fetch Profiles
    useEffect(() => {
        fetch(`${SERVER_URL}/profiles`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                setProfiles(data);
                if (data.length > 0) setSelectedProfile(data[0].id);
            })
            .catch((err) => console.error("Failed to fetch profiles:", err));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !selectedProfile) return;

        setLoading(true);
        setStatus("Submitting...");

        try {
            const formData = new FormData();
            formData.append("url", url);
            formData.append("form_name", formName || "Untitled Task");
            formData.append("profile_id", selectedProfile);

            let parsedCustomData = {};
            if (customData.trim()) {
                try {
                    parsedCustomData = JSON.parse(customData);
                } catch {
                    parsedCustomData = { "extra_info": customData };
                }
            }
            formData.append("custom_data", JSON.stringify(parsedCustomData));

            if (file) {
                formData.append("file", file);
            }

            const res = await fetch(`${SERVER_URL}/jobs`, {
                method: "POST",
                body: formData,
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok) {
                setStatus(`✅ Job Submitted! ID: ${data.id}`);
                // Redirect to dashboard after brief delay
                setTimeout(() => {
                    router.push('/');
                }, 1500);
            } else {
                setStatus(`❌ Error: ${data.error}`);
            }
        } catch (err) {
            if (err instanceof Error) {
                setStatus(`❌ Network Error: ${err.message}`);
            } else {
                setStatus(`❌ Network Error: Unknown error`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto pt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">New Automation Task</h1>
                <p className="text-gray-400">Configure a new AI agent to handle a form submission.</p>
            </div>

            <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                {/* Decorative Blur */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10"></div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Task Name</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g. Weekly Report Submission"
                                className="glass-input w-full px-4 py-3 rounded-xl text-sm placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Target URL</label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://site.com/form..."
                                required
                                className="glass-input w-full px-4 py-3 rounded-xl text-sm placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">User Profile</label>
                        <div className="relative">
                            <select
                                value={selectedProfile}
                                onChange={(e) => setSelectedProfile(e.target.value)}
                                className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white appearance-none cursor-pointer bg-black/20 hover:bg-black/30 transition-colors"
                            >
                                {profiles.map((p) => (
                                    <option key={p.id} value={p.id} className="bg-gray-900 text-white py-2">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Custom Data (JSON Context)</label>
                        <textarea
                            value={customData}
                            onChange={(e) => setCustomData(e.target.value)}
                            placeholder='Optionally provide extra context like: {"Address": "123 Main St"}...'
                            className="glass-input w-full px-4 py-3 rounded-xl text-sm h-32 placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Supporting Document</label>
                        <div className="relative border border-dashed border-white/10 bg-white/5 rounded-xl p-8 hover:bg-white/10 transition-all text-center cursor-pointer group">
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        setFile(e.target.files[0]);
                                    }
                                }}
                            />
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </div>
                                <div className="text-sm">
                                    {file ? (
                                        <span className="text-blue-300 font-semibold">{file.name}</span>
                                    ) : (
                                        <span className="text-gray-400 group-hover:text-gray-300">Data File / Resume (PDF, PNG, JPG)</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${loading
                                ? "bg-gray-700 cursor-not-allowed opacity-50"
                                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-900/20"
                                }`}
                        >
                            {loading ? "Starting Agent..." : "🚀 Launch Automation"}
                        </button>
                    </div>
                </form>

                {status && (
                    <div className={`mt-6 p-4 rounded-xl text-sm border backdrop-blur-md animate-in slide-in-from-bottom-2 ${status.startsWith("✅")
                        ? "bg-green-500/10 border-green-500/20 text-green-300"
                        : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
