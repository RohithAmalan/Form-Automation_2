
"use client";

import { ShieldCheck } from 'lucide-react';

const SERVER_URL = "http://localhost:3001";

export default function LoginPage() {
    const handleLogin = () => {
        window.location.href = `${SERVER_URL}/auth/google`;
    };

    return (
        <div className="min-h-screen bg-[#050511] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center">

                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                    <ShieldCheck className="w-8 h-8 text-white" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
                <p className="text-gray-400 mb-8">Sign in to access your automation dashboard.</p>

                <button
                    onClick={handleLogin}
                    className="w-full bg-white text-gray-900 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all hover:scale-[1.02] shadow-xl"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" className="w-6 h-6" />
                    <span>Sign in with Google</span>
                </button>

                <p className="text-xs text-gray-500 mt-8">
                    Secure access provided by OAuth 2.0
                </p>
            </div>
        </div>
    );
}
