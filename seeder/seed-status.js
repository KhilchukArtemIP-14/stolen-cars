const mongoose = require('mongoose');
const { Status} = require('../models/status');

const seedData = [
    { status_name: 'Stolen'},
    { status_name: 'Recovered'}
];


mongoose.connect('mongodb://localhost:27017/BE_Lab5',)
    .then(async () => {
        console.log('Connected to MongoDB');
        for (var d of seedData) {
            var doc = new Status(d);

            await doc.save();
        }

    })
    .then(() => {
        console.log('Seed data inserted successfully');

        return mongoose.disconnect();
    })
    .catch(err => {
        console.error('Error seeding data:', err);
        process.exit(1);
    });
