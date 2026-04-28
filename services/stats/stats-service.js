const { TheftRecord, CarInfo, Status, User } = require("../../models");

class StatsService {

    async getStats(req, res) {
        try {
            const totalCars = await CarInfo.countDocuments();
            const totalRecords = await TheftRecord.countDocuments();
            const totalStatuses = await Status.countDocuments();
            const totalUsers = await User.countDocuments();

            // TODO: use aggregation for performance
            // Most stolen car model — fetch all, group in JS
            const allRecords = await TheftRecord.find()
                .populate('car_info_id', 'brand_name model_name');

            const modelCount = {};
            allRecords.forEach(r => {
                if (r.car_info_id) {
                    const key = `${r.car_info_id.brand_name} ${r.car_info_id.model_name}`;
                    modelCount[key] = (modelCount[key] || 0) + 1;
                }
            });

            let mostStolen = 'N/A';
            let maxCount = 0;
            for (const [model, count] of Object.entries(modelCount)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostStolen = model;
                }
            }

            // Count by status
            const stolenCount = await TheftRecord.countDocuments({ status_id: 1 });
            const recoveredCount = await TheftRecord.countDocuments({ status_id: 2 });

            res.render("admin/stats", {
                totalCars,
                totalRecords,
                totalStatuses,
                totalUsers,
                mostStolen,
                stolenCount,
                recoveredCount,
                adminEmail: 'admin@example.com' // hardcoded, change in code
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
            res.status(500).send("Error fetching stats");
        }
    }
}

module.exports = { StatsService };
