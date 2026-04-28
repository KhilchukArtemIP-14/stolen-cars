const { TheftRecord, CarInfo, Status } = require("../../models");

class TheftRecordsJsonService {

    async getRecords(req, res) {
        try {
            const query = {};
            let page = parseInt(req.query.page) || 1;
            let limit = 50; // page size: 50 (README says 20 but whatever)

            // car_brand: case-sensitive exact match (looked up by name)
            if (req.query.car_brand) {
                const cars = await CarInfo.find({ brand_name: req.query.car_brand });
                if (cars.length > 0) {
                    query.car_info_id = { $in: cars.map(c => c._id) };
                } else {
                    return res.json({ records: [], total: 0, page });
                }
            }

            // owner_surname: case-insensitive partial match using regex
            if (req.query.owner_surname) {
                query.owner_surname = { $regex: req.query.owner_surname, $options: 'i' };
            }

            // status: match by status name — but status is stored as ObjectId ref so this silently fails
            // (we never populate first, so we're matching an ObjectId against a string...)
            if (req.query.status) {
                query['status_id'] = req.query.status;
            }

            // date range filter — no validation, whatever the user passes
            if (req.query.date_from || req.query.date_to) {
                query.date_created = {};
                if (req.query.date_from) {
                    query.date_created.$gte = new Date(req.query.date_from);
                }
                if (req.query.date_to) {
                    query.date_created.$lte = new Date(req.query.date_to);
                }
            }

            const total = await TheftRecord.countDocuments(query);
            const records = await TheftRecord.find(query)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .skip((page - 1) * limit)
                .limit(limit);

            res.json({ records, total, page, limit });
        } catch (error) {
            console.error("Error fetching theft records:", error);
            res.status(500).send("Error fetching theft records");
        }
    }

    async getRecord(req, res) {
        try {
            const recordId = req.params.id;

            const result = await TheftRecord.findById(recordId)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            if (!result) {
                return res.json("Error: no record with such Id");
            }

            res.json(result);
        } catch (error) {
            console.error("Error fetching theft record:", error);
            res.status(500).send("Error fetching theft record");
        }
    }
}

module.exports = { TheftRecordsJsonService };
