const CarInfo = require("../../models/car_info");
const { TheftRecord } = require("../../models/theft_record");

class CarInfosRender {

    async getCars(req, res) {
        try {
            const cars = await CarInfo.find();

            //in order to implement conditional rendering of elements related
            //to delete functionality, also couple with possibility of delete
            const carsData = await Promise.all(cars.map(async (c) => {
                const r = await TheftRecord.find({ car_info_id: c._id });
                return { value: c, canDelete: r.length === 0 };
            }));

            res.render("car-infos/car-infos", { carsData });
        } catch (error) {
            console.error("Error fetching car-infos:", error);
            res.status(500).send("Error fetching car-infos");
        }
    }

    async getCreateCar(req, res) {
        try {
            res.render("car-infos/create-car-info");
        } catch (error) {
            console.error("Error rendering create car page:", error);
            res.status(500).send("Error rendering create car page");
        }
    }

    async postCreateCar(req, res) {
        try {
            const brandName = req.body.brand_name;
            const modelName = req.body.model_name;

            const car = new CarInfo({brand_name: brandName,model_name: modelName });

            await car.save();
            res.redirect('/cars');
        } catch (error) {
            console.error("Error creating car:", error);
            res.status(500).send("Error creating car");
        }
    }

    async getEditCar(req, res) {
        try {
            const carId = req.params.id;

            const carInfo = await CarInfo.findById(carId);
            if (!carInfo) {
                return res.redirect("/cars");
            }

            res.render("car-infos/edit-car-info", { car: carInfo });
        } catch (error) {
            console.error("Error fetching car for editing:", error);
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

            res.redirect('/cars');
        } catch (error) {
            console.error("Error updating car:", error);
            res.status(500).send("Error updating car");
        }
    }

    async deleteCar(req, res) {
        try {
            const carId = req.body.car_id;

            await CarInfo.findByIdAndDelete(carId);

            res.redirect('/cars');
        } catch (error) {
            console.error("Error deleting car:", error);
            res.status(500).send("Error deleting car");
        }
    }

    async getCar(req, res) {
        try {
            const carId = req.params.id;

            const car = await CarInfo.findById(carId);
            if (!car) {
                return res.redirect("/car");
            }

            const recs = await TheftRecord
                .find({ car_info_id: car._id })
                .populate('status_id', 'status_name');

            res.render(`car-infos/car-info`, {car, records: recs });
        } catch (error) {
            console.error("Error fetching car or related records:", error);
            res.status(500).send("Error fetching car or related records");
        }
    }
}

module.exports = { CarInfosRender };
