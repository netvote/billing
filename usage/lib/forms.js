const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const FORM_TABLE = "forms"

const getFormById = async (id) => {
    let params = {
        TableName: FORM_TABLE,
        IndexName: "formId-createdAt-index",
        KeyConditionExpression: "formId = :fid",
        ExpressionAttributeValues: {
            ":fid": id
        },
    }
    let res = await docClient.query(params).promise();
    if(res.Items.length > 0){
        return res.Items[0]
    }
    return null;
}

module.exports = {
    getFormById: getFormById
}