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

// Haversine formula to calculate distance between two points (in kilometers)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
};

function ReceiverDashboard() {
    const [listings, setListings] = useState([]);
    const [filteredListings, setFilteredListings] = useState([]); // Primary state for filtered listings
    const [trends, setTrends] = useState([]);
    const [selectedListing, setSelectedListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState(null);
    const [searchedLocation, setSearchedLocation] = useState(null);
    const [searchAddress, setSearchAddress] = useState('');
    const [searchError, setSearchError] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [radius] = useState(50); // Radius in kilometers for filtering (adjustable)
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const searchedMarkerRef = useRef(null);
    const suggestionTimeoutRef = useRef(null);

    // Check authentication on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to access the Receiver Dashboard.');
            navigate('/login');
        }
    }, [navigate]);

    // Fetch available listings and donation trends on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
                const listingsResponse = await axios.get(`${backendUrl}/api/food`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setListings(listingsResponse.data);

                const trendsResponse = await axios.get(`${backendUrl}/api/food/donation-trends`);
                setTrends(trendsResponse.data.trends);
            } catch (err) {
                console.error('Fetch data error:', err);
                alert(err.response?.data?.message || 'Failed to fetch data. Check the console for details.');
            } finally {
                setLoading(false);
            }
        };
        const token = localStorage.getItem('token');
        if (token) fetchData();
    }, []);

    // Get the user's current location with reverse geocoding
    useEffect(() => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser. Showing all listings.');
            setUserLocation({ lat: 37.7749, lng: -122.4194, address: 'San Francisco, CA' }); // Default fallback
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Reverse geocode to get address
                try {
                    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                        params: {
                            lat: latitude,
                            lon: longitude,
                            format: 'json',
                        },
                    });
                    const address = response.data.display_name || 'Current Location';
                    setUserLocation({ lat: latitude, lng: longitude, address });
                } catch (err) {
                    console.error('Reverse geocoding error:', err);
                    setUserLocation({ lat: latitude, lng: longitude, address: 'Current Location' });
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                alert('Unable to retrieve your location. Showing all listings.');
                setUserLocation({ lat: 37.7749, lng: -122.4194, address: 'San Francisco, CA' }); // Default fallback
            }
        );
    }, []);

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

    // Handle input change with debouncing
    const handleSearchInputChange = (e) => {
        const value = e.target.value;
        setSearchAddress(value);
        setSearchError('');

        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        suggestionTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);
    };

    // Handle suggestion selection
    const handleSuggestionClick = (suggestion) => {
        const { lat, lon, display_name } = suggestion;
        const newLocation = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
        setSearchedLocation(newLocation);
        setSearchAddress(display_name);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    // Handle address search using Nominatim API
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchAddress.trim()) {
            setSearchError('Please enter an address to search.');
            setShowSuggestions(false);
            return;
        }

        setSearchError('');
        setShowSuggestions(false);

        try {
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: searchAddress,
                    format: 'json',
                    limit: 1,
                },
            });

            if (response.data.length === 0) {
                setSearchError('No results found for the address. Please try a different search.');
                return;
            }

            const { lat, lon, display_name } = response.data[0];
            const newLocation = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
            setSearchedLocation(newLocation);
            setSearchAddress(display_name);
        } catch (err) {
            console.error('Search error:', err);
            setSearchError('Failed to search for the address. Please try again.');
        }
    };

    // Clear the searched location
    const clearSearch = () => {
        setSearchedLocation(null);
        setSearchAddress('');
        setSearchError('');
        setSuggestions([]);
        setShowSuggestions(false);
        if (searchedMarkerRef.current) {
            searchedMarkerRef.current.remove();
            searchedMarkerRef.current = null;
        }
    };

    // Sort and filter listings by distance, excluding expired and deal_confirmed ones
    useEffect(() => {
        const referenceLocation = searchedLocation || userLocation;
        const currentDate = new Date();

        if (!referenceLocation || !listings.length) {
            setFilteredListings(
                listings.filter(listing => 
                    (!listing.expiresAt || new Date(listing.expiresAt) > currentDate) && 
                    listing.status !== 'deal_confirmed'
                )
            );
            return;
        }

        const sorted = [...listings]
            .filter(listing => 
                (!listing.expiresAt || new Date(listing.expiresAt) > currentDate) && 
                listing.status !== 'deal_confirmed'
            )
            .map(listing => {
                const distance = calculateDistance(
                    referenceLocation.lat,
                    referenceLocation.lng,
                    listing.location.latitude,
                    listing.location.longitude
                );
                return { ...listing, distance };
            })
            .sort((a, b) => a.distance - b.distance);

        if (searchedLocation) {
            const filtered = sorted.filter(listing => listing.distance <= radius);
            setFilteredListings(filtered);
        } else {
            setFilteredListings(sorted);
        }

        if (sorted.length > 0 && !selectedListing) {
            setSelectedListing(sorted[0]);
        }
    }, [userLocation, searchedLocation, listings, selectedListing, radius]);

    // Initialize the map
    useEffect(() => {
        if (!loading && !mapRef.current) {
            const center = userLocation ? [userLocation.lat, userLocation.lng] : [37.7749, -122.4194];
            mapRef.current = L.map('map').setView(center, 10);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(mapRef.current);

            if (userLocation) {
                L.marker([userLocation.lat, userLocation.lng], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div style="background-color: blue; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
                        iconSize: [15, 15],
                        iconAnchor: [7.5, 7.5],
                    }),
                })
                    .addTo(mapRef.current)
                    .bindPopup('Your Location')
                    .openPopup();
            }

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
    }, [loading, userLocation]);

    // Update map center and markers when searched location changes
    useEffect(() => {
        if (!mapRef.current || !searchedLocation) return;

        mapRef.current.setView([searchedLocation.lat, searchedLocation.lng], 10);

        if (searchedMarkerRef.current) {
            searchedMarkerRef.current.remove();
        }

        searchedMarkerRef.current = L.marker([searchedLocation.lat, searchedLocation.lng], {
            icon: L.divIcon({
                className: 'searched-location-marker',
                html: '<div style="background-color: red; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [15, 15],
                iconAnchor: [7.5, 7.5],
            }),
        })
            .addTo(mapRef.current)
            .bindPopup(`Searched Location: ${searchedLocation.address}`)
            .openPopup();

        setTimeout(() => {
            mapRef.current.invalidateSize();
        }, 0);
    }, [searchedLocation]);

    // Update markers for listings
    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        filteredListings.forEach(listing => {
            const marker = L.marker([listing.location.latitude, listing.location.longitude])
                .addTo(mapRef.current)
                .on('click', () => setSelectedListing(listing));
            markersRef.current.push(marker);

            if (selectedListing && selectedListing._id === listing._id) {
                marker.bindPopup(`
                    <div>
                        <h4>${listing.title}</h4>
                        <p>${listing.description}</p>
                        <p>Quantity: ${listing.quantity} kg</p>
                        <p>Location: ${listing.location.address}</p>
                        <p>Distance: ${listing.distance ? listing.distance.toFixed(2) + ' km' : 'Unknown'}</p>
                        <p>Expires At: ${new Date(listing.expiresAt).toLocaleDateString()}</p>
                        <p>Posted by: ${listing.postedBy.email}</p>
                        ${listing.status === 'available' ? `
                            <button onclick="document.getElementById('claim-${listing._id}').click()">Claim Listing</button>
                        ` : listing.status === 'claimed' ? `
                            <p>Donor Contact: ${listing.postedBy.phone} (Phone), ${listing.postedBy.email} (Email)</p>
                            <button onclick="document.getElementById('confirm-deal-${listing._id}').click()">Confirm Deal</button>
                        ` : listing.status === 'deal_confirmed' ? `
                            <p>Deal confirmed! Locations have been emailed.</p>
                        ` : listing.status === 'expired' ? `
                            <p style="color: #f44336">This listing has expired.</p>
                        ` : ''}
                    </div>
                `).openPopup();
            }
        });

        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }
    }, [filteredListings, selectedListing]);

    const handleClaim = async (listingId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to claim a listing.');
                navigate('/login');
                return;
            }
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.put(
                `${backendUrl}/api/food/claim/${listingId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Request sent to donor! Await their approval.');
            setListings(listings.map(listing =>
                listing._id === listingId ? { ...listing, requestedBy: response.data.requestedBy } : listing
            ));
            setSelectedListing({ ...selectedListing, requestedBy: response.data.requestedBy });
        } catch (err) {
            console.error('Claim listing error:', err);
            alert(err.response?.data?.error || 'Failed to send request. Check the console for details.');
        }
    };

    const handleConfirmDeal = async (listingId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to confirm the deal.');
                navigate('/login');
                return;
            }
            if (!userLocation) {
                alert('Please allow location access to confirm the deal.');
                return;
            }
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await axios.put(
                `${backendUrl}/api/food/confirm-deal/${listingId}`,
                {
                    receiverLocation: userLocation,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Deal confirmed! Locations have been emailed to both parties.');
            setListings(listings.filter(listing => listing._id !== listingId)); // Remove listing
            setSelectedListing(null);
        } catch (err) {
            console.error('Confirm deal error:', err);
            alert(err.response?.data?.error || 'Failed to confirm deal. Check the console for details.');
        }
    };

    const handleConfirmReceipt = async (listingId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to confirm receipt.');
                navigate('/login');
                return;
            }
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            await axios.put(
                `${backendUrl}/api/food/confirm-receipt/${listingId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Receipt confirmed! The listing has been removed.');
            setListings(listings.filter((listing) => listing._id !== listingId));
            setSelectedListing(null);
        } catch (err) {
            console.error('Confirm receipt error:', err);
            alert(err.response?.data?.error || 'Failed to confirm receipt. Check the console for details.');
        }
    };

    return (
        <div className="dashboard-container receiver-dashboard">
            <h1>Receiver Dashboard</h1>

            {/* Search Input for Location */}
            <div style={{ marginBottom: '20px' }}>
                <h3>Search for Food Listings by Location</h3>
                <form onSubmit={handleSearch} className="search-form">
                    <div className="location-search-wrapper">
                        <input
                            type="text"
                            value={searchAddress}
                            onChange={handleSearchInputChange}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Enter an address (e.g., 123 Main St, City)"
                            className="search-input"
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
                    <button type="submit" className="search-button">
                        Search
                    </button>
                    {searchedLocation && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="clear-button"
                        >
                            Clear Search
                        </button>
                    )}
                </form>
                {searchError && <p className="search-error">{searchError}</p>}
                {searchedLocation && (
                    <p className="search-info">
                        Showing {filteredListings.length} listings near searched location: {searchedLocation.address} ({searchedLocation.lat.toFixed(4)}, {searchedLocation.lng.toFixed(4)})
                    </p>
                )}
            </div>

            {loading ? (
                <div className="loading-spinner">
                    <p>Loading listings...</p>
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    <h2>Available Food Listings (Nearest First)</h2>
                    <div id="map" style={{ height: '400px', marginBottom: '20px' }}></div>

                    {/* Listings List */}
                    {filteredListings.length > 0 ? (
                        <ul className="listings-list">
                            {filteredListings.map((listing) => (
                                <li key={listing._id} className="listing-item">
                                    <h3>{listing.title}</h3>
                                    <p>{listing.description}</p>
                                    <p>Quantity: {listing.quantity} kg</p>
                                    <p>Location: {listing.location.address}</p>
                                    <p>Distance: {listing.distance ? listing.distance.toFixed(2) + ' km' : 'Unknown'}</p>
                                    <p>Expires At: {new Date(listing.expiresAt).toLocaleDateString()}</p>
                                    <p>Posted by: {listing.postedBy.email}</p>
                                    {listing.status === 'available' && (
                                        <button onClick={() => handleClaim(listing._id)}>Claim Listing</button>
                                    )}
                                    {listing.status === 'claimed' && (
                                        <>
                                            <p>Donor Contact: ${listing.postedBy.phone} (Phone), ${listing.postedBy.email} (Email)</p>
                                            <button onClick={() => handleConfirmDeal(listing._id)}>Confirm Deal</button>
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
                    ) : searchedLocation ? (
                        <p>No available listings within {radius} km of the searched location. Try clearing the search to see all listings.</p>
                    ) : (
                        <p>No available listings at the moment.</p>
                    )}

                    {/* Hidden buttons for Leaflet popups */}
                    {filteredListings.map((listing) => (
                        <div key={listing._id} style={{ display: 'none' }}>
                            <button
                                id={`claim-${listing._id}`}
                                onClick={() => handleClaim(listing._id)}
                            >
                                Claim Listing
                            </button>
                            <button
                                id={`confirm-deal-${listing._id}`}
                                onClick={() => handleConfirmDeal(listing._id)}
                            >
                                Confirm Deal
                            </button>
                            <button
                                id={`confirm-${listing._id}`}
                                onClick={() => handleConfirmReceipt(listing._id)}
                            >
                                Confirm Receipt
                            </button>
                        </div>
                    ))}
                </>
            )}

            {trends.length > 0 && (
                <div className="trends-container">
                    <h2>Donation Trends</h2>
                    <p>Here are the most commonly donated food types:</p>
                    <ul>
                        {trends.slice(0, 5).map((trend, index) => (
                            <li key={index}>
                                <strong>{trend.type}</strong>: {trend.totalQuantity} kg donated across {trend.count} listings (average: {Math.round(trend.averageQuantity)} kg per listing)
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ReceiverDashboard;