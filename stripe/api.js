var stripe = require("stripe")(process.env.stripeSecretKey);
const tenants = require("../lib/tenants")

var utils = require("../lib/utils")
const signingSecret = Buffer.from(process.env.stripeSigningSecret, "utf8");

/**  Other events that hit us
    payment_intent.created
    source.chargeable
    charge.succeeded
    payment_intent.successful
    customer.created
    customer.updated
    invoice.payment_succeeded
    invoice.created
    invoice.finalized
    checkout_beta.session_succeeded 
 */

const printObj = (obj)=>{
    console.log(JSON.stringify(obj, null, 4))
}

const getCatalogSummary = async () => {
    let plans = await stripe.plans.list({limit: 100});
    let items = {}

    plans.data.forEach((p) => {
        let groupId = p.metadata.planGroup || p.nickname;
        let productId = p.metadata.productId;
        if(!items[productId]){
            items[productId] = {}
        } 
        if(!items[productId][groupId]){
            items[productId][groupId] = {
                plans: [],
            }
        }
        if(p.metadata.monthlyPrice){
            items[productId][groupId].monthlyPrice =  p.metadata.monthlyPrice
        }
        if(p.metadata.usagePrice){
            items[productId][groupId].usagePrice =  p.metadata.usagePrice
        }
        items[productId][groupId].plans.push(p.id);
    })

    return items
}

const stripeEventHandlers = {
    "checkout_beta.session_succeeded": async (stripeEvt) => {
        return new Promise(async (resolve, reject) => {
            printObj(stripeEvt);
            let tenantId = stripeEvt.data.object.client_reference_id;
            let subId = stripeEvt.data.object.subscription;
            console.log("TENANT_ID = "+tenantId);
            if(!tenantId){
                reject("tenantId is required (missing client_reference_id)")
            }
            let tenant = await tenants.getTenant(tenantId);
            if(!tenant){
                reject("tenant doesn't exist: "+tenantId);
            }
            if(tenant.stripeCustomer){
                reject("stripeCustomer already exists...created another customer for: "+tenantId);
            }
            stripe.subscriptions.retrieve(
                subId,
                async (err, subscription) => {
                    await tenants.syncTenantWithStripe(tenantId, subscription.customer);
                    resolve(true)
                }
            );        
        })
    }
}

module.exports.planList = async (event, context) => {
    try{
        let plans = await getCatalogSummary();
        return utils.success(plans);
    }catch(e){
        console.error(e);
        return utils.error(500, "error getting catalog")
    }
}

module.exports.callback = async (event, context) => {
    let stripeSig = event.headers["Stripe-Signature"];
    let bodyBuff = Buffer.from(event.body, "utf8");
    try{
        let stripeEvt = stripe.webhooks.constructEvent(bodyBuff, stripeSig, signingSecret);
        if(stripeEventHandlers[stripeEvt.type]){
            await stripeEventHandlers[stripeEvt.type](stripeEvt);
        }
        return utils.success({
            result: "ok"
        })
    } catch(e){
        console.error(e);
        return utils.error(400, "error processing stripe callback (see logs)")
    }
}