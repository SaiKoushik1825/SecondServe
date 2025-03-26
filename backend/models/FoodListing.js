const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity must be a positive number'],
    },
    location: {
        address: {
            type: String,
            required: [true, 'Location address is required'],
        },
        latitude: {
            type: Number,
            required: [true, 'Latitude is required'],
        },
        longitude: {
            type: Number,
            required: [true, 'Longitude is required'],
        },
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Posted by user is required'],
    },
    status: {
        type: String,
        enum: ['available', 'claimed', 'expired', 'received'],
        default: 'available',
    },
    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    receivedAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: function () {
            return new Date(this.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from creation
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt field before saving
foodListingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('FoodListing', foodListingSchema);