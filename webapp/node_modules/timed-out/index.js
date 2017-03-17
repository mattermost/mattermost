'use strict';

module.exports = function (req, time) {
	if (req.timeoutTimer) {
		return req;
	}

	var host = req._headers ? (' to ' + req._headers.host) : '';

	req.timeoutTimer = setTimeout(function timeoutHandler() {
		req.abort();
		var e = new Error('Connection timed out on request' + host);
		e.code = 'ETIMEDOUT';
		req.emit('error', e);
	}, time);

	// Clear the connection timeout timer once a socket is assigned to the
	// request and is connected. Abort the request if there is no activity
	// on the socket for more than `time` milliseconds.
	req.on('socket', function assign(socket) {
		socket.on('connect', function connect() {
			clear();
			socket.setTimeout(time, function socketTimeoutHandler() {
				req.abort();
				var e = new Error('Socket timed out on request' + host);
				e.code = 'ESOCKETTIMEDOUT';
				req.emit('error', e);
			});
		});
	});

	function clear() {
		if (req.timeoutTimer) {
			clearTimeout(req.timeoutTimer);
			req.timeoutTimer = null;
		}
	}

	return req.on('error', clear);
};
