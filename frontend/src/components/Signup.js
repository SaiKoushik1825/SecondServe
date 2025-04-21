import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function Signup() {
    const [formData, setFormData] = useState({
        username: '',
        phone: '',
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({ username: '', phone: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors = { username: '', phone: '', email: '', password: '' };
        let isValid = true;

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
            isValid = false;
        } else if (formData.username.trim().length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
            isValid = false;
        } else if (/\s|,/.test(formData.username)) {
            newErrors.username = 'Username cannot contain spaces or commas';
            isValid = false;
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
            isValid = false;
        } else if (!/^\d{10}$/.test(formData.phone)) {
            newErrors.phone = 'Phone number must be 10 digits';
            isValid = false;
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
            isValid = false;
        }

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
        const payload = {
            username: formData.username.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            password: formData.password
        };
        console.log('Final payload before axios:', JSON.stringify(payload, null, 2));
        try {
            const response = await axios.post('http://localhost:5000/api/auth/signup', payload, {
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('Server response:', response.data);
            alert('Signup successful! Please log in to select your role.');
            navigate('/login');
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Signup failed. Check the console for details.';
            alert(errorMessage);
            console.error('Signup error details:', err.response?.data || err);
            if (errorMessage.includes('username') || errorMessage.includes('phone') || errorMessage.includes('email') || errorMessage.includes('password')) {
                setErrors({ ...errors, [errorMessage.split(':')[0].trim().toLowerCase()]: errorMessage });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container signup-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Signup</h1>
                <p>Create an account to get started</p>
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        disabled={loading}
                        placeholder="Enter your username"
                        className={errors.username ? 'error' : ''}
                    />
                    {errors.username && <p className="error">{errors.username}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="phone">Phone</label>
                    <input
                        id="phone"
                        name="phone"
                        type="text"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        disabled={loading}
                        placeholder="Enter your phone number"
                        className={errors.phone ? 'error' : ''}
                    />
                    {errors.phone && <p className="error">{errors.phone}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        disabled={loading}
                        placeholder="Enter your email"
                        className={errors.email ? 'error' : ''}
                    />
                    {errors.email && <p className="error">{errors.email}</p>}
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
                        placeholder="Enter your password"
                        className={errors.password ? 'error' : ''}
                    />
                    {errors.password && <p className="error">{errors.password}</p>}
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