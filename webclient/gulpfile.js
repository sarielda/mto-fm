/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var SystemBuilder = require('systemjs-builder');
var gulp = require('gulp');
var rename = require('gulp-rename');
var gulpSequence = require('gulp-sequence');
var rimraf = require('rimraf');

var argv_prod = false;

var paths = {
  dist: 'dist',
  vendor: {
    js: ['node_modules/core-js/client/shim.min.js',
         'node_modules/zone.js/dist/zone.js',
         'node_modules/reflect-metadata/Reflect.js'],
    css: [],
  },
  app: {
    index: ['./index-prod.html'],
    res: ['./app/**' + (argv_prod ? '/!(*.ts|*.map|*.js)': '/*'),
    	  './css/**',
    	  './fonts/**',
    	  './img/**',
    	  './js/**'],
  }
};

gulp.task('clean', function(cb){
  rimraf(paths.dist, cb);
})

gulp.task('vendor', function(cb){
    gulp.src(paths.vendor.js)
      .pipe(gulp.dest(paths.dist + '/js'));
    gulp.src(paths.vendor.css)
      .pipe(gulp.dest(paths.dist + '/css'));
});

gulp.task('app-res', function(){
  return gulp.src(paths.app.res, {base: '.'})
    .pipe(gulp.dest(paths.dist));
});

gulp.task('app-index', function(){
  return gulp.src(paths.app.index)
    .pipe(rename("index.html"))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('app-bundler', function(cb) {

  var builder = new SystemBuilder('..');
  builder.loadConfig('./systemjs.config-prod.js')
    .then(function(){
      var outputFile = argv_prod ? 'bundle.min.js' : 'bundle.js';
      builder.buildStatic('webclient/app/main.js', './' + paths.dist + '/js/' + outputFile, {
          minify: argv_prod,
          mangle: argv_prod,
          rollup: argv_prod,
          sourceMaps: !argv_prod,
          encodeNames: false, // http://stackoverflow.com/questions/37497635/systemjs-builder-angular-2-component-relative-paths-cause-404-errors
          globalDeps: {
            'openlayers': 'ol',
            'd3': 'd3',
            'c3': 'c3',
            'moment': 'moment',
            'underscore': '_',
          },
      });
    })
    .then(function(){
      cb();
    })
});

gulp.task('default', gulpSequence('clean', ['vendor', 'app-bundler', 'app-index']));
gulp.task('dist', gulpSequence('default', 'app-res'));
