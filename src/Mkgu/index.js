'use strict'

let events = {
	mkgu: {}
};

let tasks = [];


module.exports = {
	module: require('./mkgu.js'),
	name: 'mkgu',
	permissions: [],
	exposed: true,
	tasks: tasks,
	events: {
		group: 'mkgu',
		shorthands: events.mkgu
	}
};