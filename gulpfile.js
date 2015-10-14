/**
 * Created by tomersela on 9/20/15.
 */
var gulp = require('gulp'),
    bower = require('gulp-bower'),
    clean = require('gulp-clean'),
    concat = require('gulp-concat'),
    sass = require('gulp-sass'),
    rename = require('gulp-rename'),
    minifyCss = require('gulp-minify-css'),
    sourcemaps = require('gulp-sourcemaps'),
    shrinkwrap = require('gulp-shrinkwrap'),
    uglify = require('gulp-uglify'),
    gutil = require('gulp-util');

var config = {
    libFolder: './lib',
    cssFolder: './dist/css',
    sassFolder: './src/scss',
    srcFolder: './src',
    distFolder: './dist'
};

// Bower task
gulp.task('bower', function() {
    return bower()
        .pipe(gulp.dest(config.libFolder));
});

// Clean stylesheets
gulp.task('clean:sass', function() {
    return gulp.src(config.cssFolder, {read: false})
        .pipe(clean());
});

// Compile sass to css and minify css stylesheets
gulp.task('sass', ['clean:sass'], function () {
    gulp.src(config.sassFolder + '/**/*.scss')
        .pipe(sass())
        .pipe(gulp.dest(config.cssFolder));

    // compress and copy css stylesheets
    gulp.src(config.cssFolder + '/stylesheets/css/**/*.css')
        .pipe(minifyCss({compatibility: 'ie8'}))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(config.build + '/stylesheets/css'));
});

// Clean JS
gulp.task('clean:js', function() {
    return gulp.src(config.distFolder + '/**/*.js', {read: false})
        .pipe(clean());
});

// Clean JS map files
gulp.task('clean:maps', function() {
    return gulp.src(config.distFolder + '/**/*.map', {read: false})
        .pipe(clean());
});

// Javascript, full version
gulp.task('jsFull', ['clean:js', 'clean:maps'], function () {
    gulp.src([config.srcFolder + '/*.js'])
        .pipe(concat('vidible-player-angular.js'))
        .pipe(gulp.dest(config.distFolder));
});

// Javascript, minified version
gulp.task('jsMin', ['clean:js', 'clean:maps'], function () {
    // compress and copy angular
    gulp.src([config.srcFolder + '/*.js'])
            .pipe(concat('vidible-player-angular.js'))
            .pipe(uglify().on('error', gutil.log))
            .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(config.distFolder));
});

gulp.task('javascripts', ['jsFull', 'jsMin']);

// Shrinkwrap
gulp.task('shrinkwrap', function () {
    return gulp.src('package.json')
        .pipe(shrinkwrap())      // just like running `npm shrinkwrap`
        .pipe(gulp.dest('./'));  // writes newly created `npm-shrinkwrap.json` to the location of your choice
});

// Watch file changes and update
gulp.task('watch', function () {
    gulp.watch(config.srcFolder + '/**/*.js', ['js']);
    gulp.watch(config.srcFolder + '/**/*.scss', ['sass']);
    gulp.watch('./bower.json', ['bower']);
});

gulp.task('default', ['shrinkwrap', 'bower', 'sass', 'javascripts']);