const AWS = require("aws-sdk")
const uuid = require("uuid/v4")
const docClient = new AWS.DynamoDB.DocumentClient();
const stripe = require("stripe")(process.env.stripeSecretKey)

const TABLE_TENANTS = "tenants";

const getTenant = async (tenantId) => {
    var params = {
        TableName: TABLE_TENANTS,
        Key:{
            "tenantId": tenantId
        }
    };
    let data = await docClient.get(params).promise();
    return data.Item;
}

const syncTenantWithStripe = async (tenantId, stripeCustomerId) => {

    if(!stripeCustomerId){
        let tenant = await getTenant(tenantId);
        if(!tenant.stripeCustomer){
            throw new Error("customer does not have stripeCustomerId")
        }
        stripeCustomerId = tenant.stripeCustomer.id;
    }

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    var params = {
        TableName: TABLE_TENANTS,
        Key:{
            "tenantId": tenantId
        },
        UpdateExpression: "set stripeCustomer = :c, accountType = :p",
        ExpressionAttributeValues:{
            ":c": stripeCustomer,
            ":p": "prod"
        }
    };
    await docClient.update(params).promise();
}

const setPaymentDetails = async (tenantId, stripeToken) => {
    let tenant = await getTenant(tenantId);
    if(!tenant.owner){
        throw new Error("owner needs to have email address defined")
    }
    if(!stripeToken){
        throw new Error("stripeToken is required")
    }
    if(!tenant.stripeCustomer){
        throw new Error("cannot directly set payment method for non-existing stripe customer")
    } else {
        //remote set customer, no need for reference here
        await stripe.customers.update(tenant.stripeCustomer.id, {
            source: stripeToken,
        });
        await syncTenantWithStripe(tenantId, tenant.stripeCustomer.id);
    }
}

const createNewTenant = async (ownerEmail) => {
    let tenantId = uuid();
    var params = {
        TableName: TABLE_TENANTS,
        Item:{
            "tenantId": tenantId,
            "accountType": "beta",
            "maxApiKeys": 1,
            "owner": ownerEmail,
            "createdAt": new Date().getTime()
        }
    };
    await docClient.put(params).promise();
    return tenantId;
}


module.exports = {
    getTenant: getTenant,
    setPaymentDetails: setPaymentDetails,
    createNewTenant: createNewTenant,
    syncTenantWithStripe: syncTenantWithStripe
}