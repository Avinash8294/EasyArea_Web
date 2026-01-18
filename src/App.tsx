import React, { useState, useEffect } from 'react';
import LandAreaCalculator from "./LandAreaCalculator.tsx";
import Fake404 from "./Fake404";

import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated on initial load
    const authStatus = localStorage.getItem("app_auth") === "true";
    // Using setTimeout to avoid synchronous state update warning
    const timer = setTimeout(() => {
      setIsAuthenticated(authStatus);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  // Show nothing until we determine authentication status
  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  // Show Fake404 if not authenticated, otherwise show main app
  return (
    <>
      {!isAuthenticated ? (
        <Fake404 onAuthSuccess={handleAuthSuccess} />
      ) : (
        <LandAreaCalculator />
      )}
    </>
  );
}

export default App
