import React from "react";

const Button = ({ text,className, onClick }) => {
 return (
   <button
     onClick={onClick}
     className={`px-6 py-2  text-white rounded hover:bg-blue-600 transition ${className || 'bg-blue-500'}`}
   >
     {text}
   </button>
 );
};

export default Button;
