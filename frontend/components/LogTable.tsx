"use client";

import { LogEntry } from "./LogTimeline";

export default function LogTable({ logs }: { logs: LogEntry[] }) {
    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-50">
                <p>No logs found.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="bg-white/5 text-slate-400 sticky top-0 backdrop-blur-md">
                    <tr>
                        <th className="p-3 font-semibold border-b border-white/10">ID</th>
                        <th className="p-3 font-semibold border-b border-white/10">Time</th>
                        <th className="p-3 font-semibold border-b border-white/10">Type</th>
                        <th className="p-3 font-semibold border-b border-white/10 w-1/2">Message</th>
                        <th className="p-3 font-semibold border-b border-white/10">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 text-slate-500">{log.id}</td>
                            <td className="p-3 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${log.action_type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        log.action_type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            log.action_type === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                log.action_type === 'action' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {log.action_type}
                                </span>
                            </td>
                            <td className="p-3 break-words">{log.message}</td>
                            <td className="p-3">
                                {!!log.details && (
                                    <details className="group">
                                        <summary className="cursor-pointer text-blue-400 hover:text-blue-300 select-none">
                                            JSON
                                        </summary>
                                        <pre className="mt-2 p-2 rounded bg-black/50 text-[10px] text-gray-400 overflow-x-auto max-w-[200px]">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
