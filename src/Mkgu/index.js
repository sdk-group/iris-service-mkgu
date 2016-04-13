'use strict'

let events = {
	mkgu: {}
};

let tasks = [];


module.exports = {
	module: require('./mkgu.js'),
	permissions: [],
	exposed: true,
	tasks: tasks,
	events: {
		group: 'mkgu',
		shorthands: events.mkgu
	}
};