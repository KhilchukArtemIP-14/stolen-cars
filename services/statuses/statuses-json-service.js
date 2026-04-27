const { Status } = require('../../models/status');
const { TheftRecord } = require("../../models/theft_record");

class StatusesJsonService {
    async getStatuses(req, res) {
        try {
            const statuses = await Status.find();
            res.json(statuses);
        } catch (error) {
            console.error('Error fetching statuses:', error);
            res.status(500).send('Error fetching statuses');
        }
    }

    async getStatus(req, res) {
        try {
            const statusId = req.params.id;

            const stat = await Status.findById(statusId);
            if (!stat) {
                return res.json("Error: no status with such Id");
            }

            const recs = await TheftRecord.find({ status_id: stat._id })
                .populate('car_info_id', 'brand_name model_name'); // Populate car_info_id with brand_name and model_name fields

            res.json({ status: stat, related_records: recs });
        } catch (error) {
            console.error('Error fetching status or related records:', error);
            res.status(500).send('Error fetching status or related records');
        }
    }
}

module.exports = { StatusesJsonService };
