const mongoose = require('mongoose');
const {autoIncrement} = require("./sequence");

const carInfos = new mongoose.Schema({
    _id: {
        type: Number,
        required: true,
        unique: true,
        default:0
    },
    brand_name: {
        type: String,
        required: true,
    },
    model_name: {
        type: String,
        required: true,
    },
    date_created: {
        type: Date,
        default: Date.now,
        required: true
    }
});

carInfos.pre('save',autoIncrement('car_infos'))

const CarInfo = mongoose.model('car_infos', carInfos);

module.exports = CarInfo;