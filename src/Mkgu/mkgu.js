'use strict'

let Curl = require( 'node-libcurl' ).Curl;

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

		this.pub_key = fs.readFileSync(this.certificate_pub);
		this.priv_key = fs.readFileSync(this.certificate_priv);

		this.serializer = new xmldom.XMLSerializer();
		this.DOMI = new xmldom.DOMImplementation();
	}

	launch() {
		this.emitter.on('mkgu.send.rates', (data) => this.postRates(data));
		return Promise.resolve(true);
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
			service_date: moment.tz(organization.org_timezone)
				.subtract(1, 'day')
				.format('YYYY-MM-DD HH:MM:SS'),
			rate_date: moment.tz(organization.org_timezone)
				.format('YYYY-MM-DD HH:MM:SS'),
			user_info: ticket.user_info,
			rates: ticket.qa_answers
		});
		console.log(msg);
		return this.post(ns_rates, msg)
			.then((res) => {
				console.log("RESPONSE", res);
			})
			.catch((err) => {
				console.log("ERR", err);
			});
	}

	post(uri, data) {
		// let options = {
		// 	uri,
		// 	headers: {
		// 			'Content-Type': 'application/xml'
		// 		},
		// 	body: data,
		// 	strictSSL: false
		// };

		// return request.post(options);

		let curl = new Curl();
		curl.setOpt( Curl.option.URL, uri);
		curl.setOpt( Curl.option.POST, true );
		curl.setOpt( Curl.option.POSTFIELDS, data );
		curl.setOpt( Curl.option.HTTPHEADER,  ['Content-Type: application/xml']);
		curl.setOpt( Curl.option.SSL_VERIFYPEER,  false);

		return new Promise((resolve, reject) => {
			curl.on( 'end', function( statusCode, body, headers ) {
				this.close();
				resolve(body);
			});

			curl.on( 'error', function(err){
				curl.close.bind( curl );
				reject(err);
			});
			curl.perform();
		});
	}

	messageRates({
		authority, authority_name = '',
			service, service_name = '',
			procedure, procedure_name = '',
			service_date, rate_date,
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

		// sig.loadSignature(`<ds:Signature>
		//   <ds:SignedInfo>
		//     <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
		//     <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
		//     <ds:Reference URI="#mkgu">
		//       <ds:Transforms>
		//         <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
		//         <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
		//           <ec:InclusiveNamespaces PrefixList="mkgu"/>
		//         </ds:Transform>
		//       </ds:Transforms>
		//       <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
		//       <ds:DigestValue></ds:DigestValue>
		//     </ds:Reference>
		//   </ds:SignedInfo>
		//   <ds:SignatureValue></ds:SignatureValue>
		// </ds:Signature>`);
		return sig.getSignedXml();
	}
}

module.exports = Mkgu;