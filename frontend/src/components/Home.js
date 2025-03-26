import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css'; // Use the new Home.css for specific styling

function Home() {
    return (
        <div className="home-container">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <h1>Welcome to Second Serve</h1>
                    <p>Giving surplus food a second chance to nourish communities.</p>
                    <div className="hero-buttons">
                        <Link to="/signup">
                            <button className="hero-button">Signup</button>
                        </Link>
                        <Link to="/login">
                            <button className="hero-button">Login</button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <h2>Why Second Serve?</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🍎</div>
                        <h3>Donate Surplus</h3>
                        <p>Give your extra food a second serve by donating to those in need.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🥗</div>
                        <h3>Receive Food</h3>
                        <p>Access surplus food from donors and enjoy a second serving.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🌍</div>
                        <h3>Reduce Waste</h3>
                        <p>Help the planet by ensuring food gets a second serve instead of going to waste.</p>
                    </div>
                </div>
            </section>

            {/* Call-to-Action Section */}
            <section className="cta-section">
                <h2>Join Second Serve Today</h2>
                <p>Be a part of our mission to give food a second chance and reduce waste!</p>
                <Link to="/signup">
                    <button className="cta-button">Get Started</button>
                </Link>
            </section>

            {/* Footer Section */}
            <footer className="footer-section">
                <p>Second Serve © 2025</p>
                <div className="footer-links">
                    <Link to="/about">About</Link>
                    <Link to="/contact">Contact</Link>
                </div>
            </footer>
        </div>
    );
}

export default Home;