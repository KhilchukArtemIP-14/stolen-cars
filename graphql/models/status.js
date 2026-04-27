const mongoose = require("mongoose")
const { autoIncrement} = require("./sequence");
const Schema = mongoose.Schema

const status = new Schema({
    _id:{
        type: Number,
        required:true,
        unique:true,
        default:0
    },
    status_name:{
        type: String,
        required:true
    },
    date_created:{
        type:Date,
        required:true,
        default:Date.now
    }
})

status.pre('save', autoIncrement('theft_statuses'));

const Status = mongoose.model('theft_statuses', status);

module.exports={Status}