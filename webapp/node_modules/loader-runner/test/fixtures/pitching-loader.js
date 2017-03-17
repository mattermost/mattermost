exports.pitch = function(remaingRequest, previousRequest, data) {
	return [
		remaingRequest,
		previousRequest
	].join(":");
};
