var interactive = false;

var gulp = require('gulp'),
	argv = require('yargs').argv,
	autoprefixer = require('gulp-autoprefixer'),
	browserify = require('browserify'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),
	browserSync = require('browser-sync'),
	cleanCSS = require('gulp-clean-css'),
	concat = require('gulp-concat'),
	del = require('del'),
	plumber = require('gulp-plumber'),
	sanewatch = require('gulp-sane-watch'),
	filter = require('gulp-filter'),
	count = require('gulp-count'),
	gulpif = require('gulp-if'),
	sass = require('gulp-sass'),
	gutil = require('gulp-util'),
	jstify = require('jstify'),
	uglify = require('gulp-uglify'),
	replace = require('gulp-replace');

// bower_path is used as a prefix in other paths
var bower_path = 'src/bower_components';

var paths = {
	src: {
		scss: 'src/scss/*.scss',
		js: 'src/js/frontback.js'
	},
	dist: {
		css: 'endpoint/assets/css',
		js: 'endpoint/assets/js'
	},
	watch: {
		scss: 'src/**/*.scss',
		js: ['src/**/*.js', 'src/**/*.tpl']
	}
};

// Error reporter for plumber.
var plumber_error = function (err) {
	if (!interactive) {
		throw err;
	}
	gutil.log( err );
	this.emit('end');
};

// application and third-party SASS -> CSS
gulp.task('scss', function() {
	return gulp.src( paths.src.scss )
		.pipe( plumber({ errorHandler: plumber_error }) )

		.pipe( sass({ outputStyle: 'nested'}) )
		.pipe( autoprefixer( [ 'last 2 versions', '> 1%' ] ) )
		// Minify css only if --cssmin flag is used
		.pipe( gulpif( argv.min, cleanCSS() ) )
		.pipe( gulp.dest( paths.dist.css ) );
});

gulp.task('js', function() {
	var b = browserify({
		entries: [paths.src.js]
	});
		
	b.transform(jstify);

	var v = process.env.CI_COMMIT_SHA;
	if (!v) {
		v = '0';
	}
	
	return b.bundle()
		.on( 'error', plumber_error )
		.pipe( source( 'frontback.js' ) )
		.pipe( buffer() )
		.pipe( replace( 'DEPLOY_KEY', v ) ) 
		.pipe( gulpif( argv.min, uglify({ mangle: false })) )
		.pipe( gulp.dest( paths.dist.js ));
});

// build-all builds everything in one go.
gulp.task('build-all', ['scss', 'js']);

gulp.task('reload', function() {
	browserSync.reload();
});

// all the watchy stuff
gulp.task('watcher', ['build-all'], function() {
	
	interactive = true;

	// sane is a more configurable watcher than gulp watch.
	// You can also have it use the more friendly OSX file
	// watcher "watchman", but that apparently has to be
	// installed by hand instead of through a dependency
	// manager.
	//
	// Installation instructions for Watchman:
	// https://facebook.github.io/watchman/docs/install.html
	//
	// Usage for gulp-sane-watch:
	// https://www.npmjs.com/package/gulp-sane-watch

	//var watcherOptions = { debounce:300,watchman:true };
	var watcherOptions = { debounce:300 };

	sanewatch(paths.watch.scss, watcherOptions,
		function() {
			gulp.start('scss');
		}
	);

	sanewatch(paths.watch.js, watcherOptions,
		function() {
			gulp.start('js');
		}
	);

	// When patternlab rebuilds it modifies a text file
	// with the latest change information -- so we can
	// watch that one to see when to reload.
	// gulp.watch(paths.pl_change_file, ['reload']);

	browserSync.init({
		server: {
			baseDir: "./test"
		}
	});
});

// Default build task
gulp.task('default', function() {
	gulp.start('watcher');
});
