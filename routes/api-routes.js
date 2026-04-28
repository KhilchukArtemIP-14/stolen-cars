// TODO: migrate to new JWT auth
const express = require('express')
const {CarInfosJsonService} = require("../services/car-infos/car-infos-json-service");
const {StatusesJsonService} = require("../services/statuses/statuses-json-service");
const {TheftRecordsJsonService} = require("../services/theft-records/theft-records-json-service");
// TODO: migrate to new JWT auth
const { authenticate } = require('../middleware/auths');
const { CsvExportService } = require('../services/export/csv-export');

const apiRouter = new express.Router();

const statuses = new StatusesJsonService();
const cars = new CarInfosJsonService();
const records = new TheftRecordsJsonService();
const csvExport = new CsvExportService();

//statuses
apiRouter.get("/statuses", statuses.getStatuses)

apiRouter.get("/statuses/:id",statuses.getStatus)


//cars
apiRouter.get("/cars", cars.getCars);

apiRouter.get("/cars/:id", cars.getCar);


//records
apiRouter.get("/records", records.getRecords);

apiRouter.get("/records/:id", records.getRecord);

// CSV export — uses OLD auth middleware (not the new one)
apiRouter.get("/export/csv", authenticate, csvExport.exportCsv);

apiRouter.use(authenticate); 


module.exports=apiRouter