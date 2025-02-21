"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface RecoverPasswordComponentProps {}

interface MessageState {
  text: string;
  type: "error" | "success" | "";
}

const RecoverPasswordComponent: React.FC<
  RecoverPasswordComponentProps
> = ({}) => {
  const supabase = createClientComponentClient();
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [message, setMessage] = useState<MessageState>({ text: "", type: "" });
  const widthClass = "md:w-3/12";
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword === confirmPassword) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          console.error("Error updating password:", error.message);
          setMessage({ text: error.message, type: "error" });
        } else {
          setMessage({
            text: "Password updated successfully",
            type: "success",
          });
          console.log("Password updated successfully");
          setTimeout(() => {
            router.push("/auth/login");
          }, 1500);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        console.error("Error updating password:", errorMessage);
        setMessage({ text: errorMessage, type: "error" });
      }
    } else {
      console.error("Passwords do not match");
      setMessage({ text: "Passwords do not match", type: "error" });
    }
  };

  const handlePasswordChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void
  ) => {
    setter(e.target.value);
  };

  return (
    <div
      className={`bg-[#2a2a2a] flex justify-center items-center p-5 ${widthClass} w-full rounded-lg flex-col`}
    >
      <h2 className="text-white text-2xl font-semibold mb-6">
        Enter New Password
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
        <div>
          <label
            htmlFor="newPassword"
            className="block text-gray-400 text-sm font-medium mb-1"
          >
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => handlePasswordChange(e, setNewPassword)}
            className="bg-gray-700 border-transparent text-white text-sm rounded-md focus:border-[#2cd4bf] focus:ring-[#2cd4bf] block w-full p-2.5"
            required
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-gray-400 text-sm font-medium mb-1"
          >
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => handlePasswordChange(e, setConfirmPassword)}
            className="bg-gray-700 border-transparent text-white text-sm rounded-md focus:border-[#2cd4bf] focus:ring-[#2cd4bf] block w-full p-2.5"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-[#2cd4bf] text-black font-medium py-2 px-4 rounded-md hover:bg-[#25b3a3] transition-colors duration-200"
        >
          Reset Password
        </button>
      </form>
      {message.text && (
        <p
          className={`text-sm mt-4 ${
            message.type === "error" ? "text-red-500" : "text-green-500"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};

export default RecoverPasswordComponent;
