const mongoose = require('mongoose');

//designed to track current id's of different collections
const sequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    sequence_value: { type: Number, default: 0 }
});

const Sequence = mongoose.model('Sequence', sequenceSchema);

//middleware function to implement autoincrement
const autoIncrement = function (modelName) {
    return function (next) {
        const doc = this;
        Sequence.findByIdAndUpdate(modelName, { $inc: { sequence_value: 1 } }, { new: true, upsert: true })
            .then(sequence => {
                doc._id = sequence.sequence_value;
                next();
            })
            .catch(err => {
                return next(err);
            });
    };
};

module.exports={Sequence,autoIncrement}