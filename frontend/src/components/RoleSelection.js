import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function RoleSelection() {
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const navigate = useNavigate();

    // Fetch the user's current role to pre-select it
    useEffect(() => {
        const fetchUserRole = async () => {
            setFetching(true);
            try {
                const token = sessionStorage.getItem('token'); // Changed from localStorage
                if (!token) {
                    alert('Please log in to select a role.');
                    navigate('/login');
                    return;
                }

                const response = await axios.get('http://localhost:5000/api/auth/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userRole = response.data.role;

                // Pre-select the user's current role (if any)
                if (userRole) {
                    setRole(userRole);
                }
            } catch (err) {
                console.error('Error fetching user role:', err);
                if (err.response?.status === 401) {
                    alert('Your session has expired. Please log in again.');
                    sessionStorage.removeItem('token'); // Changed from localStorage
                    sessionStorage.removeItem('userId'); // Changed from localStorage
                    navigate('/login');
                } else {
                    alert('Failed to fetch user role. Please try again.');
                }
            } finally {
                setFetching(false);
            }
        };

        fetchUserRole();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!role) {
            alert('Please select a role to continue.');
            return;
        }

        setLoading(true);
        try {
            const token = sessionStorage.getItem('token'); // Changed from localStorage
            if (!token) {
                alert('Please log in to select a role.');
                navigate('/login');
                return;
            }

            await axios.put(
                'http://localhost:5000/api/auth/role',
                { role },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert('Role updated successfully!');
            // Redirect to the appropriate dashboard after role selection
            navigate(role === 'donor' ? '/donor-dashboard' : '/receiver-dashboard');
        } catch (err) {
            console.error('Role selection error:', err);
            if (err.response?.status === 401) {
                alert('Your session has expired. Please log in again.');
                sessionStorage.removeItem('token'); // Changed from localStorage
                sessionStorage.removeItem('userId'); // Changed from localStorage
                navigate('/login');
            } else {
                alert(err.response?.data?.error || 'Failed to update role. Check the console for details.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container role-selection-page">
            {fetching ? (
                <p>Loading...</p>
            ) : (
                <form className="auth-form" onSubmit={handleSubmit}>
                    <h1>Select Your Role</h1>
                    <p>Choose your role to continue (you can change this anytime):</p>
                    <div className="role-buttons">
                        <button
                            type="button"
                            onClick={() => setRole('donor')}
                            className={role === 'donor' ? 'selected' : ''}
                            disabled={loading}
                            aria-pressed={role === 'donor'} // Use aria-pressed instead of aria-selected
                            aria-label="Select Donor role"
                        >
                            Donor
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole('receiver')}
                            className={role === 'receiver' ? 'selected' : ''}
                            disabled={loading}
                            aria-pressed={role === 'receiver'} // Use aria-pressed instead of aria-selected
                            aria-label="Select Receiver role"
                        >
                            Receiver
                        </button>
                    </div>
                    <button type="submit" disabled={loading || !role}>
                        {loading ? 'Submitting...' : 'Continue'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default RoleSelection;