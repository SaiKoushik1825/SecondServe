import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import axios from 'axios';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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

const locationCache = new Map();

const LocationPicker = ({ onLocationSelect }) => {
    const [position, setPosition] = useState({ lat: 37.7749, lng: -122.4194 }); // Default to San Francisco
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false); // Loading state for API requests
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const searchTimeoutRef = useRef(null); // For debouncing

    // Initialize the map
    useEffect(() => {
        if (!mapRef.current) {
            mapRef.current = L.map('map').setView([position.lat, position.lng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(mapRef.current);

            markerRef.current = L.marker([position.lat, position.lng]).addTo(mapRef.current);

            // Force re-render to ensure the map displays correctly
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }

        // Cleanup on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Update map and marker when position changes
    useEffect(() => {
        if (mapRef.current && markerRef.current) {
            mapRef.current.setView([position.lat, position.lng], 13);
            markerRef.current.setLatLng([position.lat, position.lng]);
        }
    }, [position, position.lat, position.lng]); // Added position.lat and position.lng to fix ESLint warning

    // Handle location search with Nominatim
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!address) return;

        setLoading(true);

        // Check cache first
        if (locationCache.has(address)) {
            const location = locationCache.get(address);
            setPosition({ lat: location.latitude, lng: location.longitude });
            setAddress(location.address);
            onLocationSelect(location);
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: address,
                    format: 'json',
                    limit: 1,
                },
                headers: {
                    'User-Agent': 'FoodRescuePlatform/1.0 (your-email@example.com)',
                },
            });

            if (response.data.length > 0) {
                const { lat, lon, display_name } = response.data[0];
                const location = {
                    address: display_name,
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lon),
                };

                // Cache the result
                locationCache.set(address, location);

                setPosition({ lat: parseFloat(lat), lng: parseFloat(lon) });
                setAddress(display_name);
                onLocationSelect(location);
            } else {
                alert('Location not found');
            }
        } catch (err) {
            console.error('Error searching location:', err);
            alert('Error searching location. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Debounce search input
    const handleAddressChange = (e) => {
        setAddress(e.target.value);

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout
        if (e.target.value) {
            searchTimeoutRef.current = setTimeout(() => {
                handleSearch({ preventDefault: () => {} });
            }, 500); // 500ms debounce
        }
    };

    // Handle "Use Current Location"
    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setLoading(true);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setPosition({ lat: latitude, lng: longitude });

                try {
                    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                        params: {
                            lat: latitude,
                            lon: longitude,
                            format: 'json',
                        },
                        headers: {
                            'User-Agent': 'FoodRescuePlatform/1.0 (your-email@example.com)',
                        },
                    });

                    const display_name = response.data.display_name;
                    const location = {
                        address: display_name,
                        latitude,
                        longitude,
                    };

                    // Cache the result
                    locationCache.set(display_name, location);

                    setAddress(display_name);
                    onLocationSelect(location);
                } catch (err) {
                    console.error('Error reverse geocoding:', err);
                    alert('Error fetching address for current location');
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                alert('Unable to retrieve your location. Please allow location access or search manually.');
                setLoading(false);
            }
        );
    };

    return (
        <div className="location-picker-container">
            <form onSubmit={handleSearch}>
                <input
                    type="text"
                    value={address}
                    onChange={handleAddressChange}
                    placeholder="Search for a location"
                    className="location-search-input"
                    disabled={loading}
                />
                <div className="location-buttons">
                    <button type="submit" disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={loading}
                    >
                        Use Current Location
                    </button>
                </div>
            </form>
            <div id="map" className="location-map"></div>
        </div>
    );
};

export default LocationPicker;