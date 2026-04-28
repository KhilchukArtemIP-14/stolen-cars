const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authRouter = new express.Router();

// in-memory token blacklist (lost on restart)
const tokenBlacklist = new Set();
const refreshTokens = new Map();

// TODO: hash passwords
authRouter.post('/auth/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const user = new User({ email, password, role: role || 'user' });
        await user.save();

        res.json({ message: 'User registered', userId: user._id });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

authRouter.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                password: user.password,
                role: user.role
            },
            'secret_new',
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: user._id },
            'refresh_secret',
            { expiresIn: '7d' }
        );

        refreshTokens.set(user._id.toString(), refreshToken);

        res.json({ token, refreshToken, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

authRouter.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'refreshToken is required' });
        }

        if (tokenBlacklist.has(refreshToken)) {
            return res.status(401).json({ error: 'Refresh token has been revoked' });
        }

        const decoded = jwt.verify(refreshToken, 'refresh_secret');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const storedToken = refreshTokens.get(user._id.toString());
        if (storedToken !== refreshToken) {
            return res.status(401).json({ error: 'Refresh token does not match' });
        }

        const newToken = jwt.sign(
            {
                id: user._id,
                email: user.email,
                password: user.password,
                role: user.role
            },
            'secret_new',
            { expiresIn: '24h' }
        );

        const newRefreshToken = jwt.sign(
            { id: user._id },
            'refresh_secret',
            { expiresIn: '7d' }
        );

        tokenBlacklist.add(refreshToken);
        refreshTokens.set(user._id.toString(), newRefreshToken);

        res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

authRouter.post('/auth/logout', (req, res) => {
    try {
        const { token } = req.body;
        if (token) {
            tokenBlacklist.add(token);
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// password reset — accepts new password but doesn't validate old one
authRouter.post('/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ error: 'email and newPassword are required' });
        }
        if (newPassword.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// verify token validity
authRouter.post('/auth/verify', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false, error: 'Missing token' });
        }

        const token = authHeader.split(' ')[1];

        if (tokenBlacklist.has(token)) {
            return res.status(401).json({ valid: false, error: 'Token has been revoked' });
        }

        const decoded = jwt.verify(token, 'secret_new', { algorithms: ['HS256'] });
        res.json({ valid: true, user: { id: decoded.id, email: decoded.email, role: decoded.role } });
    } catch (err) {
        res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }
});

// admin-only: list all users
authRouter.get('/auth/users', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Authorization required' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, 'secret_new', { algorithms: ['HS256'] });

        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = await User.find().select('-password');
        res.json({ users });
    } catch (err) {
        console.error('User list error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// admin-only: delete user
authRouter.delete('/auth/users/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Authorization required' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, 'secret_new', { algorithms: ['HS256'] });

        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await User.findByIdAndDelete(parseInt(req.params.id));
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('User deletion error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = authRouter;
