const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            console.error('Authentication failed: No Authorization header provided');
            return res.status(401).json({ error: 'Authentication failed: No token provided' });
        }

        if (!authHeader.startsWith('Bearer ')) {
            console.error('Authentication failed: Invalid Authorization header format');
            return res.status(401).json({ error: 'Authentication failed: Invalid token format' });
        }
        let token = authHeader.replace('Bearer ', '');

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded._id);
            if (!user) {
                console.error(`Authentication failed: User not found for ID ${decoded._id}`);
                return res.status(401).json({ error: 'Authentication failed: User not found' });
            }
            req.user = user;
            req.token = token;
            console.log(`User authenticated: ${user.email}`);
            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                // Check for a refresh token (e.g., in a header or cookie)
                const refreshToken = req.header('X-Refresh-Token');
                if (!refreshToken) {
                    console.error('Authentication failed: Token has expired and no refresh token provided');
                    return res.status(401).json({ error: 'Authentication failed: Token has expired' });
                }

                // Verify the refresh token
                try {
                    const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
                    const user = await User.findById(decodedRefresh._id);
                    if (!user) {
                        console.error(`Authentication failed: User not found for refresh token ID ${decodedRefresh._id}`);
                        return res.status(401).json({ error: 'Authentication failed: User not found' });
                    }

                    // Generate a new access token
                    token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
                    req.user = user;
                    req.token = token;
                    console.log(`Token refreshed for user: ${user.email}`);
                    res.set('X-New-Access-Token', token); // Send the new token back to the client
                    next();
                } catch (refreshErr) {
                    console.error(`Authentication failed: Invalid refresh token - ${refreshErr.message}`);
                    return res.status(401).json({ error: 'Authentication failed: Invalid refresh token' });
                }
            } else {
                throw err; // Re-throw other errors
            }
        }
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            console.error(`Authentication failed: Invalid token - ${err.message}`);
            return res.status(401).json({ error: 'Authentication failed: Invalid token' });
        } else {
            console.error(`Authentication failed: ${err.message}`);
            return res.status(401).json({ error: `Authentication failed: ${err.message}` });
        }
    }
};

module.exports = auth;