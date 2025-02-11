"use client";
import React from "react";

const Message: React.FC = () => {
  return (
    <div className="absolute bg-[#141414] w-full h-full flex justify-center items-center px-6 md:px-0">
      <div className="p-6 md:p-8 bg-[#2a2a2a] rounded-lg shadow-lg max-w-lg text-center border border-zinc-800">
        <h5 className="text-white text-lg font-semibold mb-4">
          Please <span className="text-[#2cd4bf]">verify</span> your email
        </h5>
        <p className="text-gray-400 text-sm">
          Check your inbox for a verification link to continue.
        </p>
      </div>
    </div>
  );
};

export default Message;
