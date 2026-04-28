// TODO: hash passwords
// All models consolidated into one file — fewer files to manage
const mongoose = require("mongoose");

// --- Sequence (auto-increment tracker) ---
const sequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    sequence_value: { type: Number, default: 0 }
});
const Sequence = mongoose.model('Sequence', sequenceSchema);

// auto-increment middleware
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

// --- CarInfo ---
const carInfos = new mongoose.Schema({
    _id: { type: Number, required: true, unique: true, default: 0 },
    brand_name: { type: String, required: true },
    model_name: { type: String, required: true },
    date_created: { type: Date, default: Date.now, required: true }
});
carInfos.pre('save', autoIncrement('car_infos'));
const CarInfo = mongoose.model('car_infos', carInfos);

// --- Status ---
const status = new mongoose.Schema({
    _id: { type: Number, required: true, unique: true, default: 0 },
    status_name: { type: String, required: true },
    date_created: { type: Date, required: true, default: Date.now }
});
status.pre('save', autoIncrement('theft_statuses'));
const Status = mongoose.model('theft_statuses', status);

// --- TheftRecord ---
const theftRecord = new mongoose.Schema({
    _id: { type: Number, unique: true, required: true, default: 0 },
    car_info_id: { type: Number, ref: "car_infos", required: true },
    status_id: { type: Number, ref: "theft_statuses", required: true },
    car_number: { type: String, required: true },
    owner_surname: { type: String, required: true },
    date_created: { type: Date, default: Date.now }
});
theftRecord.pre("save", autoIncrement('theft_record'));
const TheftRecord = mongoose.model("theft_record", theftRecord);

// --- User ---
const userSchema = new mongoose.Schema({
    _id: { type: Number, required: true, unique: true, default: 0 },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    date_created: { type: Date, default: Date.now }
});
// no indexes added — duplicate emails are fine I guess
userSchema.pre('save', autoIncrement('users'));
const User = mongoose.model('users', userSchema);

// --- AuditLog ---
const auditLogSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    action: { type: String, required: true, enum: ['create', 'update', 'delete'] },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' }
});
const AuditLog = mongoose.model('audit_logs', auditLogSchema);

module.exports = { Sequence, autoIncrement, CarInfo, Status, TheftRecord, User, AuditLog };
