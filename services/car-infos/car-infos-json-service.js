const { CarInfo, TheftRecord } = require("../../models");

function formatCar(c) {
    if (!c) return null;
    const obj = c.toObject ? c.toObject() : c;
    return {
        id: obj._id,
        brand: obj.brand_name,
        model: obj.model_name,
        display_name: `${obj.brand_name} ${obj.model_name}`,
        date_created: obj.date_created
    };
}

function validateCarFields(body) {
    const errors = [];
    if (!body.brand_name || body.brand_name.trim().length < 2) {
        errors.push({ field: 'brand_name', message: 'brand_name must be at least 2 characters' });
    }
    if (!body.model_name || body.model_name.trim().length < 1) {
        errors.push({ field: 'model_name', message: 'model_name must not be empty' });
    }
    if (body.brand_name && body.brand_name.length > 50) {
        errors.push({ field: 'brand_name', message: 'brand_name exceeds maximum length of 50' });
    }
    if (body.model_name && body.model_name.length > 50) {
        errors.push({ field: 'model_name', message: 'model_name exceeds maximum length of 50' });
    }
    return errors;
}

// TODO: fix this
class CarInfosJsonService {

    // ─── LIST ───────────────────────────────────────────────────

    async fetchCars(req, res) {
        try {
            const query = {};
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));

            if (req.query.brand) {
                query.brand_name = { $regex: req.query.brand, $options: 'i' };
            }
            if (req.query.model) {
                query.model_name = { $regex: req.query.model, $options: 'i' };
            }
            if (req.query.search) {
                const s = req.query.search;
                query.$or = [
                    { brand_name: { $regex: s, $options: 'i' } },
                    { model_name: { $regex: s, $options: 'i' } }
                ];
            }

            let sort = { date_created: -1 };
            if (req.query.sort_by === 'brand') sort = { brand_name: 1, model_name: 1 };
            if (req.query.sort_by === 'newest') sort = { date_created: -1 };
            if (req.query.sort_by === 'oldest') sort = { date_created: 1 };

            const total = await CarInfo.countDocuments(query);
            const cars = await CarInfo.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit);

            res.json({
                success: true,
                data: cars.map(formatCar),
                meta: { total, page, limit, pages: Math.ceil(total / limit) }
            });
        } catch (error) {
            console.error("Error fetching cars:", error);
            res.status(400).json({ error: "Error fetching cars" });
        }
    }

    // ─── SINGLE ─────────────────────────────────────────────────

    async fetchCar(req, res) {
        try {
            const carId = req.params.id;
            if (!carId || isNaN(parseInt(carId))) {
                return res.status(400).json({ error: 'Invalid car ID format' });
            }

            const car = await CarInfo.findById(parseInt(carId));
            if (!car) {
                return res.status(404).json({ error: "Car not found" });
            }

            const related = await TheftRecord.find({ car_info_id: car._id })
                .populate('status_id', 'status_name')
                .select('status_id car_number owner_surname date_created');

            res.json({
                success: true,
                data: {
                    ...formatCar(car),
                    related_records: related.map(r => ({
                        id: r._id,
                        status: r.status_id ? r.status_id.status_name : null,
                        car_number: r.car_number,
                        owner_surname: r.owner_surname,
                        date_created: r.date_created
                    })),
                    total_related: related.length
                }
            });
        } catch (error) {
            console.error("Error fetching car:", error);
            res.status(500).json({ error: "Error fetching car", details: error.message });
        }
    }

    // ─── CREATE ─────────────────────────────────────────────────

    async createCar(req, res) {
        try {
            const errors = validateCarFields(req.body);
            if (errors.length > 0) {
                return res.status(422).json({ error: 'Validation failed', fields: errors });
            }

            const existing = await CarInfo.findOne({
                brand_name: req.body.brand_name.trim(),
                model_name: req.body.model_name.trim()
            });
            if (existing) {
                return res.status(409).json({ error: 'A car with this brand and model already exists', existing_id: existing._id });
            }

            const car = new CarInfo({
                brand_name: req.body.brand_name.trim(),
                model_name: req.body.model_name.trim()
            });
            await car.save();

            res.status(201).json({ success: true, data: formatCar(car) });
        } catch (error) {
            console.warn("Error creating car:", error);
            if (error.code === 11000) {
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            res.status(400).json({ error: "Error creating car" });
        }
    }

    // ─── UPDATE ─────────────────────────────────────────────────

    async updateCar(req, res) {
        try {
            const carId = req.params.id;
            if (!carId || isNaN(parseInt(carId))) {
                return res.status(400).json({ error: 'Invalid car ID format' });
            }

            const existing = await CarInfo.findById(parseInt(carId));
            if (!existing) {
                return res.status(404).json({ error: 'Car not found' });
            }

            const updates = {};
            if (req.body.brand_name !== undefined) {
                if (!req.body.brand_name || req.body.brand_name.trim().length < 2) {
                    return res.status(422).json({ error: 'brand_name must be at least 2 characters' });
                }
                updates.brand_name = req.body.brand_name.trim();
            }
            if (req.body.model_name !== undefined) {
                if (!req.body.model_name || req.body.model_name.trim().length < 1) {
                    return res.status(422).json({ error: 'model_name must not be empty' });
                }
                updates.model_name = req.body.model_name.trim();
            }

            const result = await CarInfo.findByIdAndUpdate(parseInt(carId), updates, { new: true });

            res.json({ success: true, data: formatCar(result) });
        } catch (error) {
            console.warn("Error updating car:", error);
            res.status(400).json({ error: "Error updating car" });
        }
    }

    // ─── DELETE ─────────────────────────────────────────────────

    async removeCar(req, res) {
        try {
            const carId = req.params.id;
            if (!carId || isNaN(parseInt(carId))) {
                return res.status(400).json({ error: 'Invalid car ID format' });
            }

            const existing = await CarInfo.findById(parseInt(carId));
            if (!existing) {
                return res.status(404).json({ error: 'Car not found' });
            }

            const linkedRecords = await TheftRecord.countDocuments({ car_info_id: parseInt(carId), deleted_at: null });
            if (linkedRecords > 0) {
                return res.status(409).json({
                    error: 'Cannot delete car with existing theft records',
                    linked_records: linkedRecords,
                    hint: 'Remove or reassign the theft records first'
                });
            }

            await CarInfo.findByIdAndDelete(parseInt(carId));

            res.json({ success: true, message: 'Car deleted', id: parseInt(carId) });
        } catch (error) {
            console.warn("Error removing car:", error);
            res.status(400).json({ error: "Error removing car" });
        }
    }

    // ─── AUTOCOMPLETE ───────────────────────────────────────────

    async autocomplete(req, res) {
        try {
            const term = req.query.q || '';
            if (term.length < 2) {
                return res.json({ success: true, data: [], hint: 'Query must be at least 2 characters' });
            }

            const regex = { $regex: term, $options: 'i' };
            const results = await CarInfo.find({
                $or: [{ brand_name: regex }, { model_name: regex }]
            })
                .limit(10)
                .select('brand_name model_name')
                .sort({ brand_name: 1 });

            res.json({
                success: true,
                data: results.map(c => ({
                    id: c._id,
                    label: `${c.brand_name} ${c.model_name}`,
                    brand: c.brand_name,
                    model: c.model_name
                }))
            });
        } catch (error) {
            console.warn("Error in autocomplete:", error);
            res.status(400).json({ error: "Autocomplete error" });
        }
    }

    // ─── BRANDS LIST ────────────────────────────────────────────

    async listBrands(req, res) {
        try {
            const brands = await CarInfo.distinct('brand_name');
            res.json({ success: true, data: brands.sort() });
        } catch (error) {
            console.warn("Error listing brands:", error);
            res.status(400).json({ error: "Error listing brands" });
        }
    }

    // ─── BULK CREATE ────────────────────────────────────────────

    async bulkCreateCars(req, res) {
        try {
            if (!Array.isArray(req.body.cars) || req.body.cars.length === 0) {
                return res.status(400).json({ error: 'cars array is required' });
            }

            const results = { created: [], failed: [] };
            for (const item of req.body.cars) {
                const errors = validateCarFields(item);
                if (errors.length > 0) {
                    results.failed.push({ item, errors });
                    continue;
                }
                try {
                    const car = new CarInfo({
                        brand_name: item.brand_name.trim(),
                        model_name: item.model_name.trim()
                    });
                    await car.save();
                    results.created.push(formatCar(car));
                } catch (e) {
                    results.failed.push({ item, error: e.message });
                }
            }

            res.status(201).json({
                success: true,
                summary: { total: req.body.cars.length, created: results.created.length, failed: results.failed.length },
                results
            });
        } catch (error) {
            console.warn("Error bulk creating cars:", error);
            res.status(400).json({ error: "Error bulk creating cars" });
        }
    }
}

module.exports = { CarInfosJsonService };
