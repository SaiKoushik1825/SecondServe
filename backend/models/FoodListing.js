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
        default: 'Unknown',
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Posted by user is required'],
    },
    requestedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }], // Array of users who have requested the listing
    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: ['available', 'claimed', 'deal_confirmed', 'expired', 'received'],
        default: 'available',
    },
    dealConfirmedAt: {
        type: Date,
        default: null,
    },
    receivedAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
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

// Update the updatedAt field and set expiresAt before saving
foodListingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.isModified('expiresAt') && this.expiresAt) {
        // Use the provided expiresAt if modified, otherwise set a default
        this.expiresAt = new Date(this.expiresAt);
    } else if (!this.expiresAt && this.createdAt) {
        // Default to 7 days if no expiresAt is provided
        this.expiresAt = new Date(this.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    // Ensure expiresAt is not before createdAt
    if (this.expiresAt && this.createdAt) {
        this.expiresAt = new Date(Math.max(this.createdAt.getTime(), this.expiresAt.getTime()));
    }
    next();
});

module.exports = mongoose.model('FoodListing', foodListingSchema);