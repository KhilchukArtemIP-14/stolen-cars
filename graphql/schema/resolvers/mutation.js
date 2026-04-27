const CarInfo = require("../../models/car_info");
const {Status} = require("../../models/status");
const {TheftRecord} = require("../../models/theft_record");

const mutationResolvers = {
    Mutation: {
        createCarInfo: async (_, { brand_name, model_name }) => {
            try {
                const carInfo = new CarInfo({ brand_name, model_name });
                return await carInfo.save();
            } catch (error) {
                throw new Error("Failed to create carInfo: " + error);
            }
        },
        updateCarInfo: async (_, { id, brand_name, model_name }) => {
            try {
                return await CarInfo.findByIdAndUpdate(
                    id,
                    { brand_name, model_name },
                    { new: true }
                );
            } catch (error) {
                throw new Error("Failed to update carInfo: " + error);
            }
        },
        deleteCarInfo: async (_, { id }) => {
            try {
                var dependentRecords = await TheftRecord.find({ car_info_id: id });
                if(dependentRecords.length!==0) return false;
                const deletedCarInfo = await CarInfo.findByIdAndDelete(id);
                return !!deletedCarInfo;
            } catch (error) {
                throw new Error("Failed to delete carInfo: " + error);
            }
        },
        createStatus: async (_, { status_name }) => {
            try {
                const status = new Status({ status_name });
                return await status.save();
            } catch (error) {
                throw new Error("Failed to create status: " + error);
            }
        },
        updateStatus: async (_, { id, status_name }) => {
            try {
                return await Status.findByIdAndUpdate(id, { status_name }, { new: true });
            } catch (error) {
                throw new Error("Failed to update status: " + error);
            }
        },
        deleteStatus: async (_, { id }) => {
            try {
                var dependentRecords = await TheftRecord.find({ status_id: id });
                if(dependentRecords.length!==0) return false;

                const deletedStatus = await Status.findByIdAndDelete(id);
                return deletedStatus ? true : false;
            } catch (error) {
                throw new Error("Failed to delete status: " + error);
            }
        },
        createTheftRecord: async (_, { car_info_id, status_id, car_number, owner_surname }) => {
            try {
                const theftRecord = new TheftRecord({ car_info_id, status_id, car_number, owner_surname });
                await theftRecord.save()
                return await TheftRecord.findById(theftRecord._id)
                    .populate('status_id')
                    .populate('car_info_id');
            } catch (error) {
                throw new Error("Failed to create theftRecord: " + error);
            }
        },
        updateTheftRecord: async (_, { id, car_info_id, status_id, car_number, owner_surname }) => {
            try {
                return await TheftRecord.findByIdAndUpdate(
                    id,
                    { car_info_id, status_id, car_number, owner_surname },
                    { new: true }
                ).populate('status_id').populate('car_info_id');
            } catch (error) {
                throw new Error("Failed to update theftRecord: " + error);
            }
        },
        deleteTheftRecord: async (_, { id }) => {
            try {
                const deletedTheftRecord = await TheftRecord.findByIdAndDelete(id);
                return !!deletedTheftRecord;
            } catch (error) {
                throw new Error("Failed to delete theftRecord: " + error);
            }
        },
    },
};

module.exports = mutationResolvers;
