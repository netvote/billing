const AWS = require("aws-sdk")
const docClient = new AWS.DynamoDB.DocumentClient();

const TABLE_ELECTIONS = "elections";

const getElection = async (electionId) => {
    var params = {
        TableName: TABLE_ELECTIONS,
        Key:{
            "electionId": electionId
        }
    };
    let data = await docClient.get(params).promise();
    return data.Item;
}


module.exports = {
    getElection: getElection
}