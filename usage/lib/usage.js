const AWS = require("aws-sdk")

const docClient = new AWS.DynamoDB.DocumentClient();

const TABLE = {
    "netvote": "nvUsage",
    "netrosa": "nrUsage"
}

const searchUsageByDate = async (service, start, end, user) => {
    let company = user.company;
    var params = {
        TableName : TABLE[service],
        KeyConditionExpression: "company = :company and createdAt between :startdt and :enddt",
        ExpressionAttributeValues: {
            ":startdt": start,
            ":enddt": end,
            ":company": company
        }
    };

    let res = await docClient.query(params).promise();
    return res.Items;
}

module.exports = {
    searchUsageByDate: searchUsageByDate
}