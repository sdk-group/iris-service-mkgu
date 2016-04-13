'use strict'

let Mkgu = require("./Mkgu/mkgu");
let config = require("./config/db_config.json");

describe("Mkgu service", () => {
	let service = null;
	let bucket = null;
	before(() => {
		service = new Mkgu();
		service.init();
	});
	describe("Mkgu service", () => {
		it("should mark ticket called", (done) => {
			return service.actionTicketCalled()
				.then((res) => {
					console.log(res);
					done();
				})
				.catch((err) => {
					done(err);
				});
		})
	})

});