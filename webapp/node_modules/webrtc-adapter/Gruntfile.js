'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      adapterGlobalObject: {
        src: ['./src/js/adapter_core.js'],
        dest: './out/adapter.js',
        options: {
          browserifyOptions: {
            // Exposes shim methods in a global object to the browser.
            // The tests require this.
            standalone: 'adapter'
          }
        }
      },
      // Use this if you do not want adapter to expose anything to the global
      // scope.
      adapterAndNoGlobalObject: {
        src: ['./src/js/adapter_core.js'],
        dest: './out/adapter_no_global.js'
      },
      // Use this if you do not want MS edge shim to be included.
      adapterNoEdge: {
        src: ['./src/js/adapter_core.js'],
        dest: './out/adapter_no_edge.js',
        options: {
          // These files will be skipped.
          ignore: [
            './src/js/edge/edge_shim.js',
            './src/js/edge/edge_sdp.js'
          ],
          browserifyOptions: {
            // Exposes the shim in a global object to the browser.
            standalone: 'adapter'
          }
        }
      },
      // Use this if you do not want MS edge shim to be included and do not
      // want adapter to expose anything to the global scope.
      adapterNoEdgeAndNoGlobalObject: {
        src: ['./src/js/adapter_core.js'],
        dest: './out/adapter_no_edge_no_global.js',
        options: {
          ignore: [
            './src/js/edge/edge_shim.js',
            './src/js/edge/edge_sdp.js'
          ]
        }
      }
    },
    githooks: {
      all: {
        'pre-commit': 'lint'
      }
    },
    eslint: {
      options: {
        configFile: '.eslintrc'
      },
      target: ['src/**/*.js', 'test/*.js']
    },
    copy: {
      build: {
        dest: 'release/',
        cwd: 'out',
        src: '**',
        nonull: true,
        expand: true
      }
    },
  });

  grunt.loadNpmTasks('grunt-githooks');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', ['eslint', 'browserify']);
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('build', ['browserify']);
  grunt.registerTask('copyForPublish', ['copy']);
};
