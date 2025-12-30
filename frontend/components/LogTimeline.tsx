"use client";

export interface LogEntry {
    id: number;
    job_id: string;
    action_type: 'info' | 'error' | 'action' | 'warning' | 'success';
    message: string;
    details?: unknown;
    timestamp: string;
}

export default function LogTimeline({ logs }: { logs: LogEntry[] }) {
    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-50">
                <div className="text-4xl mb-4">⏳</div>
                <p>Waiting for agent to start...</p>
            </div>
        );
    }

    return (
        <div className="relative border-l-2 border-white/10 ml-4 space-y-8 py-4">
            {logs.map((log) => {
                let colorClass = "bg-gray-500";
                let glowClass = "";

                switch (log.action_type) {
                    case 'info':
                        colorClass = "bg-blue-500";
                        break;
                    case 'action':
                        colorClass = "bg-purple-500";
                        glowClass = "shadow-[0_0_15px_rgba(168,85,247,0.5)]";
                        break;
                    case 'success':
                        colorClass = "bg-green-500";
                        glowClass = "shadow-[0_0_15px_rgba(34,197,94,0.5)]";
                        break;
                    case 'warning':
                        colorClass = "bg-yellow-500";
                        break;
                    case 'error':
                        colorClass = "bg-red-500";
                        glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.5)]";
                        break;
                }

                return (
                    <div key={log.id} className="relative pl-8 group">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-[#0a0a0a] ${colorClass} ${glowClass} transition-all group-hover:scale-125 z-10`}></div>

                        {/* Content Card */}
                        <div className="glass-panel p-4 rounded-xl border border-white/5 hover:bg-white/5 transition-all">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colorClass}/20 text-${colorClass.replace('bg-', '')}-300`}>
                                    {log.action_type}
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                            </div>

                            <p className="text-gray-200 text-sm font-medium leading-relaxed">
                                {log.message}
                            </p>

                            {!!log.details && (
                                <div className="mt-3">
                                    <details className="group/details">
                                        <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-white flex items-center gap-1 select-none">
                                            <span className="group-open/details:rotate-90 transition-transform">▶</span> Data Payload
                                        </summary>
                                        <pre className="mt-2 p-3 rounded-lg bg-black/40 text-[10px] text-gray-400 font-mono overflow-x-auto border border-white/5">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
