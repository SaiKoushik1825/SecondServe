import React, { useState } from 'react'; // Removed useEffect since it's not used
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import LocationPicker from './LocationPicker';
import '../styles/Dashboard.css';

function DonorDashboard() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState(null);
    const [wastageReport, setWastageReport] = useState(null);
    const [countryInput, setCountryInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({ title: '', description: '', quantity: '', country: '' });
    const navigate = useNavigate();

    const fetchWastageReport = async (country) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to fetch the wastage report.');
                navigate('/login');
                return;
            }
            const response = await axios.get('http://localhost:5000/api/food/predict-waste', {
                params: { country },
                headers: { Authorization: `Bearer ${token}` },
            });
            setWastageReport(response.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                alert('Your session has expired. Please log in again.');
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                console.error('Wastage report fetch error:', err);
                setErrors({ ...errors, country: err.response?.data?.error || 'Failed to fetch wastage report.' });
            }
        }
    };

    const validateWastageForm = () => {
        let isValid = true;
        const newErrors = { ...errors, country: '' };

        if (!countryInput.trim()) {
            newErrors.country = 'Please enter a country name.';
            isValid = false;
        } else if (!/^[A-Za-z\s]+$/.test(countryInput.trim())) {
            newErrors.country = 'Country name should only contain letters and spaces.';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleCountrySubmit = (e) => {
        e.preventDefault();
        if (!validateWastageForm()) return;
        fetchWastageReport(countryInput.trim());
    };

    const validateListingForm = () => {
        let isValid = true;
        const newErrors = { title: '', description: '', quantity: '', country: '' };

        // Title validation
        if (!title.trim()) {
            newErrors.title = 'Title is required';
            isValid = false;
        }

        // Description validation
        if (!description.trim()) {
            newErrors.description = 'Description is required';
            isValid = false;
        } else if (description.trim().length < 10) {
            newErrors.description = 'Description must be at least 10 characters';
            isValid = false;
        }

        // Quantity validation
        const quantityNumber = parseFloat(quantity);
        if (!quantity) {
            newErrors.quantity = 'Quantity is required';
            isValid = false;
        } else if (isNaN(quantityNumber) || quantityNumber <= 0) {
            newErrors.quantity = 'Quantity must be a number greater than 0';
            isValid = false;
        }

        // Location validation
        if (!location || !location.address || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            alert('Please select a valid location with address, latitude, and longitude.');
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateListingForm()) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to create a listing.');
                navigate('/login');
                return;
            }
            const quantityNumber = parseFloat(quantity);
            const payload = { title, description, quantity: quantityNumber, location };
            console.log('Sending food listing data:', payload);
            await axios.post(
                'http://localhost:5000/api/food',
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Food listing created successfully!');
            setTitle('');
            setDescription('');
            setQuantity('');
            setLocation(null);
            if (countryInput) {
                fetchWastageReport(countryInput);
            }
        } catch (err) {
            if (err.response && err.response.status === 401) {
                alert('Your session has expired. Please log in again.');
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                console.error('Create listing error:', err);
                alert(err.response?.data?.error || 'Failed to create listing. Check the console for details.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="dashboard-container donor-dashboard">
            <div className="dashboard-header">
                <h1>Donor Dashboard</h1>
                <button onClick={handleLogout} className="logout-button">
                    Logout
                </button>
            </div>

            {/* Country input form for wastage report */}
            <div className="wastage-report-form">
                <h2>Food Wastage Report for 2025</h2>
                <form onSubmit={handleCountrySubmit}>
                    <div className="form-field">
                        <label htmlFor="countryInput">Enter Country</label>
                        <input
                            id="countryInput"
                            type="text"
                            placeholder="e.g., USA"
                            value={countryInput}
                            onChange={(e) => setCountryInput(e.target.value)}
                            className={errors.country ? 'error' : ''}
                        />
                        {errors.country && <p className="error-message">{errors.country}</p>}
                    </div>
                    <button type="submit">Get Wastage Report</button>
                </form>
            </div>

            {/* Display the wastage report */}
            {wastageReport && (
                <div className="wastage-report-container">
                    <h3>Wastage Report</h3>
                    <p>
                        In <strong>{wastageReport.country}</strong>, the average weekly food wastage for 2025 is{' '}
                        <strong>{wastageReport.averageWeeklyWastage} kg</strong>.
                    </p>
                    <p>Suggestion: {wastageReport.suggestion}</p>
                    <p><em>Motivational Quote: "{wastageReport.quote}"</em></p>
                </div>
            )}

            {/* Form to create a food listing */}
            <h2>Create a Food Listing</h2>
            <form className="dashboard-form" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="title">Title</label>
                    <input
                        id="title"
                        type="text"
                        placeholder="Food Item (e.g., Fresh Apples)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={loading}
                        className={errors.title ? 'error' : ''}
                    />
                    {errors.title && <p className="error-message">{errors.title}</p>}
                </div>
                <div className="form-field">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        placeholder="Description (e.g., 5 kg, available for pickup)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        disabled={loading}
                        className={errors.description ? 'error' : ''}
                    />
                    {errors.description && <p className="error-message">{errors.description}</p>}
                </div>
                <div className="form-field">
                    <label htmlFor="quantity">Quantity (kg)</label>
                    <input
                        id="quantity"
                        type="number"
                        placeholder="Quantity (kg)"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        disabled={loading}
                        className={errors.quantity ? 'error' : ''}
                    />
                    {errors.quantity && <p className="error-message">{errors.quantity}</p>}
                </div>
                <div className="form-field">
                    <label>Pickup Location</label>
                    <LocationPicker onLocationSelect={setLocation} />
                    {location && (
                        <div className="location-info">
                            <p className="selected-location">Selected Location: {location.address}</p>
                            <button
                                type="button"
                                onClick={() => setLocation(null)}
                                className="clear-location-button"
                                disabled={loading}
                            >
                                Clear Location
                            </button>
                        </div>
                    )}
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Listing'}
                </button>
            </form>
        </div>
    );
}

export default DonorDashboard;