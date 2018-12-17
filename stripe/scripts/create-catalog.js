var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);



const supportMetadata = {
    "productId": "Support Package"
}

let support = {
    product: {
        name: "Support Package",
        type: "service",
        metadata: {
            "productId": "Support Package"
        }
    },
    plans: [
        {
            amount: 0,
            interval: "month",
            nickname: "Developer",
            currency: "usd",
            metadata: {
                "productId": "Support Package",
                "monthlyPrice": "$0.00"
            }
        },
        {
            amount: 7900,
            interval: "month",
            nickname: "Professional",
            currency: "usd",
            metadata: {
                "productId": "Support Package",
                "monthlyPrice": "$79.00"
            }
        },
        {
            amount: 69900,
            interval: "month",
            nickname: "Premium",
            currency: "usd",
            metadata: {
                "productId": "Support Package",
                "monthlyPrice": "$699.00"
            }
        }
    ]
}


let transactionPackage = {
    product: {
        name: "Transaction Package",
        type: "service",
        metadata: {
            "productId": "Usage Plan"
        },
    },
    plans: [
        {
            amount: 0,
            interval: "month",
            nickname: "Developer",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Developer",
                "monthlyPrice": "$0.00"
            }
        },
        {
            amount: 7500,
            interval: "month",
            nickname: "Bronze",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Bronze",
                "monthlyPrice": "$75.00"
            }
        },
        {
            amount: 22500,
            interval: "month",
            nickname: "Silver",
            currency: "usd",     
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Silver",
                "monthlyPrice": "$225.00"
            }
        },
        {
            amount: 50000,
            interval: "month",
            nickname: "Gold",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Gold",
                "monthlyPrice": "$500.00"
            }
        },
    ]
}

let transactionPlan = {
    product: {
        name: "Transaction Usage",
        type: "service",
        metadata: {
            "productId": "Usage Plan"
        },
    },
    plans: [
        {
            usage_type: "metered",
            interval: "month",
            nickname: "Developer",
            billing_scheme: "tiered",
            tiers_mode: "volume",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Developer",
                "usagePrice": "$0.10"
            },
            tiers: [
                {
                    up_to: 100,
                    unit_amount: 0
                },
                {
                    up_to: "inf",
                    unit_amount: 10
                }
            ]
        },
        {
            usage_type: "metered",
            interval: "month",
            nickname: "Bronze",
            billing_scheme: "tiered",
            tiers_mode: "volume",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Bronze",
                "usagePrice": "$0.08"
            },
            tiers: [
                {
                    up_to: 100,
                    unit_amount: 0
                },
                {
                    up_to: 1000,
                    unit_amount: 0
                },
                {
                    up_to: "inf",
                    unit_amount: 8
                }
            ]
        },
        {
            usage_type: "metered",
            interval: "month",
            nickname: "Silver",
            billing_scheme: "tiered",
            tiers_mode: "volume",
            currency: "usd",            
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Silver",
                "usagePrice": "$0.05"
            },
            tiers: [
                {
                    up_to: 100,
                    unit_amount: 0
                },
                {
                    up_to: 5000,
                    unit_amount: 0
                },
                {
                    up_to: "inf",
                    unit_amount: 5
                }
            ]
        },
        {
            usage_type: "metered",
            interval: "month",
            nickname: "Gold",
            billing_scheme: "tiered",
            tiers_mode: "volume",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "planGroup": "Gold",
                "usagePrice": "$0.03"
            },
            tiers: [
                {
                    up_to: 100,
                    unit_amount: 0
                },
                {
                    up_to: 20000,
                    unit_amount: 0
                },
                {
                    up_to: "inf",
                    unit_amount: 3
                }
            ]
        }
    ]
}


const initializePackage = async (package) => {
    let product = await stripe.products.create(package.product);

    package.plans.forEach(async (p)=>{
        p.product = product.id;
        let plan = await stripe.plans.create(p);
    });
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
const snooze = ms => new Promise(resolve => setTimeout(resolve, ms)); 

const setupCatalog = async () => {
    await initializePackage(support)
    await initializePackage(transactionPackage);
    await initializePackage(transactionPlan);
    await snooze(2000)
    await getCatalogSummary();
}

setupCatalog().then(()=>{
    console.log("setup complete")
});