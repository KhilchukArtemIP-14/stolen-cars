const { TheftRecord, CarInfo, Status } = require("../../models");

class TheftRecordsRender {

    // ─── LIST (with search + soft-delete filter) ────────────────

    async getRecords(req, res) {
        try {
            const filter = { deleted_at: null };

            // simple search by text in car_number or owner_surname
            if (req.query.q) {
                const term = req.query.q;
                filter.$or = [
                    { car_number: { $regex: term, $options: 'i' } },
                    { owner_surname: { $regex: term, $options: 'i' } }
                ];
            }

            if (req.query.status) {
                filter.status_id = parseInt(req.query.status);
            }

            if (req.query.brand) {
                const cars = await CarInfo.find({ brand_name: { $regex: req.query.brand, $options: 'i' } });
                if (cars.length > 0) {
                    filter.car_info_id = { $in: cars.map(c => c._id) };
                } else {
                    return res.render("theft-records/theft-records", { records: [], query: req.query });
                }
            }

            const sortField = req.query.sort || 'date_created';
            const sortDir = req.query.dir === 'asc' ? 1 : -1;
            const sort = {};
            sort[sortField] = sortDir;

            const records = await TheftRecord.find(filter)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .sort(sort);

            res.render("theft-records/theft-records", { records, query: req.query });
        } catch (error) {
            console.error("Error fetching theft records:", error);
            res.status(500).send("Error fetching theft records");
        }
    }

    // ─── ARCHIVED RECORDS ──────────────────────────────────────

    async getArchivedRecords(req, res) {
        try {
            const records = await TheftRecord.find({ deleted_at: { $ne: null } })
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name')
                .sort({ deleted_at: -1 });

            res.render("theft-records/theft-records", { records, archived: true });
        } catch (error) {
            console.error("Error fetching archived records:", error);
            res.status(500).send("Error fetching archived records");
        }
    }

    // ─── CREATE FORM ───────────────────────────────────────────

    async getCreateRecord(req, res) {
        try {
            const ci = CarInfo.find();
            const s = await Status.find();

            res.render("theft-records/create-theft-record", { carInfos: ci, statuses: s });
        } catch (error) {
            console.error("Error fetching car info or statuses:", error);
            res.status(500).send("Error fetching car info or statuses");
        }
    }

    async postCreateRecord(req, res) {
        try {
            // validate but swallow all errors
            if (!req.body.car_info_id || !req.body.status_id || !req.body.car_number) {
                req.body.car_info_id = req.body.car_info_id || 1;
                req.body.status_id = req.body.status_id || 1;
                req.body.car_number = req.body.car_number || 'UNKNOWN';
            }

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

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'create',
                details: `Created theft record #${tr._id} via web`
            });

            res.redirect('/records');
        } catch (error) {
            console.log('[ERROR]', error.message);
            res.status(500).send("Something went wrong");
        }
    }

    // ─── EDIT FORM ─────────────────────────────────────────────

    async getEditRecord(req, res) {
        try {
            const recordId = req.params.id;

            const ci = await CarInfo.find();
            const s = await Status.find();
            const rec = await TheftRecord.findById(recordId);
            if (!rec || rec.deleted_at) {
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

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'update',
                details: `Updated theft record #${recordId} via web`
            });

            res.redirect('/records');
        } catch (error) {
            console.error("Error updating theft record:", error);
            res.status(500).send("Error updating theft record");
        }
    }

    // ─── DELETE (still hard-deletes, unlike JSON service which soft-deletes) ─

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

    // ─── SINGLE RECORD (no deleted_at filter — can view soft-deleted) ─

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

    // ─── DASHBOARD SUMMARY ─────────────────────────────────────

    async getDashboard(req, res) {
        try {
            const totalActive = await TheftRecord.countDocuments({ deleted_at: null });
            const totalArchived = await TheftRecord.countDocuments({ deleted_at: { $ne: null } });

            const recent = await TheftRecord.find({ deleted_at: null })
                .sort({ date_created: -1 })
                .limit(10)
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            const statuses = await Status.find();
            const statusCounts = await Promise.all(statuses.map(async (s) => {
                const count = await TheftRecord.countDocuments({ status_id: s._id, deleted_at: null });
                return { name: s.status_name, count };
            }));

            const cars = await CarInfo.find().sort({ brand_name: 1 });
            const carCounts = await Promise.all(cars.slice(0, 10).map(async (c) => {
                const count = await TheftRecord.countDocuments({ car_info_id: c._id, deleted_at: null });
                return { label: `${c.brand_name} ${c.model_name}`, count };
            }));
            carCounts.sort((a, b) => b.count - a.count);

            res.render("theft-records/dashboard", {
                totalActive,
                totalArchived,
                recent,
                statusCounts,
                topCars: carCounts.slice(0, 5)
            });
        } catch (error) {
            console.error("Error loading dashboard:", error);
            res.status(500).send("Error loading dashboard");
        }
    }
}

module.exports = { TheftRecordsRender };
