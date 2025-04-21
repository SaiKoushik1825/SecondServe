import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Contact from './components/Contact';
import AboutUs from './components/AboutUs';
import Signup from './components/Signup';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import RoleSelection from './components/RoleSelection';
import DonorDashboard from './components/DonorDashboard';
import ReceiverDashboard from './components/ReceiverDashboard';

// A simple NotFound component for 404 routes
const NotFound = () => (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go back to Home</a>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem('token');
    return token ? children : <Navigate to="/login" replace />;
};

function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected Routes */}
                <Route path="/role-selection" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
                <Route path="/donor-dashboard" element={<ProtectedRoute><DonorDashboard /></ProtectedRoute>} />
                <Route path="/receiver-dashboard" element={<ProtectedRoute><ReceiverDashboard /></ProtectedRoute>} />

                {/* Catch-all route for 404 errors */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}

export default App;