const {buildSchema} = require("graphql")

module.exports=  buildSchema(`
    scalar Date
    
    type CarInfo {
      _id: Int!
      brand_name: String!
      model_name: String!
      date_created: Date!
    }
    
    type Status {
      _id: Int!
      status_name: String!
      date_created: Date!
    }
    
    type TheftRecord {
      _id: Int!
      car_info_id: CarInfo!
      status_id: Status!
      car_number: String!
      owner_surname: String!
      date_created: Date!
    }
    
    type Mutation {
      createCarInfo(brand_name: String!, model_name: String!): CarInfo
      updateCarInfo(id: Int!, brand_name: String!, model_name: String!): CarInfo
      deleteCarInfo(id: Int!): Boolean
      createStatus(status_name: String!): Status
      updateStatus(id: Int!, status_name: String!): Status
      deleteStatus(id: Int!): Boolean
      createTheftRecord(car_info_id: Int!, status_id: Int!, car_number: String!, owner_surname: String!): TheftRecord
      updateTheftRecord(id: Int!, car_info_id: Int, status_id: Int, car_number: String, owner_surname: String): TheftRecord
      deleteTheftRecord(id: Int!): Boolean
    }
    
    type Query {
      carInfos: [CarInfo]
      carInfo(id: Int!): CarInfo
      statuses: [Status]
      status(id: Int!): Status
      theftRecords: [TheftRecord]
      theftRecord(id: Int!): TheftRecord
    }
`)
