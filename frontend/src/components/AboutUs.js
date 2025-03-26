import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/AboutUs.css';

function AboutUs() {
    return (
        <div className="about-container">
            {/* About Section */}
            <section className="about-section">
                <h1>About Second Serve</h1>
                <p>
                    At Second Serve, we believe every meal deserves a second chance. Our mission is to connect food donors with receivers, reducing waste and fighting hunger in communities worldwide.
                </p>
                <div className="mission-vision">
                    <h2>Our Mission</h2>
                    <p>
                        To give surplus food a second serve by ensuring it reaches those in need, minimizing food waste, and promoting sustainability.
                    </p>
                    <h2>Our Vision</h2>
                    <p>
                        A world where no food goes to waste, and every community thrives through the power of sharing.
                    </p>
                </div>
            </section>

            {/* Team Section */}
            <section className="team-section">
                <h2>Meet the Team</h2>
                <div className="team-grid">
                    <div className="team-card">
                        <h3>Rohith Thota</h3>
                        <p className="role">Frontend Developer</p>
                        <p>Rohith designs and builds the user-friendly interface of Second Serve, ensuring a seamless experience for all users.</p>
                    </div>
                    <div className="team-card">
                        <h3>Saikoushik Merugu</h3>
                        <p className="role">Backend Developer</p>
                        <p>Saikoushik manages the server-side logic and database, ensuring Second Serve runs smoothly and securely.</p>
                    </div>
                </div>
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

export default AboutUs;