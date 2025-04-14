import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token'); // Changed from localStorage

    const handleLogout = () => {
        sessionStorage.removeItem('token'); // Changed from localStorage
        navigate('/login');
    };

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