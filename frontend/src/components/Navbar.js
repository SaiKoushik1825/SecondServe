import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
                const response = await axios.get(`${backendUrl}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(response.data);
            } catch (err) {
                console.error('Error fetching user data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [token]);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        setUser(null); // Clear user data on logout
        navigate('/login');
    };

    if (loading) {
        return null; // Or a loading spinner if preferred
    }

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Food Rescue</Link>
            </div>
            <ul className="navbar-links">
                <li>
                    <Link to="/">Home</Link>
                </li>
                {token ? (
                    <>
                        <li className="welcome-message">Welcome, {user?.username || 'User'}</li>
                        <li>
                            <Link to="/role-selection">Change Role</Link>
                        </li>
                        <li>
                            <button onClick={handleLogout} className="logout-button">
                                Logout
                            </button>
                        </li>
                    </>
                ) : (
                    <>
                        <li>
                            <Link to="/login">Login</Link>
                        </li>
                        <li>
                            <Link to="/signup">Signup</Link>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    );
}

export default Navbar;