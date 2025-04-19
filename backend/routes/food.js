const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const axios = require('axios');

// Set up Nodemailer transporter with retry logic
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER || 'default-email@gmail.com', // Fallback for testing
        pass: process.env.EMAIL_PASS || 'default-password', // Fallback for testing
    },
});

// Validate environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Warning: EMAIL_USER or EMAIL_PASS not set in environment variables. Using fallbacks which may not work.');
}

// List of motivational quotes
const motivationalQuotes = [
    "One person’s food waste is another person’s feast. Donate today! – Anonymous",
    "Small acts of kindness, like donating food, can make a big difference. – Unknown",
    "The best way to find yourself is to lose yourself in the service of others. – Mahatma Gandhi",
    "We make a living by what we get, but we make a life by what we give. – Winston Churchill",
    "No one has ever become poor by giving. – Anne Frank",
    "Food donation is an act of love that feeds both the body and the soul. – Anonymous",
    "Reducing food waste is a shared responsibility. Let’s do our part! – Unknown",
];

// Helper function to get a random quote
const getRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    return motivationalQuotes[randomIndex];
};

// Helper function to extract country from address using Nominatim
const getCountryFromAddress = async (address) => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                addressdetails: 1,
            },
            headers: {
                'User-Agent': 'FoodRescuePlatform/1.0 (your_email@example.com)', // Replace with your email
            },
        });

        if (response.data && response.data.length > 0) {
            const addressDetails = response.data[0].address;
            return addressDetails.country || 'Unknown';
        }
        return 'Unknown';
    } catch (err) {
        console.error('Error extracting country:', err.message);
        return 'Unknown';
    }
};

// Helper function to send email with retry
const sendEmail = async (to, subject, text, maxRetries = 2) => {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
                throw new Error('Invalid email address');
            }
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to,
                subject,
                text,
            };
            const info = await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${to}:`, info.response);
            return { success: true, message: info.response };
        } catch (error) {
            attempt++;
            console.error(`Email attempt ${attempt} failed for ${to}:`, error.message);
            if (attempt > maxRetries) {
                return { success: false, message: `Failed after ${maxRetries} attempts: ${error.message}` };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
    }
};

// Create a food listing
router.post('/', auth, async (req, res) => {
    const { title, description, quantity, location } = req.body;
    try {
        if (!location || !location.address || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            return res.status(400).json({ error: 'Location must include address, latitude, and longitude', emailStatus: { success: false, message: 'No email sent' } });
        }

        const country = await getCountryFromAddress(location.address);

        const foodListing = new FoodListing({
            title,
            description,
            quantity,
            location,
            country,
            postedBy: req.user._id,
            createdAt: new Date(), // Explicitly set createdAt
        });
        await foodListing.save();

        const user = await User.findById(req.user._id);
        let emailStatus = { success: false, message: 'Email not sent' };
        if (user && user.email) {
            emailStatus = await sendEmail(user.email, 'Food Listing Created Successfully', 
                `Hello ${user.email},\n\nYou have successfully created a food listing titled "${title}" with a quantity of ${quantity} kg in ${country}. It is now available for receivers to claim.\n\nThank you for using the Food Rescue Platform!`);
        }

        res.status(201).json({ message: 'Food listing created successfully', foodListing, emailStatus });
    } catch (err) {
        console.error('Create food listing error:', err);
        res.status(500).json({ error: err.message, emailStatus: { success: false, message: err.message } });
    }
});

// Get all available food listings (for ReceiverDashboard)
router.get('/', async (req, res) => {
    try {
        await FoodListing.updateMany(
            { status: 'available', expiresAt: { $lt: new Date() } },
            { $set: { status: 'expired' } }
        );

        // Show only available listings (listings disappear after acceptance)
        const listings = await FoodListing.find({ status: 'available' })
            .populate('postedBy', 'email phone')
            .populate('requestedBy', 'email phone');
        res.json(listings);
    } catch (err) {
        console.error('Fetch food listings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all food listings (for AI purposes, admin only)
router.get('/all', auth, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.', emailStatus: { success: false, message: 'No email sent' } });
        }
        const listings = await FoodListing.find()
            .populate('postedBy', 'email phone')
            .populate('requestedBy', 'email phone')
            .populate('claimedBy', 'email phone');
        res.json(listings);
    } catch (err) {
        console.error('Fetch all food listings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get donor's own listings (for DonorDashboard)
router.get('/my-listings', auth, async (req, res) => {
    try {
        const listings = await FoodListing.find({ postedBy: req.user._id })
            .populate('postedBy', 'email phone')
            .populate('requestedBy', 'email phone')
            .populate('claimedBy', 'email phone');
        res.json(listings);
    } catch (err) {
        console.error('Fetch my listings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Request a food listing (replaces claim)
router.put('/claim/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.status !== 'available') {
            return res.status(400).json({ error: 'Listing is not available', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.requestedBy && listing.requestedBy.some(user => user.toString() === req.user._id.toString())) {
            return res.status(400).json({ error: 'You have already requested this listing', emailStatus: { success: false, message: 'No email sent' } });
        }

        listing.requestedBy = listing.requestedBy || [];
        listing.requestedBy.push(req.user._id);
        await listing.save();

        const donor = await User.findById(listing.postedBy);
        const receiver = await User.findById(req.user._id);
        let emailStatus = { success: false, message: 'Email not sent' };
        if (donor && donor.email) {
            emailStatus = await sendEmail(donor.email, 'New Request for Your Food Listing', 
                `Hello ${donor.email},\n\nYour food listing titled "${listing.title}" has been requested by ${receiver.email}. Please review and accept the request in your Donor Dashboard.\n\nThank you for using the Food Rescue Platform!`);
        }

        res.json({ message: 'Request sent successfully', listing, emailStatus });
    } catch (err) {
        console.error('Request listing error:', err);
        res.status(500).json({ error: err.message, emailStatus: { success: false, message: err.message } });
    }
});

// Accept a request for a food listing
router.put('/accept-request/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id).populate('postedBy requestedBy');
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.postedBy._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the donor can accept requests', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.status !== 'available' || !listing.requestedBy || listing.requestedBy.length === 0) {
            return res.status(400).json({ error: 'No pending requests to accept', emailStatus: { success: false, message: 'No email sent' } });
        }

        const acceptedReceiverId = req.body.receiverId || listing.requestedBy[0]._id;
        if (!listing.requestedBy.some(user => user._id.toString() === acceptedReceiverId.toString())) {
            return res.status(400).json({ error: 'Invalid receiver ID', emailStatus: { success: false, message: 'No email sent' } });
        }

        listing.status = 'claimed';
        listing.claimedBy = acceptedReceiverId;
        listing.requestedBy = listing.requestedBy.filter(user => user._id.toString() !== acceptedReceiverId.toString());
        await listing.save();

        const receiver = await User.findById(acceptedReceiverId);
        let emailStatus = { success: false, message: 'Email not sent' };
        if (receiver && receiver.email) {
            emailStatus = await sendEmail(receiver.email, 'Your Request Has Been Accepted', 
                `Hello ${receiver.email},\n\nYour request for "${listing.title}" has been accepted by the donor. Please proceed to confirm the deal.\n\nThank you for using the Food Rescue Platform!`);
        }

        // Notify other requesters (if any)
        const rejectedEmails = [];
        for (const rejectedUser of listing.requestedBy) {
            const rejectedReceiver = await User.findById(rejectedUser._id);
            if (rejectedReceiver && rejectedReceiver.email) {
                const status = await sendEmail(rejectedReceiver.email, 'Your Request Was Not Accepted', 
                    `Hello ${rejectedReceiver.email},\n\nYour request for "${listing.title}" was not accepted as another receiver was chosen. Thank you for your interest!\n\nThank you for using the Food Rescue Platform!`);
                if (!status.success) rejectedEmails.push(rejectedReceiver.email);
            }
        }

        res.json({ message: 'Request accepted successfully', listing, emailStatus, rejectedEmailsStatus: rejectedEmails.length ? { success: false, message: `Failed for: ${rejectedEmails.join(', ')}` } : { success: true, message: 'All rejected emails sent' } });
    } catch (err) {
        console.error('Accept request error:', err);
        res.status(500).json({ error: 'Failed to accept request. Check server logs.', emailStatus: { success: false, message: err.message } });
    }
});

// Confirm deal for a food listing
router.put('/confirm-deal/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id).populate('postedBy claimedBy');
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.status !== 'claimed' || !listing.claimedBy || listing.claimedBy._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({ error: 'Listing must be claimed by you to confirm the deal', emailStatus: { success: false, message: 'No email sent' } });
        }

        // Get receiverLocation from request body, fallback to default if not provided
        let receiverLocation = req.body.receiverLocation || {
            address: 'Current Location (Geolocation)',
            latitude: 0,
            longitude: 0,
        };
        if (!receiverLocation.address || typeof receiverLocation.latitude !== 'number' || typeof receiverLocation.longitude !== 'number') {
            console.warn('Incomplete receiver location provided, using fallback with default coordinates.');
            receiverLocation = {
                address: 'Current Location (Geolocation)',
                latitude: 0,
                longitude: 0,
            };
        }

        listing.status = 'deal_confirmed';
        listing.dealConfirmedAt = new Date();
        listing.receiverLocation = receiverLocation;
        await listing.save();

        // Fetch donor and receiver details with explicit checks
        const donor = await User.findById(listing.postedBy._id);
        const receiver = await User.findById(listing.claimedBy._id);
        if (!donor || !receiver) {
            throw new Error('Donor or receiver user data not found');
        }

        const donorEmail = donor.email;
        const receiverEmail = receiver.email;
        console.log(`Debug - Donor Email: ${donorEmail}, Receiver Email: ${receiverEmail}`); // Added debug log

        if (donorEmail === receiverEmail) {
            console.warn('Warning: Donor and receiver emails are the same. Check user data or authentication.');
        }

        // Prepare location strings
        const donorLocation = `${listing.location.address} (Lat: ${listing.location.latitude}, Long: ${listing.location.longitude})`;
        const receiverLocationStr = `${receiverLocation.address} (Lat: ${receiverLocation.latitude}, Long: ${receiverLocation.longitude})`;

        // Send email to donor
        let donorEmailStatus = { success: false, message: 'Email not sent' };
        if (donorEmail && donorEmail !== receiverEmail) {
            donorEmailStatus = await sendEmail(donorEmail, 'Deal Confirmed - Receiver Location', 
                `Hello ${donor.email},\n\nThe deal for "${listing.title}" has been confirmed. The receiver's location is:\n${receiverLocationStr}\n\nPlease coordinate the pickup. Contact the receiver at ${receiverEmail}.\n\nBest,\nSecondServe Team`);
            console.log(`Donor email sent to: ${donorEmail}`); // Debug log
        } else {
            console.error('Donor email not sent due to mismatch or invalid email.');
        }

        // Send email to receiver
        let receiverEmailStatus = { success: false, message: 'Email not sent' };
        if (receiverEmail && receiverEmail !== donorEmail) {
            receiverEmailStatus = await sendEmail(receiverEmail, 'Deal Confirmed - Donor Location', 
                `Hello ${receiver.email},\n\nThe deal for "${listing.title}" has been confirmed. The donor's location is:\n${donorLocation}\n\nPlease coordinate the pickup. Contact the donor at ${donorEmail}.\n\nBest,\nSecondServe Team`);
            console.log(`Receiver email sent to: ${receiverEmail}`); // Debug log
        } else {
            console.error('Receiver email not sent due to mismatch or invalid email.');
        }

        res.status(200).json({ message: 'Deal confirmed and locations emailed.', emailStatus: { donor: donorEmailStatus, receiver: receiverEmailStatus } });
    } catch (err) {
        console.error('Confirm deal error:', err);
        res.status(500).json({ error: 'Failed to confirm deal. Check server logs.', emailStatus: { success: false, message: err.message } });
    }
});

// Confirm receipt of a food listing
router.put('/confirm-receipt/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Food listing not found', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.status !== 'claimed') {
            return res.status(400).json({ error: 'Food listing must be claimed before confirming receipt', emailStatus: { success: false, message: 'No email sent' } });
        }
        if (listing.claimedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You are not authorized to confirm receipt of this listing', emailStatus: { success: false, message: 'No email sent' } });
        }
        listing.status = 'received';
        listing.receivedAt = Date.now();
        await listing.save();

        const donor = await User.findById(listing.postedBy);
        const receiver = await User.findById(req.user._id);
        let emailStatus = { success: false, message: 'Email not sent' };
        if (donor && donor.email) {
            emailStatus = await sendEmail(donor.email, 'Food Listing Receipt Confirmed', 
                `Hello ${donor.email},\n\nThe receiver ${receiver.email} has confirmed receipt of your food listing titled "${listing.title}". Thank you for your donation!\n\nThank you for using the Food Rescue Platform!`);
        }

        res.json({ message: 'Receipt confirmed successfully', listing, emailStatus });
    } catch (err) {
        console.error('Confirm receipt error:', err);
        res.status(500).json({ error: err.message, emailStatus: { success: false, message: err.message } });
    }
});

// Calculate average weekly food wastage for a country for the year 2025 with AI
router.get('/predict-waste', auth, async (req, res) => {
    try {
        const country = req.query.country;
        if (!country) {
            return res.status(400).json({ error: 'Country query parameter is required', emailStatus: { success: false, message: 'No email sent' } });
        }

        // Fetch all available historical data
        const startDate = new Date('2023-01-01T00:00:00Z'); // Broad range to capture all data
        const endDate = new Date(); // Current time: April 19, 2025 01:14 PM PDT
        const historicalData = await FoodListing.find({
            country: { $regex: new RegExp(country, 'i') }, // Case-insensitive match
            createdAt: { $gte: startDate, $lte: endDate },
        }).select('quantity createdAt status country');
        console.log('All historical data found:', JSON.stringify(historicalData, null, 2));

        // Prepare data for xAI API with enhanced context for waste reduction
        const aiInput = {
            historicalData: historicalData.map(listing => ({
                quantity: listing.quantity || 0,
                date: listing.createdAt,
                status: listing.status || 'unknown',
            })),
            context: 'Predict average weekly food wastage for 2025 based on all available historical data, including a confidence interval and specific insights/recommendations to reduce food waste (e.g., adjust expiration times, encourage faster donations, or target high-waste food types).',
            country: country,
        };

        // AI integration: Call xAI API for prediction with waste reduction focus
        let xaiResponse;
        try {
            xaiResponse = await axios.post('https://api.x.ai/v1/grok/predict', aiInput, {
                headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
            });
            console.log('AI response:', xaiResponse.data);
        } catch (aiErr) {
            console.error('AI API error, falling back:', aiErr.message);
        }

        const { prediction, confidenceInterval, suggestion } = xaiResponse?.data || {};

        // Fallback to basic calculation with all 2025 data (not just available/expired)
        const fallbackData = await FoodListing.find({
            country: { $regex: new RegExp(country, 'i') }, // Case-insensitive match
            createdAt: { $gte: new Date('2025-01-01T00:00:00Z'), $lte: endDate },
        });
        console.log('Fallback data for 2025 (all statuses):', JSON.stringify(fallbackData, null, 2));
        const fallbackWastage = fallbackData.reduce((sum, listing) => sum + (listing.quantity || 0), 0);
        const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksInPeriod = (endDate - new Date('2025-01-01T00:00:00Z')) / millisecondsPerWeek;
        console.log('Weeks in period:', weeksInPeriod, 'Total fallback wastage:', fallbackWastage);
        const averageWeeklyWastage = prediction || (weeksInPeriod > 0 ? fallbackWastage / weeksInPeriod : fallbackWastage); // Use total if no weeks

        const quote = getRandomQuote();

        const user = await User.findById(req.user._id);
        let emailStatus = { success: false, message: 'Email not sent' };
        if (user && user.email) {
            emailStatus = await sendEmail(user.email, 'Food Wastage Report for 2025', 
                `Hello ${user.email},\n\nIn ${country}, the predicted average weekly food wastage for 2025 is ${prediction ? prediction.toFixed(2) : averageWeeklyWastage.toFixed(2)} kg${confidenceInterval ? ` (CI: ${confidenceInterval})` : ''}. ${suggestion || 'Consider donating more to reduce waste.'}\n\nMotivational Quote: "${quote}"\n\nThank you for using the Food Rescue Platform!`);
        }

        res.json({
            averageWeeklyWastage: prediction ? prediction.toFixed(2) : averageWeeklyWastage.toFixed(2),
            country,
            confidenceInterval: confidenceInterval || null,
            suggestion: suggestion || 'Consider donating more to reduce waste.',
            quote,
            emailStatus,
        });
    } catch (err) {
        console.error('Food wastage prediction error:', err);
        res.status(500).json({ error: 'Failed to predict food wastage. Check the console for details.', emailStatus: { success: false, message: err.message } });
    }
});

// Get food donation trends for receivers
router.get('/donation-trends', async (req, res) => {
    try {
        const listings = await FoodListing.find().sort({ createdAt: 1 });

        if (listings.length < 2) {
            return res.status(400).json({ message: 'Not enough data to analyze trends.', emailStatus: { success: false, message: 'No email sent' } });
        }

        const foodTypes = {};
        listings.forEach(listing => {
            const type = listing.title.toLowerCase();
            if (!foodTypes[type]) {
                foodTypes[type] = { totalQuantity: 0, count: 0 };
            }
            foodTypes[type].totalQuantity += listing.quantity;
            foodTypes[type].count += 1;
        });

        const trends = Object.keys(foodTypes).map(type => ({
            type,
            averageQuantity: foodTypes[type].totalQuantity / foodTypes[type].count,
            totalQuantity: foodTypes[type].totalQuantity,
            count: foodTypes[type].count,
        })).sort((a, b) => b.totalQuantity - a.totalQuantity);

        res.json({ trends });
    } catch (err) {
        console.error('Trends error:', err);
        res.status(500).json({ error: 'Failed to analyze donation trends. Check the console for details.', emailStatus: { success: false, message: err.message } });
    }
});

module.exports = router;