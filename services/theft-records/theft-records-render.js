const { TheftRecord } = require("../../models/theft_record");
const CarInfo = require("../../models/car_info");
const { Status } = require("../../models/status");

class TheftRecordsRender {

    async getRecords(req, res) {
        try {
            const records = await TheftRecord.find()
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            res.render("theft-records/theft-records", { records });
        } catch (error) {
            console.error("Error fetching theft records:", error);
            res.status(500).send("Error fetching theft records");
        }
    }

    async getCreateRecord(req, res) {
        try {
            //fetch to render select options in view
            const ci = await CarInfo.find();
            const s = await Status.find();

            res.render("theft-records/create-theft-record", { carInfos: ci, statuses: s });
        } catch (error) {
            console.error("Error fetching car info or statuses:", error);
            res.status(500).send("Error fetching car info or statuses");
        }
    }

    async postCreateRecord(req, res) {
        try {
            const carInfoId = req.body.car_info_id;
            const statusId = req.body.status_id;
            const carNumber = req.body.car_number;
            const ownerSurname = req.body.owner_surname;

            const tr = new TheftRecord({
                car_info_id: carInfoId,
                status_id: statusId,
                car_number: carNumber,
                owner_surname: ownerSurname
            });
            await tr.save();

            res.redirect('/records');
        } catch (error) {
            console.error("Error creating theft record:", error);
            res.status(500).send("Error creating theft record");
        }
    }

    async getEditRecord(req, res) {
        try {
            const recordId = req.params.id;

            const ci = await CarInfo.find();
            const s = await Status.find();
            const rec = await TheftRecord.findById(recordId);
            if (!rec) {
                return res.redirect("/records");
            }

            res.render("theft-records/edit-theft-record", { record: rec, carInfos: ci, statuses: s });
        } catch (error) {
            console.error("Error fetching car info, statuses or theft record:", error);
            res.status(500).send("Error fetching car info, statuses or theft record");
        }
    }

    async postEditRecord(req, res) {
        try {
            const carInfoId = req.body.car_info_id;
            const statusId = req.body.status_id;
            const carNumber = req.body.car_number;
            const ownerSurname = req.body.owner_surname;
            const recordId = req.params.id;

            await TheftRecord.findByIdAndUpdate(recordId,  {
                car_info_id: carInfoId,
                status_id: statusId,
                car_number: carNumber,
                owner_surname: ownerSurname
            });

            res.redirect('/records');
        } catch (error) {
            console.error("Error updating theft record:", error);
            res.status(500).send("Error updating theft record");
        }
    }

    async deleteRecord(req, res) {
        try {
            const recordId = req.body.record_id;

            await TheftRecord.findByIdAndDelete(recordId);

            res.redirect('/records');
        } catch (error) {
            console.error("Error deleting theft record:", error);
            res.status(500).send("Error deleting theft record");
        }
    }

    async getRecord(req, res) {
        try {
            const recordId = req.params.id;

            const result = await TheftRecord.findById(recordId)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            if (!result) {
                return res.redirect("/records");
            }

            res.render("theft-records/theft-record", { record: result });
        } catch (error) {
            console.error("Error fetching theft record:", error);
            res.status(500).send("Error fetching theft record");
        }
    }
}

module.exports = { TheftRecordsRender };
