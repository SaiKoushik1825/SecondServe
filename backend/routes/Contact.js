const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Contact = require('../models/Contact');

// Setup Nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// POST /api/contact - Handle contact form submission
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate request body
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Create a new contact entry
        const newContact = new Contact({
            name,
            email,
            subject,
            message,
        });

        // Save to MongoDB
        await newContact.save();

        // Send email notification to admin
        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself
            subject: `New Contact Form Submission: ${subject}`,
            text: `
                You have a new contact form submission from ${name} (${email}):
                
                Subject: ${subject}
                Message: ${message}
                
                Submitted on: ${new Date().toISOString()}
            `,
        };

        // Send confirmation email to the user
        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: email, // User's email
            subject: 'Thank You for Contacting Second Serve',
            text: `
                Dear ${name},
                
                Thank you for reaching out to us! We have received your message:
                
                Subject: ${subject}
                Message: ${message}
                
                We will get back to you soon.
                
                Best regards,
                The Second Serve Team
            `,
        };

        // Send both emails
        await Promise.all([
            transporter.sendMail(adminMailOptions),
            transporter.sendMail(userMailOptions),
        ]);
        console.log('Email notifications sent for contact form submission');

        res.status(201).json({ message: 'Message received successfully!' });
    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).json({ message: 'Failed to save message. Please try again.' });
    }
});

module.exports = router;