import { useState } from "react";
import { Lock } from "lucide-react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }
      
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-nhs-pale flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border-t-8 border-nhs-blue shadow-xl p-10">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-nhs-pale text-nhs-blue rounded-full mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-nhs-dark">NHS Login</h1>
          <p className="text-gray-500 mt-2 font-medium">Clinical Guidance Assistant</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-nhs-red text-nhs-red p-4 mb-6 font-bold text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-nhs-dark mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border-2 border-gray-300 p-3 focus:border-nhs-blue focus:ring-4 focus:ring-nhs-yellow outline-none transition-all"
              placeholder="e.g. admin@lhch.nhs.uk"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-nhs-dark mb-2">Password / PIN</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border-2 border-gray-300 p-3 focus:border-nhs-blue focus:ring-4 focus:ring-nhs-yellow outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            className="w-full btn-nhs-primary text-lg py-4 mt-4 flex justify-center"
          >
            Secure Sign In
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-400 font-medium border-t pt-6">
          System is configured for local group access. <br/> Do not use external network credentials.
        </div>
      </div>
    </div>
  );
}
