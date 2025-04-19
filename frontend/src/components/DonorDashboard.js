import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import '../styles/Dashboard.css';

// Configure the default Leaflet icon
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Static list of countries
const countries = ['Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia',
    'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin',
    'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
    'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
    'Comoros', 'Congo (Congo-Brazzaville)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia (Czech Republic)',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
    'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany',
    'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary',
    'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
    'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali',
    'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
    'Montenegro', 'Morocco', 'Mozambique', 'Myanmar (Burma)', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
    'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
    'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
    'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
    'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia',
    'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
    'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

function DonorDashboard() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState(null);
    const [expiresIn, setExpiresIn] = useState(''); // Numeric value for expiration
    const [expiresUnit, setExpiresUnit] = useState('days'); // Unit: 'hours' or 'days'
    const [wastageReport, setWastageReport] = useState(null);
    const [countryInput, setCountryInput] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [locationSearchError, setLocationSearchError] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({ title: '', description: '', quantity: '', expiresIn: '', country: '', listings: '', location: '' });
    const [listings, setListings] = useState([]); // Store donor's listings
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const suggestionTimeoutRef = useRef(null);

    // Centralized function to fetch and sort donor's listings
    const fetchListings = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('token');
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.get(`${backendUrl}/api/food/my-listings`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const sortedListings = [...response.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setListings(sortedListings);
            setErrors(prev => ({ ...prev, listings: '' }));
        } catch (err) {
            console.error('Fetch listings error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            setErrors(prev => ({
                ...prev,
                listings: `Failed to fetch listings: ${err.response?.data?.error || err.message}.`
            }));
        } finally {
            setLoading(false);
        }
    };

    // Fetch donor's listings on mount
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            alert('Please log in to access the Donor Dashboard.');
            navigate('/login');
            return;
        }
        fetchListings();
    }, [navigate]);

    // Fetch wastage report from backend with AI prediction
    const fetchWastageReport = async (country) => {
        try {
            if (!country) return;

            setLoading(true);
            const token = sessionStorage.getItem('token');
            if (!token) {
                alert('Please log in to fetch the wastage report.');
                navigate('/login');
                return;
            }
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.get(`${backendUrl}/api/food/predict-waste`, {
                params: { country },
                headers: { Authorization: `Bearer ${token}` },
            });

            const { averageWeeklyWastage, confidenceInterval, suggestion, quote } = response.data;
            if (!averageWeeklyWastage || !suggestion || !quote) {
                throw new Error('Invalid wastage report data from server.');
            }

            setWastageReport({
                country,
                averageWeeklyWastage,
                confidenceInterval,
                donationPerDay: (averageWeeklyWastage / 7).toFixed(2),
                suggestion,
                quote,
            });
            setErrors(prev => ({ ...prev, country: '' }));
        } catch (err) {
            if (err.response && err.response.status === 401) {
                alert('Your session has expired. Please log in again.');
                sessionStorage.removeItem('token');
                navigate('/login');
            } else if (err.response && err.response.status === 403) {
                setErrors(prev => ({
                    ...prev,
                    country: 'Access denied. Check your permissions or contact support.'
                }));
            } else {
                console.error('Wastage report fetch error:', err);
                setErrors(prev => ({
                    ...prev,
                    country: err.response?.data?.error || 'Failed to fetch wastage report.'
                }));
            }
            setWastageReport(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCountryChange = (e) => {
        const selectedCountry = e.target.value;
        setCountryInput(selectedCountry);
        if (selectedCountry) {
            fetchWastageReport(selectedCountry);
        } else {
            setWastageReport(null);
            setErrors(prev => ({ ...prev, country: 'Please select a country.' }));
        }
    };

    const fetchSuggestions = async (query) => {
        if (!query.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: query,
                    format: 'json',
                    limit: 5,
                },
            });

            setSuggestions(response.data);
            setShowSuggestions(true);
        } catch (err) {
            console.error('Error fetching suggestions:', err);
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleLocationInputChange = (e) => {
        const value = e.target.value;
        setLocationSearch(value);
        setLocationSearchError('');

        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        suggestionTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);
    };

    const handleSuggestionClick = (suggestion) => {
        const { lat, lon, display_name } = suggestion;
        setLocation({
            address: display_name,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
        });
        setLocationSearch(display_name);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handleLocationSearch = async (e) => {
        e.preventDefault();

        if (!locationSearch.trim()) {
            setLocationSearchError('Please enter an address to search.');
            setShowSuggestions(false);
            return;
        }

        setLocationSearchError('');
        setShowSuggestions(false);

        try {
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: locationSearch,
                    format: 'json',
                    limit: 1,
                },
            });

            if (response.data.length === 0) {
                setLocationSearchError('No results found for the address. Please try a different search.');
                return;
            }

            const { lat, lon, display_name } = response.data[0];
            setLocation({
                address: display_name,
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
            });
            setLocationSearch(display_name);
        } catch (err) {
            console.error('Location search error:', err);
            setLocationSearchError('Failed to search for the address. Please try again.');
        }
    };

    const handleUseCurrentLocation = async () => {
        if (!navigator.geolocation) {
            setLocationSearchError('Geolocation is not supported by your browser.');
            return;
        }

        setLocationSearchError('');
        setLoading(true);
        setShowSuggestions(false);

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                });
            });

            const { latitude, longitude } = position.coords;

            const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: {
                    lat: latitude,
                    lon: longitude,
                    format: 'json',
                },
            });

            const display_name = response.data.display_name || 'Current Location';
            setLocation({
                address: display_name,
                latitude,
                longitude,
            });
            setLocationSearch(display_name);
        } catch (err) {
            console.error('Geolocation error:', err);
            if (err.code === 1) {
                setLocationSearchError('Permission denied. Please allow location access to use this feature.');
            } else if (err.code === 2) {
                setLocationSearchError('Position unavailable. Please try again or search manually.');
            } else {
                setLocationSearchError('Failed to fetch your location. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const clearLocationSearch = () => {
        setLocation(null);
        setLocationSearch('');
        setLocationSearchError('');
        setSuggestions([]);
        setShowSuggestions(false);
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
    };

    const validateListingForm = () => {
        let isValid = true;
        setErrors(prev => ({
            ...prev,
            title: '',
            description: '',
            quantity: '',
            expiresIn: '',
            country: '',
            location: ''
        }));

        if (!title.trim()) {
            setErrors(prev => ({
                ...prev,
                title: 'Title is required'
            }));
            isValid = false;
        }

        if (!description.trim()) {
            setErrors(prev => ({
                ...prev,
                description: 'Description is required'
            }));
            isValid = false;
        } else if (description.trim().length < 10) {
            setErrors(prev => ({
                ...prev,
                description: 'Description must be at least 10 characters'
            }));
            isValid = false;
        }

        const quantityNumber = parseFloat(quantity);
        if (!quantity) {
            setErrors(prev => ({
                ...prev,
                quantity: 'Quantity is required'
            }));
            isValid = false;
        } else if (isNaN(quantityNumber) || quantityNumber <= 0) {
            setErrors(prev => ({
                ...prev,
                quantity: 'Quantity must be a number greater than 0'
            }));
            isValid = false;
        }

        const expiresInNumber = parseInt(expiresIn);
        if (!expiresIn) {
            setErrors(prev => ({
                ...prev,
                expiresIn: 'Expiration time is required'
            }));
            isValid = false;
        } else if (isNaN(expiresInNumber) || expiresInNumber <= 0) {
            setErrors(prev => ({
                ...prev,
                expiresIn: 'Expiration time must be a positive number'
            }));
            isValid = false;
        } else if (expiresUnit === 'hours' && (expiresInNumber > 24)) {
            setErrors(prev => ({
                ...prev,
                expiresIn: 'Expiration time must be 24 hours or less'
            }));
            isValid = false;
        } else if (expiresUnit === 'days' && (expiresInNumber > 14)) {
            setErrors(prev => ({
                ...prev,
                expiresIn: 'Expiration time must be 14 days or less'
            }));
            isValid = false;
        }

        if (!location || !location.address || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            setErrors(prev => ({
                ...prev,
                location: 'Please select a valid location with address, latitude, and longitude.'
            }));
            isValid = false;
        }

        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateListingForm()) return;

        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            if (!token) {
                alert('Please log in to create a listing.');
                navigate('/login');
                return;
            }
            const quantityNumber = parseFloat(quantity);
            const expiresInNumber = parseInt(expiresIn);
            const expiresAt = new Date(Date.now() + expiresInNumber * (expiresUnit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));
            const payload = { title, description, quantity: quantityNumber, location, expiresAt };
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            console.log('Creating listing with payload:', payload); // Debug payload
            const createResponse = await axios.post(`${backendUrl}/api/food`, payload, { headers: { Authorization: `Bearer ${token}` } });
            console.log('Create listing response:', createResponse.data);
            alert('Food listing created successfully! Email notification status:', createResponse.data.emailStatus || 'Not provided');

            // Reset form and refetch listings
            setTitle(''); setDescription(''); setQuantity(''); setLocation(null); setExpiresIn(''); setExpiresUnit('days');
            setLocationSearch(''); setLocationSearchError(''); setSuggestions([]); setShowSuggestions(false);
            if (markerRef.current) markerRef.current.remove();
            await fetchListings();
            if (countryInput) fetchWastageReport(countryInput);
        } catch (err) {
            console.error('Handle submit error:', {
                step: err.config?.url === '/api/food' ? 'create' : 'fetchMyListings',
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            alert(`Failed to create listing. Email status: ${err.response?.data?.emailStatus || 'Unknown'}. Check console for details.`);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptRequest = async (listingId, receiverId) => {
        try {
            const token = sessionStorage.getItem('token');
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.put(
                `${backendUrl}/api/food/accept-request/${listingId}`,
                { receiverId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('Accept request response:', response.data);
            alert(`Request accepted! Email notification status: ${response.data.emailStatus || 'Not provided'}`);
            await fetchListings();
        } catch (err) {
            console.error('Accept request error:', err);
            alert(`Failed to accept request. Email status: ${err.response?.data?.emailStatus || 'Unknown'}. Check console for details.`);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        navigate('/login');
    };

    // Initialize the map
    useEffect(() => {
        if (!mapRef.current) {
            mapRef.current = L.map('donor-map', { attributionControl: false }).setView([37.7749, -122.4194], 10);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(mapRef.current);

            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Update the map when the location changes
    useEffect(() => {
        if (!mapRef.current) return;

        if (markerRef.current) {
            mapRef.current.removeLayer(markerRef.current);
            markerRef.current = null;
        }

        if (location) {
            mapRef.current.setView([location.latitude, location.longitude], 12);

            markerRef.current = L.marker([location.latitude, location.longitude], {
                icon: L.divIcon({
                    className: 'selected-location-marker',
                    html: '<div style="background-color: green; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
                    iconSize: [15, 15],
                    iconAnchor: [7.5, 7.5],
                }),
            })
                .addTo(mapRef.current)
                .bindPopup(`Selected Location: ${location.address}`)
                .openPopup();

            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }
    }, [location]);

    return (
        <div className="dashboard-container donor-dashboard">
            <div className="dashboard-header">
                <h1>Donor Dashboard</h1>
                <button onClick={handleLogout} className="logout-button">
                    Logout
                </button>
            </div>

            {/* Country selection form for wastage report */}
            <div className="wastage-report-form">
                <h2>Predicted Food Wastage Report for 2025</h2>
                <form>
                    <div className="form-field">
                        <label htmlFor="countryInput">Select Country</label>
                        <select
                            id="countryInput"
                            value={countryInput}
                            onChange={handleCountryChange}
                            className={errors.country ? 'error' : ''}
                            disabled={loading}
                        >
                            <option value="">-- Select a country --</option>
                            {countries.map((country, index) => (
                                <option key={index} value={country}>
                                    {country}
                                </option>
                            ))}
                        </select>
                        {errors.country && <p className="error-message">{errors.country}</p>}
                    </div>
                </form>
            </div>

            {/* Display the wastage report with insights */}
            {wastageReport && (
                <div className="wastage-report-container">
                    <h3>Wastage Report for {wastageReport.country}</h3>
                    <p>
                        predicted average weekly food wastage: <strong>{wastageReport.averageWeeklyWastage} kg</strong>.
                    </p>
                    {wastageReport.confidenceInterval && (
                        <p>
                            Confidence Interval: <strong>{wastageReport.confidenceInterval}</strong>.
                        </p>
                    )}
                    <p>
                        Average food donations per day: <strong>{wastageReport.donationPerDay} kg</strong>.
                    </p>
                    <p>Suggestion: {wastageReport.suggestion}</p>
                    <p><em>{wastageReport.quote}</em></p>
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
                    <label>Expiration Time</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            id="expiresIn"
                            type="number"
                            placeholder="e.g., 3"
                            value={expiresIn}
                            onChange={(e) => setExpiresIn(e.target.value)}
                            required
                            disabled={loading}
                            className={errors.expiresIn ? 'error' : ''}
                            style={{ width: '100px' }}
                        />
                        <select
                            value={expiresUnit}
                            onChange={(e) => setExpiresUnit(e.target.value)}
                            disabled={loading}
                            style={{ padding: '5px' }}
                        >
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                        </select>
                    </div>
                    {errors.expiresIn && <p className="error-message">{errors.expiresIn}</p>}
                </div>
                <div className="form-field">
                    <label>Pickup Location</label>
                    <div className="location-search-container">
                        <form onSubmit={handleLocationSearch} className="location-search-form">
                            <div className="location-search-wrapper">
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={handleLocationInputChange}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    placeholder="Enter an address (e.g., 123 Main St, City)"
                                    className="location-search-input"
                                    disabled={loading}
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <ul className="suggestions-list">
                                        {suggestions.map((suggestion, index) => (
                                            <li
                                                key={index}
                                                className="suggestion-item"
                                                onMouseDown={() => handleSuggestionClick(suggestion)}
                                            >
                                                {suggestion.display_name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <button type="submit" className="location-search-button" disabled={loading}>
                                Search
                            </button>
                            <button
                                type="button"
                                onClick={handleUseCurrentLocation}
                                className="use-current-location-button"
                                disabled={loading}
                            >
                                Use Current Location
                            </button>
                            {location && (
                                <button
                                    type="button"
                                    onClick={clearLocationSearch}
                                    className="location-clear-button"
                                    disabled={loading}
                                >
                                    Clear Location
                                </button>
                            )}
                        </form>
                        {locationSearchError && <p className="location-search-error">{locationSearchError}</p>}
                        {location && (
                            <p className="location-search-info">
                                Selected Location: {location.address} ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                            </p>
                        )}
                    </div>
                    <div id="donor-map" className="donor-map"></div>
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Listing'}
                </button>
            </form>

            {/* Display donor's listings with request management */}
            <h2>Your Active Listings</h2>
            {errors.listings && <p className="error-message">{errors.listings}</p>}
            {listings.length > 0 ? (
                <ul className="listings-list">
                    {listings.map((listing) => (
                        <li key={listing._id} className={`listing-item ${listing.status === 'expired' ? 'expired' : ''}`}>
                            <h3>{listing.title}</h3>
                            <p>{listing.description}</p>
                            <p>Quantity: <strong>{listing.quantity} kg</strong></p>
                            <p>Location: {listing.location.address}</p>
                            <p>Status: <span className={listing.status}>{listing.status}</span></p>
                            <p>Expires At: {new Date(listing.expiresAt).toLocaleString()}</p>
                            {listing.status === 'available' && listing.requestedBy && listing.requestedBy.length > 0 && (
                                <>
                                    <h4>Pending Requests:</h4>
                                    <ul>
                                        {listing.requestedBy.map((requestor) => (
                                            <li key={requestor._id}>
                                                {requestor.email} ({requestor.phone})
                                                <button
                                                    onClick={() => handleAcceptRequest(listing._id, requestor._id)}
                                                    disabled={loading}
                                                >
                                                    Accept
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {listing.status === 'claimed' && listing.claimedBy && (
                                <>
                                    <p>Claimed by: {listing.claimedBy.email}</p>
                                    {listing.claimedBy.phone && <p>Receiver Phone: {listing.claimedBy.phone}</p>}
                                    {listing.claimedBy.location && (
                                        <p>
                                            Receiver Location: {listing.claimedBy.location.address} (
                                            {listing.claimedBy.location.latitude.toFixed(4)},{' '}
                                            {listing.claimedBy.location.longitude.toFixed(4)})
                                        </p>
                                    )}
                                </>
                            )}
                            {listing.status === 'deal_confirmed' && (
                                <p>Deal confirmed! Locations have been emailed.</p>
                            )}
                            {listing.status === 'expired' && (
                                <p style={{ color: '#f44336' }}>This listing has expired.</p>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No active listings found.</p>
            )}
        </div>
    );
}

export default DonorDashboard;