import React, { useState } from "react";

const Counter = () => {
 const [count, setCount] = useState(0);

 return (
   <div className="flex flex-col items-center gap-2">
     <h2 className="text-2xl font-semibold">Compteur : {count}</h2>
     <div className="flex gap-2">
       <button
         onClick={() => setCount(count + 1)}
         className="px-4 py-1 bg-green-500 text-white rounded"
       >
        incrementer +1
       </button>
       <button
         onClick={() => setCount(count - 1)}
         className="px-4 py-1 bg-red-500 text-white rounded"
       >
         decrementer -1
       </button>
     </div>
   </div>
 );
};

export default Counter;
