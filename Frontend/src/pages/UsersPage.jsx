import React, { useEffect, useState } from "react";
import authService from "../services/authService";
import { useNavigate } from "react-router-dom";
const UsersPage = () => {
    const navigate = useNavigate();

const [users,setUsers] = useState([]);
const [loading,setLoading] = useState(true);
const [search,setSearch] = useState("");

const [currentPage,setCurrentPage] = useState(1);
const usersPerPage = 5;

useEffect(()=>{
fetchUsers();
},[]);


const fetchUsers = async ()=>{
try{
setLoading(true);
const data = await authService.getAllUsers();
setUsers(data);
}
catch(error){
console.error("Erreur récupération utilisateurs",error);
}
finally{
setLoading(false);
}
};


const deleteUser = async(id)=>{
if(window.confirm("Supprimer cet utilisateur ?")){
try{
await authService.deleteUser(id);
setUsers(users.filter(u=>u._id !== id));
}
catch(error){
console.error(error);
}
}
};


const filteredUsers = users.filter(user =>
user.nom?.toLowerCase().includes(search.toLowerCase()) ||
user.email?.toLowerCase().includes(search.toLowerCase())
);


const indexOfLastUser = currentPage * usersPerPage;
const indexOfFirstUser = indexOfLastUser - usersPerPage;
const currentUsers = filteredUsers.slice(indexOfFirstUser,indexOfLastUser);

const totalPages = Math.ceil(filteredUsers.length / usersPerPage);


return(

<div className="p-10 bg-gray-100 min-h-screen">

{/* HEADER */}

<div className="flex justify-between items-center mb-8">

<div>
<h1 className="text-3xl font-bold text-gray-800">
Gestion des Utilisateurs
</h1>
<p className="text-gray-500">
Liste des utilisateurs de la plateforme
</p>
</div>

<button
onClick={fetchUsers}
className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
>
Actualiser
</button>

</div>


{/* SEARCH */}

<div className="bg-white p-4 rounded-xl shadow mb-6">

<input
type="text"
placeholder="🔍 Rechercher par nom ou email"
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="border rounded-lg px-4 py-2 w-80 focus:ring-2 focus:ring-green-500 outline-none"
/>

</div>


{/* TABLE */}

<div className="bg-white rounded-xl shadow overflow-hidden">

<table className="min-w-full text-sm">

<thead className="bg-gray-50 text-gray-600">

<tr>

<th className="px-6 py-3 text-left">Nom</th>
<th className="px-6 py-3 text-left">Prénom</th>
<th className="px-6 py-3 text-left">Email</th>
<th className="px-6 py-3 text-left">Role</th>
<th className="px-6 py-3 text-left">Date</th>
<th className="px-6 py-3 text-left">Actions</th>

</tr>

</thead>

<tbody className="divide-y">

{loading ? (

<tr>
<td colSpan="6" className="text-center py-10">
Chargement...
</td>
</tr>

) : currentUsers.length === 0 ? (

<tr>
<td colSpan="6" className="text-center py-10 text-gray-400">
Aucun utilisateur trouvé
</td>
</tr>

) : (

currentUsers.map(user => (

<tr key={user._id} className="hover:bg-gray-50">

<td className="px-6 py-3">
{user.nom}
</td>

<td className="px-6 py-3">
{user.prenom || "-"}
</td>

<td className="px-6 py-3 text-gray-600">
{user.email}
</td>

<td className="px-6 py-3">

<span className={`px-3 py-1 rounded-full text-xs font-medium
${user.role === "admin"
? "bg-purple-100 text-purple-700"
: "bg-green-100 text-green-700"}
`}>

{user.role}

</span>

</td>

<td className="px-6 py-3 text-gray-500">

{new Date(user.createdAt).toLocaleDateString("fr-FR")}

</td>

<td className="px-6 py-3 flex gap-2">

<button className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">
Edit
</button>

<button
onClick={()=>deleteUser(user._id)}
className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
>
Delete
</button>

</td>

</tr>

))

)}

</tbody>

</table>

</div>


{/* PAGINATION */}

<div className="flex justify-center items-center gap-2 mt-6">

<button
onClick={()=>setCurrentPage(currentPage - 1)}
disabled={currentPage === 1}
className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
>
Précédent
</button>

{Array.from({length: totalPages},(_,i)=>(
<button
key={i}
onClick={()=>setCurrentPage(i + 1)}
className={`px-4 py-2 rounded-lg
${currentPage === i + 1
? "bg-green-600 text-white"
: "bg-gray-200 hover:bg-gray-300"
}`}
>
{i + 1}
</button>
))}

<button
onClick={()=>setCurrentPage(currentPage + 1)}
disabled={currentPage === totalPages}
className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
>
Suivant
</button>

</div>

</div>

);

};

export default UsersPage;