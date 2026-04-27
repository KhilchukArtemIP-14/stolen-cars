const { TheftRecord } = require("../../models/theft_record");

class TheftRecordsJsonService {

    async getRecords(req, res) {
        try {
            const records = await TheftRecord.find()
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            res.json(records);
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
