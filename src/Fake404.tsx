import React, { useState } from 'react';

interface Fake404Props {
    onAuthSuccess: () => void;
}

const Fake404: React.FC<Fake404Props> = ({ onAuthSuccess }) => {
    const [clickCount, setClickCount] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Handle double-click detection on the error text
    const handleDoubleClick = () => {
        const newCount = clickCount + 1;
        setClickCount(newCount);

        if (newCount === 2) {
            setShowPassword(true);
            setClickCount(0); // Reset click count
        } else if (newCount > 2) {
            setClickCount(0); // Reset if more than 2 clicks
        }
    };

    // Handle password submission
    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (password === '880455') {
            // Store authentication in localStorage
            localStorage.setItem('app_auth', 'true');
            onAuthSuccess(); // Notify parent component of successful authentication
        } else {
            setError('Incorrect password');
            setPassword(''); // Clear the password field

            // Clear error message after 2 seconds
            setTimeout(() => {
                setError('');
            }, 2000);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="text-center max-w-md w-full">
                <div
                    className="cursor-pointer select-none"
                    onClick={handleDoubleClick}
                >
                    <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
                    <h2 className="text-2xl font-semibold text-gray-600">Page Not Found</h2>
                </div>

                <p className="text-gray-500 mt-4 mb-8">
                    Sorry, we couldn't find the page you're looking for.
                </p>

                {showPassword && (
                    <div className="mt-6 animate-fade-in">
                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                                Submit
                            </button>
                        </form>

                        {error && (
                            <p className="text-red-500 text-sm mt-2 animate-pulse">
                                {error}
                            </p>
                        )}
                    </div>
                )}

                <button
                    onClick={() => window.location.reload()}
                    className="mt-8 text-blue-600 hover:text-blue-800 text-sm"
                >
                    Go back to homepage
                </button>
            </div>
        </div>
    );
};

export default Fake404;