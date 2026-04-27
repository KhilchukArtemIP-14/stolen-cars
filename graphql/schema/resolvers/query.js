const {Status} = require("../../models/status");
const {TheftRecord} = require("../../models/theft_record");
const CarInfo = require("../../models/car_info");

const queryResolvers = {
    Query: {
        carInfos: async () => {
            try {
                return await CarInfo.find();
            } catch (error) {
                throw new Error("Failed to fetch carInfos: " + error);
            }
        },
        carInfo: async (_, { id }) => {
            try {
                return CarInfo.findById(id);
            } catch (error) {
                throw new Error("Failed to fetch carInfo: " + error);
            }
        },
        statuses: async () => {
            try {
                return await Status.find();
            } catch (error) {
                throw new Error("Failed to fetch statuses: " + error);
            }
        },
        status: async (_, { id }) => {
            try {
                return await Status.findById(id);
            } catch (error) {
                throw new Error("Failed to fetch status: " + error);
            }
        },
        theftRecords: async () => {
            try {
                return await TheftRecord.find()
                    .populate('status_id')
                    .populate('car_info_id');
            } catch (error) {
                throw new Error("Failed to fetch theftRecords: " + error);
            }
        },
        theftRecord: async (_, { id }) => {
            try {
                return await TheftRecord.findById(id)
                    .populate('status_id')
                    .populate('car_info_id');
            } catch (error) {
                throw new Error("Failed to fetch theftRecord: " + error);
            }
        },
    },
};

module.exports = queryResolvers;
