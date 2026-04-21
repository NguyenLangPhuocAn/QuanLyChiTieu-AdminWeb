"use client";

export default function Header() {
  return (
    <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
      
      <h2 className="font-semibold text-lg">
        Dashboard
      </h2>

      <button
        onClick={() => {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }}
        className="text-red-500"
      >
        Logout
      </button>

    </div>
  );
}