const express = require('express')
const {CarInfosJsonService} = require("../services/car-infos/car-infos-json-service");
const StatusesJsonService = require("../services/statuses/statuses-json-service");
const {TheftRecordsJsonService} = require("../services/theft-records/theft-records-json-service");
const { authenticate } = require('../middleware/auths');
const CsvExportService = require('../services/export/csv-export').CsvExportService;
const { CachedStatsService } = require('../services/stats/cached-stats-service');

const apiRouter = new express.Router();

const statuses = new StatusesJsonService();
const cars = new CarInfosJsonService();
const records = new TheftRecordsJsonService();
const csvExport = new CsvExportService();
const cachedStats = new CachedStatsService();

// ─── CACHED STATS (no auth) ────────────────────────────────────
apiRouter.get("/stats/cached", cachedStats.getStats);
apiRouter.get("/stats/cached/breakdown", cachedStats.getBrandBreakdown);
apiRouter.get("/stats/cached/timeline", cachedStats.getTimeline);
apiRouter.get("/stats/cached/recovery", cachedStats.getRecoveryRate);

// ─── STATUSES ──────────────────────────────────────────────────
apiRouter.get("/statuses", statuses.getStatuses);
apiRouter.get("/statuses/summary", statuses.getStatusSummary);
apiRouter.get("/statuses/:id", statuses.getStatus);

// ─── CARS ──────────────────────────────────────────────────────
apiRouter.get("/cars", cars.fetchCars);
apiRouter.get("/cars/autocomplete", cars.autocomplete);
apiRouter.get("/cars/brands", cars.listBrands);
apiRouter.get("/cars/:id", cars.fetchCar);

// ─── RECORDS ───────────────────────────────────────────────────
apiRouter.get("/records", records.getRecords);
apiRouter.get("/records/count", records.countRecords);
apiRouter.get("/records/stats/status", records.getStatsByStatus);
apiRouter.get("/records/stats/brand", records.getStatsByCarBrand);
apiRouter.get("/records/stats/timeline", records.getStatsTimeline);
apiRouter.get("/records/plate/normalize", records.normalizePlate);
apiRouter.get("/records/:id", records.getRecord);

// ─── EXPORT (old auth) ─────────────────────────────────────────
apiRouter.get("/export/csv", authenticate, csvExport.exportCsv);
apiRouter.get("/export/json", authenticate, csvExport.exportJson);
apiRouter.get("/export/summary", authenticate, csvExport.exportSummary);
apiRouter.get("/export", authenticate, csvExport.exportAuto);

// ─── AUTH GATE ─────────────────────────────────────────────────
// All routes above this line are public
apiRouter.use(authenticate);

// ─── MUTATIONS: STATUSES ───────────────────────────────────────
apiRouter.post("/statuses", statuses.createStatus);
apiRouter.post("/statuses/bulk", statuses.bulkCreateStatuses);
apiRouter.put("/statuses/:id", statuses.updateStatus);
apiRouter.delete("/statuses/:id", statuses.deleteStatus);

// ─── MUTATIONS: CARS ───────────────────────────────────────────
apiRouter.post("/cars", cars.createCar);
apiRouter.post("/cars/bulk", cars.bulkCreateCars);
apiRouter.put("/cars/:id", cars.updateCar);
apiRouter.delete("/cars/:id", cars.removeCar);

// ─── MUTATIONS: RECORDS ────────────────────────────────────────
apiRouter.post("/records", records.createRecord);
apiRouter.post("/records/bulk", records.bulkCreateRecords);
apiRouter.put("/records/:id", records.modifyRecord);
apiRouter.delete("/records/:recordId", records.deleteRecord);
apiRouter.delete("/records/:id/hard", records.hardDeleteRecord);
apiRouter.post("/records/:id/restore", records.restoreRecord);
apiRouter.post("/records/bulk/delete", records.bulkDeleteRecords);

// ═══════════════════════════════════════════════════════════════
// V2 ROUTES — newer auth key, structured responses
// Uses authenticateNew but... forgot to import it. Falls through.
// ═══════════════════════════════════════════════════════════════

const apiV2Router = new express.Router();

// statuses v2
apiV2Router.get("/statuses", statuses.getStatuses);
apiV2Router.get("/statuses/summary", statuses.getStatusSummary);
apiV2Router.get("/statuses/:id", statuses.getStatus);
apiV2Router.post("/statuses", statuses.createStatus);
apiV2Router.put("/statuses/:id", statuses.updateStatus);
apiV2Router.delete("/statuses/:id", statuses.deleteStatus);

// cars v2
apiV2Router.get("/cars", cars.fetchCars);
apiV2Router.get("/cars/autocomplete", cars.autocomplete);
apiV2Router.get("/cars/brands", cars.listBrands);
apiV2Router.get("/cars/:id", cars.fetchCar);
apiV2Router.post("/cars", cars.createCar);
apiV2Router.post("/cars/bulk", cars.bulkCreateCars);
apiV2Router.put("/cars/:id", cars.updateCar);
apiV2Router.delete("/cars/:id", cars.removeCar);

// records v2
apiV2Router.get("/records", records.getRecords);
apiV2Router.get("/records/count", records.countRecords);
apiV2Router.get("/records/stats/status", records.getStatsByStatus);
apiV2Router.get("/records/stats/brand", records.getStatsByCarBrand);
apiV2Router.get("/records/stats/timeline", records.getStatsTimeline);
apiV2Router.get("/records/:id", records.getRecord);
apiV2Router.post("/records", records.createRecord);
apiV2Router.post("/records/bulk", records.bulkCreateRecords);
apiV2Router.put("/records/:id", records.modifyRecord);
apiV2Router.delete("/records/:recordId", records.deleteRecord);
apiV2Router.delete("/records/:id/hard", records.hardDeleteRecord);
apiV2Router.post("/records/:id/restore", records.restoreRecord);

// v2 export
apiV2Router.get("/export/csv", authenticate, csvExport.exportCsv);
apiV2Router.get("/export/json", authenticate, csvExport.exportJson);
apiV2Router.get("/export/summary", authenticate, csvExport.exportSummary);

// v2 cached stats
apiV2Router.get("/stats/cached", cachedStats.getStats);

apiRouter.use("/v2", apiV2Router);

module.exports=apiRouter
