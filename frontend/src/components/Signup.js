import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function Signup() {
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({ phone: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        let isValid = true;
        const newErrors = { phone: '', email: '', password: '' };

        // Phone validation
        if (!phone.trim()) {
            newErrors.phone = 'Phone number is required';
            isValid = false;
        } else if (!/^\d{10}$/.test(phone)) {
            newErrors.phone = 'Phone number must be 10 digits';
            isValid = false;
        }

        // Email validation
        if (!email.trim()) {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = 'Please enter a valid email address';
            isValid = false;
        }

        // Password validation
        if (!password) {
            newErrors.password = 'Password is required';
            isValid = false;
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            await axios.post('http://localhost:5000/api/auth/signup', { phone, email, password });
            alert('Signup successful! Please log in to select your role.');
            navigate('/login');
        } catch (err) {
            alert(err.response?.data?.error || 'Signup failed. Check the console for details.');
            console.error('Signup error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container signup-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Signup</h1>
                <p>Create an account to get started</p>
                <div className="form-group"> {/* Changed from form-field to form-group */}
                    <label htmlFor="phone">Phone</label>
                    <input
                        id="phone"
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter your phone number"
                        className={errors.phone ? 'error' : ''}
                    />
                    {errors.phone && <p className="error">{errors.phone}</p>} {/* Changed from error-message to error */}
                </div>
                <div className="form-group"> {/* Changed from form-field to form-group */}
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter your email"
                        className={errors.email ? 'error' : ''}
                    />
                    {errors.email && <p className="error">{errors.email}</p>} {/* Changed from error-message to error */}
                </div>
                <div className="form-group"> {/* Changed from form-field to form-group */}
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter your password"
                        className={errors.password ? 'error' : ''}
                    />
                    {errors.password && <p className="error">{errors.password}</p>} {/* Changed from error-message to error */}
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Signing up...' : 'Signup'}
                </button>
                <p>
                    Already have an account? <a href="/login">Login here</a>
                </p>
            </form>
        </div>
    );
}

export default Signup;