"use client";

import { useState, useEffect } from "react";

const SERVER_URL = "http://localhost:3001";

export default function Home() {
  const [url, setUrl] = useState("");
  const [formName, setFormName] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [customData, setCustomData] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [jobs, setJobs] = useState<any[]>([]);

  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [currentJobId, setCurrentJobId] = useState("");

  // Fetch Profiles & Jobs on Load
  useEffect(() => {
    fetch(`${SERVER_URL}/profiles`)
      .then((res) => res.json())
      .then((data) => {
        setProfiles(data);
        if (data.length > 0) setSelectedProfile(data[0].id);
      })
      .catch((err) => console.error("Failed to fetch profiles:", err));

    fetchJobs();
    const interval = setInterval(fetchJobs, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = () => {
    fetch(`${SERVER_URL}/jobs`)
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Failed to fetch jobs:", err));
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      const res = await fetch(`${SERVER_URL}/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        // Optimistically update UI
        setJobs(prev => prev.filter(j => j.id !== jobId));
        // Also fetch fresh
        fetchJobs();
      } else {
        const errData = await res.json();
        alert("Failed to delete: " + (errData.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Network Error: " + err.message);
    }
  };

  const viewLogs = async (jobId: string) => {
    setCurrentJobId(jobId);
    setShowLogs(true);
    setLogs([]); // Clear previous
    try {
      const res = await fetch(`${SERVER_URL}/jobs/${jobId}/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

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

      // Parse custom data if valid JSON, else treat as string
      let parsedCustomData = {};
      if (customData.trim()) {
        try {
          parsedCustomData = JSON.parse(customData);
        } catch (e) {
          parsedCustomData = { "extra_info": customData };
        }
      }
      formData.append("custom_data", JSON.stringify(parsedCustomData));

      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${SERVER_URL}/jobs`, {
        method: "POST",
        // Content-Type header is set automatically with FormData
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Job Submitted! ID: ${data.id}`);
        setUrl(""); // Clear input
        setFormName(""); // Clear
        fetchJobs(); // Refresh immediately
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatus(`❌ Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Resume State
  const [resumeJobId, setResumeJobId] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeTextInput, setResumeTextInput] = useState("");

  const handleResumeSubmit = async () => {
    if (!resumeJobId) return;

    const job = jobs.find(j => j.id === resumeJobId);
    const missingType = job?.custom_data?._missing_type || 'file';
    const missingLabel = job?.custom_data?._missing_label || 'user_response';

    const formData = new FormData();

    if (missingType === 'file') {
      if (resumeFile) {
        formData.append("file", resumeFile);
      }
    } else {
      // Text Input
      // We send it as text_input so backend can treat it as user_response
      // OR better: we send structured custom_data
      const payload = { [missingLabel]: resumeTextInput };
      formData.append("custom_data", JSON.stringify(payload));
    }

    try {
      const res = await fetch(`${SERVER_URL}/jobs/${resumeJobId}/resume`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert("Resumed! Watch the logs.");
        setShowResumeModal(false);
        setResumeFile(null);
        setResumeTextInput("");
        fetchJobs();
      } else {
        const d = await res.json();
        alert("Error: " + d.error);
      }
    } catch (e: any) {
      alert("Network Error: " + e.message);
    }
  };

  const openResumeModal = (id: string) => {
    setResumeJobId(id);
    setShowResumeModal(true);
    setResumeFile(null);
    setResumeTextInput("");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {/* Submission Card */}
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md mb-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">🚀 Form Automation</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Name (Optional)</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Job Application 2024"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
            />
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/form"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
            />
          </div>

          {/* Profile Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Profile</label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Data Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Data / Extra Info (Optional)</label>
            <textarea
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder='{"Address": "No.1 Adhiyaman street..."} OR just type text'
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white h-24"
            />
          </div>

          {/* File Upload */}
          {/* File Upload - Enhanced UI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Attachment (Optional)</label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
              <div className="space-y-1">
                <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center">
                  <span className="font-medium text-blue-600 hover:text-blue-500">{file ? file.name : "Upload a file"}</span>
                </div>
                {!file && <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>}
                {file && <p className="text-xs text-green-600 font-semibold">Ready to upload</p>}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {loading ? "Processing..." : "Start Automation"}
          </button>
        </form>

        {/* Status Message */}
        {status && (
          <div className={`mt-6 p-4 rounded-lg text-sm ${status.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {status}
          </div>
        )}
      </div>

      {/* Recent Jobs List */}
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Recent Jobs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-gray-600 text-sm">
                <th className="py-2">Status</th>
                <th className="py-2">Form Name</th>
                <th className="py-2">URL</th>
                <th className="py-2">Profile</th>
                <th className="py-2">Time</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">No jobs found.</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-gray-50 text-gray-800 text-sm">
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold
                        ${job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            job.status === 'WAITING_INPUT' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
                              job.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'}`}>
                        {job.status === 'WAITING_INPUT' ? '⚠️ NEED INPUT' : job.status}
                      </span>
                    </td>
                    <td className="py-3 font-medium">{job.form_name || 'Untitled'}</td>
                    <td className="py-3 truncate max-w-xs text-xs text-gray-500" title={job.url}>{job.url}</td>
                    <td className="py-3">{job.profile_name || 'Unknown'}</td>
                    <td className="py-3">{new Date(job.created_at).toLocaleTimeString()}</td>
                    <td className="py-3">
                      <button
                        onClick={() => viewLogs(job.id)}
                        className="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                      >
                        View Logs
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="ml-3 text-red-600 hover:text-red-800 underline text-xs font-medium"
                      >
                        Delete
                      </button>
                      {job.status === 'WAITING_INPUT' && (
                        <button
                          onClick={() => openResumeModal(job.id)}
                          className="ml-3 px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-black rounded text-xs font-bold shadow-sm"
                        >
                          🛑 RESUME
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">📜 Execution Logs</h3>
              <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-black">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-gray-50 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500 italic">No logs found...</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="mb-2 border-l-2 pl-2 border-gray-300">
                    <span className="text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                    <span className={`font-semibold ${log.action_type === 'error' ? 'text-red-600' :
                      log.action_type === 'success' ? 'text-green-600' :
                        log.action_type === 'warning' ? 'text-yellow-600' :
                          log.action_type === 'action' ? 'text-purple-600' : 'text-blue-600'
                      }`}>
                      {log.action_type.toUpperCase()}:
                    </span>{" "}
                    <span className="text-gray-800">{log.message}</span>
                    {log.details && (
                      <pre className="mt-1 text-gray-500 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t bg-white">
              <button
                onClick={() => setShowLogs(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Action Required</h2>

            {/* Logic for Text Input vs File */}
            {(() => {
              const job = jobs.find(j => j.id === resumeJobId);
              const missingType = job?.custom_data?._missing_type || 'file'; // default to file for backward compat
              const missingLabel = job?.custom_data?._missing_label || (missingType === 'file' ? 'Missing Document' : 'Missing Information');

              return (
                <>
                  <p className="text-gray-700 mb-4">
                    The automation is paused. Please provide: <strong>{missingLabel}</strong>
                  </p>

                  {missingType === 'file' ? (
                    <div className="mb-4 relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer">
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setResumeFile(e.target.files[0]);
                          }
                        }}
                      />
                      <p className="text-blue-600 underline font-medium">{resumeFile ? resumeFile.name : "Select File"}</p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter Value</label>
                      <input
                        type="text"
                        autoFocus
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
                        placeholder={`Type value for ${missingLabel}...`}
                        value={resumeTextInput}
                        onChange={(e) => setResumeTextInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleResumeSubmit();
                        }}
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowResumeModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                    <button onClick={handleResumeSubmit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                      {missingType === 'file' ? 'Upload & Resume' : 'Submit & Resume'}
                    </button>
                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}
