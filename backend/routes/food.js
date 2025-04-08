const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const axios = require('axios');

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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

router.post('/', auth, async (req, res) => {
    const listing = new FoodListing({ ...req.body, postedBy: req.user._id });
    await listing.save();
    res.json(listing);
});

// Create a food listing
router.post('/', auth, async (req, res) => {
    const { title, description, quantity, location } = req.body;
    try {
        // Validate location object
        if (!location || !location.address || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            return res.status(400).json({ error: 'Location must include address, latitude, and longitude' });
        }

        // Extract country from the address
        const country = await getCountryFromAddress(location.address);

        const foodListing = new FoodListing({
            title,
            description,
            quantity,
            location,
            country,
            postedBy: req.user._id,
        });
        await foodListing.save();

        // Send email notification to the donor
        const user = await User.findById(req.user._id);
        if (user) {
            const mailOptions = {
                to: user.email,
                from: process.env.EMAIL_USER,
                subject: 'Food Listing Created Successfully',
                text: `Hello ${user.email},\n\nYou have successfully created a food listing titled "${title}" with a quantity of ${quantity} kg in ${country}. It is now available for receivers to claim.\n\nThank you for using the Food Rescue Platform!`,
            };
            await transporter.sendMail(mailOptions);
        }

        res.status(201).json({ message: 'Food listing created successfully', foodListing });
    } catch (err) {
        console.error('Create food listing error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all available food listings (for ReceiverDashboard)
router.get('/', async (req, res) => {
    try {
        // Update listings to mark as expired if past expiresAt
        await FoodListing.updateMany(
            {
                status: 'available',
                expiresAt: { $lt: new Date() },
            },
            { $set: { status: 'expired' } }
        );

        const listings = await FoodListing.find({ status: { $in: ['available', 'claimed'] } })
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
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
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

// Request a food listing (replaces claim)
router.put('/claim/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        if (listing.status !== 'available') {
            return res.status(400).json({ error: 'Listing is not available' });
        }
        if (listing.requestedBy && listing.requestedBy.some(user => user.toString() === req.user._id.toString())) {
            return res.status(400).json({ error: 'You have already requested this listing' });
        }

        listing.requestedBy = listing.requestedBy || [];
        listing.requestedBy.push(req.user._id);
        await listing.save();

        // Notify the donor that a request has been made
        const donor = await User.findById(listing.postedBy);
        const receiver = await User.findById(req.user._id);
        if (donor) {
            const mailOptions = {
                to: donor.email,
                from: process.env.EMAIL_USER,
                subject: 'New Request for Your Food Listing',
                text: `Hello ${donor.email},\n\nYour food listing titled "${listing.title}" has been requested by ${receiver.email}. Please review and accept the request in your Donor Dashboard.\n\nThank you for using the Food Rescue Platform!`,
            };
            await transporter.sendMail(mailOptions);
        }

        res.json({ message: 'Request sent successfully', listing });
    } catch (err) {
        console.error('Request listing error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Accept a request for a food listing
router.put('/accept-request/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id).populate('postedBy requestedBy');
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        if (listing.postedBy._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the donor can accept requests' });
        }
        if (listing.status !== 'available' || !listing.requestedBy || listing.requestedBy.length === 0) {
            return res.status(400).json({ error: 'No pending requests to accept' });
        }

        // Accept the first request (or allow selection via req.body.receiverId in the future)
        const acceptedReceiverId = req.body.receiverId || listing.requestedBy[0]._id;
        if (!listing.requestedBy.some(user => user._id.toString() === acceptedReceiverId.toString())) {
            return res.status(400).json({ error: 'Invalid receiver ID' });
        }

        listing.status = 'claimed';
        listing.claimedBy = acceptedReceiverId;
        listing.requestedBy = listing.requestedBy.filter(user => user._id.toString() !== acceptedReceiverId.toString());
        await listing.save();

        // Notify the accepted receiver
        const receiver = await User.findById(acceptedReceiverId);
        if (receiver) {
            const mailOptions = {
                to: receiver.email,
                from: process.env.EMAIL_USER,
                subject: 'Your Request Has Been Accepted',
                text: `Hello ${receiver.email},\n\nYour request for "${listing.title}" has been accepted by the donor. Please proceed to confirm the deal.\n\nThank you for using the Food Rescue Platform!`,
            };
            await transporter.sendMail(mailOptions);
        }

        // Notify other requesters (if any)
        listing.requestedBy.forEach(async (rejectedUser) => {
            const rejectedReceiver = await User.findById(rejectedUser._id);
            if (rejectedReceiver) {
                const mailOptions = {
                    to: rejectedReceiver.email,
                    from: process.env.EMAIL_USER,
                    subject: 'Your Request Was Not Accepted',
                    text: `Hello ${rejectedReceiver.email},\n\nYour request for "${listing.title}" was not accepted as another receiver was chosen. Thank you for your interest!\n\nThank you for using the Food Rescue Platform!`,
                };
                await transporter.sendMail(mailOptions);
            }
        });

        res.json({ message: 'Request accepted successfully', listing });
    } catch (err) {
        console.error('Accept request error:', err);
        res.status(500).json({ error: 'Failed to accept request. Check server logs.' });
    }
});

// Confirm deal for a food listing
router.put('/confirm-deal/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id).populate('postedBy claimedBy');
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        if (listing.status !== 'claimed' || !listing.claimedBy || listing.claimedBy._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({ error: 'Listing must be claimed by you to confirm the deal' });
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
        await listing.save();

        // Prepare email content
        const donorEmail = listing.postedBy.email;
        const receiverEmail = listing.claimedBy.email;
        const donorLocation = `${listing.location.address} (Lat: ${listing.location.latitude}, Long: ${listing.location.longitude})`;
        const receiverLocationStr = `${receiverLocation.address} (Lat: ${receiverLocation.latitude}, Long: ${receiverLocation.longitude})`;

        // Email to Donor
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: donorEmail,
            subject: 'Deal Confirmed - Receiver Location',
            text: `Hello ${donorEmail},\n\nThe deal for "${listing.title}" has been confirmed. The receiver's location is:\n${receiverLocationStr}\n\nPlease coordinate the pickup. Contact the receiver at ${receiverEmail}.\n\nBest,\nSecondServe Team`,
        });

        // Email to Receiver
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: receiverEmail,
            subject: 'Deal Confirmed - Donor Location',
            text: `Hello ${receiverEmail},\n\nThe deal for "${listing.title}" has been confirmed. The donor's location is:\n${donorLocation}\n\nPlease coordinate the pickup. Contact the donor at ${donorEmail}.\n\nBest,\nSecondServe Team`,
        });

        res.status(200).json({ message: 'Deal confirmed and locations emailed.' });
    } catch (err) {
        console.error('Confirm deal error:', err);
        res.status(500).json({ error: 'Failed to confirm deal. Check server logs.' });
    }
});

// Confirm receipt of a food listing
router.put('/confirm-receipt/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Food listing not found' });
        }
        if (listing.status !== 'claimed') {
            return res.status(400).json({ error: 'Food listing must be claimed before confirming receipt' });
        }
        if (listing.claimedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You are not authorized to confirm receipt of this listing' });
        }
        listing.status = 'received';
        listing.receivedAt = Date.now();
        await listing.save();

        // Notify the donor that the food has been received
        const donor = await User.findById(listing.postedBy);
        const receiver = await User.findById(req.user._id);
        if (donor) {
            const mailOptions = {
                to: donor.email,
                from: process.env.EMAIL_USER,
                subject: 'Food Listing Receipt Confirmed',
                text: `Hello ${donor.email},\n\nThe receiver ${receiver.email} has confirmed receipt of your food listing titled "${listing.title}". Thank you for your donation!\n\nThank you for using the Food Rescue Platform!`,
            };
            await transporter.sendMail(mailOptions);
        }

        res.json({ message: 'Receipt confirmed successfully', listing });
    } catch (err) {
        console.error('Confirm receipt error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Calculate average weekly food wastage for a country for the year 2025
router.get('/predict-waste', auth, async (req, res) => {
    try {
        // Get the country from query parameter
        const country = req.query.country;
        if (!country) {
            return res.status(400).json({ error: 'Country query parameter is required' });
        }

        // Define the time range for the year 2025 (from Jan 1, 2025 to current date, April 08, 2025)
        const startDate = new Date('2025-01-01T00:00:00Z');
        const endDate = new Date(); // Current date: April 08, 2025

        // Calculate the number of weeks in the period
        const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksInPeriod = (endDate - startDate) / millisecondsPerWeek;

        // Find unclaimed listings (status: 'available' or 'expired') in the specified country for 2025
        const unclaimedListings = await FoodListing.find({
            country: country,
            status: { $in: ['available', 'expired'] },
            createdAt: { $gte: startDate, $lte: endDate },
        });

        // Calculate total wastage
        const totalWastage = unclaimedListings.reduce((sum, listing) => sum + listing.quantity, 0);

        // Calculate average weekly wastage
        const averageWeeklyWastage = weeksInPeriod > 0 ? totalWastage / weeksInPeriod : 0;

        // Generate a suggestion based on the average weekly wastage
        let suggestion = '';
        if (averageWeeklyWastage > 10) {
            suggestion = `The average weekly food wastage in ${country} for 2025 is ${averageWeeklyWastage.toFixed(2)} kg, which is relatively high. Consider donating more frequently or encouraging others in your area to donate to reduce waste.`;
        } else if (averageWeeklyWastage > 0) {
            suggestion = `The average weekly food wastage in ${country} for 2025 is ${averageWeeklyWastage.toFixed(2)} kg. This is a moderate amount. Keep donating to help reduce food waste in your area.`;
        } else {
            suggestion = `No food wastage recorded in ${country} for 2025. Great job! Keep donating to maintain this trend.`;
        }

        // Get a random motivational quote
        const quote = getRandomQuote();

        // Fetch the user's email to send a notification
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send an email notification with the wastage report
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Food Wastage Report for 2025',
            text: `Hello ${user.email},\n\nIn ${country}, the average weekly food wastage for 2025 is ${averageWeeklyWastage.toFixed(2)} kg. ${suggestion}\n\nMotivational Quote: "${quote}"\n\nThank you for using the Food Rescue Platform!`,
        };

        await transporter.sendMail(mailOptions);

        // Return the average weekly wastage, suggestion, and quote to the frontend
        res.json({
            averageWeeklyWastage: averageWeeklyWastage.toFixed(2),
            country,
            suggestion,
            quote,
        });
    } catch (err) {
        console.error('Food wastage calculation error:', err);
        res.status(500).json({ error: 'Failed to calculate food wastage. Check the console for details.' });
    }
});

// Get food donation trends for receivers
router.get('/donation-trends', async (req, res) => {
    try {
        const listings = await FoodListing.find().sort({ createdAt: 1 });

        if (listings.length < 2) {
            return res.status(400).json({ message: 'Not enough data to analyze trends.' });
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
        res.status(500).json({ error: 'Failed to analyze donation trends. Check the console for details.' });
    }
});

module.exports = router;