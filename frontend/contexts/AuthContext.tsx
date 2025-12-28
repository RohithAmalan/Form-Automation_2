
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
    id: string;
    display_name: string;
    email: string;
    photo_url: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => { } });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Exclude Public Routes
        // Exclude Public Routes
        if (pathname === '/login') {
            // We are on login page, so we don't need to check auth, but we need to stop loading.
            // Using setTimeout to avoid "setState during render" warning if this effect runs immediately.
            setTimeout(() => setLoading(false), 0);
            return;
        }

        fetch("http://localhost:3001/auth/me", { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.authenticated) {
                    setUser(data.user);
                } else {
                    router.push('/login');
                }
                setLoading(false);
            })
            .catch(() => {
                router.push('/login');
                setLoading(false);
            });
    }, [pathname, router]);

    const logout = async () => {
        await fetch("http://localhost:3001/auth/logout", { method: "POST", credentials: 'include' });
        setUser(null);
        router.push('/login');
    };

    if (loading) {
        return <div className="min-h-screen bg-[#050511] flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
