const AWS = require("aws-sdk")
const uuid = require("uuid/v4")
const docClient = new AWS.DynamoDB.DocumentClient({
    region: "us-east-1"
});
const stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY)

const PLAN_SUPPORT = "Support Package";
const PLAN_USAGE = "Usage Plan";

const TABLE_TENANTS = "tenants";

const getAllTenants = async () => {
    var params = {
        TableName: TABLE_TENANTS
    }
    let data = await docClient.scan(params).promise();
    return data.Items;
}

const getTenant = async (tenantId) => {
    var params = {
        TableName: TABLE_TENANTS,
        Key: {
            "tenantId": tenantId
        }
    };
    let data = await docClient.get(params).promise();
    return data.Item;
}

const syncTenantWithStripe = async (tenantId, stripeCustomerId) => {

    if (!stripeCustomerId) {
        let tenant = await getTenant(tenantId);
        if (!tenant.stripeCustomer) {
            throw new Error("customer does not have stripeCustomerId")
        }
        stripeCustomerId = tenant.stripeCustomer.id;
    }

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    let supportSubItem = await getCurrentSupportSubItem(stripeCustomer);
    let usageSubItem = await getCurrentUsageSubItem(stripeCustomer);
    
    var params = {
        TableName: TABLE_TENANTS,
        Key: {
            "tenantId": tenantId
        },
        UpdateExpression: "set stripeCustomer = :c, accountType = :p, usagePlanId = :u, supportPlanId = :s, usagePlanLevel = :ul, supportPlanLevel = :sl",
        ExpressionAttributeValues: {
            ":c": stripeCustomer,
            ":p": "prod",
            ":u": usageSubItem.plan.id,
            ":s": supportSubItem.plan.id,
            ":ul": usageSubItem.plan.metadata.groupId,
            ":sl": supportSubItem.plan.metadata.groupId
        }
    };
    await docClient.update(params).promise();
}

const getDefaultPlans = async () => {
    let catalog = await getCatalogSummary();
    return {
        supportPlanId: catalog[PLAN_SUPPORT]["Developer"].planId,
        usagePlanId: catalog[PLAN_USAGE]["Developer"].planId
    }
}

const setPaymentDetails = async (tenantId, stripeToken) => {
    let tenant = await getTenant(tenantId);
    if (!tenant.owner) {
        throw new Error("owner needs to have email address defined")
    }
    if (!stripeToken) {
        throw new Error("stripeToken is required")
    }
    if (!tenant.stripeCustomer) {
        let customer = await stripe.customers.create({
            source: stripeToken,
        });    
        await setPlanLevels(customer.id, "Developer", "Developer");
        await syncTenantWithStripe(tenantId, customer.id);
    } else {
        //remote set customer, no need for reference here
        await stripe.customers.update(tenant.stripeCustomer.id, {
            source: stripeToken,
        });
        await syncTenantWithStripe(tenantId, tenant.stripeCustomer.id);
    }
}

// avoids floating points
const toUsd = (amountCents) => {
    let amountStr = `${amountCents}`
    let dollars = amountStr.substring(0, amountStr.length - 2) || "0";
    let cents = amountStr.substring(amountStr.length - 2) || "00";
    if (cents.length == 1) {
        cents = `0${cents}`
    }
    return `$${dollars}.${cents}`;
}

const getCatalogSummary = async () => {
    let plans = await stripe.plans.list({ limit: 100 });
    let items = {}

    plans.data.forEach((p) => {
        let groupId = p.metadata.groupId || p.nickname;
        let productId = p.metadata.productId;
        if(productId){
            if (!items[productId]) {
                items[productId] = {}
            }
            if (!items[productId][groupId]) {
                items[productId][groupId] = {
                    plans: []
                }
            }

            if (p.usage_type === "licensed") {
                items[productId][groupId].monthlyPrice = toUsd(p.amount);
                items[productId][groupId].planId = p.id;
                items[productId][groupId].plans.push(p.id)
            }
            if (p.usage_type === "metered") {
                items[productId][groupId].usagePrice = p.metadata.usagePrice;
                items[productId][groupId].includedTx = p.metadata.includedTx || "0";
                items[productId][groupId].meteredPlanId = p.id;
            }
        }
    })

    return items
}

const getSubscriptionItemByProductId = (customerObj, usageType, productId) => {
    for (let i = 0; i < customerObj.subscriptions.data.length; i++) {
        let sub = customerObj.subscriptions.data[i];
        for (let j = 0; j < sub.items.data.length; j++) {
            let item = sub.items.data[j];
            if (item.plan.usage_type === usageType && item.plan.metadata.productId === productId) {
                return item;
            }
        }
    }
    return null;
}

const getCurrentSupportSubItem = (customerObj) => {
    return getSubscriptionItemByProductId(customerObj, "licensed", PLAN_SUPPORT)
}

const getCurrentUsageSubItem = (customerObj) => {
    return getSubscriptionItemByProductId(customerObj, "licensed", PLAN_USAGE)
}

const getCurrentMeteredSubItem = (customerObj) => {
    return getSubscriptionItemByProductId(customerObj, "metered", PLAN_USAGE)
}


const getSupportPlanChanges = async (customerId, level) => {
    let stripeCustomer = await stripe.customers.retrieve(customerId);
    let catalog = await getCatalogSummary();
    let planSubItem = getCurrentSupportSubItem(stripeCustomer);

    let changes = []

    console.log(JSON.stringify(catalog, null, 4))
    console.log("level: "+level)
    
    if (planSubItem.plan.id !== catalog[PLAN_SUPPORT][level].planId) {
        changes.push({
            id: planSubItem.id,
            plan: catalog[PLAN_SUPPORT][level].planId
        })
    }
    return changes;
}

const getUsagePlanChanges = async (customerId, level) => {
    let stripeCustomer = await stripe.customers.retrieve(customerId);
    let catalog = await getCatalogSummary();
    let meteredSubscriptionItem = getCurrentMeteredSubItem(stripeCustomer);
    let usagePlanSubItem = getCurrentUsageSubItem(stripeCustomer);

    let changes = []

    if (meteredSubscriptionItem.plan.id != catalog[PLAN_USAGE][level].meteredPlanId) {
        changes.push({
            id: meteredSubscriptionItem.id,
            plan: catalog[PLAN_USAGE][level].meteredPlanId
        })
    }

    if (usagePlanSubItem.plan.id != catalog[PLAN_USAGE][level].planId) {
        changes.push({
            id: usagePlanSubItem.id,
            plan: catalog[PLAN_USAGE][level].planId
        })
    }

    return changes;
}

let getLevelFromCatalog = (catalog, productId, planId) => {
    let keys = Object.keys(catalog[productId]);
    for (let i = 0; i < keys.length; i++) {
        if (catalog[productId][keys[i]].planId === planId) {
            return keys[i];
        }
    }
    return null;
}

const setPlanLevels = async (stripeCustomerId, supportLevel, usageLevel) => {
    let supportChanges = await getSupportPlanChanges(stripeCustomerId, supportLevel);
    let usageChanges = await getUsagePlanChanges(stripeCustomerId, usageLevel);
    let customer = await stripe.customers.retrieve(stripeCustomerId);

    let changes = supportChanges.concat(usageChanges);

    if (changes.length > 0) {
        console.log(`applying changes to ${stripeCustomerId}: ` + JSON.stringify(changes, null, 4))
        await stripe.subscriptions.update(customer.subscriptions.data[0].id, {
            items: changes
        })
    } else {
        console.log(`no changes required for ${stripeCustomerId}`)
    }
}

// changemap has usagePlanId and supportPlanId
const setPlans = async (tenantId, changeMap) => {
    let tenant = await getTenant(tenantId);
    let catalog = await getCatalogSummary();

    let usageLevel = getLevelFromCatalog(catalog, PLAN_USAGE, changeMap.usagePlanId);
    let supportLevel = getLevelFromCatalog(catalog, PLAN_SUPPORT, changeMap.supportPlanId);

    if (!usageLevel) {
        throw new Error("cannot find level for usage planId: " + changeMap.usagePlanId);
    }
    if (!supportLevel) {
        throw new Error("cannot find level for usage planId: " + changeMap.supportLevel);
    }
    await setPlanLevels(tenant.stripeCustomer.id, supportLevel, usageLevel )
}

const syncMeteredPlanWithUsagePlan = async (customerId) => {
    let stripeCustomer = await stripe.customers.retrieve(customerId);
    let catalog = await getCatalogSummary();
    let meteredSubscriptionItem = getCurrentMeteredSubItem(stripeCustomer);
    let usagePlanSubItem = getCurrentUsageSubItem(stripeCustomer);
    let groupId = usagePlanSubItem.plan.metadata.groupId;

    let desiredPlanId = catalog["Usage Plan"][groupId].meteredPlanId;

    if (meteredSubscriptionItem && meteredSubscriptionItem.plan.id !== desiredPlanId) {
        console.log(`changing metered plan for ${customerId} from ${meteredSubscriptionItem.plan.id} to ${desiredPlanId}`)
        let subItemId = meteredSubscriptionItem.id;
        await stripe.subscriptionItems.update(subItemId, {
            plan: desiredPlanId,
        });
    } else if (!meteredSubscriptionItem) {
        console.log(`adding metered plan to ${customerId}, planId=${desiredPlanId}`)
        await stripe.subscriptions.update(stripeCustomer.subscriptions.data[0].id, {
            items: [{
                plan: desiredPlanId
            }]
        })
    } else {
        console.log(`${customerId} already has plan=${desiredPlanId}, no changes required`)
    }
}

const setTenantBilledToDate = async (tenantId, billtedToDate) => {
    var params = {
        TableName: TABLE_TENANTS,
        Key: {
            "tenantId": tenantId
        },
        UpdateExpression: "set billedToDate = :b",
        ExpressionAttributeValues: {
            ":b": billtedToDate   
        }
    };
    await docClient.update(params).promise();
}

const createNewTenant = async (ownerEmail) => {
    let tenantId = uuid();
    var params = {
        TableName: TABLE_TENANTS,
        Item: {
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
    getAllTenants: getAllTenants,
    getTenant: getTenant,
    setPaymentDetails: setPaymentDetails,
    createNewTenant: createNewTenant,
    syncTenantWithStripe: syncTenantWithStripe,
    syncMeteredPlanWithUsagePlan: syncMeteredPlanWithUsagePlan,
    getCurrentMeteredSubItem: getCurrentMeteredSubItem,
    getCatalogSummary: getCatalogSummary,
    setPlans: setPlans,
    setTenantBilledToDate: setTenantBilledToDate
}