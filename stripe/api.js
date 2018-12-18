var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);
const tenants = require("../lib/tenants")
const Joi = require("joi")
var utils = require("../lib/utils")

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

const printObj = (obj) => {
    console.log(JSON.stringify(obj, null, 4))
}

const stripeEventHandlers = {
    // checkout process completed successfully
    "checkout_beta.session_succeeded": async (stripeEvt) => {
        printObj(stripeEvt);
        let tenantId = stripeEvt.data.object.client_reference_id;
        let subId = stripeEvt.data.object.subscription;
        if (!tenantId) {
            throw new Error("tenantId is required (missing client_reference_id)")
        }
        let tenant = await tenants.getTenant(tenantId);
        if (!tenant) {
            throw new Error("tenant doesn't exist: " + tenantId);
        }

        let subscription = await stripe.subscriptions.retrieve(subId);
        await tenants.syncTenantWithStripe(tenantId, subscription.customer);
        await tenants.syncMeteredPlanWithUsagePlan(subscription.customer)
    }
}


const changePlanSchema = Joi.object().keys({
    supportPlanId: Joi.string().required(),
    usagePlanId: Joi.string().required()
})

module.exports.setPlans = async (event, context) => {
    try{
        let params = await utils.validate(event.body, changePlanSchema);
        let user = await utils.getUser(event);
        await tenants.setPlans(user.company, params);
        await tenants.syncTenantWithStripe(user.company);
        return utils.success({
            result: "ok"
        })
    } catch(e) {
        console.log(e);
        return utils.error(400, e.message);
    }
}

module.exports.planList = async (event, context) => {
    try {
        let plans = await tenants.getCatalogSummary();
        return utils.success(plans);
    } catch (e) {
        console.error(e);
        return utils.error(500, "error getting catalog")
    }
}

module.exports.callback = async (event, context) => {
    const signingSecret = Buffer.from(process.env.stripeSigningSecret, "utf8");
    let stripeSig = event.headers["Stripe-Signature"];
    let bodyBuff = Buffer.from(event.body, "utf8");
    try {
        let stripeEvt = stripe.webhooks.constructEvent(bodyBuff, stripeSig, signingSecret);
        if (stripeEventHandlers[stripeEvt.type]) {
            await stripeEventHandlers[stripeEvt.type](stripeEvt);
        }
        return utils.success({
            result: "ok"
        })
    } catch (e) {
        console.error(e);
        return utils.error(400, "error processing stripe callback (see logs)")
    }
}