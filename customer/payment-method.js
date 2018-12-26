const utils = require("../lib/utils")
const tenants = require("../lib/tenants")
const Joi = require("joi")

const savePaymentSchema = Joi.object().keys({
    stripeToken: Joi.string().required()
})

module.exports.save = async (event, context) => {
    try {
        console.log(event);
        let params = await utils.validate(event.body, savePaymentSchema);
        let user = utils.getUser(event);
        let tenant = await tenants.getTenant(user.company);

        if(!tenant){
            return utils.error(404, `error, tenant does not exist: ${user.company}`)
        }

        await tenants.setPaymentDetails(user.company, params.stripeToken)
        return utils.success({
            message: "Payment method updated"
        })
    } catch(e) {
        console.error(e);
        return utils.error(400, {
            code: 400,
            errorType: "VALIDATION",
            message: e.message
        })
    }
};
