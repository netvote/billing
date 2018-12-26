var stripe = require("stripe")(process.env.STRIPE_API_SECRET_KEY);


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
                "groupId": "Developer",
                "available": "true"
            }
        },
        {
            amount: 7900,
            interval: "month",
            nickname: "Professional",
            currency: "usd",
            metadata: {
                "productId": "Support Package",
                "groupId": "Professional",
                "available": "true"
            }
        },
        {
            amount: 69900,
            interval: "month",
            nickname: "Premium",
            currency: "usd",
            metadata: {
                "productId": "Support Package",
                "groupId": "Premium",
                "available": "true"
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
                "groupId": "Developer",
                "available": "true"
            }
        },
        {
            amount: 7900,
            interval: "month",
            nickname: "Bronze",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Bronze",
                "available": "true"
            }
        },
        {
            amount: 24900,
            interval: "month",
            nickname: "Silver",
            currency: "usd",     
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Silver",
                "available": "true"
            }
        },
        {
            amount: 49900,
            interval: "month",
            nickname: "Gold",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Gold",
                "available": "true"
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
            tiers_mode: "graduated",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Developer",
                "usagePrice": "$0.10",
                "available": "true"
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
            tiers_mode: "graduated",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Bronze",
                "usagePrice": "$0.08",
                "includedTx": "1000",
                "available": "true"
            },
            tiers: [
                {
                    up_to: 1100,
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
            tiers_mode: "graduated",
            currency: "usd",            
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Silver",
                "usagePrice": "$0.05",
                "includedTx": "5000",
                "available": "true"
            },
            tiers: [
                {
                    up_to: 5100,
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
            tiers_mode: "graduated",
            currency: "usd",
            metadata: {
                "productId": "Usage Plan",
                "groupId": "Gold",
                "usagePrice": "$0.03",
                "includedTx": "20000",
                "available": "true"
            },
            tiers: [
                {
                    up_to: 20100,
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

// avoids floating points
const toUsd = (amountCents) => {
    let amountStr = `${amountCents}`
    let dollars = amountStr.substring(0, amountStr.length - 2) || "0";
    let cents = amountStr.substring(amountStr.length - 2) || "00";
    if(cents.length == 1){
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
        if (!items[productId]) {
            items[productId] = {}
        }
        if (!items[productId][groupId]){
            items[productId][groupId] = {}
        }
       
        if (p.usage_type === "licensed") {
            items[productId][groupId].monthlyPrice = toUsd(p.amount);
            items[productId][groupId].planId = p.id;
        }
        if (p.usage_type === "metered") {
            items[productId][groupId].usagePrice = p.metadata.usagePrice;
            items[productId][groupId].includedTx = p.metadata.includedTx || "0";
        }
    })

    return items
}


const initializePackage = async (package) => {
    let product = await stripe.products.create(package.product);

    package.plans.forEach(async (p)=>{
        p.product = product.id;
        let plan = await stripe.plans.create(p);
    });
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