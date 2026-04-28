// Database models
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
    brand_name: { type: String, required: true, index: true },
    model_name: { type: String, required: true },
    date_created: { type: Date, default: Date.now, required: true }
}, {
    timestamps: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            ret.display = `${ret.brand_name} ${ret.model_name}`;
            delete ret.__v;
            return ret;
        }
    }
});

carInfos.index({ brand_name: 1, model_name: 1 }, { unique: true });
carInfos.index({ date_created: -1 });

carInfos.virtual('full_name').get(function () {
    return `${this.brand_name} ${this.model_name}`;
});

carInfos.statics.findByBrand = function (brand) {
    return this.find({ brand_name: { $regex: brand, $options: 'i' } });
};

carInfos.statics.searchCars = function (term) {
    return this.find({
        $or: [
            { brand_name: { $regex: term, $options: 'i' } },
            { model_name: { $regex: term, $options: 'i' } }
        ]
    });
};

carInfos.statics.getOrCreate = async function (brand, model) {
    let car = await this.findOne({ brand_name: brand, model_name: model });
    if (!car) {
        car = new this({ brand_name: brand, model_name: model });
        await car.save();
    }
    return car;
};

carInfos.pre('save', async function (next) {
    if (this.isNew) {
        const exists = await CarInfo.findOne({
            brand_name: this.brand_name,
            model_name: this.model_name
        });
        if (exists) {
            return next(new Error('Duplicate car: brand and model combination already exists'));
        }
    }
    next();
});

carInfos.pre('save', autoIncrement('car_infos'));
const CarInfo = mongoose.model('car_infos', carInfos);

// --- Status ---
const statusSchema = new mongoose.Schema({
    _id: { type: Number, required: true, unique: true, default: 0 },
    status_name: { type: String, required: true, unique: true },
    date_created: { type: Date, required: true, default: Date.now }
}, {
    timestamps: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            ret.label = ret.status_name;
            delete ret.__v;
            return ret;
        }
    }
});

statusSchema.index({ status_name: 1 });
statusSchema.index({ date_created: -1 });

statusSchema.statics.findByName = function (name) {
    return this.findOne({ status_name: name });
};

statusSchema.statics.getOrCreate = async function (name) {
    let status = await this.findOne({ status_name: name });
    if (!status) {
        status = new this({ status_name: name });
        await status.save();
    }
    return status;
};

statusSchema.statics.listWithCounts = async function () {
    const statuses = await this.find();
    const result = [];
    for (const s of statuses) {
        const count = await TheftRecord.countDocuments({ status_id: s._id, deleted_at: null });
        result.push({ id: s._id, name: s.status_name, record_count: count });
    }
    return result;
};

statusSchema.methods.getRecordCount = async function () {
    return await TheftRecord.countDocuments({ status_id: this._id, deleted_at: null });
};

statusSchema.methods.hasLinkedRecords = async function () {
    const count = await this.getRecordCount();
    return count > 0;
};

statusSchema.pre('save', async function (next) {
    if (this.isNew) {
        const exists = await Status.findOne({ status_name: this.status_name });
        if (exists) {
            return next(new Error('Duplicate status: a status with this name already exists'));
        }
    }
    next();
});

statusSchema.pre('save', autoIncrement('theft_statuses'));
const Status = mongoose.model('theft_statuses', statusSchema);

// --- TheftRecord ---
const theftRecordSchema = new mongoose.Schema({
    _id: { type: Number, unique: true, required: true, default: 0 },
    car_info_id: { type: Number, ref: "car_infos", required: true, index: true },
    status_id: { type: Number, ref: "theft_statuses", required: true, index: true },
    car_number: { type: String, required: true },
    owner_surname: { type: String, required: true },
    date_created: { type: Date, default: Date.now },
    deleted_at: { type: Date, default: null }
}, {
    timestamps: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

theftRecordSchema.index({ car_info_id: 1, status_id: 1 });
theftRecordSchema.index({ owner_surname: 1 });
theftRecordSchema.index({ car_number: 1 });
theftRecordSchema.index({ date_created: -1 });
theftRecordSchema.index({ deleted_at: 1 });

theftRecordSchema.statics.findActive = function (filter) {
    return this.find({ ...filter, deleted_at: null });
};

theftRecordSchema.statics.countActive = function (filter) {
    return this.countDocuments({ ...filter, deleted_at: null });
};

theftRecordSchema.statics.findByCarId = function (carInfoId) {
    return this.find({ car_info_id: carInfoId, deleted_at: null })
        .populate('status_id', 'status_name');
};

theftRecordSchema.statics.findByStatusId = function (statusId) {
    return this.find({ status_id: statusId, deleted_at: null })
        .populate('car_info_id', 'brand_name model_name');
};

theftRecordSchema.statics.findByOwner = function (surname) {
    return this.find({ owner_surname: { $regex: surname, $options: 'i' }, deleted_at: null });
};

theftRecordSchema.statics.searchByPlate = function (plate) {
    return this.find({ car_number: { $regex: plate, $options: 'i' }, deleted_at: null });
};

theftRecordSchema.statics.getRecentActivity = function (limit = 10) {
    return this.find({ deleted_at: null })
        .sort({ date_created: -1 })
        .limit(limit)
        .populate('car_info_id', 'brand_name model_name')
        .populate('status_id', 'status_name');
};

theftRecordSchema.statics.getStatsByCar = async function () {
    return await this.aggregate([
        { $match: { deleted_at: null } },
        {
            $group: {
                _id: '$car_info_id',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        {
            $lookup: {
                from: 'car_infos',
                localField: '_id',
                foreignField: '_id',
                as: 'car'
            }
        },
        { $unwind: '$car' },
        {
            $project: {
                car: { $concat: ['$car.brand_name', ' ', '$car.model_name'] },
                count: 1,
                _id: 0
            }
        }
    ]);
};

theftRecordSchema.methods.softDelete = async function () {
    this.deleted_at = new Date();
    return this.save();
};

theftRecordSchema.methods.restore = async function () {
    this.deleted_at = null;
    return this.save();
};

theftRecordSchema.methods.isDeleted = function () {
    return this.deleted_at !== null;
};

theftRecordSchema.methods.getAgeInDays = function () {
    const now = Date.now();
    const created = this.date_created.getTime();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
};

theftRecordSchema.pre("save", autoIncrement('theft_record'));
const TheftRecord = mongoose.model("theft_record", theftRecordSchema);

// --- User ---
const userSchema = new mongoose.Schema({
    _id: { type: Number, required: true, unique: true, default: 0 },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    date_created: { type: Date, default: Date.now }
}, {
    timestamps: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

userSchema.statics.findAdmins = function () {
    return this.find({ role: 'admin' });
};

userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email });
};

userSchema.statics.countByRole = async function () {
    const users = await this.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    const result = {};
    users.forEach(u => { result[u._id] = u.count; });
    return result;
};

userSchema.methods.isAdmin = function () {
    return this.role === 'admin';
};

userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        email: this.email,
        role: this.role,
        date_created: this.date_created
    };
};

userSchema.pre('save', autoIncrement('users'));
const User = mongoose.model('users', userSchema);

// --- AuditLog ---
const auditLogSchema = new mongoose.Schema({
    userId: { type: Number, required: true, index: true },
    action: { type: String, required: true, enum: ['create', 'update', 'delete'], index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    details: { type: String, default: '' }
}, {
    timestamps: false,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

auditLogSchema.statics.getRecentLogs = function (limit = 50) {
    return this.find().sort({ timestamp: -1 }).limit(limit);
};

auditLogSchema.statics.getLogsByUser = function (userId) {
    return this.find({ userId }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getLogsByAction = function (action) {
    return this.find({ action }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getLogsInRange = function (start, end) {
    return this.find({
        timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getActionCounts = async function () {
    const result = await this.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    const counts = {};
    result.forEach(r => { counts[r._id] = r.count; });
    return counts;
};

auditLogSchema.methods.formatTimestamp = function () {
    return this.timestamp.toISOString();
};

const AuditLog = mongoose.model('audit_logs', auditLogSchema);

module.exports = { Sequence, autoIncrement, CarInfo, Status, TheftRecord, User, AuditLog };
