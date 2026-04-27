const CarInfo = require("../../models/car_info");
const { TheftRecord } = require("../../models/theft_record");

class CarInfosJsonService {
    async getCars(req, res) {
        try {
            const cars = await CarInfo.find();

            res.json(cars);
        } catch (error) {
            console.error("Error fetching car-infos:", error);
            res.status(500).send("Error fetching car-infos");
        }
    }

    async getCar(req, res) {
        try {
            const carId = req.params.id;

            const car = await CarInfo.findById(carId);
            if (!car) {
                return res.json("Error: no car with such Id");
            }

            const recs = await TheftRecord.find({ car_info_id: car._id })
                .populate('status_id', 'status_name');

            res.json({ car, related_records: recs });
        } catch (error) {
            console.error("Error fetching car or related records:", error);
            res.status(500).send("Error fetching car or related records");
        }
    }
}

module.exports = { CarInfosJsonService };
