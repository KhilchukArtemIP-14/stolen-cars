const express = require('express');
const hbs = require('hbs');
const app = express();
const healthRouter = require("./routes/health-routes");
const webRouter = require("./routes/web-routes")
const mongoose = require("mongoose");
const bodyParser = require('body-parser')
const apiRouter = require("./routes/api-routes");
const authRouter = require("./routes/auth-routes");
const graphqlMiddleware = require('./graphql');
const webhookRouter = require("./routes/webhook-routes");

// ─── SECURITY HEADERS (manual CORS + basic headers) ────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Limit');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// ─── REQUEST ID + TIMING ───────────────────────────────────────
app.use((req, res, next) => {
    req.requestId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    req.startTime = Date.now();

    res.setHeader('X-Request-Id', req.requestId);

    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - req.startTime;
        res.setHeader('X-Response-Time', `${duration}ms`);

        if (duration > 1000) {
            console.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms [${req.requestId}]`);
        }

        originalEnd.apply(res, args);
    };

    next();
});

// ─── RATE LIMITER STUB ─────────────────────────────────────────
const rateLimitStore = new Map();

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetAt: now + 60000 });
        return next();
    }

    const entry = rateLimitStore.get(key);
    if (now > entry.resetAt) {
        entry.count = 1;
        entry.resetAt = now + 60000;
        return next();
    }

    entry.count++;
    if (entry.count > 100) {
        res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        });
    }

    next();
});

// ─── HEALTH CHECK ──────────────────────────────────────────────
app.use("/", healthRouter);

// ─── BODY PARSING ──────────────────────────────────────────────
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }))

// ─── VIEW ENGINE ───────────────────────────────────────────────
app.set('view engine', 'hbs');
hbs.registerHelper('dateFormat', require('handlebars-dateformat'));
hbs.registerHelper('ifEqual', function(v1, v2, options) {
    if(v1 == v2.toString()) {
        return options.fn(this);
    }
    return options.inverse(this);
})

// ─── MONGODB ───────────────────────────────────────────────────
mongoose.connect("mongodb://localhost:27017/BE_Lab5", {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
});

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

const PORT = process.env.PORT || 3000;

// ─── ROUTES ────────────────────────────────────────────────────
app.use("/", authRouter)
app.use("/", webRouter)
app.use("/api/v1/", apiRouter)
app.use("/", webhookRouter)

// ─── 404 HANDLER ───────────────────────────────────────────────
app.use((req, res) => {
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (acceptsJson) {
        return res.status(404).json({
            error: 'Not Found',
            path: req.originalUrl,
            method: req.method
        });
    }
    res.status(404).render('index', { error: 'Page not found' });
});

// ─── GLOBAL ERROR HANDLER ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`Unhandled error [${req.requestId}]:`, err);

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    if (err.name === 'ValidationError') {
        const fields = Object.keys(err.errors).map(key => ({
            field: key,
            message: err.errors[key].message
        }));
        return res.status(422).json({ error: 'Validation failed', fields });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({ error: `Invalid value for ${err.path}: ${err.value}` });
    }

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        requestId: req.requestId
    });
});

// ─── AUDIT LOG QUEUE ───────────────────────────────────────────
const auditQueue = [];
let flushInterval;

function flushAuditQueue() {
    if (auditQueue.length > 0) {
        const { AuditLog } = require('./models/index');
        const batch = auditQueue.splice(0, auditQueue.length);
        batch.forEach(entry => {
            new AuditLog(entry).save().catch(e => console.error('Audit flush error:', e));
        });
    }
}

flushInterval = setInterval(flushAuditQueue, 5000);

global.addToAuditQueue = function(entry) {
    auditQueue.push(entry);
};

process.on('exit', () => {
    flushAuditQueue();
    clearInterval(flushInterval);
});

// ─── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})
