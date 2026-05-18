import React, { useState } from "react";

const Form = () => {
 const [email, setEmail] = useState("");

 const [mdp, setMdp] = useState("");

 const handleSubmit = (e) => {
   e.preventDefault();
   alert("Email envoyé : " + email +"mdp envoyé : " + mdp);
 };

 return (
   <form onSubmit={handleSubmit} className="flex flex-col gap-2">
    <h1 className="text-2xl font-bold">Formulaire de contact</h1>
     <input
       type="email"
       value={email}
       onChange={(e) => setEmail(e.target.value)}
       placeholder="Votre email"
       className="px-2 py-1 border rounded"
     />
     <input
       type="password"
       value={mdp}
       onChange={(e) => setMdp(e.target.value)}
       placeholder="Votre mot de passe"
       className="px-2 py-1 border rounded"
     />
     <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
       Envoyer
     </button>
   </form>
 );
};

export default Form;
