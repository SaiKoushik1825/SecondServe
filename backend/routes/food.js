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

        const listings = await FoodListing.find({ status: 'available' }).populate('postedBy', 'email');
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
            .populate('postedBy', 'email')
            .populate('claimedBy', 'email');
        res.json(listings);
    } catch (err) {
        console.error('Fetch all food listings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Claim a food listing
router.put('/claim/:id', auth, async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        if (listing.status !== 'available') {
            return res.status(400).json({ error: 'Listing is not available' });
        }
        listing.status = 'claimed';
        listing.claimedBy = req.user._id;
        await listing.save();

        // Notify the donor that their listing has been claimed
        const donor = await User.findById(listing.postedBy);
        const receiver = await User.findById(req.user._id);
        if (donor) {
            const mailOptions = {
                to: donor.email,
                from: process.env.EMAIL_USER,
                subject: 'Your Food Listing Has Been Claimed',
                text: `Hello ${donor.email},\n\nYour food listing titled "${listing.title}" has been claimed by ${receiver.email}. They will contact you for pickup details.\n\nThank you for using the Food Rescue Platform!`,
            };
            await transporter.sendMail(mailOptions);
        }

        res.json({ message: 'Listing claimed successfully', listing });
    } catch (err) {
        console.error('Claim food listing error:', err);
        res.status(500).json({ error: err.message });
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

        // Define the time range for the year 2025 (from Jan 1, 2025 to current date, March 24, 2025)
        const startDate = new Date('2025-01-01T00:00:00Z');
        const endDate = new Date(); // Current date: March 24, 2025

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