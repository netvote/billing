'use strict'

const Joi = require('joi');
const crypto = require('crypto');

const validate = (params, schema) => {
    return new Promise((resolve, reject)=>{
      Joi.validate(params, schema, (err, res) => {
        if(err){
          reject(err);
        } else {
          resolve(res);
        }
      })
    })
  }

const getUser = (event) => {
    let id = event.requestContext.authorizer;
    if(id.claims){
        id = id.claims;
    }

    let hasMainnet = ('1' === `${id["custom:mainnet"]}`);
    return {
        id: id.sub,
        company: id["custom:company"],
        email: id.email,
        mainnet: hasMainnet,
        phone: id.phone_number,
        accountType: id["custom:accountType"],
        maxApiKeys: id["custom:maxApiKeys"]
    }
}

const redirect = (url) => {
    return {
        statusCode: 302, 
        headers: {
            'Location': url
        }
    }
}

const success = (obj) => {
    return {
        statusCode: 200,
        body: JSON.stringify(obj),
        headers: {
            "Access-Control-Allow-Origin" : "*", 
            "Access-Control-Allow-Credentials" : true,
            "Content-Type": "application/json"
        }
      };
}

const error = (code, errorObj) => {
    console.error({type:"error", code: code, errorObj: errorObj});
    let body = (typeof errorObj === "object") ? JSON.stringify(errorObj) : JSON.stringify({message: errorObj})
    return {
        statusCode: code,
        body: body,
        headers: {
            "Access-Control-Allow-Origin" : "*", 
            "Access-Control-Allow-Credentials" : true,
            "Content-Type": "application/json"
        }
      };
}

// overrides default message for error type
const errorMessage = (errorType, message) => {
    return error(errorType.code, {
        code: errorType.code,
        errorType: errorType.errorType,
        message: message
    })
}

const sha256Hash = (str) => {
    let hash = crypto.createHash("sha256")
    hash.update(str);
    return hash.digest().toString("base64");
}

module.exports = {
    getUser: getUser,
    sha256Hash: sha256Hash,
    validate: validate,
    redirect: redirect,
    error: error,
    errorMessage: errorMessage,
    success: success,
}