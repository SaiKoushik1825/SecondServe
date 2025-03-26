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
    const [sortedListings, setSortedListings] = useState([]);
    const [trends, setTrends] = useState([]);
    const [selectedListing, setSelectedListing] = useState(null);
    const [route, setRoute] = useState(null);
    const [loading, setLoading] = useState(true);
    const [directionsLoading, setDirectionsLoading] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const routeLayerRef = useRef(null);

    // Fetch available listings and donation trends on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const listingsResponse = await axios.get('http://localhost:5000/api/food');
                setListings(listingsResponse.data);

                const trendsResponse = await axios.get('http://localhost:5000/api/food/donation-trends');
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

    // Sort listings by distance
    useEffect(() => {
        if (!userLocation || !listings.length) {
            setSortedListings(listings);
            return;
        }

        const sorted = [...listings].map(listing => {
            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                listing.location.latitude,
                listing.location.longitude
            );
            return { ...listing, distance };
        }).sort((a, b) => a.distance - b.distance);

        setSortedListings(sorted);

        if (sorted.length > 0 && !selectedListing) {
            setSelectedListing(sorted[0]);
        }
    }, [userLocation, listings, selectedListing]);

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

    // Update markers and route
    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        if (routeLayerRef.current) {
            routeLayerRef.current.remove();
            routeLayerRef.current = null;
        }

        sortedListings.forEach(listing => {
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
    }, [sortedListings, selectedListing, directionsLoading]);

    const handleClaim = async (listingId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to claim a listing.');
                navigate('/login');
                return;
            }
            const response = await axios.put(
                `http://localhost:5000/api/food/claim/${listingId}`,
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
            await axios.put(
                `http://localhost:5000/api/food/confirm-receipt/${listingId}`,
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
            {loading ? (
                <p>Loading listings...</p>
            ) : (
                <>
                    <h2>Available Food Listings (Nearest First)</h2>
                    <div id="map"></div>

                    {sortedListings.map((listing) => (
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