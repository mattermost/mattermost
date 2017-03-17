import stripDiacritics from './stripDiacritics';

function filterOptions (options, filterValue, excludeOptions, props) {
	if (props.ignoreAccents) {
		filterValue = stripDiacritics(filterValue);
	}

	if (props.ignoreCase) {
		filterValue = filterValue.toLowerCase();
	}

	if (excludeOptions) excludeOptions = excludeOptions.map(i => i[props.valueKey]);

	return options.filter(option => {
		if (excludeOptions && excludeOptions.indexOf(option[props.valueKey]) > -1) return false;
		if (props.filterOption) return props.filterOption.call(this, option, filterValue);
		if (!filterValue) return true;
		var valueTest = String(option[props.valueKey]);
		var labelTest = String(option[props.labelKey]);
		if (props.ignoreAccents) {
			if (props.matchProp !== 'label') valueTest = stripDiacritics(valueTest);
			if (props.matchProp !== 'value') labelTest = stripDiacritics(labelTest);
		}
		if (props.ignoreCase) {
			if (props.matchProp !== 'label') valueTest = valueTest.toLowerCase();
			if (props.matchProp !== 'value') labelTest = labelTest.toLowerCase();
		}
		return props.matchPos === 'start' ? (
			(props.matchProp !== 'label' && valueTest.substr(0, filterValue.length) === filterValue) ||
			(props.matchProp !== 'value' && labelTest.substr(0, filterValue.length) === filterValue)
		) : (
			(props.matchProp !== 'label' && valueTest.indexOf(filterValue) >= 0) ||
			(props.matchProp !== 'value' && labelTest.indexOf(filterValue) >= 0)
		);
	});
}

module.exports = filterOptions;
