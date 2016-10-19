/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Injectable } from "@angular/core";
import { Http, Headers, RequestOptions } from '@angular/http';

@Injectable()
export class HttpClient {
  constructor(private http: Http) {
  }

  public get(url: string, options: RequestOptions = undefined) {
      // to prevent caching issue on IE
      options = options || new RequestOptions();
      if (options.headers) {
        options.headers.append("If-Modified-Since", (new Date(0)).toUTCString());
      } else {
        options.headers = new Headers({"If-Modified-Since": (new Date(0)).toUTCString()});
      }
      return this.http.get(url, options);
  }

  public post(url: string, body: any, options: RequestOptions = undefined) {
      return this.http.post(url, body, options);
  }

  public put(url: string, body: any, options: RequestOptions = undefined) {
      return this.http.put(url, body, options);
  }

  public delete(url: string, options: RequestOptions = undefined) {
      return this.http.delete(url, options);
  }
}