
process.env.VCAP_SERVICES = JSON.stringify({
    "cloudantNoSQLDB": [
        {
            "name": "FleetCloudantDB-dev",
            "label": "cloudantNoSQLDB",
            "plan": "Shared",
            "credentials": {
                "username": "4940dcd5-55ab-495c-b5a1-3113dd246d8a-bluemix",
                "password": "afbb00cea2585e5a228edde219090b6fefbbd8e63e63e507a90f2ad2b7ac77d4",
                "host": "4940dcd5-55ab-495c-b5a1-3113dd246d8a-bluemix.cloudant.com",
                "port": 443,
                "url": "https://4940dcd5-55ab-495c-b5a1-3113dd246d8a-bluemix:afbb00cea2585e5a228edde219090b6fefbbd8e63e63e507a90f2ad2b7ac77d4@4940dcd5-55ab-495c-b5a1-3113dd246d8a-bluemix.cloudant.com"
            }
        }
    ],
    "iotforautomotive": [ 
         { "name": "IoTForAuto-dev", "label": "iotforautomotive", "plan": "free_shared", "credentials": { "vehicle_data_hub": [ "vdh.automotive.internetofthings.ibmcloud.com" ], "username": "rtnBRoe4", "tenant_id": "61ec0000-8c92-428d-97c9-7335211d6bfc", "api": "https://automotive.internetofthings.ibmcloud.com/", "password": "TRdEZL&hijnz5F" } } 
    ] 
});

process.env.APP_USER = 'none';
process.env.APP_PASSWORD = 'none';
process.env.PORT = '3000';
process.env.NODE_ENV = 'development';

require('./app.js');
