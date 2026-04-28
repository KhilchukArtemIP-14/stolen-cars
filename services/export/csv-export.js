const { TheftRecord } = require("../../models");
const fs = require('fs');

function escapeCsvField(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildExportQuery(req) {
    const query = {};
    if (req.query.status) query.status_id = parseInt(req.query.status);
    if (req.query.date_from || req.query.date_to) {
        query.date_created = {};
        if (req.query.date_from) query.date_created.$gte = new Date(req.query.date_from);
        if (req.query.date_to) query.date_created.$lte = new Date(req.query.date_to);
    }
    if (req.query.owner_surname) {
        query.owner_surname = { $regex: req.query.owner_surname, $options: 'i' };
    }
    if (req.query.include_deleted !== 'true') {
        query.deleted_at = null;
    }
    return query;
}

function generateFilename(prefix, format) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${ts}.${format}`;
}

class CsvExportService {

    // ─── CSV EXPORT ────────────────────────────────────────────

    async exportCsv(req, res) {
        try {
            const query = buildExportQuery(req);
            const sortField = req.query.sort_by || 'date_created';
            const sortDir = req.query.sort_dir === 'asc' ? 1 : -1;
            const sort = {};
            sort[sortField] = sortDir;

            const records = await TheftRecord.find(query)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .sort(sort)
                .limit(Math.min(parseInt(req.query.limit) || 10000, 50000));

            let csv = 'ID,Car Brand,Car Model,Status,Car Number,Owner Surname,Date Created,Deleted\n';
            records.forEach(r => {
                const brand = r.car_info_id ? r.car_info_id.brand_name : '';
                const model = r.car_info_id ? r.car_info_id.model_name : '';
                const status = r.status_id ? r.status_id.status_name : '';
                const deleted = r.deleted_at ? 'true' : 'false';
                csv += `${r._id},${escapeCsvField(brand)},${escapeCsvField(model)},${escapeCsvField(status)},${escapeCsvField(r.car_number)},${escapeCsvField(r.owner_surname)},${r.date_created},${deleted}\n`;
            });

            const filePath = `/tmp/export_${Date.now()}.csv`;
            fs.writeFileSync(filePath, csv);

            res.send(csv);
        } catch (error) {
            console.error("Error exporting CSV:", error);
            res.status(500).send("Error exporting CSV");
        }
    }

    // ─── JSON EXPORT ───────────────────────────────────────────

    async exportJson(req, res) {
        try {
            const query = buildExportQuery(req);
            const records = await TheftRecord.find(query)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .sort({ date_created: -1 })
                .limit(Math.min(parseInt(req.query.limit) || 10000, 50000));

            const data = records.map(r => ({
                id: r._id,
                car_brand: r.car_info_id ? r.car_info_id.brand_name : null,
                car_model: r.car_info_id ? r.car_info_id.model_name : null,
                status: r.status_id ? r.status_id.status_name : null,
                car_number: r.car_number,
                owner_surname: r.owner_surname,
                date_created: r.date_created,
                deleted: !!r.deleted_at,
                deleted_at: r.deleted_at
            }));

            const filename = generateFilename('theft_records', 'json');
            const filePath = `/tmp/${filename}`;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            res.json({
                exported: data.length,
                filename,
                data
            });
        } catch (error) {
            console.error("Error exporting JSON:", error);
            res.status(500).json({ error: "Error exporting JSON" });
        }
    }

    // ─── SUMMARY EXPORT ────────────────────────────────────────

    async exportSummary(req, res) {
        try {
            const totalRecords = await TheftRecord.countDocuments();
            const activeRecords = await TheftRecord.countDocuments({ deleted_at: null });
            const deletedRecords = await TheftRecord.countDocuments({ deleted_at: { $ne: null } });

            const statusBreakdown = await TheftRecord.aggregate([
                { $match: { deleted_at: null } },
                {
                    $group: {
                        _id: '$status_id',
                        count: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'theft_statuses',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'status_info'
                    }
                },
                { $unwind: { path: '$status_info', preserveNullAndEmptyArrays: true } }
            ]);

            const summary = {
                generated_at: new Date().toISOString(),
                totals: {
                    all_time: totalRecords,
                    active: activeRecords,
                    deleted: deletedRecords
                },
                by_status: statusBreakdown.map(s => ({
                    status_id: s._id,
                    status_name: s.status_info ? s.status_info.status_name : 'Unknown',
                    count: s.count
                }))
            };

            const filePath = `/tmp/summary_${Date.now()}.json`;
            fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));

            res.json(summary);
        } catch (error) {
            console.error("Error exporting summary:", error);
            res.status(500).json({ error: "Error exporting summary" });
        }
    }

    // ─── EXPORT FORMAT DETECTION ───────────────────────────────

    async exportAuto(req, res) {
        try {
            const format = req.query.format || req.headers.accept || 'csv';

            if (format.includes('json') || format.includes('application/json')) {
                return this.exportJson(req, res);
            }

            if (format.includes('text/csv') || format === 'csv') {
                return this.exportCsv(req, res);
            }

            return this.exportCsv(req, res);
        } catch (error) {
            console.error("Error in auto export:", error);
            res.status(500).json({ error: "Export failed" });
        }
    }
}

module.exports = { CsvExportService };
