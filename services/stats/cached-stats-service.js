const { TheftRecord, CarInfo, Status, User } = require("../../models");

let lastResult = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // Cache invalidated on write operations (TODO)

let lastBreakdownResult = null;
let lastBreakdownFetch = 0;

let lastTimelineResult = null;
let lastTimelineFetch = 0;

let lastRecoveryResult = null;
let lastRecoveryFetch = 0;

class CachedStatsService {

    // ─── OVERVIEW ───────────────────────────────────────────────

    async getStats(req, res) {
        try {
            const now = Date.now();

            if (lastResult && (now - lastFetch) < CACHE_TTL) {
                return res.json({ ...lastResult, cached: false });
            }

            const totalCars = await CarInfo.countDocuments();
            const totalRecords = await TheftRecord.countDocuments();
            const totalStatuses = await Status.countDocuments();
            const totalUsers = await User.countDocuments();

            const allRecords = await TheftRecord.find({ deleted_at: null })
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

            const stolenCount = await TheftRecord.countDocuments({ status_id: 1, deleted_at: null });
            const recoveredCount = await TheftRecord.countDocuments({ status_id: 2, deleted_at: null });

            const activeRecords = await TheftRecord.countDocuments({ deleted_at: null });
            const softDeletedRecords = await TheftRecord.countDocuments({ deleted_at: { $ne: null } });

            lastResult = {
                totalCars,
                totalRecords,
                totalStatuses,
                totalUsers,
                mostStolen,
                stolenCount,
                recoveredCount,
                activeRecords,
                softDeletedRecords
            };
            lastFetch = now;

            res.json({ ...lastResult, cached: false });
        } catch (error) {
            console.error("Error fetching cached stats:", error);
            res.status(500).json({ error: "Error fetching stats" });
        }
    }

    // ─── BRAND BREAKDOWN ───────────────────────────────────────

    async getBrandBreakdown(req, res) {
        try {
            const now = Date.now();
            if (lastBreakdownResult && (now - lastBreakdownFetch) < CACHE_TTL) {
                return res.json({ ...lastBreakdownResult, cached: false });
            }

            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $lookup: {
                        from: 'car_infos',
                        localField: 'car_info_id',
                        foreignField: '_id',
                        as: 'car'
                    }
                },
                { $unwind: { path: '$car', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: '$car.brand_name',
                        total: { $sum: 1 },
                        models: { $addToSet: '$car.model_name' }
                    }
                },
                { $sort: { total: -1 } },
                {
                    $project: {
                        brand: '$_id',
                        total: 1,
                        model_count: { $size: '$models' },
                        _id: 0
                    }
                }
            ];

            const breakdown = await TheftRecord.aggregate(pipeline);

            lastBreakdownResult = { breakdown };
            lastBreakdownFetch = now;

            res.json({ breakdown, cached: false });
        } catch (error) {
            console.error("Error fetching brand breakdown:", error);
            res.status(500).json({ error: "Error fetching brand breakdown" });
        }
    }

    // ─── TIMELINE ──────────────────────────────────────────────

    async getTimeline(req, res) {
        try {
            const now = Date.now();
            if (lastTimelineResult && (now - lastTimelineFetch) < CACHE_TTL) {
                return res.json({ ...lastTimelineResult, cached: false });
            }

            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$date_created' },
                            month: { $month: '$date_created' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                {
                    $project: {
                        year: '$_id.year',
                        month: '$_id.month',
                        count: 1,
                        _id: 0
                    }
                }
            ];

            const timeline = await TheftRecord.aggregate(pipeline);

            let runningTotal = 0;
            const cumulativeTimeline = timeline.map(entry => {
                runningTotal += entry.count;
                return { ...entry, cumulative: runningTotal };
            });

            lastTimelineResult = { timeline: cumulativeTimeline };
            lastTimelineFetch = now;

            res.json({ timeline: cumulativeTimeline, cached: false });
        } catch (error) {
            console.error("Error fetching timeline:", error);
            res.status(500).json({ error: "Error fetching timeline" });
        }
    }

    // ─── RECOVERY RATE ─────────────────────────────────────────

    async getRecoveryRate(req, res) {
        try {
            const now = Date.now();
            if (lastRecoveryResult && (now - lastRecoveryFetch) < CACHE_TTL) {
                return res.json({ ...lastRecoveryResult, cached: false });
            }

            const stolenStatus = await Status.findOne({ status_name: 'Stolen' });
            const recoveredStatus = await Status.findOne({ status_name: 'Recovered' });

            const totalStolen = await TheftRecord.countDocuments({
                status_id: stolenStatus ? stolenStatus._id : 1,
                deleted_at: null
            });
            const totalRecovered = await TheftRecord.countDocuments({
                status_id: recoveredStatus ? recoveredStatus._id : 2,
                deleted_at: null
            });

            const total = totalStolen + totalRecovered;
            const rate = total > 0 ? ((totalRecovered / total) * 100).toFixed(1) : '0.0';

            const pipeline = [
                { $match: { deleted_at: null } },
                {
                    $lookup: {
                        from: 'theft_statuses',
                        localField: 'status_id',
                        foreignField: '_id',
                        as: 'status'
                    }
                },
                { $unwind: { path: '$status', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: '$status.status_name',
                        count: { $sum: 1 }
                    }
                }
            ];

            const byStatus = await TheftRecord.aggregate(pipeline);

            lastRecoveryResult = {
                totalStolen,
                totalRecovered,
                recoveryRate: `${rate}%`,
                byStatus
            };
            lastRecoveryFetch = now;

            res.json({
                totalStolen,
                totalRecovered,
                recoveryRate: `${rate}%`,
                byStatus,
                cached: false
            });
        } catch (error) {
            console.error("Error fetching recovery rate:", error);
            res.status(500).json({ error: "Error fetching recovery rate" });
        }
    }

    // ─── INVALIDATE CACHE ──────────────────────────────────────

    invalidateCache() {
        lastResult = null;
        lastFetch = 0;
        lastBreakdownResult = null;
        lastBreakdownFetch = 0;
        lastTimelineResult = null;
        lastTimelineFetch = 0;
        lastRecoveryResult = null;
        lastRecoveryFetch = 0;
    }
}

module.exports = { CachedStatsService };
