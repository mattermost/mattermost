import React from 'react';
import Select from './Select';
import defaultFilterOptions from './utils/defaultFilterOptions';
import defaultMenuRenderer from './utils/defaultMenuRenderer';

const Creatable = React.createClass({
	displayName: 'CreatableSelect',

	propTypes: {
		// Child function responsible for creating the inner Select component
		// This component can be used to compose HOCs (eg Creatable and Async)
		// (props: Object): PropTypes.element
		children: React.PropTypes.func,

		// See Select.propTypes.filterOptions
		filterOptions: React.PropTypes.any,

		// Searches for any matching option within the set of options.
		// This function prevents duplicate options from being created.
		// ({ option: Object, options: Array, labelKey: string, valueKey: string }): boolean
		isOptionUnique: React.PropTypes.func,

    // Determines if the current input text represents a valid option.
    // ({ label: string }): boolean
    isValidNewOption: React.PropTypes.func,

		// See Select.propTypes.menuRenderer
		menuRenderer: React.PropTypes.any,

    // Factory to create new option.
    // ({ label: string, labelKey: string, valueKey: string }): Object
		newOptionCreator: React.PropTypes.func,

		// See Select.propTypes.options
		options: React.PropTypes.array,

    // Creates prompt/placeholder option text.
    // (filterText: string): string
		promptTextCreator: React.PropTypes.func,

		// Decides if a keyDown event (eg its `keyCode`) should result in the creation of a new option.
		shouldKeyDownEventCreateNewOption: React.PropTypes.func,
	},

	// Default prop methods
	statics: {
		isOptionUnique,
		isValidNewOption,
		newOptionCreator,
		promptTextCreator,
		shouldKeyDownEventCreateNewOption
	},

	getDefaultProps () {
		return {
			filterOptions: defaultFilterOptions,
			isOptionUnique,
			isValidNewOption,
			menuRenderer: defaultMenuRenderer,
			newOptionCreator,
			promptTextCreator,
			shouldKeyDownEventCreateNewOption,
		};
	},

	createNewOption () {
		const {
			isValidNewOption,
			newOptionCreator,
			options = [],
			shouldKeyDownEventCreateNewOption
		} = this.props;

		if (isValidNewOption({ label: this.inputValue })) {
			const option = newOptionCreator({ label: this.inputValue, labelKey: this.labelKey, valueKey: this.valueKey });
			const isOptionUnique = this.isOptionUnique({ option });

			// Don't add the same option twice.
			if (isOptionUnique) {
				options.unshift(option);

				this.select.selectValue(option);
			}
		}
	},

	filterOptions (...params) {
		const { filterOptions, isValidNewOption, options, promptTextCreator } = this.props;

		// TRICKY Check currently selected options as well.
		// Don't display a create-prompt for a value that's selected.
		// This covers async edge-cases where a newly-created Option isn't yet in the async-loaded array.
		const excludeOptions = params[2] || [];

		const filteredOptions = filterOptions(...params) || [];

		if (isValidNewOption({ label: this.inputValue })) {
			const { newOptionCreator } = this.props;

			const option = newOptionCreator({
				label: this.inputValue,
				labelKey: this.labelKey,
				valueKey: this.valueKey
			});

			// TRICKY Compare to all options (not just filtered options) in case option has already been selected).
			// For multi-selects, this would remove it from the filtered list.
			const isOptionUnique = this.isOptionUnique({
				option,
				options: excludeOptions.concat(filteredOptions)
			});

			if (isOptionUnique) {
				const prompt = promptTextCreator(this.inputValue);

				this._createPlaceholderOption = newOptionCreator({
					label: prompt,
					labelKey: this.labelKey,
					valueKey: this.valueKey
				});

				filteredOptions.unshift(this._createPlaceholderOption);
			}
		}

		return filteredOptions;
	},

	isOptionUnique ({
		option,
		options
	}) {
		const { isOptionUnique } = this.props;

		options = options || this.select.filterOptions();

		return isOptionUnique({
			labelKey: this.labelKey,
			option,
			options,
			valueKey: this.valueKey
		});
	},

	menuRenderer (params) {
		const { menuRenderer } = this.props;

		return menuRenderer({
			...params,
			onSelect: this.onOptionSelect
		});
	},

	onInputChange (input) {
		// This value may be needed in between Select mounts (when this.select is null)
		this.inputValue = input;
	},

	onInputKeyDown (event) {
		const { shouldKeyDownEventCreateNewOption } = this.props;
		const focusedOption = this.select.getFocusedOption();

		if (
			focusedOption &&
			focusedOption === this._createPlaceholderOption &&
			shouldKeyDownEventCreateNewOption({ keyCode: event.keyCode })
		) {
			this.createNewOption();

			// Prevent decorated Select from doing anything additional with this keyDown event
			event.preventDefault();
		}
	},

	onOptionSelect (option, event) {
		if (option === this._createPlaceholderOption) {
			this.createNewOption();
		} else {
			this.select.selectValue(option);
		}
	},

	render () {
		const {
			children = defaultChildren,
			newOptionCreator,
			shouldKeyDownEventCreateNewOption,
			...restProps
		} = this.props;

		const props = {
			...restProps,
			allowCreate: true,
			filterOptions: this.filterOptions,
			menuRenderer: this.menuRenderer,
			onInputChange: this.onInputChange,
			onInputKeyDown: this.onInputKeyDown,
			ref: (ref) => {
				this.select = ref;

				// These values may be needed in between Select mounts (when this.select is null)
				if (ref) {
					this.labelKey = ref.props.labelKey;
					this.valueKey = ref.props.valueKey;
				}
			}
		};

		return children(props);
	}
});

function defaultChildren (props) {
	return (
		<Select {...props} />
	);
};

function isOptionUnique ({ option, options, labelKey, valueKey }) {
	return options
		.filter((existingOption) =>
			existingOption[labelKey] === option[labelKey] ||
			existingOption[valueKey] === option[valueKey]
		)
		.length === 0;
};

function isValidNewOption ({ label }) {
	return !!label;
};

function newOptionCreator ({ label, labelKey, valueKey }) {
	const option = {};
	option[valueKey] = label;
 	option[labelKey] = label;
 	option.className = 'Select-create-option-placeholder';
 	return option;
};

function promptTextCreator (label) {
	return `Create option "${label}"`;
}

function shouldKeyDownEventCreateNewOption ({ keyCode }) {
	switch (keyCode) {
		case 9:   // TAB
		case 13:  // ENTER
		case 188: // COMMA
			return true;
	}

	return false;
};

module.exports = Creatable;
