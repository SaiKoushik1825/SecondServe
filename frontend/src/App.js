import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Signup from './components/Signup';
import Login from './components/Login';
import Home from './components/Home';
import Navbar from './components/Navbar';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import RoleSelection from './components/RoleSelection';
import DonorDashboard from './components/DonorDashboard';
import ReceiverDashboard from './components/ReceiverDashboard'; // This line is causing the error

function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/role-selection" element={<RoleSelection />} />
                <Route path="/donor-dashboard" element={<DonorDashboard />} />
                <Route path="/receiver-dashboard" element={<ReceiverDashboard />} />
                <Route path="/" element={<Home />} />
            </Routes>
        </Router>
    );
}

export default App;