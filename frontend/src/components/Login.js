import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({ identifier: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        let isValid = true;
        const newErrors = { identifier: '', password: '' };

        if (!identifier.trim()) {
            newErrors.identifier = 'Phone or email is required';
            isValid = false;
        }

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
            const response = await axios.post('http://localhost:5000/api/auth/login', { identifier, password });
            const { token } = response.data;

            sessionStorage.setItem('token', token); // Changed from localStorage to sessionStorage
            navigate('/role-selection');
        } catch (err) {
            alert(err.response?.data?.error || 'Login failed. Check the console for details.');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container login-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Login</h1>
                <p>Sign in to access your dashboard</p>
                <div className="form-group"> {/* Changed from form-field to form-group */}
                    <label htmlFor="identifier">Phone or Email</label>
                    <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter phone or email"
                        className={errors.identifier ? 'error' : ''}
                    />
                    {errors.identifier && <p className="error">{errors.identifier}</p>} {/* Changed from error-message to error */}
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
                        className={errors.password ? 'error' : ''}
                    />
                    {errors.password && <p className="error">{errors.password}</p>} {/* Changed from error-message to error */}
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
                <p>
                    Don't have an account? <a href="/signup">Signup here</a>
                </p>
                <p>
                    <a href="/forgot-password">Forgot Password?</a>
                </p>
            </form>
        </div>
    );
}

export default Login;