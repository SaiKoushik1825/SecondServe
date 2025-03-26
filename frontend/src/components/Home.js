import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Auth.css'; // Reuse the same CSS for consistency

function Home() {
    return (
        <div className="auth-container">
            <div className="auth-form">
                <h1>Welcome to Food Rescue Platform</h1>
                <p>Connecting food donors and receivers to reduce waste.</p>
                <div className="home-buttons">
                    <Link to="/signup">
                        <button>Signup</button>
                    </Link>
                    <Link to="/login">
                        <button>Login</button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Home;