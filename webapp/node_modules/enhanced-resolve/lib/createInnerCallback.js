/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
module.exports = function createInnerCallback(callback, options, message, messageOptional) {
	var log = options.log;
	if(!log) {
		if(options.stack !== callback.stack) {
			var callbackWrapper = function callbackWrapper() {
				return callback.apply(this, arguments);
			}
			callbackWrapper.stack = options.stack;
			callbackWrapper.missing = options.missing;
			return callbackWrapper;
		}
		return callback;
	}

	function loggingCallbackWrapper() {
		var i;
		if(message) {
			if(!messageOptional || theLog.length > 0) {
				log(message);
				for(i = 0; i < theLog.length; i++)
					log("  " + theLog[i]);
			}
		} else {
			for(i = 0; i < theLog.length; i++)
				log(theLog[i]);
		}
		return callback.apply(this, arguments);

	}
	var theLog = [];
	loggingCallbackWrapper.log = function writeLog(msg) {
		theLog.push(msg);
	};
	loggingCallbackWrapper.stack = options.stack;
	loggingCallbackWrapper.missing = options.missing;
	return loggingCallbackWrapper;
}
