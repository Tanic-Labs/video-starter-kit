"use client";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { SettingsIcon, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header({
  openKeyDialog,
  session,
}: {
  openKeyDialog?: () => void;
  session: any;
}) {
  const [isUserOpen, setUserOpen] = useState(false);
  const router = useRouter();

  // Crear el cliente de Supabase usando el helper específico para componentes del cliente
  const supabase = createClientComponentClient();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUserOpen(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <header className="px-4 py-2 flex justify-between items-center border-b border-border">
      <h1 className="text-lg font-medium">
        <Logo />
      </h1>
      <nav className="flex flex-row items-center justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <a href="https://fal.ai" target="_blank" rel="noopener noreferrer">
            fal.ai
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://github.com/fal-ai-community/video-starter-kit"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </Button>
        {process.env.NEXT_PUBLIC_CUSTOM_KEY && openKeyDialog && (
          <Button variant="ghost" size="icon" onClick={openKeyDialog}>
            <SettingsIcon className="w-6 h-6" />
          </Button>
        )}

        {session ? (
          <div className="relative inline-block">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUserOpen(!isUserOpen)}
            >
              <User className="w-11 h-11" />
            </Button>
            {isUserOpen && (
              <div className="user-menu absolute right-1 top-10 bg-[#2a2a2a] py-2 rounded-lg shadow-md w-60 z-10">
                <Button
                  variant="ghost"
                  className="w-full text-center hover:bg-gray-700"
                  onClick={handleLogout}
                >
                  Log out
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login" rel="noopener noreferrer">
              Login
            </Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
