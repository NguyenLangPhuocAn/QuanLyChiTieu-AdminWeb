// src/components/layout/Sidebar.tsx
export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-orange-500 text-white fixed">
      <h1 className="p-4 text-xl font-bold">Admin</h1>

      <ul className="p-4 space-y-2">
        <li className="p-2 hover:bg-orange-600 rounded">Dashboard</li>
        <li className="p-2 hover:bg-orange-600 rounded">Users</li>
      </ul>
    </div>
  );
}