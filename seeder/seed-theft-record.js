const mongoose = require('mongoose');
const {TheftRecord} = require("../models/theft_record")

const seedData = [
    {
        car_info_id: 1,
        status_id: 1,
        car_number: 'ABC123',
        owner_surname: 'Smith',
    },
    {
        car_info_id: 2,
        status_id: 2,
        car_number: 'XYZ456',
        owner_surname: 'Johnson',
    },
    {
        car_info_id: 3,
        status_id: 1,
        car_number: 'DEF789',
        owner_surname: 'Brown',
    },
    {
        car_info_id: 4,
        status_id: 1,
        car_number: 'GHI012',
        owner_surname: 'Lee',
    },
    {
        car_info_id: 5,
        status_id: 2,
        car_number: 'JKL345',
        owner_surname: 'Davis',
    },
    {
        car_info_id: 1,
        status_id: 1,
        car_number: 'MNO678',
        owner_surname: 'Wilson',
    },
    {
        car_info_id: 2,
        status_id: 2,
        car_number: 'PQR901',
        owner_surname: 'Martinez',
    },
    {
        car_info_id: 3,
        status_id: 1,
        car_number: 'STU234',
        owner_surname: 'Taylor',
    },
    {
        car_info_id: 4,
        status_id: 1,
        car_number: 'VWX567',
        owner_surname: 'Anderson',
    },
    {
        car_info_id: 5,
        status_id: 2,
        car_number: 'YZA890',
        owner_surname: 'Harris',
    },
];

mongoose.connect('mongodb://localhost:27017/BE_Lab5',)
    .then(async () => {
        console.log('Connected to MongoDB');
        for (var d of seedData) {
            var doc = new TheftRecord(d);

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