/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { OpaqueToken } from '@angular/core';

export let APP_CONFIG = new OpaqueToken('app.config');

export interface AppConfig {
  DEBUG: boolean;
  webApiHost: string;
}

/**
 * When client is hosted at port 3123, it seems that lite-server is used for debugging.
 * So, re-target the API host to port 3000
 */
let webApiHost = (function(){
  if(window.location.port == '3123'){
    console.warn('WARNING');
    console.warn('WARNING: This client seems hosted by lite-server. Directing Web APIs to ' +  window.location.hostname + ':3000' + '.');
    console.warn('WARNING');

    return window.location.hostname + ':3000';
  }
  return window.location.host;
})();

export const DEFAULT_APP_CONFIG: AppConfig = {
  DEBUG: false,
  webApiHost: webApiHost,
};
