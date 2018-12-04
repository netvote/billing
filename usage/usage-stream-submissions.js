'use strict';
const AWS = require("aws-sdk")
const forms = require("./lib/forms")
const docClient = new AWS.DynamoDB.DocumentClient();

/*
    For each submission, if being updated (modify), we check to see if the transaction succeeded.
    If successful, then we insert a usage record.
*/

module.exports.update = async (event, context) => {
    for (let i = 0; i < event.Records.length; i++) {
        let record = event.Records[i];
        try {
            if (record.eventName === "MODIFY") {
                let entry = record.dynamodb.NewImage;
                console.log(JSON.stringify(entry));

                let status = entry.txStatus.S;
                let formId = entry.formId.S;
                let timestamp = entry.createdAt.N;
                let mode = entry.mode.S;

                if (status === "complete") {
                    let form = await forms.getFormById(formId)
                    let payload = {
                        company: form.company,
                        createdAt: parseInt(timestamp),
                        eventId: record.eventID,
                        formId: formId,
                        eventName: "submission",
                        mode: mode,
                        details: {
                            subId: entry.subId.S,
                            network: form.network,
                            txId: entry.txId.S
                        }
                    }

                    let params = {
                        TableName: "nrUsage",
                        Item: payload
                    }
                    await docClient.put(params).promise();

                } else {
                    console.log(`Skipping, status = ${status}`)
                }
            }
        } catch (e) {
            console.log("skipping due to error")
            console.error(e);
        }
    }
};
