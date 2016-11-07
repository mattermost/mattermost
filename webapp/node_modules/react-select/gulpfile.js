var gulp = require('gulp');
var initGulpTasks = require('react-component-gulp-tasks');

var taskConfig = {

	component: {
		name: 'Select',
		dependencies: [
			'classnames',
			'react-input-autosize',
			'react',
			'react-dom'
		],
		less: {
			path: 'less',
			entry: 'default.less'
		}
	},

	example: {
		src: 'examples/src',
		dist: 'examples/dist',
		standalone: true,
		files: [
			'index.html',
			'standalone.html',
			'.gitignore'
		],
		scripts: [
			'app.js'
		],
		less: [
			'example.less'
		]
	}

};

initGulpTasks(gulp, taskConfig);
