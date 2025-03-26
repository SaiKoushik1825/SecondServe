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
    const [filteredListings, setFilteredListings] = useState([]); // Renamed from filteredListings, now the primary state
    const [trends, setTrends] = useState([]);
    const [selectedListing, setSelectedListing] = useState(null);
    const [route, setRoute] = useState(null);
    const [loading, setLoading] = useState(true);
    const [directionsLoading, setDirectionsLoading] = useState(false);
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
    const routeLayerRef = useRef(null);
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
                const listingsResponse = await axios.get(`${backendUrl}/api/food`);
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
        fetchData();
    }, []);

    // Get the user's current location
    useEffect(() => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser. Showing all listings.');
            setUserLocation(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude });
            },
            (err) => {
                console.error('Geolocation error:', err);
                alert('Unable to retrieve your location. Showing all listings.');
                setUserLocation(null);
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

    // Sort and filter listings by distance
    useEffect(() => {
        const referenceLocation = searchedLocation || userLocation;
        if (!referenceLocation || !listings.length) {
            setFilteredListings(listings);
            return;
        }

        const sorted = [...listings].map(listing => {
            const distance = calculateDistance(
                referenceLocation.lat,
                referenceLocation.lng,
                listing.location.latitude,
                listing.location.longitude
            );
            return { ...listing, distance };
        }).sort((a, b) => a.distance - b.distance);

        // Filter listings within the radius (only if searchedLocation is set)
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

    // Update markers and route for listings
    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        if (routeLayerRef.current) {
            routeLayerRef.current.remove();
            routeLayerRef.current = null;
        }

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
                        <p>Posted by: ${listing.postedBy.email}</p>
                        ${listing.status === 'available' ? `
                            <button onclick="document.getElementById('claim-${listing._id}').click()">Claim Listing</button>
                        ` : listing.status === 'claimed' ? `
                            <button onclick="document.getElementById('confirm-${listing._id}').click()">Confirm Receipt</button>
                        ` : listing.status === 'expired' ? `
                            <p>This listing has expired.</p>
                        ` : ''}
                        <br/>
                        <button onclick="document.getElementById('directions-${listing._id}').click()" ${directionsLoading ? 'disabled' : ''}>
                            ${directionsLoading ? 'Loading Directions...' : 'Show Directions'}
                        </button>
                    </div>
                `).openPopup();
            }
        });

        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }
    }, [filteredListings, selectedListing, directionsLoading]);

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
            alert('Listing claimed successfully!');
            setListings(listings.map(listing =>
                listing._id === listingId ? { ...listing, status: 'claimed', claimedBy: response.data.claimedBy } : listing
            ));
            setSelectedListing({ ...selectedListing, status: 'claimed', claimedBy: response.data.claimedBy });
            setRoute(null);
        } catch (err) {
            console.error('Claim listing error:', err);
            alert(err.response?.data?.error || 'Failed to claim listing. Check the console for details.');
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
            setRoute(null);
        } catch (err) {
            console.error('Confirm receipt error:', err);
            alert(err.response?.data?.error || 'Failed to confirm receipt. Check the console for details.');
        }
    };

    const handleShowDirections = async (listing) => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setDirectionsLoading(true);

        navigator.geolocation.getCurrentPosition(async (position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            try {
                const response = await axios.get('http://router.project-osrm.org/route/v1/driving/' +
                    `${userLocation.lng},${userLocation.lat};${listing.location.longitude},${listing.location.latitude}`, {
                    params: {
                        overview: 'full',
                        geometries: 'polyline',
                    },
                });

                const routeData = response.data.routes[0];
                const coordinates = L.Polyline.fromEncoded(routeData.geometry).getLatLngs();

                if (routeLayerRef.current) {
                    routeLayerRef.current.remove();
                }

                routeLayerRef.current = L.polyline(coordinates, { color: 'blue' }).addTo(mapRef.current);
                mapRef.current.fitBounds(L.polyline(coordinates).getBounds());
                setRoute(routeData);
            } catch (err) {
                console.error('Error fetching directions:', err);
                alert('Error fetching directions');
            } finally {
                setDirectionsLoading(false);
            }
        }, () => {
            alert('Unable to retrieve your location');
            setDirectionsLoading(false);
        });
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
                                    <p>Posted by: {listing.postedBy.email}</p>
                                    {listing.status === 'available' && (
                                        <button onClick={() => handleClaim(listing._id)}>Claim Listing</button>
                                    )}
                                    {listing.status === 'claimed' && (
                                        <button onClick={() => handleConfirmReceipt(listing._id)}>Confirm Receipt</button>
                                    )}
                                    {listing.status === 'expired' && (
                                        <p style={{ color: '#f44336' }}>This listing has expired.</p>
                                    )}
                                    <button
                                        onClick={() => handleShowDirections(listing)}
                                        disabled={directionsLoading}
                                    >
                                        {directionsLoading ? 'Loading Directions...' : 'Show Directions'}
                                    </button>
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
                                id={`confirm-${listing._id}`}
                                onClick={() => handleConfirmReceipt(listing._id)}
                            >
                                Confirm Receipt
                            </button>
                            <button
                                id={`directions-${listing._id}`}
                                onClick={() => handleShowDirections(listing)}
                            >
                                Show Directions
                            </button>
                        </div>
                    ))}

                    {route && (
                        <div className="directions-container">
                            <h3>Directions to Pickup Location</h3>
                            <p>Distance: {(route.distance / 1000).toFixed(2)} km</p>
                            <p>Duration: {(route.duration / 60).toFixed(2)} minutes</p>
                        </div>
                    )}
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