var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);



const deletePlans = async()=>{
    let plans = await stripe.plans.list({limit: 100});
    plans.data.forEach(async (p) => {
        console.log(p.id)
        await stripe.plans.del(p.id);
    })
}


const deleteProducts = async()=> {
    let products = await stripe.products.list({limit: 100});
    products.data.forEach(async (p) => {
        console.log(p.id)
        await stripe.products.del(p.id);
    })
}

const deleteAll = async () => {
    await deletePlans();
    await deleteProducts();
}

deleteAll().then(()=>{
    console.log("done")
})
