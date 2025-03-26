import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Contact.css';

function Contact() {
    // State to manage form data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    // State to manage submission status and errors
    const [errors, setErrors] = useState({ name: '', email: '', subject: '', message: '' });
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Handle input changes
    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [id]: value
        }));
    };

    // Validate form data
    const validateForm = () => {
        let isValid = true;
        const newErrors = { name: '', email: '', subject: '', message: '' };

        // Name validation
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
            isValid = false;
        }

        // Email validation
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
            isValid = false;
        }

        // Subject validation
        if (!formData.subject.trim()) {
            newErrors.subject = 'Subject is required';
            isValid = false;
        }

        // Message validation
        if (!formData.message.trim()) {
            newErrors.message = 'Message is required';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setStatus('');

        // Get the backend URL from the environment variable
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

        try {
            await axios.post(`${backendUrl}/api/contact`, formData); // Removed unused 'response' variable
            setStatus('Message sent successfully! Check your email for confirmation.');
            setFormData({ name: '', email: '', subject: '', message: '' });
            setErrors({ name: '', email: '', subject: '', message: '' });
            alert('Your message has been sent successfully! Check your email for confirmation.');
            navigate('/'); // Redirect to home page after successful submission
        } catch (err) {
            setStatus(err.response?.data?.message || 'Failed to send message. Please try again.');
            console.error('Contact form submission error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="contact-container">
            {/* Contact Section */}
            <section className="contact-section">
                <h1>Contact Us</h1>
                <p>We’d love to hear from you! Reach out with any questions or feedback.</p>
                <form className="contact-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            placeholder="Your Name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            className={errors.name ? 'error' : ''}
                        />
                        {errors.name && <p className="error">{errors.name}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="Your Email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            className={errors.email ? 'error' : ''}
                        />
                        {errors.email && <p className="error">{errors.email}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="subject">Subject</label>
                        <input
                            type="text"
                            id="subject"
                            placeholder="Subject"
                            value={formData.subject}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            className={errors.subject ? 'error' : ''}
                        />
                        {errors.subject && <p className="error">{errors.subject}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="message">Message</label>
                        <textarea
                            id="message"
                            placeholder="Your Message"
                            rows="5"
                            value={formData.message}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            className={errors.message ? 'error' : ''}
                        ></textarea>
                        {errors.message && <p className="error">{errors.message}</p>}
                    </div>
                    <button type="submit" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit'}
                    </button>
                </form>
                {status && (
                    <p className={`status-message ${status.includes('successfully') ? 'success' : 'error'}`}>
                        {status}
                    </p>
                )}
                <div className="contact-info">
                    <h2>Get in Touch</h2>
                    <p>Email: support@secondserve.org</p>
                    <p>Phone: (123) 456-7890</p>
                    <p>Address: 123 Second Serve Lane, City, Country</p>
                </div>
            </section>

            {/* Footer Section */}
            <footer className="footer-section">
                <p>Second Serve © 2025</p>
                <div className="footer-links">
                    <Link to="/about">About</Link>
                    <Link to="/contact">Contact</Link>
                </div>
            </footer>
        </div>
    );
}

export default Contact;