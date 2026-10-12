import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export default function MagicAccess({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setError("No secure access token found in the URL.");
      return;
    }

    fetch("http://localhost:8000/api/auth/magic-link/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
    .then(async res => {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    })
    .then(({ ok, data }) => {
      if (!ok) {
        setError(data.detail || "This secure link is invalid or has expired.");
        return;
      }
      
      // We got the payload, log them in!
      onLogin(data.access_token, data.user);
      
      // Short delay for visual assurance
      setTimeout(() => {
        navigate(`/wizard/${data.target_guideline}`, { replace: true });
      }, 1500);
    })
    .catch(err => {
      setError("Failed to connect to the authentication server.");
    });
  }, [searchParams, navigate, onLogin]);

  if (error) {
    return (
      <div className="min-h-screen bg-nhs-pale flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border-t-8 border-nhs-red shadow-xl p-10 text-center">
          <AlertTriangle size={48} className="mx-auto text-nhs-red mb-4" />
          <h1 className="text-2xl font-bold text-nhs-dark mb-4">Access Denied</h1>
          <p className="text-gray-600 font-medium">{error}</p>
          <button 
            onClick={() => navigate("/")}
            className="mt-8 px-6 py-2 border-2 border-nhs-blue text-nhs-blue font-bold rounded hover:bg-nhs-blue hover:text-white transition-colors"
          >
            Return to Standard Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nhs-pale flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border-t-8 border-nhs-green shadow-xl p-10 text-center">
        <ShieldCheck size={48} className="mx-auto text-nhs-green mb-6" />
        <h1 className="text-2xl font-bold text-nhs-dark mb-2">Authenticating Secure Link</h1>
        <p className="text-gray-500 font-medium mb-8">Please wait while we verify your access...</p>
        <Loader2 className="mx-auto animate-spin text-nhs-blue" size={32} />
      </div>
    </div>
  );
}
