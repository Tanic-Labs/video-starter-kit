"use client";
import React, { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

interface SignInFormData {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const supabase = createClientComponentClient();
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { email, password } = formData;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Redirigir al usuario después de iniciar sesión correctamente
    window.location.href = "/"; // Cambia esta URL según tu lógica
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#141414]">
      <Link
        href="/"
        className="absolute left-8 top-8 py-2 px-4 rounded-md no-underline text-foreground bg-btn-background hover:bg-btn-background-hover flex items-center group text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </Link>
      <div className="bg-[#2a2a2a] p-8 rounded-xl shadow-xl w-full max-w-md">
        <div className="">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-base font-medium text-gray-200"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-1 block w-full rounded-lg bg-gray-700 border-transparent focus:border-[#2cd4bf] focus:ring-[#2cd4bf] text-white p-2"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-base font-medium text-gray-200"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="mt-1 block w-full rounded-md bg-gray-700 border-transparent focus:border-[#2cd4bf] focus:ring-[#2cd4bf] text-white p-2"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-[#2cd4bf] text-black p-3 rounded-md hover:bg-[#25b3a3] transition-colors"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>
          <h3 className="text-center text-gray-200 mt-8">
            You do not have an account?
          </h3>
          <Link
            href="/auth/signup"
            className="block text-indigo-300 text-center underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
