/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
module.exports = function getInnerRequest(resolver, request) {
	var innerRequest;
	if(request.request) {
		innerRequest = request.request;
		if(/^\.\.?\//.test(innerRequest) && request.relativePath) {
			innerRequest = resolver.join(request.relativePath, innerRequest);
		}
	} else {
		innerRequest = request.relativePath;
	}
	return innerRequest;
};
