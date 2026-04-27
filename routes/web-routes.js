const express = require('express')
const {StatusesRender} = require("../services/statuses/statuses-render")
const {CarInfosRender} = require("../services/car-infos/car-infos-render")
const {TheftRecordsRender} = require("../services/theft-records/theft-records-render")
const webRouter = new express.Router();

const statuses = new StatusesRender();
const cars = new CarInfosRender();
const records = new TheftRecordsRender();

webRouter.get("/",(req,res)=>res.render("index"))

//statuses
webRouter.get("/statuses", statuses.getStatuses)
webRouter.post("/statuses",statuses.deleteStatus)

webRouter.get("/statuses/create",statuses.getCreateStatus)
webRouter.post("/statuses/create",statuses.postCreateStatus)

webRouter.get("/statuses/:id",statuses.getStatus)

webRouter.get("/statuses/:id/edit",statuses.getEditStatus)
webRouter.post("/statuses/:id/edit",statuses.postEditStatus)


//cars
webRouter.get("/cars", cars.getCars);
webRouter.post("/cars", cars.deleteCar);

webRouter.get("/cars/create", cars.getCreateCar);
webRouter.post("/cars/create", cars.postCreateCar);

webRouter.get("/cars/:id", cars.getCar);

webRouter.get("/cars/:id/edit", cars.getEditCar);
webRouter.post("/cars/:id/edit", cars.postEditCar);

webRouter.get("/records", records.getRecords);
webRouter.post("/records", records.deleteRecord);


//records
webRouter.get("/records/create", records.getCreateRecord);
webRouter.post("/records/create", records.postCreateRecord);

webRouter.get("/records/:id", records.getRecord);

webRouter.get("/records/:id/edit", records.getEditRecord);
webRouter.post("/records/:id/edit", records.postEditRecord);


module.exports=webRouter