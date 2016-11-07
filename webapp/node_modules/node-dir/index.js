var dirpaths = require('./lib/paths');

exports.files = dirpaths.files;
exports.paths = dirpaths.paths;
exports.subdirs = dirpaths.subdirs;
exports.readFiles = require('./lib/readfiles');
exports.readFilesStream = require('./lib/readfilesstream');
