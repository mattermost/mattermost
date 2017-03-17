// vim: set et sw=2 ts=2
var gulp = require('gulp');

var jshint = require('gulp-jshint');

gulp.task('lint', function (done) {
  gulp.src([ "*.js", "lib/*.js" ])
      .pipe(jshint())
      .pipe(jshint.reporter('default'))
      .on('end', done);
});

gulp.task('default', [ 'lint' ]);
