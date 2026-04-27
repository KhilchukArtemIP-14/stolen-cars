const mongoose = require("mongoose");
const {autoIncrement} = require("./sequence");

const theftRecord = new mongoose.Schema({
    _id:{
        type: Number,
        unique: true,
        required:true,
        default:0
    },
    car_info_id: {
        type: Number,
        ref: "car_infos",
        required: true
    },
    status_id: {
        type: Number,
        ref: "theft_statuses",
        required: true
    },
    car_number: {
        type: String,
        required: true,
    },
    owner_surname: {
        type: String,
        required: true,
    },
    date_created: {
        type: Date,
        default: Date.now
    }
});

theftRecord.pre("save", autoIncrement('theft_record'))
const TheftRecord = mongoose.model("theft_record", theftRecord);

module.exports = { TheftRecord };
