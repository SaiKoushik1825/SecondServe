import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function Login() {
    const [formData, setFormData] = useState({
        identifierType: 'email', // Default to email
        identifierValue: '',
        password: ''
    });
    const [errors, setErrors] = useState({ identifier: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        let isValid = true;
        const newErrors = { identifier: '', password: '' };

        // Check identifier value based on type
        if (!formData.identifierValue.trim()) {
            newErrors.identifier = 'Identifier is required';
            isValid = false;
        } else {
            switch (formData.identifierType) {
                case 'email':
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(formData.identifierValue)) {
                        newErrors.identifier = 'Please enter a valid email address';
                        isValid = false;
                    }
                    break;
                case 'phone':
                    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
                    if (!phoneRegex.test(formData.identifierValue)) {
                        newErrors.identifier = 'Please enter a valid phone number (e.g., 1234567890 or +123456789012)';
                        isValid = false;
                    }
                    break;
                case 'username':
                    if (formData.identifierValue.length < 3 || formData.identifierValue.length > 20) {
                        newErrors.identifier = 'Username must be 3-20 characters long';
                        isValid = false;
                    }
                    if (!/^[a-zA-Z0-9_]+$/.test(formData.identifierValue)) {
                        newErrors.identifier = 'Username can only contain letters, numbers, and underscores';
                        isValid = false;
                    }
                    break;
                default:
                    newErrors.identifier = 'Invalid identifier type';
                    isValid = false;
            }
        }

        // Check password
        if (!formData.password) {
            newErrors.password = 'Password is required';
            isValid = false;
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        console.log(`Field ${name} updated to:`, value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Form data before validation:', formData);
        if (!validateForm()) return;

        setLoading(true);
        try {
            const payload = {
                identifier: formData.identifierValue,
                password: formData.password
            };
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.post(`${backendUrl}/api/auth/login`, payload);
            console.log('Server response:', response.data);
            const { token } = response.data;
            sessionStorage.setItem('token', token);
            navigate('/role-selection');
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Login failed. Check the console for details.';
            alert(errorMessage);
            console.error('Login error details:', err.response?.data || err);
            setErrors({ ...errors, identifier: errorMessage, password: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container login-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Login</h1>
                <p>Sign in to access your dashboard</p>
                <div className="form-group">
                    <label htmlFor="identifierType">Select Identifier:</label>
                    <select
                        id="identifierType"
                        name="identifierType"
                        value={formData.identifierType}
                        onChange={handleChange}
                        disabled={loading}
                        className={errors.identifier ? 'error' : ''}
                    >
                        <option value="username">Username</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="identifierValue">{`Enter ${formData.identifierType}:`}</label>
                    <input
                        id="identifierValue"
                        name="identifierValue"
                        type="text"
                        value={formData.identifierValue}
                        onChange={handleChange}
                        required
                        disabled={loading}
                        placeholder={`Enter your ${formData.identifierType}`}
                        className={errors.identifier ? 'error' : ''}
                    />
                    {errors.identifier && <p className="error">{errors.identifier}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={loading}
                        className={errors.password ? 'error' : ''}
                    />
                    {errors.password && <p className="error">{errors.password}</p>}
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
                <p>
                    <a href="/forgot-password">Forgot Password?</a>
                </p>
                <p>
                    Don't have an account? <a href="/signup">Signup here</a>
                </p>
            </form>
        </div>
    );
}

export default Login;