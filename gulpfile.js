'use strict';

var gulp = require('gulp'),
	cleanCSS = require('gulp-clean-css'),
  stylesheetsDir = 'public/stylesheets/';

gulp.task('minify-css:watch', function () {
  gulp.watch(stylesheetsDir + "style.css", ['minify-css']);
});

gulp.task('minify-css', function() {
    return gulp.src(stylesheetsDir + "style.css")
        .pipe(cleanCSS({debug: true}, function(details) {
            console.log(details.name + ': ' + details.stats.originalSize);
            console.log(details.name + ': ' + details.stats.minifiedSize);
        }))
        .pipe(gulp.dest(stylesheetsDir + "minified"));
});

gulp.task('default', ['minify-css']);
gulp.task('watch', ['minify-css:watch']);