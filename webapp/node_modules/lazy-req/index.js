'use strict';
module.exports = function (fn) {
	return function (id) {
		var mod;

		return function () {
			if (!arguments.length) {
				mod = lazy(mod, fn, id);
				return mod;
			}

			var ret = {};

			[].forEach.call(arguments, function (prop) {
				Object.defineProperty(ret, prop, {
					get: function () {
						mod = lazy(mod, fn, id);
						if (typeof mod[prop] === 'function') {
							return function () {
								return mod[prop].apply(mod, arguments);
							};
						}

						return mod[prop];
					}
				});
			});

			return ret;
		};
	};

	function lazy(mod, fn, id) {
		return mod !== undefined ? mod : fn(id);
	}
};
