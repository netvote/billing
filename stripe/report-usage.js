var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);
const tenants = require("../lib/tenants")
const usage = require("../usage/lib/usage")


const reportUsage = async (tenant) => {
    let subItem =  tenants.getCurrentMeteredSubItem(tenant.stripeCustomer);

    let startDate = tenant.billedToDate || 0;
    let endDate = new Date().getTime();

    let netvoteCount = await usage.countUsageByDate("netvote", startDate, endDate, tenant.tenantId);
    let netrosaCount = await usage.countUsageByDate("netrosa", startDate, endDate, tenant.tenantId);

    let totalUsage = netvoteCount + netrosaCount;

    if(totalUsage > 0){
        console.log(`Reporting usage for ${tenant.tenantId}, ${subItem.id}, ${totalUsage}`);

        await stripe.usageRecords.create(subItem.id, {
            quantity: totalUsage,
            timestamp: Math.floor((new Date().getTime()/1000)),
            action: "increment"
        });

        await tenants.setTenantBilledToDate(tenant.tenantId, endDate);
    }
}

module.exports.report = async (event, context) => {
    console.log("Starting Billing Execution")
    let tenantList = await tenants.getAllTenants();
    let tasks = []
    for(let i=0; i<tenantList.length; i++){
        let tenant = tenantList[i];
        if(tenant.accountType === "prod" && tenant.stripeCustomer){
            tasks.push(reportUsage(tenant));
        }
    }
    await Promise.all(tasks);
    console.log("Completed Billing Execution")
}