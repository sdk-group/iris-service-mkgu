'use strict'

let bunyan = require('bunyan');
let mkgulogger = bunyan.createLogger({
	name: 'iris-v2',
	streams: [{
		level: 'info',
		type: 'rotating-file',
		path: './logs/mkgu/iris.log',
		period: '1d'
	}]
});

let Curl = require('node-libcurl')
	.Curl;
let request = require('request-promise');

let fs = Promise.promisifyAll(require("fs"));

let xmldom = require('xmldom');
let select = require('xml-crypto')
	.xpath;
let SignedXml = require('xml-crypto')
	.SignedXml;

const ns_main = 'http://vashkontrol.ru#';
const ns_w3 = 'http://www.w3.org/2000/xmlns/';
const ns_ds = 'http://www.w3.org/2000/09/xmldsig#';
const ns_ec = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ns_events = 'https://vashkontrol.ru/hershel/events.json';
const ns_events_sb = 'https://vashkontrol.ru/hershel/sandbox/events.json';
const ns_rates = 'https://vashkontrol.ru/hershel/rates.json';
const ns_rates_sb = 'https://vashkontrol.ru/hershel/sandbox/rates.json';


class Mkgu {
	constructor() {
		this.emitter = message_bus;
	}

	init(cfg) {
		this.certificate_pub = cfg.certificate_pub || './keys/cert.pem';
		this.certificate_priv = cfg.certificate_priv || './keys/key.pem';

		this.serializer = new xmldom.XMLSerializer();
		this.DOMI = new xmldom.DOMImplementation();
	}

	launch() {
		this.emitter.listenTask('mkgu.send.rates', (data) => this.postRates(data));

		return Promise.all([fs.readFileAsync(this.certificate_pub), fs.readFileAsync(this.certificate_priv)])
			.then(([pub, priv]) => {
				this.pub_key = pub;
				this.priv_key = priv;
				return true;
			})
			.catch((err) => {
				console.log("MKGU LAUNCH ERR", err.message);
				return false;
			});
	}

	//API
	postRates({
		organization,
		service,
		ticket
	}) {
		// console.log("POST RATES", organization, service, ticket);
		let msg = this.messageRates({
			user: ticket.id,
			vendor: organization.mkgu_code,
			service: service.code_frgu,
			service_name: service.label,
			authority: service.dept_code_frgu,
			procedure: service.procedure_code_frgu,
			okato: organization.okato,
			service_date: moment(ticket.dedicated_date, "YYYY-MM-DD")
				.tz(organization.org_timezone)
				.utc()
				.format('YYYY-MM-DD HH:mm:ss'),
			rate_date: moment.tz(organization.org_timezone)
				.utc()
				.format('YYYY-MM-DD HH:mm:ss'),
			user_info: ticket.user_info,
			rates: ticket.qa_answers
		});
		return this.post(ns_rates, msg, _.get(organization, 'logs.mkgu', false))
			.catch((err) => {
				global.logger && logger.error(
					err, {
						module: 'mkgu',
						method: 'post-rates'
					});
			});
	}

	post(uri, data, log) {
		// let options = {
		// 	uri,
		// 	headers: {
		// 			'Content-Type': 'application/xml'
		// 		},
		// 	body: data,
		// 	strictSSL: false
		// };queue

		// return request.post(options);

		let curl = new Curl();
		curl.setOpt(Curl.option.URL, uri);
		curl.setOpt(Curl.option.POST, true);
		curl.setOpt(Curl.option.POSTFIELDS, data);
		curl.setOpt(Curl.option.HTTPHEADER, ['Content-Type: application/xml']);
		curl.setOpt(Curl.option.SSL_VERIFYPEER, false);

		return new Promise(function (resolve, reject) {
			curl.on('end', function (statusCode, body, headers) {
				let code = _.parseInt(_.join(_.slice(body, 13, _.size(body) - 1), ''));
				if (log || !_.isFinite(code) || !_.isNumber(code)) {
					mkgulogger.info({
						statusCode,
						body,
						headers,
						data
					});
				}
				this.close();
				resolve(body);
			});

			curl.on('error', function (err) {
				mkgulogger.error(err);
				mkgulogger.info('Lost packet', data);
				curl.close.bind(curl);
				reject(err);
			});
			curl.perform();
		});
	}

	messageRates({
		authority,
		authority_name = '',
		service,
		service_name = '',
		procedure,
		procedure_name = '',
		service_date,
		rate_date,
		okato,
		vendor,
		user,
		user_info = {},
		rates = {}
	}) {
		let doc = this.DOMI.createDocument();
		let root = doc.createElementNS(ns_main, 'mkgu:body');

		root.setAttribute('ID', 'mkgu');
		root.setAttributeNS(ns_w3, 'xmlns:mkgu', ns_main);
		root.setAttributeNS(ns_w3, 'xmlns:ds', ns_ds);
		root.setAttributeNS(ns_w3, 'xmlns:ec', ns_ec);


		let vendor_node = doc.createElement('vendor');
		vendor_node.setAttribute('id', vendor);

		let form_version = doc.createElement('form-version');
		form_version.textContent = "0.0.2";

		vendor_node.appendChild(form_version);
		root.appendChild(vendor_node);

		let forms = doc.createElement('forms');
		let form = doc.createElement('form');
		form.setAttribute('mkgu-id', '0');
		form.setAttribute('foreign-id', user);

		let data = doc.createElement('data');
		let procedure_node = doc.createElement('procedure');
		procedure_node.textContent = procedure_name;
		let authority_node = doc.createElement('authority');
		authority_node.setAttribute('id', authority);
		authority_node.textContent = authority_name;
		let service_node = doc.createElement('service');
		service_node.setAttribute('id', service);
		service_node.textContent = service_name;
		let user_node = doc.createElement('user');
		user_node.setAttribute('id', user);
		if (user_info.email) {
			user_node.textContent = user_info.email;
		}
		let date_node = doc.createElement('date');
		date_node.textContent = service_date;
		let rdate_node = doc.createElement('received-date');
		rdate_node.textContent = rate_date;


		data.appendChild(user_node);
		data.appendChild(service_node);
		data.appendChild(procedure_node);
		data.appendChild(authority_node);
		data.appendChild(date_node);
		data.appendChild(rdate_node);

		if (okato) {
			let okato_node = doc.createElement('okato');
			okato_node.textContent = okato;
			data.appendChild(okato_node);
		}

		let rates_node = doc.createElement('rates');
		_.map(rates, (answer, question) => {
			let rate = doc.createElement('rate');
			rate.setAttribute('indicator-id', question);
			rate.setAttribute('value-id', answer);
			rate.textContent = answer;
			rates_node.appendChild(rate);
		});

		root.appendChild(forms);
		forms.appendChild(form);
		form.appendChild(data);
		form.appendChild(rates_node);

		return ('<?xml version="1.0" encoding="UTF-8"?>' + this.sign(root));
	}

	sign(root) {
		let xml = this.serializer.serializeToString(root);

		var sig = new SignedXml();

		sig.addReference("/*", ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"], "http://www.w3.org/2001/04/xmlenc#sha256");
		sig.signingKey = this.priv_key;
		sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
		sig.computeSignature(xml);

		return sig.getSignedXml();
	}
}

module.exports = Mkgu;
