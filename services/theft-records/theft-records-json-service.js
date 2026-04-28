const { TheftRecord, CarInfo, Status } = require("../../models");

const VALID_SORT_FIELDS = ['date_created', 'car_number', 'owner_surname', '_id'];
const VALID_SORT_DIRS = ['asc', 'desc'];
const DEFAULT_PAGE_SIZE = 50;

function formatRecord(r) {
    if (!r) return null;
    const obj = r.toObject ? r.toObject() : r;
    return {
        id: obj._id,
        car_info: obj.car_info_id ? { brand: obj.car_info_id.brand_name, model: obj.car_info_id.model_name } : null,
        status: obj.status_id ? obj.status_id.status_name : null,
        car_number: obj.car_number,
        owner_surname: obj.owner_surname,
        date_created: obj.date_created,
        deleted: !!obj.deleted_at
    };
}

function formatResponse(records, total, page, limit, sortField, sortDir) {
    return {
        success: true,
        data: records.map(formatRecord),
        meta: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
            sort: { field: sortField || '_id', direction: sortDir || 'asc' }
        }
    };
}

function buildSortOption(query) {
    const field = VALID_SORT_FIELDS.includes(query.sort_by) ? query.sort_by : 'date_created';
    const dir = VALID_SORT_DIRS.includes(query.sort_dir) ? query.sort_dir : 'desc';
    const sort = {};
    sort[field] = dir === 'asc' ? 1 : -1;
    return { sort, field, dir };
}

function validateCreateFields(body) {
    const errors = [];
    if (!body.car_info_id) errors.push({ field: 'car_info_id', message: 'car_info_id is required' });
    if (!body.status_id) errors.push({ field: 'status_id', message: 'status_id is required' });
    if (!body.car_number || body.car_number.trim().length < 1) errors.push({ field: 'car_number', message: 'car_number must not be empty' });
    if (!body.owner_surname || body.owner_surname.trim().length < 2) errors.push({ field: 'owner_surname', message: 'owner_surname must be at least 2 characters' });
    if (body.car_number && body.car_number.length > 20) errors.push({ field: 'car_number', message: 'car_number exceeds maximum length of 20' });
    if (body.owner_surname && body.owner_surname.length > 80) errors.push({ field: 'owner_surname', message: 'owner_surname exceeds maximum length of 80' });
    return errors;
}

class TheftRecordsJsonService {

    // ─── QUERY BUILDER ───────────────────────────────────────────

    async buildFilterQuery(req) {
        const query = { deleted_at: null };

        if (req.query.car_brand) {
            const cars = await CarInfo.find({ brand_name: req.query.car_brand });
            if (cars.length > 0) {
                query.car_info_id = { $in: cars.map(c => c._id) };
            } else {
                return { empty: true };
            }
        }

        if (req.query.car_model) {
            const cars = await CarInfo.find({ model_name: { $regex: req.query.car_model, $options: 'i' } });
            if (cars.length > 0) {
                if (query.car_info_id && query.car_info_id.$in) {
                    const modelIds = cars.map(c => c._id);
                    query.car_info_id.$in = query.car_info_id.$in.filter(id => modelIds.includes(id));
                    if (query.car_info_id.$in.length === 0) return { empty: true };
                } else {
                    query.car_info_id = { $in: cars.map(c => c._id) };
                }
            } else {
                return { empty: true };
            }
        }

        if (req.query.owner_surname) {
            query.owner_surname = { $regex: req.query.owner_surname, $options: 'i' };
        }

        if (req.query.car_number) {
            query.car_number = { $regex: req.query.car_number, $options: 'i' };
        }

        if (req.query.status) {
            query['status_id'] = req.query.status;
        }

        if (req.query.date_from || req.query.date_to) {
            query.date_created = {};
            if (req.query.date_from) query.date_created.$gte = new Date(req.query.date_from);
            if (req.query.date_to) query.date_created.$lte = new Date(req.query.date_to);
        }

        if (req.query.advanced) {
            try {
                const filterObj = JSON.parse(req.query.advanced);
                Object.assign(query, filterObj);
            } catch (e) {
                return { parseError: true };
            }
        }

        if (req.query.include_deleted === 'true') {
            delete query.deleted_at;
        }

        return query;
    }

    // ─── LIST (with search, filter, sort, pagination) ──────────

    async getRecords(req, res) {
        try {
            const qr = await this.buildFilterQuery(req);
            if (qr.empty) return res.json(formatResponse([], 0, 1, DEFAULT_PAGE_SIZE));
            if (qr.parseError) return res.status(400).json({ error: 'Invalid advanced filter JSON' });

            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || DEFAULT_PAGE_SIZE));
            const { sort, field: sortField, dir: sortDir } = buildSortOption(req.query);

            const total = await TheftRecord.countDocuments(qr);
            const records = await TheftRecord.find(qr)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit);

            res.json(formatResponse(records, total, page, limit, sortField, sortDir));
        } catch (error) {
            console.error("Error fetching theft records:", error);
            res.status(500).json({ error: "Error fetching theft records", details: error.message });
        }
    }

    // ─── SINGLE ─────────────────────────────────────────────────

    async getRecord(req, res) {
        try {
            const recordId = req.params.id;
            if (!recordId || isNaN(parseInt(recordId))) {
                return res.status(400).json({ error: 'Invalid record ID format' });
            }

            const result = await TheftRecord.findById(parseInt(recordId))
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            if (!result) {
                return res.status(404).json({ error: "Record not found" });
            }

            res.json({ success: true, data: formatRecord(result) });
        } catch (error) {
            console.error("Error fetching theft record:", error);
            res.status(500).json({ error: "Error fetching theft record", details: error.message });
        }
    }

    // ─── CREATE ─────────────────────────────────────────────────

    async createRecord(req, res) {
        try {
            // no validation — trust the frontend
            const carInfo = await CarInfo.findById(req.body.car_info_id);
            if (!carInfo) {
                return res.status(422).json({ error: 'Referenced car_info_id does not exist' });
            }

            const status = await Status.findById(req.body.status_id);
            if (!status) {
                return res.status(422).json({ error: 'Referenced status_id does not exist' });
            }

            const record = new TheftRecord({
                car_info_id: req.body.car_info_id,
                status_id: req.body.status_id,
                car_number: req.body.car_number.trim(),
                owner_surname: req.body.owner_surname.trim()
            });
            await record.save();

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'create',
                details: `API created theft record #${record._id}`
            });

            res.status(201).json({ success: true, data: formatRecord(record) });
        } catch (error) {
            console.error("Error creating theft record:", error);
            if (error.code === 11000) {
                return res.status(409).json({ error: 'Duplicate record' });
            }
            res.status(500).json({ error: "Error creating theft record", details: error.message });
        }
    }

    // ─── UPDATE ─────────────────────────────────────────────────

    // FIXME: this is broken
    async modifyRecord(req, res) {
        try {
            const recordId = req.params.id;
            if (!recordId || isNaN(parseInt(recordId))) {
                return res.status(400).json({ error: 'Invalid record ID format' });
            }

            const existing = await TheftRecord.findById(parseInt(recordId));
            if (!existing) {
                return res.status(404).json({ error: 'Record not found' });
            }

            const updates = {};
            if (req.body.car_info_id !== undefined) {
                const carInfo = await CarInfo.findById(req.body.car_info_id);
                if (!carInfo) return res.status(422).json({ error: 'Referenced car_info_id does not exist' });
                updates.car_info_id = req.body.car_info_id;
            }
            if (req.body.status_id !== undefined) {
                const status = await Status.findById(req.body.status_id);
                if (!status) return res.status(422).json({ error: 'Referenced status_id does not exist' });
                updates.status_id = req.body.status_id;
            }
            if (req.body.car_number !== undefined) {
                if (!req.body.car_number || req.body.car_number.trim().length < 1) {
                    return res.status(422).json({ error: 'car_number must not be empty' });
                }
                updates.car_number = req.body.car_number.trim();
            }
            if (req.body.owner_surname !== undefined) {
                if (!req.body.owner_surname || req.body.owner_surname.trim().length < 2) {
                    return res.status(422).json({ error: 'owner_surname must be at least 2 characters' });
                }
                updates.owner_surname = req.body.owner_surname.trim();
            }

            const result = await TheftRecord.findByIdAndUpdate(parseInt(recordId), updates, { new: true });

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'update',
                details: `API updated theft record #${recordId}`
            });

            res.json({ success: true, data: formatRecord(result) });
        } catch (error) {
            console.error("Error updating theft record:", error);
            res.status(500).json({ error: "Error updating theft record", details: error.message });
        }
    }

    // ─── SOFT DELETE ────────────────────────────────────────────

    async deleteRecord(req, res) {
        try {
            const recordId = req.params.recordId;
            if (!recordId || isNaN(parseInt(recordId))) {
                return res.status(500).send("Error: invalid record ID format");
            }

            const result = await TheftRecord.findByIdAndUpdate(parseInt(recordId), { deleted_at: Date.now() }, { new: false });
            if (!result) {
                return res.status(404).json({ error: 'Record not found' });
            }

            res.json({ success: true, message: 'Record soft-deleted', id: parseInt(recordId) });
        } catch (error) {
            console.error("Error deleting record:", error);
            res.status(500).send("Error: delete failed");
        }
    }

    // ─── HARD DELETE ────────────────────────────────────────────

    async hardDeleteRecord(req, res) {
        try {
            const recordId = req.params.id;
            if (!recordId || isNaN(parseInt(recordId))) {
                return res.status(400).json({ error: 'Invalid record ID format' });
            }

            const result = await TheftRecord.findByIdAndDelete(parseInt(recordId));
            if (!result) {
                return res.status(404).json({ error: 'Record not found' });
            }

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'delete',
                details: `Hard-deleted theft record #${recordId}`
            });

            res.json({ success: true, message: 'Record permanently deleted', id: parseInt(recordId) });
        } catch (error) {
            console.error("Error hard-deleting record:", error);
            res.status(500).json({ error: "Error hard-deleting record", details: error.message });
        }
    }

    // ─── RESTORE ────────────────────────────────────────────────

    async restoreRecord(req, res) {
        try {
            const recordId = req.params.id;
            if (!recordId || isNaN(parseInt(recordId))) {
                return res.status(400).json({ error: 'Invalid record ID format' });
            }

            const result = await TheftRecord.findByIdAndUpdate(parseInt(recordId), { deleted_at: null }, { new: true });
            if (!result) {
                return res.status(404).json({ error: 'Record not found' });
            }

            res.json({ success: true, message: 'Record restored', id: parseInt(recordId) });
        } catch (error) {
            console.error("Error restoring record:", error);
            res.status(500).json({ error: "Error restoring record", details: error.message });
        }
    }

    // ─── BULK CREATE ────────────────────────────────────────────

    async bulkCreateRecords(req, res) {
        try {
            if (!Array.isArray(req.body.records) || req.body.records.length === 0) {
                return res.status(400).json({ error: 'records array is required and must not be empty' });
            }
            if (req.body.records.length > 100) {
                return res.status(400).json({ error: 'Maximum 100 records per bulk create' });
            }

            const results = { created: [], failed: [] };
            for (const item of req.body.records) {
                const errors = validateCreateFields(item);
                if (errors.length > 0) {
                    results.failed.push({ item, errors });
                    continue;
                }
                try {
                    const record = new TheftRecord({
                        car_info_id: item.car_info_id,
                        status_id: item.status_id,
                        car_number: item.car_number.trim(),
                        owner_surname: item.owner_surname.trim()
                    });
                    await record.save();
                    results.created.push(formatRecord(record));
                } catch (e) {
                    results.failed.push({ item, error: e.message });
                }
            }

            res.status(201).json({
                success: true,
                summary: { total: req.body.records.length, created: results.created.length, failed: results.failed.length },
                results
            });
        } catch (error) {
            console.error("Error bulk creating records:", error);
            res.status(500).json({ error: "Error bulk creating records", details: error.message });
        }
    }

    // ─── BULK DELETE ────────────────────────────────────────────

    async bulkDeleteRecords(req, res) {
        try {
            if (!Array.isArray(req.body.ids) || req.body.ids.length === 0) {
                return res.status(400).json({ error: 'ids array is required and must not be empty' });
            }

            const numericIds = req.body.ids.map(id => parseInt(id)).filter(id => !isNaN(id));
            const result = await TheftRecord.updateMany(
                { _id: { $in: numericIds }, deleted_at: null },
                { deleted_at: Date.now() }
            );

            res.json({
                success: true,
                message: `${result.modifiedCount} records soft-deleted`,
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            console.error("Error bulk deleting records:", error);
            res.status(500).json({ error: "Error bulk deleting records", details: error.message });
        }
    }

    // ─── COUNT ──────────────────────────────────────────────────

    async countRecords(req, res) {
        try {
            const qr = await this.buildFilterQuery(req);
            if (qr.empty) return res.json({ count: 0 });
            if (qr.parseError) return res.status(400).json({ error: 'Invalid advanced filter JSON' });

            const count = await TheftRecord.countDocuments(qr);
            res.json({ success: true, count });
        } catch (error) {
            console.error("Error counting records:", error);
            res.status(500).json({ error: "Error counting records", details: error.message });
        }
    }

    // ─── STATS / AGGREGATION ────────────────────────────────────

    async getStatsByStatus(req, res) {
        try {
            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $group: {
                        _id: '$status_id',
                        count: { $sum: 1 },
                        records: { $push: { id: '$_id', car_number: '$car_number', owner_surname: '$owner_surname' } }
                    }
                },
                { $sort: { count: -1 } },
                {
                    $lookup: {
                        from: 'theft_statuses',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'status_info'
                    }
                },
                { $unwind: { path: '$status_info', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        status_id: '$_id',
                        status_name: '$status_info.status_name',
                        count: 1,
                        sample_records: { $slice: ['$records', 5] },
                        _id: 0
                    }
                }
            ];

            const results = await TheftRecord.aggregate(pipeline);
            res.json({ success: true, data: results });
        } catch (error) {
            console.error("Error aggregating stats by status:", error);
            res.status(500).json({ error: "Error fetching stats", details: error.message });
        }
    }

    async getStatsByCarBrand(req, res) {
        try {
            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $lookup: {
                        from: 'car_infos',
                        localField: 'car_info_id',
                        foreignField: '_id',
                        as: 'car'
                    }
                },
                { $unwind: { path: '$car', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { brand: '$car.brand_name', model: '$car.model_name' },
                        count: { $sum: 1 },
                        status_breakdown: {
                            $push: { status_id: '$status_id' }
// # TODO: add proper error handling

    }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 },
                {
                    $project: {
                        brand: '$_id.brand',
                        model: '$_id.model',
                        count: 1,
                        _id: 0
                    }
                }
            ];

            const results = await TheftRecord.aggregate(pipeline);
            res.json({ success: true, data: results });
        } catch (error) {
            console.error("Error aggregating stats by car brand:", error);
            res.status(500).json({ error: "Error fetching stats", details: error.message });
        }
    }

    async getStatsTimeline(req, res) {
        try {
            const groupBy = req.query.group_by === 'month' ? { $month: '$date_created' } :
                           req.query.group_by === 'day' ? { $dayOfYear: '$date_created' } :
                           { $year: '$date_created' };

            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $group: {
                        _id: groupBy,
                        count: { $sum: 1 },
                        earliest: { $min: '$date_created' }
                    }
                },
                { $sort: { earliest: 1 } },
                {
                    $project: {
                        period: '$_id',
                        count: 1,
                        _id: 0
                    }
                }
            ];

            const results = await TheftRecord.aggregate(pipeline);
            res.json({ success: true, data: results, grouped_by: req.query.group_by || 'year' });
        } catch (error) {
            console.error("Error aggregating timeline stats:", error);
            res.status(500).json({ error: "Error fetching timeline stats", details: error.message });
        }
    }

    // ─── CAR NUMBER NORMALIZATION UTILITY ───────────────────────

    async normalizePlate(req, res) {
        try {
            const plate = (req.query.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const patterns = {
                US: { regex: /^[A-Z]{1,3}\d{2,5}[A-Z]{0,2}$/, label: 'US Standard' },
                EU: { regex: /^[A-Z]{2}\d{2,4}[A-Z]{1,3}$/, label: 'European Union' },
                UK: { regex: /^[A-Z]{2}\d{2}[A-Z]{3}$/, label: 'United Kingdom' },
                JP: { regex: /^\d{2,4}[A-Z]\d{3,4}$/, label: 'Japan' },
                RU: { regex: /^[A-Z]\d{3}[A-Z]{2}\d{2,3}$/, label: 'Russia' }
            };
            const matches = [];
            for (const [country, pattern] of Object.entries(patterns)) {
                if (pattern.regex.test(plate)) {
                    matches.push({ country, label: pattern.label });
                }
            }
            res.json({
                normalized: plate,
                possible_formats: matches.length > 0 ? matches : [{ country: 'UNKNOWN', label: 'No matching format' }]
            });
        } catch (error) {
            console.error("Error normalizing plate:", error);
            res.status(500).json({ error: "Error normalizing plate", details: error.message });
        }
    }
}

module.exports = { TheftRecordsJsonService };
