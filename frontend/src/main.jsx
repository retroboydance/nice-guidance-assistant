import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global Fetch Interceptor to attach the JWT Token and handle network hostnames
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  // If accessing from another machine on the network, convert http://localhost:8000/api to relative /api
  if (typeof resource === 'string' && resource.startsWith('http://localhost:8000/api')) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      resource = resource.replace('http://localhost:8000', '');
    }
  }

  const isApiCall = typeof resource === 'string' && (
    resource.startsWith('/api') || resource.startsWith('http://localhost:8000/api')
  );

  if (isApiCall) {
    const token = localStorage.getItem('token');
    if (token) {
      config = config || {};
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }
  
  const response = await originalFetch(resource, config);

  // If session expired or unauthorized, safely clear session and send to Login
  if (response.status === 401 && isApiCall && !resource.includes('/auth/login')) {
    if (localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  }

  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
