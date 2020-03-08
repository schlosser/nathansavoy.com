var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
var cache = require('gulp-cached');
var cp = require('child_process');
var cssnano = require('gulp-cssnano');
var del = require('del');
var eslint = require('gulp-eslint');
var fs = require('fs');
var gulp = require('gulp');
var handlebars = require('gulp-compile-handlebars');
var htmlmin = require('gulp-htmlmin');
var imagemin = require('gulp-imagemin');
var inlinesource = require('gulp-inline-source');
var jshint = require('gulp-jshint');
var layouts = require('handlebars-layouts');
var plumber = require('gulp-plumber');
var reload = browserSync.reload;
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var scsslint = require('gulp-scss-lint');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var yaml = require('js-yaml');
var path = require('path');


handlebars.Handlebars.registerHelper(layouts(handlebars.Handlebars));
handlebars.Handlebars.registerHelper('reverse', function (arr) {
    arr.reverse();
});
handlebars.Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

function catchErr(e) {
  console.log(e.messageFormatted);
  this.emit('end');
}

gulp.task('reload', function(done) {
  done();
  reload();
});

gulp.task('sass:lint', function() {
  return gulp.src('./src/sass/**/*.scss')
    .pipe(plumber())
    .pipe(scsslint());
});

gulp.task('sass:build', function() {
  return gulp.src(['./src/sass/**/*.scss', '!./src/sass/**/_*.scss'])
    .pipe(rename({suffix: '.min'}))
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass({
      outputStyle: 'compressed',
    }))
    .on('error', catchErr)
    .pipe(autoprefixer({
      browsers: ['last 1 version', '> 0.2%'],
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./dist/css/'));
});

gulp.task('sass:optimized', function() {
  return gulp.src(['./src/sass/**/*.scss', '!./src/sass/**/_*.scss'])
    .pipe(rename({suffix: '.min'}))
    .pipe(plumber())
    .pipe(sass({
      outputStyle: 'compressed',
    }))
    .pipe(autoprefixer())
    .pipe(cssnano({compatibility: 'ie8'}))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('sass', gulp.series('sass:lint', 'sass:build'));

gulp.task('js:build', function() {
  return gulp.src('src/js/**/*.js')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist/js'));
});

gulp.task('js:lint', function() {
  return gulp.src(['./src/js/**/*.js', '!./src/js/lib/**/*.js', 'Gulpfile.js'])
    .pipe(plumber())
      .pipe(eslint())
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('js', gulp.series('js:lint', 'js:build'));

gulp.task('images', function() {
  return gulp.src('src/img/**/*')
    .pipe(plumber())
    // .pipe(imagemin({
    //   progressive: true,
    // }))
    .pipe(gulp.dest('./dist/img'));
});

gulp.task('images:optimized', function() {
  return gulp.src('src/img/**/*')
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
      multipass: true,
    }))
    .pipe(gulp.dest('./dist/img'));
});

gulp.task('resources', function() {
  return gulp.src('src/resources/*')
    .pipe(plumber())
    .pipe(gulp.dest('./dist/resources'));
});

gulp.task('fonts', function() {
  return gulp.src('src/font/*')
    .pipe(plumber())
    .pipe(gulp.dest('./dist/font'));
});

gulp.task('templates', function() {
  var templateData = yaml.safeLoad(fs.readFileSync('data.yml', 'utf-8'));
  var options = {
    ignorePartials: true, //ignores the unknown footer2 partial in the handlebars template, defaults to false
    batch: ['./src/partials/'],
    helpers: {},
  };

  return gulp.src('./src/templates/**/*.hbs')
    .pipe(plumber())
    .pipe(handlebars(templateData, options))
    .pipe(rename(function(path) {
      path.extname = '.html';
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('templates:optimized', gulp.series('templates', function() {
  return gulp.src('./dist/**/*.html')
    .pipe(inlinesource({
      rootpath: process.cwd() + '/dist'
    }))
    .pipe(replace(/\.\.\//g, ''))
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
    }))
    .pipe(gulp.dest('./dist/'));
}));

gulp.task('clean', function(done) {
  return del('./dist/', done);
});

gulp.task('watch', function() {
  gulp.watch(['./src/templates/**/*.hbs', './src/partials/**/*.hbs', 'data.yml', 'events.json', 'Gulpfile.js'], gulp.series('templates', 'reload'));
  gulp.watch(['./src/sass/**/*.scss'], gulp.series('sass', 'reload'));
  gulp.watch('./src/img/**/*', gulp.series('images', 'reload'));
  gulp.watch(['./src/js/**/*.js', 'Gulpfile.js'], gulp.series('js', 'reload'));
});

gulp.task('build',
  gulp.series('clean',
    gulp.parallel('sass', 'images', 'fonts', 'resources', 'js', 'templates')
));

gulp.task('build:optimized',
  gulp.series('clean',
    gulp.parallel('sass:optimized', 'images:optimized', 'fonts', 'resources', 'js', 'templates:optimized')
));

gulp.task('deploy:rsync', function(done) {
  cp.exec('rsync -avuzh ./dist/* dan:/srv/nathansavoy.com/public_html/', function() {
    process.stdout.write('Deployed to https://nathansavoy.com\n');
    done();
  })
  .stdout.on('data', function(data) {
    process.stdout.write(data);
  });
});

gulp.task('deploy', gulp.series('build:optimized', 'deploy:rsync'));

// use default task to launch Browsersync and watch JS files
gulp.task('serve', gulp.series('build', function(done) {

  // Serve files from the root of this project
  browserSync.init(['./dist/**/*'], {
    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false,
    },
    server: {
      baseDir: './dist',
    },
    notify: false,
  });

  done();
}, 'watch'));
