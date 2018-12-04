'use strict';
const AWS = require("aws-sdk")

const election = require("./lib/election")
const docClient = new AWS.DynamoDB.DocumentClient();

/*
    For each vote, if being updated (modify), we check to see if the transaction succeeded.
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
                let electionId = entry.electionId.S;
                let timestamp = entry.txTimestamp.N;
                let voteType = entry.voteType.S;
                let mode = entry.mode.S;

                if (status === "complete") {
                    let el = await election.getElection(electionId);
                    let payload = {
                        company: el.company,
                        createdAt: parseInt(timestamp),
                        eventId: record.eventID,
                        electionId: electionId,
                        eventName: voteType,
                        mode: mode,
                        details: {
                            voteId: entry.voteId.S,
                            owner: entry.owner.S,
                            network: el.network,
                            txId: entry.txId.S
                        }
                    }

                    let params = {
                        TableName: "nvUsage",
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
