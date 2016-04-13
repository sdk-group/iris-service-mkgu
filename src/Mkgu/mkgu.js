'use strict'


let ServiceApi = require('resource-management-framework')
	.ServiceApi;

class Mkgu {
	constructor() {
		this.emitter = message_bus;
	}

	init(cfg) {
		this.iris = new ServiceApi();
		this.iris.initContent();
		this.certificate_pub = cfg.certificate_pub || './keys/cert.pem';
		this.certificate_priv = cfg.certificate_priv || './keys/key.pem';
	}

	//API

}

module.exports = Mkgu;