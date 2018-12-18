var tenants = require("../../lib/tenants");

let print = (obj) =>{
    console.log(JSON.stringify(obj, null, 4));
}

tenants.setPlans("netvote", {
    usagePlanId: "plan_EB7XLrBaFtVANL",
    supportPlanId: "plan_EB7XTpOp8U3Ag1"
}).then(()=>{

})