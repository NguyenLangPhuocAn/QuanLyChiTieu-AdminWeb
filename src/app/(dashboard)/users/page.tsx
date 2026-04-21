"use client";

import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    const res = await fetch("http://localhost:3000/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setUsers(data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const deleteUser = async (id: number) => {
    await fetch(`http://localhost:3000/users/detail/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    fetchUsers();
  };

  return (
    <div>
      
      <h1 className="text-2xl font-bold mb-6">
        Users
      </h1>

      <div className="bg-white rounded-xl shadow p-4">
        
        <table className="w-full">
          
          <thead>
            <tr className="text-left border-b">
              <th>ID</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                
                <td>{u.id}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>

                <td>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-red-500"
                  >
                    Xóa
                  </button>
                </td>

              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  );
}