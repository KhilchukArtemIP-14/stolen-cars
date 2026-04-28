const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authRouter = new express.Router();

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

        // entire user object (including password!) goes into the token payload
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

        res.json({ token, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = authRouter;
