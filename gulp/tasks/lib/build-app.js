/**
 *
 * (c) 2013-2015 Wishtack
 *
 * $Id: $
 */

module.exports = function buildAppFactory(args) {

    var NamedParameters = require('named-parameters').NamedParameters;

    args = new NamedParameters(args)
        .default('bower', true)
        .default('plumber', false)
        .default('uglify', true)
        .values();

    var bower = args.bower;
    var plumber = args.plumber;
    var uglify = args.uglify;

    return function buildApp(done) {

        var del = require('del');
        var fs = require('fs');
        var gulp = require('gulp');
        var vinylPaths = require('vinyl-paths');

        var config = require('../../config')();
        var plugins = require('../../plugins');
        var loadenv = require('./loadenv');

        var _clean = function _clean(done) {

            try {
                fs.statSync(config.distPath);
                return gulp.src(config.distPath, {read: false})
                    .pipe(plugins.if(plumber, plugins.plumber()))
                    .pipe(vinylPaths(del));
            }
            catch (exception) {
                if (exception.code === 'ENOENT') {
                    done();
                }
                else {
                    throw exception;
                }
            }

        };

        var _revReplace = function _revReplace(args) {

            var manifestFilePath = args.manifestFilePath;

            var source = gulp.src(manifestFilePath)
                .on('error', function (err) {
                    console.error(err);
                    console.error(err.stack);
                });

            return plugins.revReplace({manifest: source});

        };

        /**
         * Copy images.
         */
        var _copyImages = function _copyImages() {

            return gulp.src(config.appImagesPattern)
                .pipe(plugins.if(plumber, plugins.plumber()))
                .pipe(plugins.rev())
                .pipe(gulp.dest(config.distAssetsImagesPath))
                .pipe(plugins.rev.manifest('rev-manifest-images.json', {merge: true}))
                .pipe(gulp.dest(config.distPath));

        };

        /**
         * Replace revved images.
         * @hack: rev.manifest({merge: true}) doesn't seem to work.
         */
        var _revReplaceImages = function _revReplaceImages() {
            return _revReplace({manifestFilePath: config.distPath + '/rev-manifest-images.json'});
        };

        /**
         * Copy and rev angular templates then generate file rev mapping manifest.
         */
        var _copyFrontendTemplates = function _copyFrontendTemplates() {

            return gulp.src(config.appFrontendTemplatesPattern)
                .pipe(plugins.if(plumber, plugins.plumber()))
                .pipe(_revReplaceImages())
                .pipe(plugins.rev())
                .pipe(gulp.dest(config.distAssetsFrontendTemplatesPath))
                .pipe(plugins.rev.manifest('rev-manifest-frontend-templates.json'))
                .pipe(gulp.dest(config.distPath));

        };

        /**
         * Replace revved templates.
         */
        var _revReplaceFrontendTemplates = function _revReplaceFrontendTemplates() {
            return _revReplace({manifestFilePath: config.distPath + '/rev-manifest-frontend-templates.json'});
        };

        var _usemin = function _usemin() {

            return gulp.src(config.appDjangoTemplatesPattern)
                .pipe(plugins.if(plumber, plugins.plumber()))
                .pipe(plugins.htmlGlobExpansion({root: config.appPath}))
                /* @hack: https://github.com/zont/gulp-usemin/issues/91. */
                .pipe(plugins.foreach(function (stream, file) {
                    return stream
                        .pipe(plugins.usemin({
                            css: [
                                plugins.if(plumber, plugins.plumber()),
                                plugins.less(),
                                plugins.minifyCss(),
                                plugins.rev()
                            ],
                            html: [
                                plugins.if(plumber, plugins.plumber()),
                                plugins.minifyHtml({empty: true}),
                                /* @hack: That way we can control templates target directory without moving generated
                                 * assets. */
                                plugins.rename({dirname: config.djangoTemplatesDirectory})
                            ],
                            jsApp: [
                                plugins.if(plumber, plugins.plumber()),
                                /* Replace references to angular templates and images. */
                                _revReplaceFrontendTemplates(),
                                _revReplaceImages(),
                                plugins.if(uglify, plugins.ngAnnotate()),
                                plugins.if(uglify, plugins.uglify()),
                                plugins.rev()
                            ],
                            jsComponents: [
                                plugins.if(plumber, plugins.plumber()),
                                plugins.if(uglify, plugins.ngAnnotate()),
                                plugins.if(uglify, plugins.uglify()),
                                plugins.rev()
                            ]
                        }))
                        .pipe(gulp.dest(config.distPath));
                }));

        };

        return gulp.series(
            /* Load environment before building as we might cross-env build the project.
             * I.e.: Build the production project on local machine using 'gulp build --env=prod'. */
            loadenv(),
            _clean,
            _copyImages,
            _copyFrontendTemplates,
            bower ? ['bower'] : [],
            _usemin,
            'cache-manifest'
        )(done);

    };

};
