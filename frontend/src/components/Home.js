import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Home.css';

function Home() {
    const [user, setUser] = useState(null);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const token = sessionStorage.getItem('token');

    useEffect(() => {
        const fetchUserData = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
                console.log('Fetching user data with token:', token);
                const userResponse = await axios.get(`${backendUrl}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                console.log('User data received:', userResponse.data);
                setUser(userResponse.data);

                // Fetch listings using the same endpoint as DonorDashboard
                if (userResponse.data.role === 'donor' || userResponse.data.role === 'receiver') {
                    console.log('Fetching listings...');
                    const listingsResponse = await axios.get(`${backendUrl}/api/food/my-listings`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log('Listings received:', listingsResponse.data);
                    setListings(listingsResponse.data);
                }
            } catch (err) {
                console.error('Fetch error details:', {
                    status: err.response?.status,
                    data: err.response?.data,
                    message: err.message,
                });
                if (err.response?.status === 404) {
                    setError('Listings endpoint not found. Check with the administrator.');
                } else if (err.response?.status === 401) {
                    setError('Unauthorized. Please log in again.');
                    sessionStorage.removeItem('token');
                    navigate('/login');
                } else if (err.response?.status === 403) {
                    setError('Access denied. Contact support or check your role permissions.');
                } else {
                    setError('An unexpected error occurred. Check the console for details.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [token, navigate]);

    if (loading) {
        return (
            <div className="home-container">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="home-container">
            {token ? (
                <>
                    {user ? (
                        <section className="user-section">
                            <h1>Welcome, {user.name || user.email || 'User'}!</h1>
                            <p>Role: {user.role || 'Unknown'}</p>
                            <h2>Your {user.role === 'donor' ? 'Donations' : 'Received Listings'}</h2>
                            {listings.length > 0 ? (
                                <ul>
                                    {listings.map((listing) => (
                                        <li key={listing._id}>
                                            {listing.title || 'Untitled'} - {listing.quantity || 'N/A'} kg -{' '}
                                            {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : 'N/A'}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No {user.role === 'donor' ? 'donations' : 'received listings'} yet.</p>
                            )}
                            <button
                                onClick={() => {
                                    sessionStorage.removeItem('token');
                                    navigate('/login');
                                }}
                                className="logout-button"
                            >
                                Logout
                            </button>
                        </section>
                    ) : (
                        <p className="error">User data not loaded. {error}</p>
                    )}
                    {error && <p className="error">{error}</p>}
                </>
            ) : (
                <>
                    {/* Hero Section for non-logged-in users */}
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
                </>
            )}

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