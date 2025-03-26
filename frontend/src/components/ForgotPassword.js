import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css'; // Updated import path

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // Step 1: Enter email, Step 2: Enter OTP and new password
    const navigate = useNavigate();

    // Step 1: Send OTP
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!email.trim()) {
            setError('Email is required');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/api/auth/forgot-password', { email });
            setSuccess(response.data.message);
            setStep(2); // Move to the OTP and new password form
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP. Check the console for details.');
            console.error('Forgot password error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP and Reset Password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!otp.trim() || !newPassword.trim()) {
            setError('OTP and new password are required');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/api/auth/reset-password', {
                email,
                otp,
                newPassword,
            });
            setSuccess(response.data.message);
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. Check the console for details.');
            console.error('Reset password error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Forgot Password</h2>

                {step === 1 ? (
                    <>
                        <p>Enter your email to receive an OTP</p>
                        <form onSubmit={handleSendOtp}>
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    aria-describedby="email-error"
                                />
                            </div>
                            {error && (
                                <p className="error" id="email-error">
                                    {error}
                                </p>
                            )}
                            {success && <p className="success">{success}</p>}
                            <button type="submit" disabled={loading}>
                                {loading ? 'Sending...' : 'Send OTP'}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <p>Enter the OTP sent to your email and your new password</p>
                        <form onSubmit={handleResetPassword}>
                            <div className="form-group">
                                <label htmlFor="otp">OTP</label>
                                <input
                                    type="text"
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                    aria-describedby="otp-error"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="newPassword">New Password</label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    aria-describedby="password-error"
                                />
                            </div>
                            {error && (
                                <p className="error" id="otp-error">
                                    {error}
                                </p>
                            )}
                            {success && <p className="success">{success}</p>}
                            <button type="submit" disabled={loading}>
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </>
                )}

                <p className="auth-link">
                    <button onClick={() => navigate('/login')} className="link-button">
                        Back to Login
                    </button>
                </p>
            </div>
        </div>
    );
}

export default ForgotPassword;