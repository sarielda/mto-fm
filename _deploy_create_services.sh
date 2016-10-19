#!/bin/bash 
cf create-service cloudantNoSQLDB Lite FleetCloudantDB
cf create-service iotforautomotive free_shared FleetIoTForAuto
