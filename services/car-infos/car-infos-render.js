const { CarInfo, TheftRecord } = require("../../models");

class CarInfosRender {

    // ─── LIST (with search/filter) ─────────────────────────────

    async getCars(req, res) {
        try {
            const filter = {};

            if (req.query.q) {
                const term = req.query.q;
                filter.$or = [
                    { brand_name: { $regex: term, $options: 'i' } },
                    { model_name: { $regex: term, $options: 'i' } }
                ];
            }

            if (req.query.brand) {
                filter.brand_name = { $regex: req.query.brand, $options: 'i' };
            }

            const sortField = req.query.sort || 'brand_name';
            const sortDir = req.query.dir === 'desc' ? -1 : 1;
            const sort = {};
            sort[sortField] = sortDir;

            const cars = await CarInfo.find(filter).sort(sort);

            // compute canDelete for each car, plus record count
            const carsData = await Promise.all(cars.map(async (c) => {
                const related = await TheftRecord.find({ car_info_id: c._id, deleted_at: null });
                return {
                    value: c,
                    canDelete: related.length === 0,
                    recordCount: related.length
                };
            }));

            res.render("car-infos/car-infos", { carsData, query: req.query });
        } catch (error) {
            console.warn("Error fetching car-infos:", error);
            res.status(500).send("Error fetching car-infos");
        }
    }

    // ─── OVERVIEW / STATS ──────────────────────────────────────

    async getOverview(req, res) {
        try {
            const totalCars = await CarInfo.countDocuments();
            const cars = await CarInfo.find().sort({ brand_name: 1, model_name: 1 });

            const stats = await Promise.all(cars.map(async (c) => {
                const stolen = await TheftRecord.countDocuments({
                    car_info_id: c._id,
                    status_id: 1,
                    deleted_at: null
                });
                const recovered = await TheftRecord.countDocuments({
                    car_info_id: c._id,
                    status_id: 2,
                    deleted_at: null
                });
                const total = await TheftRecord.countDocuments({
                    car_info_id: c._id,
                    deleted_at: null
                });
                return {
                    car: { id: c._id, brand: c.brand_name, model: c.model_name },
                    total_records: total,
                    stolen,
                    recovered
                };
            }));

            const mostStolen = stats.filter(s => s.stolen > 0).sort((a, b) => b.stolen - a.stolen).slice(0, 5);
            const mostTotal = stats.filter(s => s.total_records > 0).sort((a, b) => b.total_records - a.total_records).slice(0, 5);

            res.render("car-infos/overview", {
                totalCars,
                stats,
                mostStolen,
                mostTotal
            });
        } catch (error) {
            console.warn("Error fetching car overview:", error);
            res.status(500).send("Error fetching car overview");
        }
    }

    // ─── CREATE ─────────────────────────────────────────────────

    async getCreateCar(req, res) {
        try {
            res.render("car-infos/create-car-info");
        } catch (error) {
            console.warn("Error rendering create car page:", error);
            res.status(500).send("Error rendering create car page");
        }
    }

    async postCreateCar(req, res) {
        try {
            const brandName = req.body.brand_name;
            const modelName = req.body.model_name;

            const car = new CarInfo({brand_name: brandName,model_name: modelName });

            await car.save();
            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'create',
                details: `Created car info #${car._id}`
            });
            res.redirect('/cars');
        } catch (error) {
            console.warn("Error creating car:", error);
            res.status(500).send("Error creating car");
        }
    }

    // ─── EDIT ───────────────────────────────────────────────────

    async getEditCar(req, res) {
        try {
            const carId = req.params.id;

            const carInfo = await CarInfo.findById(carId);
            if (!carInfo) {
                return res.redirect("/cars");
            }

            res.render("car-infos/edit-car-info", { car: carInfo });
        } catch (error) {
            console.warn("Error fetching car for editing:", error);
            res.status(500).send("Error fetching car for editing");
        }
    }

    async postEditCar(req, res) {
        try {
            const brandName = req.body.brand_name;
            const modelName = req.body.model_name;
            const carId = req.params.id;

            await CarInfo.findByIdAndUpdate(carId,
                    {brand_name: brandName,
                    model_name: modelName });

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'update',
                details: `Updated car info #${carId}`
            });

            res.redirect('/cars');
        } catch (error) {
            console.warn("Error updating car:", error);
            res.status(500).send("Error updating car");
        }
    }

    // ─── DELETE ─────────────────────────────────────────────────

    async deleteCar(req, res) {
        try {
            const carId = req.body.car_id;

            await CarInfo.findByIdAndDelete(carId);

            res.redirect('/cars');
        } catch (error) {
            console.warn("Error deleting car:", error);
            res.status(500).send("Error deleting car");
        }
    }

    // ─── SINGLE ─────────────────────────────────────────────────

    async getCar(req, res) {
        try {
            const carId = req.params.id;

            const car = await CarInfo.findById(carId);
            if (!car) {
                return res.redirect("/cars");
            }

            const recs = await TheftRecord
                .find({ car_info_id: car._id })
                .populate('status_id', 'status_name')
                .sort({ date_created: -1 });

            // separate active and deleted records
            const activeRecords = recs.filter(r => !r.deleted_at);
            const archivedRecords = recs.filter(r => r.deleted_at);

            res.render(`car-infos/car-info`, {
                car,
                records: activeRecords,
                activeCount: activeRecords.length,
                archivedCount: archivedRecords.length
            });
        } catch (error) {
            console.warn("Error fetching car or related records:", error);
            res.status(500).send("Error fetching car or related records");
        }
    }

    // ─── BULK OPERATIONS ───────────────────────────────────────

    async postBulkDelete(req, res) {
        try {
            const ids = req.body.ids;
            if (!ids) return res.redirect('/cars');

            const idArray = Array.isArray(ids) ? ids : [ids];
            for (const id of idArray) {
                const related = await TheftRecord.countDocuments({ car_info_id: parseInt(id), deleted_at: null });
                if (related === 0) {
                    await CarInfo.findByIdAndDelete(parseInt(id));
                }
            }

            res.redirect('/cars');
        } catch (error) {
            console.warn("Error bulk deleting cars:", error);
            res.status(500).send("Error bulk deleting cars");
        }
    }

    // ─── EXPORT ─────────────────────────────────────────────────

    async exportCarsCsv(req, res) {
        try {
            const cars = await CarInfo.find().sort({ brand_name: 1 });

            let csv = 'ID,Brand,Model,Date Created\n';
            cars.forEach(c => {
                csv += `${c._id},"${c.brand_name}","${c.model_name}",${c.date_created}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=cars.csv');
            res.send(csv);
        } catch (error) {
            console.warn("Error exporting cars CSV:", error);
            res.status(500).send("Error exporting cars CSV");
        }
    }
}

module.exports = { CarInfosRender };
