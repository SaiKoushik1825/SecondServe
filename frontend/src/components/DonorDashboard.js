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

function DonorDashboard() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [location, setLocation] = useState(null);
    const [wastageReport, setWastageReport] = useState(null);
    const [countryInput, setCountryInput] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [locationSearchError, setLocationSearchError] = useState('');
    const [suggestions, setSuggestions] = useState([]); // State for autocomplete suggestions
    const [showSuggestions, setShowSuggestions] = useState(false); // Control suggestion dropdown visibility
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({ title: '', description: '', quantity: '', country: '' });
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const suggestionTimeoutRef = useRef(null); // For debouncing API calls

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

    // Fetch suggestions as the user types (debounced)
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
                    limit: 5, // Limit to 5 suggestions
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

    // Handle input change with debouncing
    const handleLocationInputChange = (e) => {
        const value = e.target.value;
        setLocationSearch(value);
        setLocationSearchError('');

        // Clear previous timeout
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        // Set new timeout for fetching suggestions
        suggestionTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300); // 300ms debounce
    };

    // Handle suggestion selection
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

    // Handle search form submission
    const handleLocationSearch = async (e) => {
        e.preventDefault(); // Prevent page refresh

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
        const newErrors = { title: '', description: '', quantity: '', country: '' };

        if (!title.trim()) {
            newErrors.title = 'Title is required';
            isValid = false;
        }

        if (!description.trim()) {
            newErrors.description = 'Description is required';
            isValid = false;
        } else if (description.trim().length < 10) {
            newErrors.description = 'Description must be at least 10 characters';
            isValid = false;
        }

        const quantityNumber = parseFloat(quantity);
        if (!quantity) {
            newErrors.quantity = 'Quantity is required';
            isValid = false;
        } else if (isNaN(quantityNumber) || quantityNumber <= 0) {
            newErrors.quantity = 'Quantity must be a number greater than 0';
            isValid = false;
        }

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
            setLocationSearch('');
            setLocationSearchError('');
            setSuggestions([]);
            setShowSuggestions(false);
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
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

    // Initialize the map
    useEffect(() => {
        if (!mapRef.current) {
            mapRef.current = L.map('donor-map').setView([37.7749, -122.4194], 10);

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
            markerRef.current.remove();
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
                    <div className="location-search-container">
                        <form onSubmit={handleLocationSearch} className="location-search-form">
                            <div className="location-search-wrapper">
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={handleLocationInputChange}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
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
                                                onMouseDown={() => handleSuggestionClick(suggestion)} // Use onMouseDown to handle before onBlur
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
        </div>
    );
}

export default DonorDashboard;