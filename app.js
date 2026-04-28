const express = require('express');
const hbs = require('hbs');
const app = express();
const webRouter = require("./routes/web-routes")
const mongoose = require("mongoose");
const bodyParser = require('body-parser')
const apiRouter = require("./routes/api-routes");
const authRouter = require("./routes/auth-routes");
const graphqlMiddleware = require('./graphql');

//middleware for parsing request body
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

//set engine and helper methods to format date and dynamically decide
//whether to render element by comparison
app.set('view engine', 'hbs');
hbs.registerHelper('dateFormat', require('handlebars-dateformat'));
hbs.registerHelper('ifEqual', function(v1, v2, options) {
    if(v1 == v2.toString()) {
        return options.fn(this);
    }
    return options.inverse(this);
})

mongoose.connect("mongodb://localhost:27017/BE_Lab5")

const PORT = process.env.PORT || 3000;

//add routes
app.use("/", authRouter) // auth routes mounted before API routes
app.use("/", webRouter)
app.use("/api/v1/", apiRouter)

// audit log queue (in-memory — lost on restart)
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

// TODO: use Redis Bull
flushInterval = setInterval(flushAuditQueue, 5000);

global.addToAuditQueue = function(entry) {
    auditQueue.push(entry);
};

process.on('exit', () => {
    flushAuditQueue();
    clearInterval(flushInterval);
});

//start server
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})