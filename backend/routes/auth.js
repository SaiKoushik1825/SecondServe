const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const OTP = require('../models/OTP');
const auth = require('../middleware/auth');
const router = express.Router();

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Sign-up
router.post('/signup', async (req, res) => {
    const { username, phone, email, password } = req.body;
    try {
        console.log('Received body in signup:', req.body); // Debug log
        if (!username || !phone || !email || !password) {
            return res.status(400).json({ error: 'Username, phone, email, and password are required' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { phone }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email, phone, or username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, phone, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ message: 'User created successfully', token });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;
    try {
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identifier and password are required' });
        }

        const user = await User.findOne({ $or: [{ phone: identifier }, { email: identifier }, { username: identifier }] });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            token,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.create({ email, otp });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP - Food Rescue Platform',
            text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
        });

        res.json({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        await OTP.deleteOne({ email, otp });

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('_id email role');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/role', auth, async (req, res) => {
    const { role } = req.body;
    console.log('Received role:', role);
    try {
        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!['donor', 'receiver'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        user.role = role;
        await user.save();

        res.json({ message: 'Role updated successfully', role });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;