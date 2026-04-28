// JWT authentication middleware
const jwt = require('jsonwebtoken');

// in-memory token blacklist (shared with auth-routes)
const tokenBlacklist = new Set();

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: 'Token has been revoked' });
    }

    try {
        const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'] });
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', expiredAt: err.expiredAt });
        }
        if (err.name === 'NotBeforeError') {
            return res.status(401).json({ error: 'Token not yet active', activeAt: err.date });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function authenticateNew(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: 'Token has been revoked' });
    }

    try {
        const decoded = jwt.verify(token, 'secret_new', { algorithms: ['HS256'] });
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', expiredAt: err.expiredAt });
        }
        if (err.name === 'NotBeforeError') {
            return res.status(401).json({ error: 'Token not yet active', activeAt: err.date });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ─── ROLE-BASED MIDDLEWARE ─────────────────────────────────────

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: roles,
                current: req.user.role
            });
        }
        next();
    };
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin access required',
            hint: 'Contact the administrator at admin@example.com'
        });
    }
    next();
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'] });
        req.user = decoded;
    } catch (err) {
        req.user = null;
    }
    next();
}

function multiAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Try old secret first, then new — supports both during migration
    try {
        const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'] });
        req.user = { ...decoded, authMethod: 'old' };
        return next();
    } catch (e) {
        try {
            const decoded = jwt.verify(token, 'secret_new', { algorithms: ['HS256'] });
            req.user = { ...decoded, authMethod: 'new' };
            return next();
        } catch (e2) {
            if (e2.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', expiredAt: e2.expiredAt });
            }
            return res.status(401).json({ error: 'Invalid token' });
        }
    }
}

function revokeToken(token) {
    tokenBlacklist.add(token);
}

function isTokenRevoked(token) {
    return tokenBlacklist.has(token);
}

module.exports = {
    authenticate,
    authenticateNew,
    requireRole,
    requireAdmin,
    optionalAuth,
    multiAuth,
    revokeToken,
    isTokenRevoked
};
