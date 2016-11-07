
module.exports = function (html) {
	if (typeof document !== 'undefined') {
		return;
	}

	var jsdom = require('jsdom').jsdom;
	global.document = jsdom(html || '');
	global.window = global.document.defaultView;
	global.navigator = {
		userAgent: 'JSDOM'
	};
};
