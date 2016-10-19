/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
/**
 * System configuration for Angular 2
 * Adjust as necessary for your application needs.
 */
(function(global) {
  var bundles = {
    'c3': ['d3'],
    // 'bootstrap': ['jquery'],
  }
  var paths = {
    'npm:': 'node_modules/',
  };
  // map tells the System loader where to look for things
  var map = {
    'app': 'app',
    'rxjs': 'npm:rxjs',
    
    // angular
    '@angular/core': 'npm:@angular/core/bundles/core.umd.js',
    '@angular/common': 'npm:@angular/common/bundles/common.umd.js',
    '@angular/compiler': 'npm:@angular/compiler/bundles/compiler.umd.js',
    '@angular/platform-browser': 'npm:@angular/platform-browser/bundles/platform-browser.umd.js',
    '@angular/platform-browser-dynamic': 'npm:@angular/platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js',
    '@angular/http': 'npm:@angular/http/bundles/http.umd.js',
    '@angular/router': 'npm:@angular/router/bundles/router.umd.js',
    '@angular/forms': 'npm:@angular/forms/bundles/forms.umd.js',    
    //'angular2-in-memory-web-api': 'npm:angular2-in-memory-web-api',
    
    // additional external libraries
    'openlayers':                 'https://cdnjs.cloudflare.com/ajax/libs/ol3/3.5.0/ol.js',
    'd3':                         'https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.7/d3.js',
    'c3':                         'https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.9/c3.js',
    'moment':                     'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.12.0/moment.min.js',
    'underscore':                 'https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.2/underscore-min.js',
    // 'jquery':                     'https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js',
    // 'bootstrap':                  'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.6/js/bootstrap.min.js',
  };
  // packages tells the System loader how to load when no filename and/or no extension
  var packages = {
    'app':                        { main: 'main.js',  defaultExtension: 'js' },
    'rxjs':                       { defaultExtension: 'js' },
    //'angular2-in-memory-web-api': { main: 'index.js', defaultExtension: 'js' },
  };
  // define metadata for Subresource Integrity
  var meta = {
    'https://cdnjs.cloudflare.com/ajax/libs/ol3/3.5.0/ol.js': {
      scriptLoad: true,
      integrity: 'sha256-ybQnvDcVTLFnbUmkq5oSsJ62Pij7mhFrdeUtnyYJnTk=',
      crossOrigin: 'anonymous'
    },
    'https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.7/d3.js': {
      scriptLoad: true,
      integrity: 'sha256-M1yTN9xSjkvhn9W6lr/vC4z1haMXf86JEpLWT4gosd0=',
      crossOrigin: 'anonymous'
    },
    'https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.9/c3.js': {
      scriptLoad: true,
      integrity: 'sha256-uWSq0mObZ65yexU+Ywtj0MwpYPlLo85oJy+Mt4l0UcY=',
      crossOrigin: 'anonymous'
    },
    'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.12.0/moment.min.js': {
      scriptLoad: true,
      integrity: 'sha256-QTFbCMKzMsKmdagXusjKHMZIwzEJtpnGYJ/v/ArHklQ=',
      crossOrigin: 'anonymous'
    },
    'https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.2/underscore-min.js': {
      scriptLoad: true,
      integrity: 'sha256-LeGeo7heAyOd2cvjDZVFobWnzi8GYv6urz0tCIF56lw=',
      crossOrigin: 'anonymous'
    },
    // 'https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.1/jquery.min.js': {
    //   scriptLoad: true,
    //   integrity: 'sha256-I1nTg78tSrZev3kjvfdM5A5Ak/blglGzlaZANLPDl3I=',
    //   crossOrigin: 'anonymous'
    // },
    // 'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.6/js/bootstrap.min.js': {
    //   scriptLoad: true,
    //   integrity: 'sha256-KXn5puMvxCw+dAYznun+drMdG1IFl3agK0p/pqT9KAo=',
    //   crossOrigin: 'anonymous'
    // },
  };
  var config = {
    paths: paths,
    map: map,
    meta: meta,
    packages: packages
  };
  System.config(config);
})(this);
