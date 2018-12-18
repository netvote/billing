const AWS = require("aws-sdk")

const docClient = new AWS.DynamoDB.DocumentClient(
    {region: "us-east-1"}
);

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

const countUsageByDate = async (service, start, end, company) => {
    var params = {
        TableName : TABLE[service],
        KeyConditionExpression: "company = :company and createdAt between :startdt and :enddt",
        FilterExpression: '#m = :p',
        ExpressionAttributeNames: {
            "#m": "mode"
        },
        ExpressionAttributeValues: {
            ":startdt": start,
            ":enddt": end,
            ":company": company,
            ":p": "PROD"
        }
    };

    let res = await docClient.query(params).promise();
    return res.Count;
}

module.exports = {
    searchUsageByDate: searchUsageByDate,
    countUsageByDate: countUsageByDate
}