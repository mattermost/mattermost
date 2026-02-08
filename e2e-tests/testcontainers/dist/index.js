'use strict';

var config = require('./config.js');
require('testcontainers');
require('@testcontainers/postgresql');
require('fs');
require('path');
require('child_process');
require('http');
require('url');



exports.MattermostTestEnvironment = config.MattermostTestEnvironment;
exports.defineConfig = config.defineConfig;
exports.discoverAndLoadConfig = config.discoverAndLoadConfig;
//# sourceMappingURL=index.js.map
