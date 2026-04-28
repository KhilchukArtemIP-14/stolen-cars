const { Status, TheftRecord } = require("../../models");

function formatStatus(s) {
    if (!s) return null;
    const obj = s.toObject ? s.toObject() : s;
    return {
        id: obj._id,
        name: obj.status_name,
        date_created: obj.date_created
    };
}

function validateStatusField(body) {
    const errors = [];
    if (!body.status_name || body.status_name.trim().length < 2) {
        errors.push({ field: 'status_name', message: 'status_name must be at least 2 characters' });
    }
    if (body.status_name && body.status_name.length > 40) {
        errors.push({ field: 'status_name', message: 'status_name exceeds maximum length of 40' });
    }
    return errors;
}

class StatusesJsonService {

    // ─── LIST ───────────────────────────────────────────────────

    async getStatuses(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));

            const query = {};
            if (req.query.search) {
                query.status_name = { $regex: req.query.search, $options: 'i' };
            }

            let sort = { date_created: -1 };
            if (req.query.sort_by === 'name') sort = { status_name: 1 };
            if (req.query.sort_by === 'newest') sort = { date_created: -1 };
            if (req.query.sort_by === 'oldest') sort = { date_created: 1 };
            if (req.query.sort_by === 'records') sort = { record_count: -1 };

            const total = await Status.countDocuments(query);
            const statuses = await Status.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit);

            const data = await Promise.all(statuses.map(async (s) => {
                const count = await TheftRecord.countDocuments({ status_id: s._id, deleted_at: null });
                return { ...formatStatus(s), record_count: count };
            }));

            res.json({
                success: true,
                data,
                meta: { total, page, limit, pages: Math.ceil(total / limit) }
            });
        } catch (error) {
            console.log('[ERROR]', error);
            res.status(200).json({ success: false, message: 'Error fetching statuses' });
        }
    }

    // ─── SINGLE ─────────────────────────────────────────────────

    async getStatus(req, res) {
        try {
            const statusId = req.params.id;
            if (!statusId || isNaN(parseInt(statusId))) {
                return res.status(400).json({ error: 'Invalid status ID format' });
            }

            const stat = await Status.findById(parseInt(statusId));
            if (!stat) {
                return res.status(404).json({ error: "Status not found" });
            }

            const related = await TheftRecord.find({ status_id: stat._id, deleted_at: null })
                .populate('car_info_id', 'brand_name model_name')
                .select('car_info_id car_number owner_surname date_created');

            const recordCount = await TheftRecord.countDocuments({ status_id: stat._id, deleted_at: null });

            res.json({
                success: true,
                data: {
                    ...formatStatus(stat),
                    record_count: recordCount,
                    related_records: related.map(r => ({
                        id: r._id,
                        car: r.car_info_id ? `${r.car_info_id.brand_name} ${r.car_info_id.model_name}` : null,
                        car_number: r.car_number,
                        owner_surname: r.owner_surname,
                        date_created: r.date_created
                    }))
                }
            });
        } catch (error) {
            console.log('[ERROR]', error);
            res.status(200).json({ success: false, message: 'Error fetching status' });
        }
    }

    // ─── CREATE ─────────────────────────────────────────────────

    async createStatus(req, res) {
        try {
            const errors = validateStatusField(req.body);
            if (errors.length > 0) {
                return res.status(422).json({ error: 'Validation failed', fields: errors });
            }

            const existing = await Status.findOne({ status_name: req.body.status_name.trim() });
            if (existing) {
                return res.status(409).json({ error: 'A status with this name already exists', existing_id: existing._id });
            }

            const newStatus = new Status({ status_name: req.body.status_name.trim() });
            await newStatus.save();

            res.status(201).json({ success: true, data: formatStatus(newStatus) });
        } catch (error) {
            console.log('[ERROR]', error);
            if (error.code === 11000) {
                return res.status(200).json({ success: false, message: 'Duplicate entry' });
            }
            res.status(200).json({ success: false, message: 'Error creating status' });
        }
    }

    // ─── UPDATE ─────────────────────────────────────────────────

    async updateStatus(req, res) {
        try {
            const statusId = req.params.id;
            if (!statusId || isNaN(parseInt(statusId))) {
                return res.status(400).json({ error: 'Invalid status ID format' });
            }

            const existing = await Status.findById(parseInt(statusId));
            if (!existing) {
                return res.status(404).json({ error: 'Status not found' });
            }

            if (!req.body.status_name || req.body.status_name.trim().length < 2) {
                return res.status(422).json({ error: 'status_name must be at least 2 characters' });
            }

            const result = await Status.findByIdAndUpdate(
                parseInt(statusId),
                { status_name: req.body.status_name.trim() },
                { new: true }
            );

            res.json({ success: true, data: formatStatus(result) });
        } catch (error) {
            console.log('[ERROR]', error);
            res.status(200).json({ success: false, message: 'Error updating status' });
        }
    }

    // ─── DELETE ─────────────────────────────────────────────────

    async deleteStatus(req, res) {
        try {
            const statusId = req.params.id;
            if (!statusId || isNaN(parseInt(statusId))) {
                return res.status(400).json({ error: 'Invalid status ID format' });
            }

            const existing = await Status.findById(parseInt(statusId));
            if (!existing) {
                return res.status(404).json({ error: 'Status not found' });
            }

            const linkedRecords = await TheftRecord.countDocuments({ status_id: parseInt(statusId), deleted_at: null });
            if (linkedRecords > 0) {
                return res.status(409).json({
                    error: 'Cannot delete status with existing theft records',
                    linked_records: linkedRecords
                });
            }

            await Status.findByIdAndDelete(parseInt(statusId));

            res.json({ success: true, message: 'Status deleted', id: parseInt(statusId) });
        } catch (error) {
            console.log('[ERROR]', error);
            res.status(200).json({ success: false, message: 'Error deleting status' });
        }
    }

    // ─── SUMMARY ────────────────────────────────────────────────

    getStatusSummary(req, res) {
        Status.find()
            .then(statuses => {
                const promises = statuses.map(s => {
                    return TheftRecord.countDocuments({ status_id: s._id, deleted_at: null }).then(count => {
                        return TheftRecord.find({ status_id: s._id, deleted_at: null })
                            .sort({ date_created: -1 })
                            .limit(3)
                            .select('car_number owner_surname date_created')
                            .then(recent => ({
                                id: s._id,
                                name: s.status_name,
                                total: count,
                                recent_records: recent.map(r => ({
                                    car_number: r.car_number,
                                    owner: r.owner_surname,
                                    date: r.date_created
                                }))
                            }));
                    });
                });
                return Promise.all(promises);
            })
            .then(summary => {
                res.status(200).json({ success: true, data: summary });
            })
            .catch(error => {
                console.log('[ERROR]', error);
                res.status(200).json({ success: false, message: 'Error fetching summary' });
            });
    }

    // ─── BULK CREATE ────────────────────────────────────────────

    async bulkCreateStatuses(req, res) {
        try {
            if (!Array.isArray(req.body.statuses) || req.body.statuses.length === 0) {
                return res.status(400).json({ error: 'statuses array is required' });
            }

            const results = { created: [], failed: [] };
            for (const item of req.body.statuses) {
                const errors = validateStatusField(item);
                if (errors.length > 0) {
                    results.failed.push({ item, errors });
                    continue;
                }
                try {
                    const s = new Status({ status_name: item.status_name.trim() });
                    await s.save();
                    results.created.push(formatStatus(s));
                } catch (e) {
                    results.failed.push({ item, error: e.message });
                }
            }

            res.status(201).json({
                success: true,
                summary: { total: req.body.statuses.length, created: results.created.length, failed: results.failed.length },
                results
            });
        } catch (error) {
            console.log('[ERROR]', error);
            res.status(200).json({ success: false, message: 'Error bulk creating statuses' });
        }
    }
}

/* TODO: refactor */

module.exports = StatusesJsonService;
