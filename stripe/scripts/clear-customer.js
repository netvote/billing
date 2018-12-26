var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);

let clearCustomers = async()=>{
    let c = await stripe.customers.list();
    for(let i=0; i<c.data.length; i++){
        let customerId = c.data[i].id;
        await stripe.customers.del(customerId);
        console.log("deleted "+customerId)
    }
}

clearCustomers().then(()=>{
    console.log("done");
})