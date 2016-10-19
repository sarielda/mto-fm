/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, Input } from '@angular/core';
import { HttpClient } from '../../shared/http-client';
import { Response, Headers, RequestOptions } from '@angular/http';
import { Observable }     from 'rxjs/Observable';

@Component({
  moduleId: module.id,
  selector: 'vendor-list',
  templateUrl: 'vendor-list.component.html',
  styleUrls: ['vendor-list.component.css']
})

export class VendorListComponent {
  vendors: Vendor[];
  requestSending: boolean;
  selectedVendor: Vendor;
  formVendor: Vendor;
  errorMessage: string;

  constructor(private http: HttpClient) {
//    this.selectedVendor = new Vendor({});
    this.formVendor = new Vendor({});
    this.errorMessage = "";
  }

  ngOnInit() {
    this._updateVendorList();
  }

  // refresh table
  onReload() {
    this.formVendor = new Vendor({});
    this._updateVendorList();
  }

      // Create or update a vendor
  onCreateVendor() {
    if (!this.formVendor.vendor) {
      alert("The vendor name cannot be empty.");
      return;
    } else if (this._getVendor(this.formVendor.vendor)) {
      alert("The vendor already exists.");
      return;
    }
    this._createNewVendor(this.formVendor);
  }

    // Create or update a vendor
  onUpdateVendor(id: string) {
    this._updateVendor(id, this.formVendor);
  }

  // Delete given vendor
  onDeleteVendor(id: string) {
    this._deleteVendor(id);
  }

  onSelectionChanged(id: string) {
    this.selectedVendor = this._getVendor(id);
    this.formVendor = new Vendor(this.selectedVendor);
  }

  private _updateVendorList() {
    let isRequestRoot = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this.selectedVendor = null;
    this._getVendors()
    .subscribe((vendors: Array<Vendor>) => {
        this.vendors = vendors;
        if (isRequestRoot) {
          this.requestSending = false;
        }
    }, (error: any) => {
        if (isRequestRoot) {
          this.requestSending = false;
        }
    });
  }

  // find a vendor from list
  private _getVendor(id: string): Vendor {
    for (let i = 0; i < this.vendors.length; i++) {
      if (this.vendors[i].vendor === id) {
        return this.vendors[i];
      }
    }
    return null;
  }

  // Get vendor list
  private _getVendors() {
    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    let url = "/user/vendor?num_rec_in_page=50&num_page=1";
    return this.http.get(url)
    .map((response: Response) => {
      let resJson = response.json();
      return resJson && resJson.data.map(function(v) {
          return new Vendor(v);
      });
    });
  }

    // Create a vendor with given data
    private _createNewVendor(vendor: Vendor) {
      // remove internally used property
      let url = "/user/vendor";
      let body = JSON.stringify({vendor: vendor.getData()});
      let headers = new Headers({"Content-Type": "application/json"});
      let options = new RequestOptions({headers: headers});

      let isRequestOwner = !this.requestSending;
      this.requestSending = true;
      this.errorMessage = null;
      this.http.post(url, body, options)
      .subscribe((response: Response) => {
        // Update vehicle list when succeeded
        this._updateVendorList();
        if (isRequestOwner) {
          this.requestSending = false;
        }
      }, (error: any) => {
        this.errorMessage = error.message || error._body || error;
        if (isRequestOwner) {
          this.requestSending = false;
        }
      });
    }

    // update a vendor with given data
    private _updateVendor(id: string, vendor: Vendor) {
      let url = "/user/vendor/" + id;
      let body = JSON.stringify(vendor.getData());
      let headers = new Headers({"Content-Type": "application/json"});
      let options = new RequestOptions({headers: headers});

      let isRequestOwner = !this.requestSending;
      this.requestSending = true;
      this.errorMessage = null;
      this.http.put(url, body, options)
      .subscribe((response: Response) => {
        // Update vendor list when succeeded
        this._updateVendorList();
        if (isRequestOwner) {
          this.requestSending = false;
        }
      }, (error: any) => {
        this.errorMessage = error.message || error._body || error;
        if (isRequestOwner) {
          this.requestSending = false;
        }
      });
    }

    // delete a vendor
    private _deleteVendor(id: string) {
      let isRequestOwner = !this.requestSending;
      this.requestSending = true;
      this.errorMessage = null;
      this.http.delete("/user/vendor/" + id)
      .subscribe((response: Response) => {
        // Update vehicle list when succeeded
        this._updateVendorList();
        if (isRequestOwner) {
          this.requestSending = false;
        }
      }, (error: any) => {
        this.errorMessage = error.message || error._body || error;
        if (isRequestOwner) {
          this.requestSending = false;
        }
      });
    }
}

// Vehicle definition
class Vendor {
  vendor: string; // The ID of the vendor.
  description: string; // Description of the vendor.
  type: string = "Manufacturer"; // Type of vendor. = [Manufacturer,Vendor,Caurier]
  website: string; // Vendors website URL.
  status: string = "Active";

  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
    }
  }

  getData() {
    let data = {};
    for (let key in this) {
      data[key] = this[key];
    }
    return data;
  }
}
