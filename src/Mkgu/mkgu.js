'use strict'

const ns_main = 'http://vashkontrol.ru#';
const ns_w3 = 'http://www.w3.org/2000/xmlns/';
const ns_dsig = 'http://www.w3.org/2000/09/xmldsig#';
const ns_ec = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ns_events = 'https://vashkontrol.ru/hershel/events';
const ns_rates = 'https://vashkontrol.ru/hershel/rates';

class Mkgu {
	constructor() {
		this.emitter = message_bus;
	}

	init(cfg) {
		this.certificate_pub = cfg.certificate_pub || './keys/cert.pem';
		this.certificate_priv = cfg.certificate_priv || './keys/key.pem';
		this.vendor_id = = cfg.vendor_id;
	}

	//API


}

module.exports = Mkgu;