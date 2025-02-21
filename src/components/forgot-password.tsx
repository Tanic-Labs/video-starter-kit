"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import React, { useState, FormEvent } from "react";

interface ForgotPasswordResetProps {}

const ForgotPasswordReset: React.FC<ForgotPasswordResetProps> = () => {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const widthClass = "md:w-3/12";
  const redirectUrl =
    process.env.NEXT_PUBLIC_ENV === "DEV"
      ? `${process.env.NEXT_PUBLIC_HOST}auth/recover`
      : `https://www.telegai.com/auth/recover`;

  const handlePasswordReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the password reset link");
    }
  };

  return (
    <div
      className={`bg-[#2a2a2a] flex justify-center items-center p-5 ${widthClass} w-full rounded-lg flex-col`}
    >
      <h2 className="text-white text-2xl font-semibold mb-6">
        Introduce your Email
      </h2>
      <form
        onSubmit={handlePasswordReset}
        className="flex flex-col space-y-4 w-full"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-gray-400 text-sm font-medium mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            className="bg-gray-700 border-transparent text-white text-sm rounded-md focus:border-[#2cd4bf] focus:ring-[#2cd4bf] block w-full p-2.5"
            placeholder="example@email.com"
            required
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
          />
        </div>

        <button
          type="submit"
          className="bg-[#2cd4bf] text-black font-medium py-2 px-4 rounded-md hover:bg-[#25b3a3] transition-colors duration-200"
        >
          Reset Password
        </button>
      </form>
      {message && <p className="text-gray-400 text-sm mt-4">{message}</p>}
    </div>
  );
};

export default ForgotPasswordReset;
