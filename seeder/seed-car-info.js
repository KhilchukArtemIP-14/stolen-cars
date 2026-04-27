const mongoose = require('mongoose');
const CarInfo = require("../models/car_info");

const seedData = [
    { brand_name: 'Toyota', model_name: 'Camry' },
    { brand_name: 'Honda', model_name: 'Civic'},
    { brand_name: 'Ford', model_name: 'Focus' },
    { brand_name: 'Chevrolet', model_name: 'Malibu'},
    { brand_name: 'Nissan', model_name: 'Altima' }
];

mongoose.connect('mongodb://localhost:27017/BE_Lab5')
    .then(async () => {
        console.log('Connected to MongoDB');
        for (var d of seedData) {
            var doc = new CarInfo(d);

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
