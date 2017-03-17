
module.exports = {

	name: 'fix-nodelist-for-jsdom-6',

	installInto: function (expect) {

		expect.addType({
			name: 'NodeList',
			base: 'array-like',
			identify: value => {
				return typeof window !== 'undefined' &&
					typeof window.NodeList === 'function' &&
					value instanceof window.NodeList;
			}
		});

	}
};
