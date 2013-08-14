module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jasmine: {
      freedom: {
        src: ['src/*.js', 'src/proxy/*.js'],
        options: {
          specs: 'spec/*Spec.js'
        }
      }
    },
    jshint: {
      beforeconcat: ['src/*.js', 'src/proxy/*.js'],
      afterconcat: ['freedom.js'],
      options: {
        '-W069': true
      }
    },
    concat: {
      dist: {
        src: [
          'src/util/preamble.js',
          'src/*.js',
          'src/proxy/*.js',
          'providers/*.js',
          'interface/*.js',
          'src/util/postamble.js'
        ],
        dest: 'freedom.js'
      }
    },
    clean: ['freedom.js'],
    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        options: {
          paths: 'src/',
          outdir: 'tools/doc/'
        }
      }
    }
  });

  // Load tasks.
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');

  // Default tasks.
  grunt.registerTask('default', [
    'jshint:beforeconcat',
    'concat',
    'jasmine',
    'jshint:afterconcat'
  ]);
};
