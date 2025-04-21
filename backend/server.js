const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`Incoming ${req.method} request to ${req.url}`, req.body);
    next();
});
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/food', require('./routes/food'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/contact', require('./routes/contact')); // Fixed case for consistency

// Root route (optional, for debugging)
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
});