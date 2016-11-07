require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* eslint react/prop-types: 0 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var _componentsContributors = require('./components/Contributors');

var _componentsContributors2 = _interopRequireDefault(_componentsContributors);

var _componentsGithubUsers = require('./components/GithubUsers');

var _componentsGithubUsers2 = _interopRequireDefault(_componentsGithubUsers);

var _componentsCustomComponents = require('./components/CustomComponents');

var _componentsCustomComponents2 = _interopRequireDefault(_componentsCustomComponents);

var _componentsCustomRender = require('./components/CustomRender');

var _componentsCustomRender2 = _interopRequireDefault(_componentsCustomRender);

var _componentsMultiselect = require('./components/Multiselect');

var _componentsMultiselect2 = _interopRequireDefault(_componentsMultiselect);

var _componentsNumericSelect = require('./components/NumericSelect');

var _componentsNumericSelect2 = _interopRequireDefault(_componentsNumericSelect);

var _componentsVirtualized = require('./components/Virtualized');

var _componentsVirtualized2 = _interopRequireDefault(_componentsVirtualized);

var _componentsStates = require('./components/States');

var _componentsStates2 = _interopRequireDefault(_componentsStates);

_reactDom2['default'].render(_react2['default'].createElement(
	'div',
	null,
	_react2['default'].createElement(_componentsStates2['default'], { label: 'States', searchable: true }),
	_react2['default'].createElement(_componentsMultiselect2['default'], { label: 'Multiselect' }),
	_react2['default'].createElement(_componentsVirtualized2['default'], { label: 'Virtualized' }),
	_react2['default'].createElement(_componentsContributors2['default'], { label: 'Contributors (Async)' }),
	_react2['default'].createElement(_componentsGithubUsers2['default'], { label: 'Github users (Async with fetch.js)' }),
	_react2['default'].createElement(_componentsNumericSelect2['default'], { label: 'Numeric Values' }),
	_react2['default'].createElement(_componentsCustomRender2['default'], { label: 'Custom Render Methods' }),
	_react2['default'].createElement(_componentsCustomComponents2['default'], { label: 'Custom Placeholder, Option and Value Components' })
), document.getElementById('example'));
/*
<SelectedValuesField label="Option Creation (tags mode)" options={FLAVOURS} allowCreate hint="Enter a value that's NOT in the list, then hit return" />
*/

},{"./components/Contributors":2,"./components/CustomComponents":3,"./components/CustomRender":4,"./components/GithubUsers":5,"./components/Multiselect":6,"./components/NumericSelect":7,"./components/States":8,"./components/Virtualized":9,"react":undefined,"react-dom":undefined,"react-select":undefined}],2:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var CONTRIBUTORS = require('../data/contributors');
var MAX_CONTRIBUTORS = 6;
var ASYNC_DELAY = 500;

var Contributors = _react2['default'].createClass({
	displayName: 'Contributors',
	propTypes: {
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {
			multi: true,
			value: [CONTRIBUTORS[0]]
		};
	},
	onChange: function onChange(value) {
		this.setState({
			value: value
		});
	},
	switchToMulti: function switchToMulti() {
		this.setState({
			multi: true,
			value: [this.state.value]
		});
	},
	switchToSingle: function switchToSingle() {
		this.setState({
			multi: false,
			value: this.state.value[0]
		});
	},
	getContributors: function getContributors(input, callback) {
		input = input.toLowerCase();
		var options = CONTRIBUTORS.filter(function (i) {
			return i.github.substr(0, input.length) === input;
		});
		var data = {
			options: options.slice(0, MAX_CONTRIBUTORS),
			complete: options.length <= MAX_CONTRIBUTORS
		};
		setTimeout(function () {
			callback(null, data);
		}, ASYNC_DELAY);
	},
	gotoContributor: function gotoContributor(value, event) {
		window.open('https://github.com/' + value.github);
	},
	render: function render() {
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'].Async, { multi: this.state.multi, value: this.state.value, onChange: this.onChange, onValueClick: this.gotoContributor, valueKey: 'github', labelKey: 'name', loadOptions: this.getContributors }),
			_react2['default'].createElement(
				'div',
				{ className: 'checkbox-list' },
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: this.state.multi, onChange: this.switchToMulti }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Multiselect'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: !this.state.multi, onChange: this.switchToSingle }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Single Value'
					)
				)
			),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'This example implements custom label and value properties, async options and opens the github profiles in a new window when values are clicked'
			)
		);
	}
});

module.exports = Contributors;

},{"../data/contributors":11,"react":undefined,"react-select":undefined}],3:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var _reactGravatar = require('react-gravatar');

var _reactGravatar2 = _interopRequireDefault(_reactGravatar);

var USERS = require('../data/users');
var GRAVATAR_SIZE = 15;

var GravatarOption = _react2['default'].createClass({
	displayName: 'GravatarOption',

	propTypes: {
		children: _react2['default'].PropTypes.node,
		className: _react2['default'].PropTypes.string,
		isDisabled: _react2['default'].PropTypes.bool,
		isFocused: _react2['default'].PropTypes.bool,
		isSelected: _react2['default'].PropTypes.bool,
		onFocus: _react2['default'].PropTypes.func,
		onSelect: _react2['default'].PropTypes.func,
		option: _react2['default'].PropTypes.object.isRequired
	},
	handleMouseDown: function handleMouseDown(event) {
		event.preventDefault();
		event.stopPropagation();
		this.props.onSelect(this.props.option, event);
	},
	handleMouseEnter: function handleMouseEnter(event) {
		this.props.onFocus(this.props.option, event);
	},
	handleMouseMove: function handleMouseMove(event) {
		if (this.props.isFocused) return;
		this.props.onFocus(this.props.option, event);
	},
	render: function render() {
		var gravatarStyle = {
			borderRadius: 3,
			display: 'inline-block',
			marginRight: 10,
			position: 'relative',
			top: -2,
			verticalAlign: 'middle'
		};
		return _react2['default'].createElement(
			'div',
			{ className: this.props.className,
				onMouseDown: this.handleMouseDown,
				onMouseEnter: this.handleMouseEnter,
				onMouseMove: this.handleMouseMove,
				title: this.props.option.title },
			_react2['default'].createElement(_reactGravatar2['default'], { email: this.props.option.email, size: GRAVATAR_SIZE, style: gravatarStyle }),
			this.props.children
		);
	}
});

var GravatarValue = _react2['default'].createClass({
	displayName: 'GravatarValue',

	propTypes: {
		children: _react2['default'].PropTypes.node,
		placeholder: _react2['default'].PropTypes.string,
		value: _react2['default'].PropTypes.object
	},
	render: function render() {
		var gravatarStyle = {
			borderRadius: 3,
			display: 'inline-block',
			marginRight: 10,
			position: 'relative',
			top: -2,
			verticalAlign: 'middle'
		};
		return _react2['default'].createElement(
			'div',
			{ className: 'Select-value', title: this.props.value.title },
			_react2['default'].createElement(
				'span',
				{ className: 'Select-value-label' },
				_react2['default'].createElement(_reactGravatar2['default'], { email: this.props.value.email, size: GRAVATAR_SIZE, style: gravatarStyle }),
				this.props.children
			)
		);
	}
});

var UsersField = _react2['default'].createClass({
	displayName: 'UsersField',

	propTypes: {
		hint: _react2['default'].PropTypes.string,
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {};
	},
	setValue: function setValue(value) {
		this.setState({ value: value });
	},
	render: function render() {
		var placeholder = _react2['default'].createElement(
			'span',
			null,
			'☺ Select User'
		);

		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'], {
				onChange: this.setValue,
				optionComponent: GravatarOption,
				options: USERS,
				placeholder: placeholder,
				value: this.state.value,
				valueComponent: GravatarValue
			}),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'This example implements custom Option and Value components to render a Gravatar image for each user based on their email. It also demonstrates rendering HTML elements as the placeholder.'
			)
		);
	}
});

module.exports = UsersField;

},{"../data/users":13,"react":undefined,"react-gravatar":29,"react-select":undefined}],4:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var DisabledUpsellOptions = _react2['default'].createClass({
	displayName: 'DisabledUpsellOptions',
	propTypes: {
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {};
	},
	setValue: function setValue(value) {
		this.setState({ value: value });
		console.log('Support level selected:', value.label);
	},
	renderLink: function renderLink() {
		return _react2['default'].createElement(
			'a',
			{ style: { marginLeft: 5 }, href: '/upgrade', target: '_blank' },
			'Upgrade here!'
		);
	},
	renderOption: function renderOption(option) {
		return _react2['default'].createElement(
			'span',
			{ style: { color: option.color } },
			option.label,
			' ',
			option.link
		);
	},
	renderValue: function renderValue(option) {
		return _react2['default'].createElement(
			'strong',
			{ style: { color: option.color } },
			option.label
		);
	},
	render: function render() {
		var options = [{ label: 'Basic customer support', value: 'basic', color: '#E31864' }, { label: 'Premium customer support', value: 'premium', color: '#6216A3' }, { label: 'Pro customer support', value: 'pro', disabled: true, link: this.renderLink() }];
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'], {
				placeholder: 'Select your support level',
				options: options,
				optionRenderer: this.renderOption,
				onChange: this.setValue,
				value: this.state.value,
				valueRenderer: this.renderValue
			}),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'This demonstates custom render methods and links in disabled options'
			)
		);
	}
});
module.exports = DisabledUpsellOptions;

},{"react":undefined,"react-select":undefined}],5:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var _isomorphicFetch = require('isomorphic-fetch');

var _isomorphicFetch2 = _interopRequireDefault(_isomorphicFetch);

var GithubUsers = _react2['default'].createClass({
	displayName: 'GithubUsers',
	propTypes: {
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {
			multi: true
		};
	},
	onChange: function onChange(value) {
		this.setState({
			value: value
		});
	},
	switchToMulti: function switchToMulti() {
		this.setState({
			multi: true,
			value: [this.state.value]
		});
	},
	switchToSingle: function switchToSingle() {
		this.setState({
			multi: false,
			value: this.state.value ? this.state.value[0] : null
		});
	},
	getUsers: function getUsers(input) {
		return (0, _isomorphicFetch2['default'])('https://api.github.com/search/users?q=' + input).then(function (response) {
			return response.json();
		}).then(function (json) {
			return { options: json.items };
		});
	},
	gotoUser: function gotoUser(value, event) {
		window.open(value.html_url);
	},
	render: function render() {
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'].Async, { multi: this.state.multi, value: this.state.value, onChange: this.onChange, onValueClick: this.gotoUser, valueKey: 'id', labelKey: 'login', loadOptions: this.getUsers, minimumInput: 1, backspaceRemoves: false }),
			_react2['default'].createElement(
				'div',
				{ className: 'checkbox-list' },
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: this.state.multi, onChange: this.switchToMulti }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Multiselect'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: !this.state.multi, onChange: this.switchToSingle }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Single Value'
					)
				)
			),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'This example uses fetch.js for showing Async options with Promises'
			)
		);
	}
});

module.exports = GithubUsers;

},{"isomorphic-fetch":21,"react":undefined,"react-select":undefined}],6:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var FLAVOURS = [{ label: 'Chocolate', value: 'chocolate' }, { label: 'Vanilla', value: 'vanilla' }, { label: 'Strawberry', value: 'strawberry' }, { label: 'Caramel', value: 'caramel' }, { label: 'Cookies and Cream', value: 'cookiescream' }, { label: 'Peppermint', value: 'peppermint' }];

var WHY_WOULD_YOU = [{ label: 'Chocolate (are you crazy?)', value: 'chocolate', disabled: true }].concat(FLAVOURS.slice(1));

var MultiSelectField = _react2['default'].createClass({
	displayName: 'MultiSelectField',
	propTypes: {
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {
			disabled: false,
			crazy: false,
			options: FLAVOURS,
			value: []
		};
	},
	handleSelectChange: function handleSelectChange(value) {
		console.log('You\'ve selected:', value);
		this.setState({ value: value });
	},
	toggleDisabled: function toggleDisabled(e) {
		this.setState({ disabled: e.target.checked });
	},
	toggleChocolate: function toggleChocolate(e) {
		var crazy = e.target.checked;
		this.setState({
			crazy: crazy,
			options: crazy ? WHY_WOULD_YOU : FLAVOURS
		});
	},
	render: function render() {
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'], { multi: true, simpleValue: true, disabled: this.state.disabled, value: this.state.value, placeholder: 'Select your favourite(s)', options: this.state.options, onChange: this.handleSelectChange }),
			_react2['default'].createElement(
				'div',
				{ className: 'checkbox-list' },
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.disabled, onChange: this.toggleDisabled }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Disable the control'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.crazy, onChange: this.toggleChocolate }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'I don\'t like Chocolate (disabled the option)'
					)
				)
			)
		);
	}
});

module.exports = MultiSelectField;

},{"react":undefined,"react-select":undefined}],7:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var ValuesAsNumbersField = _react2['default'].createClass({
	displayName: 'ValuesAsNumbersField',
	propTypes: {
		label: _react2['default'].PropTypes.string
	},
	getInitialState: function getInitialState() {
		return {
			options: [{ value: 10, label: 'Ten' }, { value: 11, label: 'Eleven' }, { value: 12, label: 'Twelve' }, { value: 23, label: 'Twenty-three' }, { value: 24, label: 'Twenty-four' }],
			matchPos: 'any',
			matchValue: true,
			matchLabel: true,
			value: null,
			multi: false
		};
	},
	onChangeMatchStart: function onChangeMatchStart(event) {
		this.setState({
			matchPos: event.target.checked ? 'start' : 'any'
		});
	},
	onChangeMatchValue: function onChangeMatchValue(event) {
		this.setState({
			matchValue: event.target.checked
		});
	},
	onChangeMatchLabel: function onChangeMatchLabel(event) {
		this.setState({
			matchLabel: event.target.checked
		});
	},
	onChange: function onChange(value) {
		this.setState({ value: value });
		console.log('Numeric Select value changed to', value);
	},
	onChangeMulti: function onChangeMulti(event) {
		this.setState({
			multi: event.target.checked
		});
	},
	render: function render() {
		var matchProp = 'any';
		if (this.state.matchLabel && !this.state.matchValue) {
			matchProp = 'label';
		}
		if (!this.state.matchLabel && this.state.matchValue) {
			matchProp = 'value';
		}
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'], {
				matchPos: this.state.matchPos,
				matchProp: matchProp,
				multi: this.state.multi,
				onChange: this.onChange,
				options: this.state.options,
				simpleValue: true,
				value: this.state.value
			}),
			_react2['default'].createElement(
				'div',
				{ className: 'checkbox-list' },
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.multi, onChange: this.onChangeMulti }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Multi-Select'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.matchValue, onChange: this.onChangeMatchValue }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Match value'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.matchLabel, onChange: this.onChangeMatchLabel }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Match label'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', checked: this.state.matchPos === 'start', onChange: this.onChangeMatchStart }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Only include matches from the start of the string'
					)
				)
			),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'This example uses simple numeric values'
			)
		);
	}
});

module.exports = ValuesAsNumbersField;

},{"react":undefined,"react-select":undefined}],8:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var STATES = require('../data/states');

var StatesField = _react2['default'].createClass({
	displayName: 'StatesField',
	propTypes: {
		label: _react2['default'].PropTypes.string,
		searchable: _react2['default'].PropTypes.bool
	},
	getDefaultProps: function getDefaultProps() {
		return {
			label: 'States:',
			searchable: true
		};
	},
	getInitialState: function getInitialState() {
		return {
			country: 'AU',
			disabled: false,
			searchable: this.props.searchable,
			selectValue: 'new-south-wales',
			clearable: true
		};
	},
	switchCountry: function switchCountry(e) {
		var newCountry = e.target.value;
		console.log('Country changed to ' + newCountry);
		this.setState({
			country: newCountry,
			selectValue: null
		});
	},
	updateValue: function updateValue(newValue) {
		console.log('State changed to ' + newValue);
		this.setState({
			selectValue: newValue
		});
	},
	focusStateSelect: function focusStateSelect() {
		this.refs.stateSelect.focus();
	},
	toggleCheckbox: function toggleCheckbox(e) {
		var newState = {};
		newState[e.target.name] = e.target.checked;
		this.setState(newState);
	},
	render: function render() {
		var options = STATES[this.state.country];
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				this.props.label
			),
			_react2['default'].createElement(_reactSelect2['default'], { ref: 'stateSelect', autofocus: true, options: options, simpleValue: true, clearable: this.state.clearable, name: 'selected-state', disabled: this.state.disabled, value: this.state.selectValue, onChange: this.updateValue, searchable: this.state.searchable }),
			_react2['default'].createElement(
				'div',
				{ style: { marginTop: 14 } },
				_react2['default'].createElement(
					'button',
					{ type: 'button', onClick: this.focusStateSelect },
					'Focus Select'
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox', style: { marginLeft: 10 } },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', name: 'searchable', checked: this.state.searchable, onChange: this.toggleCheckbox }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Searchable'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox', style: { marginLeft: 10 } },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', name: 'disabled', checked: this.state.disabled, onChange: this.toggleCheckbox }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Disabled'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox', style: { marginLeft: 10 } },
					_react2['default'].createElement('input', { type: 'checkbox', className: 'checkbox-control', name: 'clearable', checked: this.state.clearable, onChange: this.toggleCheckbox }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Clearable'
					)
				)
			),
			_react2['default'].createElement(
				'div',
				{ className: 'checkbox-list' },
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: this.state.country === 'AU', value: 'AU', onChange: this.switchCountry }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'Australia'
					)
				),
				_react2['default'].createElement(
					'label',
					{ className: 'checkbox' },
					_react2['default'].createElement('input', { type: 'radio', className: 'checkbox-control', checked: this.state.country === 'US', value: 'US', onChange: this.switchCountry }),
					_react2['default'].createElement(
						'span',
						{ className: 'checkbox-label' },
						'United States'
					)
				)
			)
		);
	}
});

module.exports = StatesField;

},{"../data/states":12,"react":undefined,"react-select":undefined}],9:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactVirtualizedSelect = require('react-virtualized-select');

var _reactVirtualizedSelect2 = _interopRequireDefault(_reactVirtualizedSelect);

var DATA = require('../data/cities');

var CitiesField = _react2['default'].createClass({
	displayName: 'CitiesField',
	getInitialState: function getInitialState() {
		return {};
	},
	updateValue: function updateValue(newValue) {
		this.setState({
			selectValue: newValue
		});
	},
	render: function render() {
		var options = DATA.CITIES;
		return _react2['default'].createElement(
			'div',
			{ className: 'section' },
			_react2['default'].createElement(
				'h3',
				{ className: 'section-heading' },
				'Cities (Large Dataset)'
			),
			_react2['default'].createElement(_reactVirtualizedSelect2['default'], { ref: 'citySelect',
				options: options,
				simpleValue: true,
				clearable: true,
				name: 'select-city',
				value: this.state.selectValue,
				onChange: this.updateValue,
				searchable: true,
				labelKey: 'name',
				valueKey: 'name'
			}),
			_react2['default'].createElement(
				'div',
				{ className: 'hint' },
				'Uses ',
				_react2['default'].createElement(
					'a',
					{ href: 'https://github.com/bvaughn/react-virtualized' },
					'react-virtualized'
				),
				' and ',
				_react2['default'].createElement(
					'a',
					{ href: 'https://github.com/bvaughn/react-virtualized-select/' },
					'react-virtualized-select'
				),
				' to display a list of the world\'s 1,000 largest cities.'
			)
		);
	}
});

module.exports = CitiesField;

},{"../data/cities":10,"react":undefined,"react-virtualized-select":32}],10:[function(require,module,exports){
'use strict';

exports.CITIES = [{ name: 'Abilene' }, { name: 'Addison' }, { name: 'Akron' }, { name: 'Alameda' }, { name: 'Albany' }, { name: 'Albany' }, { name: 'Albany' }, { name: 'Albuquerque' }, { name: 'Alexandria' }, { name: 'Alexandria' }, { name: 'Alhambra' }, { name: 'Aliso Viejo' }, { name: 'Allen' }, { name: 'Allentown' }, { name: 'Alpharetta' }, { name: 'Altamonte Springs' }, { name: 'Altoona' }, { name: 'Amarillo' }, { name: 'Ames' }, { name: 'Anaheim' }, { name: 'Anchorage' }, { name: 'Anderson' }, { name: 'Ankeny' }, { name: 'Ann Arbor' }, { name: 'Annapolis' }, { name: 'Antioch' }, { name: 'Apache Junction' }, { name: 'Apex' }, { name: 'Apopka' }, { name: 'Apple Valley' }, { name: 'Apple Valley' }, { name: 'Appleton' }, { name: 'Arcadia' }, { name: 'Arlington' }, { name: 'Arlington Heights' }, { name: 'Arvada' }, { name: 'Asheville' }, { name: 'Athens-Clarke County' }, { name: 'Atlanta' }, { name: 'Atlantic City' }, { name: 'Attleboro' }, { name: 'Auburn' }, { name: 'Auburn' }, { name: 'Augusta-Richmond County' }, { name: 'Aurora' }, { name: 'Aurora' }, { name: 'Austin' }, { name: 'Aventura' }, { name: 'Avondale' }, { name: 'Azusa' }, { name: 'Bakersfield' }, { name: 'Baldwin Park' }, { name: 'Baltimore' }, { name: 'Barnstable Town' }, { name: 'Bartlett' }, { name: 'Bartlett' }, { name: 'Baton Rouge' }, { name: 'Battle Creek' }, { name: 'Bayonne' }, { name: 'Baytown' }, { name: 'Beaumont' }, { name: 'Beaumont' }, { name: 'Beavercreek' }, { name: 'Beaverton' }, { name: 'Bedford' }, { name: 'Bell Gardens' }, { name: 'Belleville' }, { name: 'Bellevue' }, { name: 'Bellevue' }, { name: 'Bellflower' }, { name: 'Bellingham' }, { name: 'Beloit' }, { name: 'Bend' }, { name: 'Bentonville' }, { name: 'Berkeley' }, { name: 'Berwyn' }, { name: 'Bethlehem' }, { name: 'Beverly' }, { name: 'Billings' }, { name: 'Biloxi' }, { name: 'Binghamton' }, { name: 'Birmingham' }, { name: 'Bismarck' }, { name: 'Blacksburg' }, { name: 'Blaine' }, { name: 'Bloomington' }, { name: 'Bloomington' }, { name: 'Bloomington' }, { name: 'Blue Springs' }, { name: 'Boca Raton' }, { name: 'Boise City' }, { name: 'Bolingbrook' }, { name: 'Bonita Springs' }, { name: 'Bossier City' }, { name: 'Boston' }, { name: 'Boulder' }, { name: 'Bountiful' }, { name: 'Bowie' }, { name: 'Bowling Green' }, { name: 'Boynton Beach' }, { name: 'Bozeman' }, { name: 'Bradenton' }, { name: 'Brea' }, { name: 'Bremerton' }, { name: 'Brentwood' }, { name: 'Brentwood' }, { name: 'Bridgeport' }, { name: 'Bristol' }, { name: 'Brockton' }, { name: 'Broken Arrow' }, { name: 'Brookfield' }, { name: 'Brookhaven' }, { name: 'Brooklyn Park' }, { name: 'Broomfield' }, { name: 'Brownsville' }, { name: 'Bryan' }, { name: 'Buckeye' }, { name: 'Buena Park' }, { name: 'Buffalo' }, { name: 'Buffalo Grove' }, { name: 'Bullhead City' }, { name: 'Burbank' }, { name: 'Burien' }, { name: 'Burleson' }, { name: 'Burlington' }, { name: 'Burlington' }, { name: 'Burnsville' }, { name: 'Caldwell' }, { name: 'Calexico' }, { name: 'Calumet City' }, { name: 'Camarillo' }, { name: 'Cambridge' }, { name: 'Camden' }, { name: 'Campbell' }, { name: 'Canton' }, { name: 'Cape Coral' }, { name: 'Cape Girardeau' }, { name: 'Carlsbad' }, { name: 'Carmel' }, { name: 'Carol Stream' }, { name: 'Carpentersville' }, { name: 'Carrollton' }, { name: 'Carson' }, { name: 'Carson City' }, { name: 'Cary' }, { name: 'Casa Grande' }, { name: 'Casper' }, { name: 'Castle Rock' }, { name: 'Cathedral City' }, { name: 'Cedar Falls' }, { name: 'Cedar Hill' }, { name: 'Cedar Park' }, { name: 'Cedar Rapids' }, { name: 'Centennial' }, { name: 'Ceres' }, { name: 'Cerritos' }, { name: 'Champaign' }, { name: 'Chandler' }, { name: 'Chapel Hill' }, { name: 'Charleston' }, { name: 'Charleston' }, { name: 'Charlotte' }, { name: 'Charlottesville' }, { name: 'Chattanooga' }, { name: 'Chelsea' }, { name: 'Chesapeake' }, { name: 'Chesterfield' }, { name: 'Cheyenne' }, { name: 'Chicago' }, { name: 'Chico' }, { name: 'Chicopee' }, { name: 'Chino' }, { name: 'Chino Hills' }, { name: 'Chula Vista' }, { name: 'Cicero' }, { name: 'Cincinnati' }, { name: 'Citrus Heights' }, { name: 'Clarksville' }, { name: 'Clearwater' }, { name: 'Cleveland' }, { name: 'Cleveland' }, { name: 'Cleveland Heights' }, { name: 'Clifton' }, { name: 'Clovis' }, { name: 'Clovis' }, { name: 'Coachella' }, { name: 'Coconut Creek' }, { name: 'Coeur d\'Alene' }, { name: 'College Station' }, { name: 'Collierville' }, { name: 'Colorado Springs' }, { name: 'Colton' }, { name: 'Columbia' }, { name: 'Columbia' }, { name: 'Columbus' }, { name: 'Columbus' }, { name: 'Columbus' }, { name: 'Commerce City' }, { name: 'Compton' }, { name: 'Concord' }, { name: 'Concord' }, { name: 'Concord' }, { name: 'Conroe' }, { name: 'Conway' }, { name: 'Coon Rapids' }, { name: 'Coppell' }, { name: 'Coral Gables' }, { name: 'Coral Springs' }, { name: 'Corona' }, { name: 'Corpus Christi' }, { name: 'Corvallis' }, { name: 'Costa Mesa' }, { name: 'Council Bluffs' }, { name: 'Covina' }, { name: 'Covington' }, { name: 'Cranston' }, { name: 'Crystal Lake' }, { name: 'Culver City' }, { name: 'Cupertino' }, { name: 'Cutler Bay' }, { name: 'Cuyahoga Falls' }, { name: 'Cypress' }, { name: 'Dallas' }, { name: 'Daly City' }, { name: 'Danbury' }, { name: 'Danville' }, { name: 'Danville' }, { name: 'Davenport' }, { name: 'Davie' }, { name: 'Davis' }, { name: 'Dayton' }, { name: 'Daytona Beach' }, { name: 'DeKalb' }, { name: 'DeSoto' }, { name: 'Dearborn' }, { name: 'Dearborn Heights' }, { name: 'Decatur' }, { name: 'Decatur' }, { name: 'Deerfield Beach' }, { name: 'Delano' }, { name: 'Delray Beach' }, { name: 'Deltona' }, { name: 'Denton' }, { name: 'Denver' }, { name: 'Des Moines' }, { name: 'Des Plaines' }, { name: 'Detroit' }, { name: 'Diamond Bar' }, { name: 'Doral' }, { name: 'Dothan' }, { name: 'Dover' }, { name: 'Downers Grove' }, { name: 'Downey' }, { name: 'Draper' }, { name: 'Dublin' }, { name: 'Dublin' }, { name: 'Dubuque' }, { name: 'Duluth' }, { name: 'Duncanville' }, { name: 'Dunwoody' }, { name: 'Durham' }, { name: 'Eagan' }, { name: 'East Lansing' }, { name: 'East Orange' }, { name: 'East Providence' }, { name: 'Eastvale' }, { name: 'Eau Claire' }, { name: 'Eden Prairie' }, { name: 'Edina' }, { name: 'Edinburg' }, { name: 'Edmond' }, { name: 'Edmonds' }, { name: 'El Cajon' }, { name: 'El Centro' }, { name: 'El Monte' }, { name: 'El Paso' }, { name: 'Elgin' }, { name: 'Elizabeth' }, { name: 'Elk Grove' }, { name: 'Elkhart' }, { name: 'Elmhurst' }, { name: 'Elyria' }, { name: 'Encinitas' }, { name: 'Enid' }, { name: 'Erie' }, { name: 'Escondido' }, { name: 'Euclid' }, { name: 'Eugene' }, { name: 'Euless' }, { name: 'Evanston' }, { name: 'Evansville' }, { name: 'Everett' }, { name: 'Everett' }, { name: 'Fairfield' }, { name: 'Fairfield' }, { name: 'Fall River' }, { name: 'Fargo' }, { name: 'Farmington' }, { name: 'Farmington Hills' }, { name: 'Fayetteville' }, { name: 'Fayetteville' }, { name: 'Federal Way' }, { name: 'Findlay' }, { name: 'Fishers' }, { name: 'Fitchburg' }, { name: 'Flagstaff' }, { name: 'Flint' }, { name: 'Florence' }, { name: 'Florence' }, { name: 'Florissant' }, { name: 'Flower Mound' }, { name: 'Folsom' }, { name: 'Fond du Lac' }, { name: 'Fontana' }, { name: 'Fort Collins' }, { name: 'Fort Lauderdale' }, { name: 'Fort Myers' }, { name: 'Fort Pierce' }, { name: 'Fort Smith' }, { name: 'Fort Wayne' }, { name: 'Fort Worth' }, { name: 'Fountain Valley' }, { name: 'Franklin' }, { name: 'Frederick' }, { name: 'Freeport' }, { name: 'Fremont' }, { name: 'Fresno' }, { name: 'Friendswood' }, { name: 'Frisco' }, { name: 'Fullerton' }, { name: 'Gainesville' }, { name: 'Gaithersburg' }, { name: 'Galveston' }, { name: 'Garden Grove' }, { name: 'Gardena' }, { name: 'Garland' }, { name: 'Gary' }, { name: 'Gastonia' }, { name: 'Georgetown' }, { name: 'Germantown' }, { name: 'Gilbert' }, { name: 'Gilroy' }, { name: 'Glendale' }, { name: 'Glendale' }, { name: 'Glendora' }, { name: 'Glenview' }, { name: 'Goodyear' }, { name: 'Goose Creek' }, { name: 'Grand Forks' }, { name: 'Grand Island' }, { name: 'Grand Junction' }, { name: 'Grand Prairie' }, { name: 'Grand Rapids' }, { name: 'Grapevine' }, { name: 'Great Falls' }, { name: 'Greeley' }, { name: 'Green Bay' }, { name: 'Greenacres' }, { name: 'Greenfield' }, { name: 'Greensboro' }, { name: 'Greenville' }, { name: 'Greenville' }, { name: 'Greenwood' }, { name: 'Gresham' }, { name: 'Grove City' }, { name: 'Gulfport' }, { name: 'Hackensack' }, { name: 'Hagerstown' }, { name: 'Hallandale Beach' }, { name: 'Haltom City' }, { name: 'Hamilton' }, { name: 'Hammond' }, { name: 'Hampton' }, { name: 'Hanford' }, { name: 'Hanover Park' }, { name: 'Harlingen' }, { name: 'Harrisburg' }, { name: 'Harrisonburg' }, { name: 'Hartford' }, { name: 'Hattiesburg' }, { name: 'Haverhill' }, { name: 'Hawthorne' }, { name: 'Hayward' }, { name: 'Hemet' }, { name: 'Hempstead' }, { name: 'Henderson' }, { name: 'Hendersonville' }, { name: 'Hesperia' }, { name: 'Hialeah' }, { name: 'Hickory' }, { name: 'High Point' }, { name: 'Highland' }, { name: 'Hillsboro' }, { name: 'Hilton Head Island' }, { name: 'Hoboken' }, { name: 'Hoffman Estates' }, { name: 'Hollywood' }, { name: 'Holyoke' }, { name: 'Homestead' }, { name: 'Honolulu' }, { name: 'Hoover' }, { name: 'Houston' }, { name: 'Huber Heights' }, { name: 'Huntersville' }, { name: 'Huntington' }, { name: 'Huntington Beach' }, { name: 'Huntington Park' }, { name: 'Huntsville' }, { name: 'Huntsville' }, { name: 'Hurst' }, { name: 'Hutchinson' }, { name: 'Idaho Falls' }, { name: 'Independence' }, { name: 'Indianapolis' }, { name: 'Indio' }, { name: 'Inglewood' }, { name: 'Iowa City' }, { name: 'Irvine' }, { name: 'Irving' }, { name: 'Jackson' }, { name: 'Jackson' }, { name: 'Jacksonville' }, { name: 'Jacksonville' }, { name: 'Janesville' }, { name: 'Jefferson City' }, { name: 'Jeffersonville' }, { name: 'Jersey City' }, { name: 'Johns Creek' }, { name: 'Johnson City' }, { name: 'Joliet' }, { name: 'Jonesboro' }, { name: 'Joplin' }, { name: 'Jupiter' }, { name: 'Jurupa Valley' }, { name: 'Kalamazoo' }, { name: 'Kannapolis' }, { name: 'Kansas City' }, { name: 'Kansas City' }, { name: 'Kearny' }, { name: 'Keizer' }, { name: 'Keller' }, { name: 'Kenner' }, { name: 'Kennewick' }, { name: 'Kenosha' }, { name: 'Kent' }, { name: 'Kentwood' }, { name: 'Kettering' }, { name: 'Killeen' }, { name: 'Kingsport' }, { name: 'Kirkland' }, { name: 'Kissimmee' }, { name: 'Knoxville' }, { name: 'Kokomo' }, { name: 'La Crosse' }, { name: 'La Habra' }, { name: 'La Mesa' }, { name: 'La Mirada' }, { name: 'La Puente' }, { name: 'La Quinta' }, { name: 'Lacey' }, { name: 'Lafayette' }, { name: 'Lafayette' }, { name: 'Laguna Niguel' }, { name: 'Lake Charles' }, { name: 'Lake Elsinore' }, { name: 'Lake Forest' }, { name: 'Lake Havasu City' }, { name: 'Lake Oswego' }, { name: 'Lakeland' }, { name: 'Lakeville' }, { name: 'Lakewood' }, { name: 'Lakewood' }, { name: 'Lakewood' }, { name: 'Lakewood' }, { name: 'Lancaster' }, { name: 'Lancaster' }, { name: 'Lancaster' }, { name: 'Lancaster' }, { name: 'Lansing' }, { name: 'Laredo' }, { name: 'Largo' }, { name: 'Las Cruces' }, { name: 'Las Vegas' }, { name: 'Lauderhill' }, { name: 'Lawrence' }, { name: 'Lawrence' }, { name: 'Lawrence' }, { name: 'Lawton' }, { name: 'Layton' }, { name: 'League City' }, { name: 'Lee\'s Summit' }, { name: 'Leesburg' }, { name: 'Lehi' }, { name: 'Lenexa' }, { name: 'Leominster' }, { name: 'Lewisville' }, { name: 'Lexington-Fayette' }, { name: 'Lima' }, { name: 'Lincoln' }, { name: 'Lincoln' }, { name: 'Lincoln Park' }, { name: 'Linden' }, { name: 'Little Rock' }, { name: 'Littleton' }, { name: 'Livermore' }, { name: 'Livonia' }, { name: 'Lodi' }, { name: 'Logan' }, { name: 'Lombard' }, { name: 'Lompoc' }, { name: 'Long Beach' }, { name: 'Longmont' }, { name: 'Longview' }, { name: 'Lorain' }, { name: 'Los Angeles' }, { name: 'Louisville/Jefferson County' }, { name: 'Loveland' }, { name: 'Lowell' }, { name: 'Lubbock' }, { name: 'Lynchburg' }, { name: 'Lynn' }, { name: 'Lynwood' }, { name: 'Macon' }, { name: 'Madera' }, { name: 'Madison' }, { name: 'Madison' }, { name: 'Malden' }, { name: 'Manassas' }, { name: 'Manchester' }, { name: 'Manhattan' }, { name: 'Mankato' }, { name: 'Mansfield' }, { name: 'Mansfield' }, { name: 'Manteca' }, { name: 'Maple Grove' }, { name: 'Maplewood' }, { name: 'Marana' }, { name: 'Margate' }, { name: 'Maricopa' }, { name: 'Marietta' }, { name: 'Marlborough' }, { name: 'Martinez' }, { name: 'Marysville' }, { name: 'McAllen' }, { name: 'McKinney' }, { name: 'Medford' }, { name: 'Medford' }, { name: 'Melbourne' }, { name: 'Memphis' }, { name: 'Menifee' }, { name: 'Mentor' }, { name: 'Merced' }, { name: 'Meriden' }, { name: 'Meridian' }, { name: 'Meridian' }, { name: 'Mesa' }, { name: 'Mesquite' }, { name: 'Methuen' }, { name: 'Miami' }, { name: 'Miami Beach' }, { name: 'Miami Gardens' }, { name: 'Middletown' }, { name: 'Middletown' }, { name: 'Midland' }, { name: 'Midland' }, { name: 'Midwest City' }, { name: 'Milford' }, { name: 'Milpitas' }, { name: 'Milwaukee' }, { name: 'Minneapolis' }, { name: 'Minnetonka' }, { name: 'Minot' }, { name: 'Miramar' }, { name: 'Mishawaka' }, { name: 'Mission' }, { name: 'Mission Viejo' }, { name: 'Missoula' }, { name: 'Missouri City' }, { name: 'Mobile' }, { name: 'Modesto' }, { name: 'Moline' }, { name: 'Monroe' }, { name: 'Monrovia' }, { name: 'Montclair' }, { name: 'Montebello' }, { name: 'Monterey Park' }, { name: 'Montgomery' }, { name: 'Moore' }, { name: 'Moorhead' }, { name: 'Moreno Valley' }, { name: 'Morgan Hill' }, { name: 'Mount Pleasant' }, { name: 'Mount Prospect' }, { name: 'Mount Vernon' }, { name: 'Mountain View' }, { name: 'Muncie' }, { name: 'Murfreesboro' }, { name: 'Murray' }, { name: 'Murrieta' }, { name: 'Muskegon' }, { name: 'Muskogee' }, { name: 'Nampa' }, { name: 'Napa' }, { name: 'Naperville' }, { name: 'Nashua' }, { name: 'Nashville-Davidson' }, { name: 'National City' }, { name: 'New Bedford' }, { name: 'New Berlin' }, { name: 'New Braunfels' }, { name: 'New Britain' }, { name: 'New Brunswick' }, { name: 'New Haven' }, { name: 'New Orleans' }, { name: 'New Rochelle' }, { name: 'New York' }, { name: 'Newark' }, { name: 'Newark' }, { name: 'Newark' }, { name: 'Newport Beach' }, { name: 'Newport News' }, { name: 'Newton' }, { name: 'Niagara Falls' }, { name: 'Noblesville' }, { name: 'Norfolk' }, { name: 'Normal' }, { name: 'Norman' }, { name: 'North Charleston' }, { name: 'North Las Vegas' }, { name: 'North Lauderdale' }, { name: 'North Little Rock' }, { name: 'North Miami' }, { name: 'North Miami Beach' }, { name: 'North Port' }, { name: 'North Richland Hills' }, { name: 'Northglenn' }, { name: 'Norwalk' }, { name: 'Norwalk' }, { name: 'Norwich' }, { name: 'Novato' }, { name: 'Novi' }, { name: 'O\'Fallon' }, { name: 'Oak Lawn' }, { name: 'Oak Park' }, { name: 'Oakland' }, { name: 'Oakland Park' }, { name: 'Oakley' }, { name: 'Ocala' }, { name: 'Oceanside' }, { name: 'Ocoee' }, { name: 'Odessa' }, { name: 'Ogden' }, { name: 'Oklahoma City' }, { name: 'Olathe' }, { name: 'Olympia' }, { name: 'Omaha' }, { name: 'Ontario' }, { name: 'Orange' }, { name: 'Orem' }, { name: 'Orland Park' }, { name: 'Orlando' }, { name: 'Ormond Beach' }, { name: 'Oro Valley' }, { name: 'Oshkosh' }, { name: 'Overland Park' }, { name: 'Owensboro' }, { name: 'Oxnard' }, { name: 'Pacifica' }, { name: 'Palatine' }, { name: 'Palm Bay' }, { name: 'Palm Beach Gardens' }, { name: 'Palm Coast' }, { name: 'Palm Desert' }, { name: 'Palm Springs' }, { name: 'Palmdale' }, { name: 'Palo Alto' }, { name: 'Panama City' }, { name: 'Paramount' }, { name: 'Park Ridge' }, { name: 'Parker' }, { name: 'Parma' }, { name: 'Pasadena' }, { name: 'Pasadena' }, { name: 'Pasco' }, { name: 'Passaic' }, { name: 'Paterson' }, { name: 'Pawtucket' }, { name: 'Peabody' }, { name: 'Peachtree Corners' }, { name: 'Pearland' }, { name: 'Pembroke Pines' }, { name: 'Pensacola' }, { name: 'Peoria' }, { name: 'Peoria' }, { name: 'Perris' }, { name: 'Perth Amboy' }, { name: 'Petaluma' }, { name: 'Pflugerville' }, { name: 'Pharr' }, { name: 'Phenix City' }, { name: 'Philadelphia' }, { name: 'Phoenix' }, { name: 'Pico Rivera' }, { name: 'Pine Bluff' }, { name: 'Pinellas Park' }, { name: 'Pittsburg' }, { name: 'Pittsburgh' }, { name: 'Pittsfield' }, { name: 'Placentia' }, { name: 'Plainfield' }, { name: 'Plainfield' }, { name: 'Plano' }, { name: 'Plantation' }, { name: 'Pleasanton' }, { name: 'Plymouth' }, { name: 'Pocatello' }, { name: 'Pomona' }, { name: 'Pompano Beach' }, { name: 'Pontiac' }, { name: 'Port Arthur' }, { name: 'Port Orange' }, { name: 'Port St. Lucie' }, { name: 'Portage' }, { name: 'Porterville' }, { name: 'Portland' }, { name: 'Portland' }, { name: 'Portsmouth' }, { name: 'Poway' }, { name: 'Prescott' }, { name: 'Prescott Valley' }, { name: 'Providence' }, { name: 'Provo' }, { name: 'Pueblo' }, { name: 'Puyallup' }, { name: 'Quincy' }, { name: 'Quincy' }, { name: 'Racine' }, { name: 'Raleigh' }, { name: 'Rancho Cordova' }, { name: 'Rancho Cucamonga' }, { name: 'Rancho Palos Verdes' }, { name: 'Rancho Santa Margarita' }, { name: 'Rapid City' }, { name: 'Reading' }, { name: 'Redding' }, { name: 'Redlands' }, { name: 'Redmond' }, { name: 'Redondo Beach' }, { name: 'Redwood City' }, { name: 'Reno' }, { name: 'Renton' }, { name: 'Revere' }, { name: 'Rialto' }, { name: 'Richardson' }, { name: 'Richland' }, { name: 'Richmond' }, { name: 'Richmond' }, { name: 'Rio Rancho' }, { name: 'Riverside' }, { name: 'Riverton' }, { name: 'Roanoke' }, { name: 'Rochester' }, { name: 'Rochester' }, { name: 'Rochester Hills' }, { name: 'Rock Hill' }, { name: 'Rock Island' }, { name: 'Rockford' }, { name: 'Rocklin' }, { name: 'Rockville' }, { name: 'Rockwall' }, { name: 'Rocky Mount' }, { name: 'Rogers' }, { name: 'Rohnert Park' }, { name: 'Romeoville' }, { name: 'Rosemead' }, { name: 'Roseville' }, { name: 'Roseville' }, { name: 'Roswell' }, { name: 'Roswell' }, { name: 'Round Rock' }, { name: 'Rowlett' }, { name: 'Roy' }, { name: 'Royal Oak' }, { name: 'Sacramento' }, { name: 'Saginaw' }, { name: 'Salem' }, { name: 'Salem' }, { name: 'Salina' }, { name: 'Salinas' }, { name: 'Salt Lake City' }, { name: 'Sammamish' }, { name: 'San Angelo' }, { name: 'San Antonio' }, { name: 'San Bernardino' }, { name: 'San Bruno' }, { name: 'San Buenaventura (Ventura)' }, { name: 'San Clemente' }, { name: 'San Diego' }, { name: 'San Francisco' }, { name: 'San Gabriel' }, { name: 'San Jacinto' }, { name: 'San Jose' }, { name: 'San Leandro' }, { name: 'San Luis Obispo' }, { name: 'San Marcos' }, { name: 'San Marcos' }, { name: 'San Mateo' }, { name: 'San Rafael' }, { name: 'San Ramon' }, { name: 'Sandy' }, { name: 'Sandy Springs' }, { name: 'Sanford' }, { name: 'Santa Ana' }, { name: 'Santa Barbara' }, { name: 'Santa Clara' }, { name: 'Santa Clarita' }, { name: 'Santa Cruz' }, { name: 'Santa Fe' }, { name: 'Santa Maria' }, { name: 'Santa Monica' }, { name: 'Santa Rosa' }, { name: 'Santee' }, { name: 'Sarasota' }, { name: 'Savannah' }, { name: 'Sayreville' }, { name: 'Schaumburg' }, { name: 'Schenectady' }, { name: 'Scottsdale' }, { name: 'Scranton' }, { name: 'Seattle' }, { name: 'Shakopee' }, { name: 'Shawnee' }, { name: 'Sheboygan' }, { name: 'Shelton' }, { name: 'Sherman' }, { name: 'Shoreline' }, { name: 'Shreveport' }, { name: 'Sierra Vista' }, { name: 'Simi Valley' }, { name: 'Sioux City' }, { name: 'Sioux Falls' }, { name: 'Skokie' }, { name: 'Smyrna' }, { name: 'Smyrna' }, { name: 'Somerville' }, { name: 'South Bend' }, { name: 'South Gate' }, { name: 'South Jordan' }, { name: 'South San Francisco' }, { name: 'Southaven' }, { name: 'Southfield' }, { name: 'Spanish Fork' }, { name: 'Sparks' }, { name: 'Spartanburg' }, { name: 'Spokane' }, { name: 'Spokane Valley' }, { name: 'Springdale' }, { name: 'Springfield' }, { name: 'Springfield' }, { name: 'Springfield' }, { name: 'Springfield' }, { name: 'Springfield' }, { name: 'St. Charles' }, { name: 'St. Clair Shores' }, { name: 'St. Cloud' }, { name: 'St. Cloud' }, { name: 'St. George' }, { name: 'St. Joseph' }, { name: 'St. Louis' }, { name: 'St. Louis Park' }, { name: 'St. Paul' }, { name: 'St. Peters' }, { name: 'St. Petersburg' }, { name: 'Stamford' }, { name: 'Stanton' }, { name: 'State College' }, { name: 'Sterling Heights' }, { name: 'Stillwater' }, { name: 'Stockton' }, { name: 'Streamwood' }, { name: 'Strongsville' }, { name: 'Suffolk' }, { name: 'Sugar Land' }, { name: 'Summerville' }, { name: 'Sumter' }, { name: 'Sunnyvale' }, { name: 'Sunrise' }, { name: 'Surprise' }, { name: 'Syracuse' }, { name: 'Tacoma' }, { name: 'Tallahassee' }, { name: 'Tamarac' }, { name: 'Tampa' }, { name: 'Taunton' }, { name: 'Taylor' }, { name: 'Taylorsville' }, { name: 'Temecula' }, { name: 'Tempe' }, { name: 'Temple' }, { name: 'Terre Haute' }, { name: 'Texarkana' }, { name: 'Texas City' }, { name: 'The Colony' }, { name: 'Thornton' }, { name: 'Thousand Oaks' }, { name: 'Tigard' }, { name: 'Tinley Park' }, { name: 'Titusville' }, { name: 'Toledo' }, { name: 'Topeka' }, { name: 'Torrance' }, { name: 'Tracy' }, { name: 'Trenton' }, { name: 'Troy' }, { name: 'Troy' }, { name: 'Tucson' }, { name: 'Tulare' }, { name: 'Tulsa' }, { name: 'Turlock' }, { name: 'Tuscaloosa' }, { name: 'Tustin' }, { name: 'Twin Falls' }, { name: 'Tyler' }, { name: 'Union City' }, { name: 'Union City' }, { name: 'Upland' }, { name: 'Urbana' }, { name: 'Urbandale' }, { name: 'Utica' }, { name: 'Vacaville' }, { name: 'Valdosta' }, { name: 'Vallejo' }, { name: 'Valley Stream' }, { name: 'Vancouver' }, { name: 'Victoria' }, { name: 'Victorville' }, { name: 'Vineland' }, { name: 'Virginia Beach' }, { name: 'Visalia' }, { name: 'Vista' }, { name: 'Waco' }, { name: 'Walnut Creek' }, { name: 'Waltham' }, { name: 'Warner Robins' }, { name: 'Warren' }, { name: 'Warren' }, { name: 'Warwick' }, { name: 'Washington' }, { name: 'Waterbury' }, { name: 'Waterloo' }, { name: 'Watsonville' }, { name: 'Waukegan' }, { name: 'Waukesha' }, { name: 'Wausau' }, { name: 'Wauwatosa' }, { name: 'Wellington' }, { name: 'Weslaco' }, { name: 'West Allis' }, { name: 'West Covina' }, { name: 'West Des Moines' }, { name: 'West Haven' }, { name: 'West Jordan' }, { name: 'West New York' }, { name: 'West Palm Beach' }, { name: 'West Sacramento' }, { name: 'West Valley City' }, { name: 'Westerville' }, { name: 'Westfield' }, { name: 'Westland' }, { name: 'Westminster' }, { name: 'Westminster' }, { name: 'Weston' }, { name: 'Weymouth Town' }, { name: 'Wheaton' }, { name: 'Wheeling' }, { name: 'White Plains' }, { name: 'Whittier' }, { name: 'Wichita' }, { name: 'Wichita Falls' }, { name: 'Wilkes-Barre' }, { name: 'Wilmington' }, { name: 'Wilmington' }, { name: 'Wilson' }, { name: 'Winston-Salem' }, { name: 'Winter Garden' }, { name: 'Woburn' }, { name: 'Woodbury' }, { name: 'Woodland' }, { name: 'Woonsocket' }, { name: 'Worcester' }, { name: 'Wylie' }, { name: 'Wyoming' }, { name: 'Yakima' }, { name: 'Yonkers' }, { name: 'Yorba Linda' }, { name: 'York' }, { name: 'Youngstown' }, { name: 'Yuba City' }, { name: 'Yucaipa' }, { name: 'Yuma' }];

},{}],11:[function(require,module,exports){
'use strict';

module.exports = [{ github: 'jedwatson', name: 'Jed Watson' }, { github: 'bruderstein', name: 'Dave Brotherstone' }, { github: 'jossmac', name: 'Joss Mackison' }, { github: 'jniechcial', name: 'Jakub Niechciał' }, { github: 'craigdallimore', name: 'Craig Dallimore' }, { github: 'julen', name: 'Julen Ruiz Aizpuru' }, { github: 'dcousens', name: 'Daniel Cousens' }, { github: 'jgautsch', name: 'Jon Gautsch' }, { github: 'dmitry-smirnov', name: 'Dmitry Smirnov' }];

},{}],12:[function(require,module,exports){
'use strict';

exports.AU = [{ value: 'australian-capital-territory', label: 'Australian Capital Territory', className: 'State-ACT' }, { value: 'new-south-wales', label: 'New South Wales', className: 'State-NSW' }, { value: 'victoria', label: 'Victoria', className: 'State-Vic' }, { value: 'queensland', label: 'Queensland', className: 'State-Qld' }, { value: 'western-australia', label: 'Western Australia', className: 'State-WA' }, { value: 'south-australia', label: 'South Australia', className: 'State-SA' }, { value: 'tasmania', label: 'Tasmania', className: 'State-Tas' }, { value: 'northern-territory', label: 'Northern Territory', className: 'State-NT' }];

exports.US = [{ value: 'AL', label: 'Alabama', disabled: true }, { value: 'AK', label: 'Alaska' }, { value: 'AS', label: 'American Samoa' }, { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' }, { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'DC', label: 'District Of Columbia' }, { value: 'FM', label: 'Federated States Of Micronesia' }, { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'GU', label: 'Guam' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MH', label: 'Marshall Islands' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'MP', label: 'Northern Mariana Islands' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' }, { value: 'PW', label: 'Palau' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'PR', label: 'Puerto Rico' }, { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' }, { value: 'VI', label: 'Virgin Islands' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }];

},{}],13:[function(require,module,exports){
'use strict';

module.exports = [{ value: 'John Smith', label: 'John Smith', email: 'john@smith.com' }, { value: 'Merry Jane', label: 'Merry Jane', email: 'merry@jane.com' }, { value: 'Stan Hoper', label: 'Stan Hoper', email: 'stan@hoper.com' }];

},{}],14:[function(require,module,exports){
var charenc = {
  // UTF-8 encoding
  utf8: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
    }
  },

  // Binary encoding
  bin: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      for (var bytes = [], i = 0; i < str.length; i++)
        bytes.push(str.charCodeAt(i) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      for (var str = [], i = 0; i < bytes.length; i++)
        str.push(String.fromCharCode(bytes[i]));
      return str.join('');
    }
  }
};

module.exports = charenc;

},{}],15:[function(require,module,exports){
(function() {
  var base64map
      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  crypt = {
    // Bit-wise rotation left
    rotl: function(n, b) {
      return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotation right
    rotr: function(n, b) {
      return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function(n) {
      // If number given, swap endian
      if (n.constructor == Number) {
        return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
      }

      // Else, assume array and swap all items
      for (var i = 0; i < n.length; i++)
        n[i] = crypt.endian(n[i]);
      return n;
    },

    // Generate an array of any length of random bytes
    randomBytes: function(n) {
      for (var bytes = []; n > 0; n--)
        bytes.push(Math.floor(Math.random() * 256));
      return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function(bytes) {
      for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
      return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function(words) {
      for (var bytes = [], b = 0; b < words.length * 32; b += 8)
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function(bytes) {
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join('');
    },

    // Convert a hex string to a byte array
    hexToBytes: function(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function(bytes) {
      for (var base64 = [], i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        for (var j = 0; j < 4; j++)
          if (i * 8 + j * 6 <= bytes.length * 8)
            base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
          else
            base64.push('=');
      }
      return base64.join('');
    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function(base64) {
      // Remove non-base-64 characters
      base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

      for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
          imod4 = ++i % 4) {
        if (imod4 == 0) continue;
        bytes.push(((base64map.indexOf(base64.charAt(i - 1))
            & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
            | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
      }
      return bytes;
    }
  };

  module.exports = crypt;
})();

},{}],16:[function(require,module,exports){
'use strict';
module.exports = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
},{}],17:[function(require,module,exports){
'use strict';

var canUseDOM = require('./inDOM');

var size;

module.exports = function (recalc) {
  if (!size || recalc) {
    if (canUseDOM) {
      var scrollDiv = document.createElement('div');

      scrollDiv.style.position = 'absolute';
      scrollDiv.style.top = '-9999px';
      scrollDiv.style.width = '50px';
      scrollDiv.style.height = '50px';
      scrollDiv.style.overflow = 'scroll';

      document.body.appendChild(scrollDiv);
      size = scrollDiv.offsetWidth - scrollDiv.clientWidth;
      document.body.removeChild(scrollDiv);
    }
  }

  return size;
};
},{"./inDOM":16}],18:[function(require,module,exports){
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks
 * 
 */

/*eslint-disable no-self-compare */

'use strict';

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function is(x, y) {
  // SameValue algorithm
  if (x === y) {
    // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    return x !== 0 || 1 / x === 1 / y;
  } else {
    // Step 6.a: NaN == NaN
    return x !== x && y !== y;
  }
}

/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * Returns true when the values of all keys are strictly equal.
 */
function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  var keysA = Object.keys(objA);
  var keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (var i = 0; i < keysA.length; i++) {
    if (!hasOwnProperty.call(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
      return false;
    }
  }

  return true;
}

module.exports = shallowEqual;
},{}],19:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],20:[function(require,module,exports){
module.exports = function() {
  var mediaQuery;
  if (typeof window !== "undefined" && window !== null) {
    mediaQuery = "(-webkit-min-device-pixel-ratio: 1.25), (min--moz-device-pixel-ratio: 1.25), (-o-min-device-pixel-ratio: 5/4), (min-resolution: 1.25dppx)";
    if (window.devicePixelRatio > 1.25) {
      return true;
    }
    if (window.matchMedia && window.matchMedia(mediaQuery).matches) {
      return true;
    }
  }
  return false;
};

},{}],21:[function(require,module,exports){
// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
require('whatwg-fetch');
module.exports = self.fetch.bind(self);

},{"whatwg-fetch":70}],22:[function(require,module,exports){
(function(){
  var crypt = require('crypt'),
      utf8 = require('charenc').utf8,
      isBuffer = require('is-buffer'),
      bin = require('charenc').bin,

  // The core
  md5 = function (message, options) {
    // Convert to byte array
    if (message.constructor == String)
      if (options && options.encoding === 'binary')
        message = bin.stringToBytes(message);
      else
        message = utf8.stringToBytes(message);
    else if (isBuffer(message))
      message = Array.prototype.slice.call(message, 0);
    else if (!Array.isArray(message))
      message = message.toString();
    // else, assume byte array already

    var m = crypt.bytesToWords(message),
        l = message.length * 8,
        a =  1732584193,
        b = -271733879,
        c = -1732584194,
        d =  271733878;

    // Swap endian
    for (var i = 0; i < m.length; i++) {
      m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
             ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
    }

    // Padding
    m[l >>> 5] |= 0x80 << (l % 32);
    m[(((l + 64) >>> 9) << 4) + 14] = l;

    // Method shortcuts
    var FF = md5._ff,
        GG = md5._gg,
        HH = md5._hh,
        II = md5._ii;

    for (var i = 0; i < m.length; i += 16) {

      var aa = a,
          bb = b,
          cc = c,
          dd = d;

      a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
      d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
      c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
      b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
      a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
      d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
      c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
      b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
      a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
      d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
      c = FF(c, d, a, b, m[i+10], 17, -42063);
      b = FF(b, c, d, a, m[i+11], 22, -1990404162);
      a = FF(a, b, c, d, m[i+12],  7,  1804603682);
      d = FF(d, a, b, c, m[i+13], 12, -40341101);
      c = FF(c, d, a, b, m[i+14], 17, -1502002290);
      b = FF(b, c, d, a, m[i+15], 22,  1236535329);

      a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
      d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
      c = GG(c, d, a, b, m[i+11], 14,  643717713);
      b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
      a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
      d = GG(d, a, b, c, m[i+10],  9,  38016083);
      c = GG(c, d, a, b, m[i+15], 14, -660478335);
      b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
      a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
      d = GG(d, a, b, c, m[i+14],  9, -1019803690);
      c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
      b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
      a = GG(a, b, c, d, m[i+13],  5, -1444681467);
      d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
      c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
      b = GG(b, c, d, a, m[i+12], 20, -1926607734);

      a = HH(a, b, c, d, m[i+ 5],  4, -378558);
      d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
      c = HH(c, d, a, b, m[i+11], 16,  1839030562);
      b = HH(b, c, d, a, m[i+14], 23, -35309556);
      a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
      d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
      c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
      b = HH(b, c, d, a, m[i+10], 23, -1094730640);
      a = HH(a, b, c, d, m[i+13],  4,  681279174);
      d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
      c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
      b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
      a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
      d = HH(d, a, b, c, m[i+12], 11, -421815835);
      c = HH(c, d, a, b, m[i+15], 16,  530742520);
      b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

      a = II(a, b, c, d, m[i+ 0],  6, -198630844);
      d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
      c = II(c, d, a, b, m[i+14], 15, -1416354905);
      b = II(b, c, d, a, m[i+ 5], 21, -57434055);
      a = II(a, b, c, d, m[i+12],  6,  1700485571);
      d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
      c = II(c, d, a, b, m[i+10], 15, -1051523);
      b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
      a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
      d = II(d, a, b, c, m[i+15], 10, -30611744);
      c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
      b = II(b, c, d, a, m[i+13], 21,  1309151649);
      a = II(a, b, c, d, m[i+ 4],  6, -145523070);
      d = II(d, a, b, c, m[i+11], 10, -1120210379);
      c = II(c, d, a, b, m[i+ 2], 15,  718787259);
      b = II(b, c, d, a, m[i+ 9], 21, -343485551);

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return crypt.endian([a, b, c, d]);
  };

  // Auxiliary functions
  md5._ff  = function (a, b, c, d, x, s, t) {
    var n = a + (b & c | ~b & d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._gg  = function (a, b, c, d, x, s, t) {
    var n = a + (b & d | c & ~d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._hh  = function (a, b, c, d, x, s, t) {
    var n = a + (b ^ c ^ d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._ii  = function (a, b, c, d, x, s, t) {
    var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };

  // Package private blocksize
  md5._blocksize = 16;
  md5._digestsize = 16;

  module.exports = function (message, options) {
    if(typeof message == 'undefined')
      return;

    var digestbytes = crypt.wordsToBytes(md5(message, options));
    return options && options.asBytes ? digestbytes :
        options && options.asString ? bin.bytesToString(digestbytes) :
        crypt.bytesToHex(digestbytes);
  };

})();

},{"charenc":14,"crypt":15,"is-buffer":19}],23:[function(require,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (e) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],24:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.7.1
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

}).call(this,require('_process'))
},{"_process":25}],25:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],26:[function(require,module,exports){
'use strict';
var strictUriEncode = require('strict-uri-encode');
var objectAssign = require('object-assign');

function encode(value, opts) {
	if (opts.encode) {
		return opts.strict ? strictUriEncode(value) : encodeURIComponent(value);
	}

	return value;
}

exports.extract = function (str) {
	return str.split('?')[1] || '';
};

exports.parse = function (str) {
	// Create an object with no prototype
	// https://github.com/sindresorhus/query-string/issues/47
	var ret = Object.create(null);

	if (typeof str !== 'string') {
		return ret;
	}

	str = str.trim().replace(/^(\?|#|&)/, '');

	if (!str) {
		return ret;
	}

	str.split('&').forEach(function (param) {
		var parts = param.replace(/\+/g, ' ').split('=');
		// Firefox (pre 40) decodes `%3D` to `=`
		// https://github.com/sindresorhus/query-string/pull/37
		var key = parts.shift();
		var val = parts.length > 0 ? parts.join('=') : undefined;

		key = decodeURIComponent(key);

		// missing `=` should be `null`:
		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
		val = val === undefined ? null : decodeURIComponent(val);

		if (ret[key] === undefined) {
			ret[key] = val;
		} else if (Array.isArray(ret[key])) {
			ret[key].push(val);
		} else {
			ret[key] = [ret[key], val];
		}
	});

	return ret;
};

exports.stringify = function (obj, opts) {
	var defaults = {
		encode: true,
		strict: true
	};

	opts = objectAssign(defaults, opts);

	return obj ? Object.keys(obj).sort().map(function (key) {
		var val = obj[key];

		if (val === undefined) {
			return '';
		}

		if (val === null) {
			return encode(key, opts);
		}

		if (Array.isArray(val)) {
			var result = [];

			val.slice().forEach(function (val2) {
				if (val2 === undefined) {
					return;
				}

				if (val2 === null) {
					result.push(encode(key, opts));
				} else {
					result.push(encode(key, opts) + '=' + encode(val2, opts));
				}
			});

			return result.join('&');
		}

		return encode(key, opts) + '=' + encode(val, opts);
	}).filter(function (x) {
		return x.length > 0;
	}).join('&') : '';
};

},{"object-assign":23,"strict-uri-encode":69}],27:[function(require,module,exports){
(function (global){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function() {
  root.requestAnimationFrame = raf
  root.cancelAnimationFrame = caf
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":24}],28:[function(require,module,exports){
module.exports = require('react/lib/shallowCompare');
},{"react/lib/shallowCompare":68}],29:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _md = require('md5');

var _md2 = _interopRequireDefault(_md);

var _queryString = require('query-string');

var _queryString2 = _interopRequireDefault(_queryString);

var _isRetina = require('is-retina');

var _isRetina2 = _interopRequireDefault(_isRetina);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Gravatar = function (_React$Component) {
  _inherits(Gravatar, _React$Component);

  function Gravatar() {
    _classCallCheck(this, Gravatar);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Gravatar).apply(this, arguments));
  }

  _createClass(Gravatar, [{
    key: 'render',
    value: function render() {
      var base = void 0;
      if (this.props.https) {
        base = 'https://secure.gravatar.com/avatar/';
      } else {
        base = 'http://www.gravatar.com/avatar/';
      }

      var query = _queryString2.default.stringify({
        s: this.props.size,
        r: this.props.rating,
        d: this.props.default
      });

      var retinaQuery = _queryString2.default.stringify({
        s: this.props.size * 2,
        r: this.props.rating,
        d: this.props.default
      });

      var hash = void 0;
      if (this.props.md5) {
        hash = this.props.md5;
      } else if (this.props.email) {
        hash = (0, _md2.default)(this.props.email);
      } else {
        console.warn('Gravatar image can not be fetched. Either the "email" or "md5" prop must be specified.');
        return _react2.default.createElement('script', null);
      }

      var src = '' + base + hash + '?' + query;
      var retinaSrc = '' + base + hash + '?' + retinaQuery;

      var modernBrowser = true; // server-side, we render for modern browsers

      if (typeof window !== 'undefined') {
        // this is not NodeJS
        modernBrowser = 'srcset' in document.createElement('img');
      }

      var className = 'react-gravatar';
      if (this.props.className) {
        className = className + ' ' + this.props.className;
      }

      // Clone this.props and then delete Component specific props so we can
      // spread the rest into the img.

      var rest = _objectWithoutProperties(this.props, []);

      delete rest.https;
      delete rest.md5;
      delete rest.email;
      delete rest.rating;
      delete rest.size;
      delete rest.style;
      delete rest.className;
      delete rest.default;
      if (!modernBrowser && (0, _isRetina2.default)()) {
        return _react2.default.createElement('img', _extends({
          alt: 'Gravatar for ' + this.props.email,
          style: this.props.style,
          src: retinaSrc,
          height: this.props.size,
          width: this.props.size
        }, rest, {
          className: className
        }));
      }
      return _react2.default.createElement('img', _extends({
        alt: 'Gravatar for ' + this.props.email,
        style: this.props.style,
        src: src,
        srcSet: retinaSrc + ' 2x',
        height: this.props.size,
        width: this.props.size
      }, rest, {
        className: className
      }));
    }
  }]);

  return Gravatar;
}(_react2.default.Component);

Gravatar.displayName = 'Gravatar';
Gravatar.propTypes = {
  email: _react2.default.PropTypes.string,
  md5: _react2.default.PropTypes.string,
  size: _react2.default.PropTypes.number,
  rating: _react2.default.PropTypes.string,
  https: _react2.default.PropTypes.bool,
  default: _react2.default.PropTypes.string,
  className: _react2.default.PropTypes.string,
  style: _react2.default.PropTypes.object
};
Gravatar.defaultProps = {
  size: 50,
  rating: 'g',
  https: false,
  default: 'retro'
};


module.exports = Gravatar;
},{"is-retina":20,"md5":22,"query-string":26,"react":undefined}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var _reactVirtualized = require('react-virtualized');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var VirtualizedSelect = function (_Component) {
  _inherits(VirtualizedSelect, _Component);

  function VirtualizedSelect(props, context) {
    _classCallCheck(this, VirtualizedSelect);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(VirtualizedSelect).call(this, props, context));

    _this._renderMenu = _this._renderMenu.bind(_this);
    _this._optionRenderer = _this._optionRenderer.bind(_this);
    return _this;
  }

  _createClass(VirtualizedSelect, [{
    key: 'render',
    value: function render() {
      return _react2.default.createElement(_reactSelect2.default, _extends({}, this.props, {
        menuRenderer: this._renderMenu,
        menuStyle: { overflow: 'hidden' }
      }));
    }

    // See https://github.com/JedWatson/react-select/#effeciently-rendering-large-lists-with-windowing

  }, {
    key: '_renderMenu',
    value: function _renderMenu(_ref) {
      var focusedOption = _ref.focusedOption;
      var focusOption = _ref.focusOption;
      var labelKey = _ref.labelKey;
      var options = _ref.options;
      var selectValue = _ref.selectValue;
      var valueArray = _ref.valueArray;
      var _props = this.props;
      var maxHeight = _props.maxHeight;
      var optionHeight = _props.optionHeight;
      var optionRenderer = _props.optionRenderer;

      var focusedOptionIndex = options.indexOf(focusedOption);
      var height = Math.min(maxHeight, options.length * optionHeight);
      var innerRowRenderer = optionRenderer || this._optionRenderer;

      function wrappedRowRenderer(index) {
        var option = options[index];

        return innerRowRenderer({ focusedOption: focusedOption, focusedOptionIndex: focusedOptionIndex, focusOption: focusOption, labelKey: labelKey, option: option, options: options, selectValue: selectValue, valueArray: valueArray });
      }

      return _react2.default.createElement(
        _reactVirtualized.AutoSizer,
        { disableHeight: true },
        function (_ref2) {
          var width = _ref2.width;
          return _react2.default.createElement(_reactVirtualized.VirtualScroll, {
            className: 'VirtualSelectGrid',
            height: height,
            rowHeight: optionHeight,
            rowRenderer: wrappedRowRenderer,
            rowsCount: options.length,
            scrollToIndex: focusedOptionIndex,
            width: width
          });
        }
      );
    }
  }, {
    key: '_optionRenderer',
    value: function _optionRenderer(_ref3) {
      var focusedOption = _ref3.focusedOption;
      var focusOption = _ref3.focusOption;
      var labelKey = _ref3.labelKey;
      var option = _ref3.option;
      var selectValue = _ref3.selectValue;
      var optionHeight = this.props.optionHeight;


      var className = option === focusedOption ? 'VirtualizedSelectOption VirtualizedSelectFocusedOption' : 'VirtualizedSelectOption';

      return _react2.default.createElement(
        'div',
        {
          className: className,
          onClick: function onClick() {
            return selectValue(option);
          },
          onMouseOver: function onMouseOver() {
            return focusOption(option);
          },
          style: {
            height: optionHeight
          }
        },
        option[labelKey]
      );
    }
  }]);

  return VirtualizedSelect;
}(_react.Component);

VirtualizedSelect.propTypes = {
  maxHeight: _react.PropTypes.number.isRequired,
  optionHeight: _react.PropTypes.number.isRequired,
  optionRenderer: _react.PropTypes.func
};
VirtualizedSelect.defaultProps = {
  maxHeight: 200,
  optionHeight: 35
};
exports.default = VirtualizedSelect;
},{"react":undefined,"react-select":undefined,"react-virtualized":63}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _VirtualizedSelect = require('./VirtualizedSelect');

var _VirtualizedSelect2 = _interopRequireDefault(_VirtualizedSelect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _VirtualizedSelect2.default;
},{"./VirtualizedSelect":30}],32:[function(require,module,exports){
arguments[4][31][0].apply(exports,arguments)
},{"./VirtualizedSelect":31,"dup":31}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This HOC decorates a virtualized component and responds to arrow-key events by scrolling one row or column at a time.
 */

var ArrowKeyStepper = function (_Component) {
  _inherits(ArrowKeyStepper, _Component);

  function ArrowKeyStepper(props, context) {
    _classCallCheck(this, ArrowKeyStepper);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ArrowKeyStepper).call(this, props, context));

    _this.state = {
      scrollToColumn: 0,
      scrollToRow: 0
    };

    _this._columnStartIndex = 0;
    _this._columnStopIndex = 0;
    _this._rowStartIndex = 0;
    _this._rowStopIndex = 0;

    _this._onKeyDown = _this._onKeyDown.bind(_this);
    _this._onSectionRendered = _this._onSectionRendered.bind(_this);
    return _this;
  }

  _createClass(ArrowKeyStepper, [{
    key: 'render',
    value: function render() {
      var _props = this.props;
      var className = _props.className;
      var children = _props.children;
      var _state = this.state;
      var scrollToColumn = _state.scrollToColumn;
      var scrollToRow = _state.scrollToRow;


      return _react2.default.createElement(
        'div',
        {
          className: className,
          onKeyDown: this._onKeyDown
        },
        children({
          onSectionRendered: this._onSectionRendered,
          scrollToColumn: scrollToColumn,
          scrollToRow: scrollToRow
        })
      );
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_onKeyDown',
    value: function _onKeyDown(event) {
      var _props2 = this.props;
      var columnsCount = _props2.columnsCount;
      var rowsCount = _props2.rowsCount;

      // The above cases all prevent default event event behavior.
      // This is to keep the grid from scrolling after the snap-to update.

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.setState({
            scrollToRow: Math.min(this._rowStopIndex + 1, rowsCount - 1)
          });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.setState({
            scrollToColumn: Math.max(this._columnStartIndex - 1, 0)
          });
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.setState({
            scrollToColumn: Math.min(this._columnStopIndex + 1, columnsCount - 1)
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.setState({
            scrollToRow: Math.max(this._rowStartIndex - 1, 0)
          });
          break;
      }
    }
  }, {
    key: '_onSectionRendered',
    value: function _onSectionRendered(_ref) {
      var columnStartIndex = _ref.columnStartIndex;
      var columnStopIndex = _ref.columnStopIndex;
      var rowStartIndex = _ref.rowStartIndex;
      var rowStopIndex = _ref.rowStopIndex;

      this._columnStartIndex = columnStartIndex;
      this._columnStopIndex = columnStopIndex;
      this._rowStartIndex = rowStartIndex;
      this._rowStopIndex = rowStopIndex;
    }
  }]);

  return ArrowKeyStepper;
}(_react.Component);

ArrowKeyStepper.propTypes = {
  children: _react.PropTypes.func.isRequired,
  className: _react.PropTypes.string,
  columnsCount: _react.PropTypes.number.isRequired,
  rowsCount: _react.PropTypes.number.isRequired
};
exports.default = ArrowKeyStepper;
},{"react":undefined,"react-addons-shallow-compare":28}],34:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ArrowKeyStepper = exports.default = undefined;

var _ArrowKeyStepper2 = require('./ArrowKeyStepper');

var _ArrowKeyStepper3 = _interopRequireDefault(_ArrowKeyStepper2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _ArrowKeyStepper3.default;
exports.ArrowKeyStepper = _ArrowKeyStepper3.default;
},{"./ArrowKeyStepper":33}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Decorator component that automatically adjusts the width and height of a single child.
 * Child component should not be declared as a child but should rather be specified by a `ChildComponent` property.
 * All other properties will be passed through to the child component.
 */

var AutoSizer = function (_Component) {
  _inherits(AutoSizer, _Component);

  function AutoSizer(props) {
    _classCallCheck(this, AutoSizer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AutoSizer).call(this, props));

    _this.state = {
      height: 0,
      width: 0
    };

    _this._onResize = _this._onResize.bind(_this);
    _this._onScroll = _this._onScroll.bind(_this);
    _this._setRef = _this._setRef.bind(_this);
    return _this;
  }

  _createClass(AutoSizer, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      // Defer requiring resize handler in order to support server-side rendering.
      // See issue #41
      this._detectElementResize = require('../vendor/detectElementResize');
      this._detectElementResize.addResizeListener(this._parentNode, this._onResize);

      this._onResize();
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      if (this._detectElementResize) {
        this._detectElementResize.removeResizeListener(this._parentNode, this._onResize);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props;
      var children = _props.children;
      var disableHeight = _props.disableHeight;
      var disableWidth = _props.disableWidth;
      var _state = this.state;
      var height = _state.height;
      var width = _state.width;

      // Outer div should not force width/height since that may prevent containers from shrinking.
      // Inner component should overflow and use calculated width/height.
      // See issue #68 for more information.

      var outerStyle = { overflow: 'visible' };

      if (!disableHeight) {
        outerStyle.height = 0;
      }

      if (!disableWidth) {
        outerStyle.width = 0;
      }

      return _react2.default.createElement(
        'div',
        {
          ref: this._setRef,
          onScroll: this._onScroll,
          style: outerStyle
        },
        children({ height: height, width: width })
      );
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_onResize',
    value: function _onResize() {
      var onResize = this.props.onResize;

      // Gaurd against AutoSizer component being removed from the DOM immediately after being added.
      // This can result in invalid style values which can result in NaN values if we don't handle them.
      // See issue #150 for more context.

      var boundingRect = this._parentNode.getBoundingClientRect();
      var height = boundingRect.height || 0;
      var width = boundingRect.width || 0;

      var style = getComputedStyle(this._parentNode);
      var paddingLeft = parseInt(style.paddingLeft, 10) || 0;
      var paddingRight = parseInt(style.paddingRight, 10) || 0;
      var paddingTop = parseInt(style.paddingTop, 10) || 0;
      var paddingBottom = parseInt(style.paddingBottom, 10) || 0;

      this.setState({
        height: height - paddingTop - paddingBottom,
        width: width - paddingLeft - paddingRight
      });

      onResize({ height: height, width: width });
    }
  }, {
    key: '_onScroll',
    value: function _onScroll(event) {
      // Prevent detectElementResize library from being triggered by this scroll event.
      event.stopPropagation();
    }
  }, {
    key: '_setRef',
    value: function _setRef(autoSizer) {
      // In case the component has been unmounted
      this._parentNode = autoSizer && autoSizer.parentNode;
    }
  }]);

  return AutoSizer;
}(_react.Component);

AutoSizer.propTypes = {
  /**
   * Function respondible for rendering children.
   * This function should implement the following signature:
   * ({ height, width }) => PropTypes.element
   */
  children: _react.PropTypes.func.isRequired,

  /** Disable dynamic :height property */
  disableHeight: _react.PropTypes.bool,

  /** Disable dynamic :width property */
  disableWidth: _react.PropTypes.bool,

  /** Callback to be invoked on-resize: ({ height, width }) */
  onResize: _react.PropTypes.func.isRequired
};
AutoSizer.defaultProps = {
  onResize: function onResize() {}
};
exports.default = AutoSizer;
},{"../vendor/detectElementResize":67,"react":undefined,"react-addons-shallow-compare":28}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AutoSizer = exports.default = undefined;

var _AutoSizer2 = require('./AutoSizer');

var _AutoSizer3 = _interopRequireDefault(_AutoSizer2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _AutoSizer3.default;
exports.AutoSizer = _AutoSizer3.default;
},{"./AutoSizer":35}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _CollectionView = require('./CollectionView');

var _CollectionView2 = _interopRequireDefault(_CollectionView);

var _calculateSizeAndPositionData2 = require('./utils/calculateSizeAndPositionData');

var _calculateSizeAndPositionData3 = _interopRequireDefault(_calculateSizeAndPositionData2);

var _getUpdatedOffsetForIndex = require('../utils/getUpdatedOffsetForIndex');

var _getUpdatedOffsetForIndex2 = _interopRequireDefault(_getUpdatedOffsetForIndex);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Renders scattered or non-linear data.
 * Unlike Grid, which renders checkerboard data, Collection can render arbitrarily positioned- even overlapping- data.
 */

var Collection = function (_Component) {
  _inherits(Collection, _Component);

  function Collection(props, context) {
    _classCallCheck(this, Collection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Collection).call(this, props, context));

    _this._cellMetadata = [];
    _this._lastRenderedCellIndices = [];
    return _this;
  }

  /** React lifecycle methods */

  _createClass(Collection, [{
    key: 'render',
    value: function render() {
      var props = _objectWithoutProperties(this.props, []);

      return _react2.default.createElement(_CollectionView2.default, _extends({
        cellLayoutManager: this,
        ref: 'CollectionView'
      }, props));
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }

    /** CellLayoutManager interface */

  }, {
    key: 'calculateSizeAndPositionData',
    value: function calculateSizeAndPositionData() {
      var _props = this.props;
      var cellCount = _props.cellCount;
      var cellSizeAndPositionGetter = _props.cellSizeAndPositionGetter;
      var sectionSize = _props.sectionSize;


      var data = (0, _calculateSizeAndPositionData3.default)({
        cellCount: cellCount,
        cellSizeAndPositionGetter: cellSizeAndPositionGetter,
        sectionSize: sectionSize
      });

      this._cellMetadata = data.cellMetadata;
      this._sectionManager = data.sectionManager;
      this._height = data.height;
      this._width = data.width;
    }

    /**
     * Returns the most recently rendered set of cell indices.
     */

  }, {
    key: 'getLastRenderedIndices',
    value: function getLastRenderedIndices() {
      return this._lastRenderedCellIndices;
    }

    /**
     * Calculates the minimum amount of change from the current scroll position to ensure the specified cell is (fully) visible.
     */

  }, {
    key: 'getScrollPositionForCell',
    value: function getScrollPositionForCell(_ref) {
      var cellIndex = _ref.cellIndex;
      var height = _ref.height;
      var scrollLeft = _ref.scrollLeft;
      var scrollTop = _ref.scrollTop;
      var width = _ref.width;
      var cellCount = this.props.cellCount;


      if (cellIndex >= 0 && cellIndex < cellCount) {
        var cellMetadata = this._cellMetadata[cellIndex];

        scrollLeft = (0, _getUpdatedOffsetForIndex2.default)({
          cellOffset: cellMetadata.x,
          cellSize: cellMetadata.width,
          containerSize: width,
          currentOffset: scrollLeft,
          targetIndex: cellIndex
        });

        scrollTop = (0, _getUpdatedOffsetForIndex2.default)({
          cellOffset: cellMetadata.y,
          cellSize: cellMetadata.height,
          containerSize: height,
          currentOffset: scrollTop,
          targetIndex: cellIndex
        });
      }

      return {
        scrollLeft: scrollLeft,
        scrollTop: scrollTop
      };
    }
  }, {
    key: 'getTotalSize',
    value: function getTotalSize() {
      return {
        height: this._height,
        width: this._width
      };
    }
  }, {
    key: 'renderCells',
    value: function renderCells(_ref2) {
      var _this2 = this;

      var height = _ref2.height;
      var isScrolling = _ref2.isScrolling;
      var width = _ref2.width;
      var x = _ref2.x;
      var y = _ref2.y;
      var _props2 = this.props;
      var cellGroupRenderer = _props2.cellGroupRenderer;
      var cellRenderer = _props2.cellRenderer;

      // Store for later calls to getLastRenderedIndices()

      this._lastRenderedCellIndices = this._sectionManager.getCellIndices({
        height: height,
        width: width,
        x: x,
        y: y
      });

      return cellGroupRenderer({
        cellRenderer: cellRenderer,
        cellSizeAndPositionGetter: function cellSizeAndPositionGetter(index) {
          return _this2._sectionManager.getCellMetadata(index);
        },
        indices: this._lastRenderedCellIndices
      });
    }
  }]);

  return Collection;
}(_react.Component);

Collection.propTypes = {
  'aria-label': _react.PropTypes.string,

  /**
   * Number of cells in Collection.
   */
  cellCount: _react.PropTypes.number.isRequired,

  /**
   * Responsible for rendering a group of cells given their indices.
   * Should implement the following interface: ({
   *   cellSizeAndPositionGetter:Function,
   *   indices: Array<number>,
   *   cellRenderer: Function
   * }): Array<PropTypes.node>
   */
  cellGroupRenderer: _react.PropTypes.func.isRequired,

  /**
   * Responsible for rendering a cell given an row and column index.
   * Should implement the following interface: (index: number): PropTypes.node
   */
  cellRenderer: _react.PropTypes.func.isRequired,

  /**
   * Callback responsible for returning size and offset/position information for a given cell (index).
   * (index): { height: number, width: number, x: number, y: number }
   */
  cellSizeAndPositionGetter: _react.PropTypes.func.isRequired,

  /**
   * Optionally override the size of the sections a Collection's cells are split into.
   */
  sectionSize: _react.PropTypes.number
};
Collection.defaultProps = {
  'aria-label': 'grid',
  cellGroupRenderer: defaultCellGroupRenderer
};
exports.default = Collection;


function defaultCellGroupRenderer(_ref3) {
  var cellRenderer = _ref3.cellRenderer;
  var cellSizeAndPositionGetter = _ref3.cellSizeAndPositionGetter;
  var indices = _ref3.indices;

  return indices.map(function (index) {
    var cellMetadata = cellSizeAndPositionGetter(index);
    var renderedCell = cellRenderer(index);

    if (renderedCell == null || renderedCell === false) {
      return null;
    }

    return _react2.default.createElement(
      'div',
      {
        className: 'Collection__cell',
        key: index,
        style: {
          height: cellMetadata.height,
          left: cellMetadata.x,
          top: cellMetadata.y,
          width: cellMetadata.width
        }
      },
      renderedCell
    );
  }).filter(function (renderedCell) {
    return !!renderedCell;
  });
}
},{"../utils/getUpdatedOffsetForIndex":65,"./CollectionView":38,"./utils/calculateSizeAndPositionData":42,"react":undefined,"react-addons-shallow-compare":28}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _createCallbackMemoizer = require('../utils/createCallbackMemoizer');

var _createCallbackMemoizer2 = _interopRequireDefault(_createCallbackMemoizer);

var _scrollbarSize = require('dom-helpers/util/scrollbarSize');

var _scrollbarSize2 = _interopRequireDefault(_scrollbarSize);

var _raf = require('raf');

var _raf2 = _interopRequireDefault(_raf);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// @TODO It would be nice to refactor Grid to use this code as well.

/**
 * Specifies the number of miliseconds during which to disable pointer events while a scroll is in progress.
 * This improves performance and makes scrolling smoother.
 */
var IS_SCROLLING_TIMEOUT = 150;

/**
 * Controls whether the Grid updates the DOM element's scrollLeft/scrollTop based on the current state or just observes it.
 * This prevents Grid from interrupting mouse-wheel animations (see issue #2).
 */
var SCROLL_POSITION_CHANGE_REASONS = {
  OBSERVED: 'observed',
  REQUESTED: 'requested'
};

/**
 * Monitors changes in properties (eg. cellCount) and state (eg. scroll offsets) to determine when rendering needs to occur.
 * This component does not render any visible content itself; it defers to the specified :cellLayoutManager.
 */

var CollectionView = function (_Component) {
  _inherits(CollectionView, _Component);

  function CollectionView(props, context) {
    _classCallCheck(this, CollectionView);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(CollectionView).call(this, props, context));

    _this.state = {
      calculateSizeAndPositionDataOnNextUpdate: false,
      isScrolling: false,
      scrollLeft: 0,
      scrollTop: 0
    };

    // Invokes callbacks only when their values have changed.
    _this._onSectionRenderedMemoizer = (0, _createCallbackMemoizer2.default)();
    _this._onScrollMemoizer = (0, _createCallbackMemoizer2.default)(false);

    // Bind functions to instance so they don't lose context when passed around.
    _this._invokeOnSectionRenderedHelper = _this._invokeOnSectionRenderedHelper.bind(_this);
    _this._onScroll = _this._onScroll.bind(_this);
    _this._updateScrollPositionForScrollToCell = _this._updateScrollPositionForScrollToCell.bind(_this);
    return _this;
  }

  /**
   * Forced recompute of cell sizes and positions.
   * This function should be called if cell sizes have changed but nothing else has.
   * Since cell positions are calculated by callbacks, the collection view has no way of detecting when the underlying data has changed.
   */


  _createClass(CollectionView, [{
    key: 'recomputeCellSizesAndPositions',
    value: function recomputeCellSizesAndPositions() {
      this.setState({
        calculateSizeAndPositionDataOnNextUpdate: true
      });
    }

    /* ---------------------------- Component lifecycle methods ---------------------------- */

  }, {
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _props = this.props;
      var cellLayoutManager = _props.cellLayoutManager;
      var scrollLeft = _props.scrollLeft;
      var scrollToCell = _props.scrollToCell;
      var scrollTop = _props.scrollTop;


      this._scrollbarSize = (0, _scrollbarSize2.default)();

      if (scrollToCell >= 0) {
        this._updateScrollPositionForScrollToCell();
      } else if (scrollLeft >= 0 || scrollTop >= 0) {
        this._setScrollPosition({ scrollLeft: scrollLeft, scrollTop: scrollTop });
      }

      // Update onSectionRendered callback.
      this._invokeOnSectionRenderedHelper();

      var _cellLayoutManager$ge = cellLayoutManager.getTotalSize();

      var totalHeight = _cellLayoutManager$ge.height;
      var totalWidth = _cellLayoutManager$ge.width;

      // Initialize onScroll callback.

      this._invokeOnScrollMemoizer({
        scrollLeft: scrollLeft || 0,
        scrollTop: scrollTop || 0,
        totalHeight: totalHeight,
        totalWidth: totalWidth
      });
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps, prevState) {
      var _props2 = this.props;
      var height = _props2.height;
      var scrollToCell = _props2.scrollToCell;
      var width = _props2.width;
      var _state = this.state;
      var scrollLeft = _state.scrollLeft;
      var scrollPositionChangeReason = _state.scrollPositionChangeReason;
      var scrollTop = _state.scrollTop;

      // Make sure requested changes to :scrollLeft or :scrollTop get applied.
      // Assigning to scrollLeft/scrollTop tells the browser to interrupt any running scroll animations,
      // And to discard any pending async changes to the scroll position that may have happened in the meantime (e.g. on a separate scrolling thread).
      // So we only set these when we require an adjustment of the scroll position.
      // See issue #2 for more information.

      if (scrollPositionChangeReason === SCROLL_POSITION_CHANGE_REASONS.REQUESTED) {
        if (scrollLeft >= 0 && scrollLeft !== prevState.scrollLeft && scrollLeft !== this.refs.scrollingContainer.scrollLeft) {
          this.refs.scrollingContainer.scrollLeft = scrollLeft;
        }
        if (scrollTop >= 0 && scrollTop !== prevState.scrollTop && scrollTop !== this.refs.scrollingContainer.scrollTop) {
          this.refs.scrollingContainer.scrollTop = scrollTop;
        }
      }

      // Update scroll offsets if the current :scrollToCell values requires it
      if (height !== prevProps.height || scrollToCell !== prevProps.scrollToCell || width !== prevProps.width) {
        this._updateScrollPositionForScrollToCell();
      }

      // Update onRowsRendered callback if start/stop indices have changed
      this._invokeOnSectionRenderedHelper();
    }
  }, {
    key: 'componentWillMount',
    value: function componentWillMount() {
      var cellLayoutManager = this.props.cellLayoutManager;


      cellLayoutManager.calculateSizeAndPositionData();
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      if (this._disablePointerEventsTimeoutId) {
        clearTimeout(this._disablePointerEventsTimeoutId);
      }

      if (this._setNextStateAnimationFrameId) {
        _raf2.default.cancel(this._setNextStateAnimationFrameId);
      }
    }

    /**
     * @private
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) Empty content (0 rows or columns)
     * 2) New scroll props overriding the current state
     * 3) Cells-count or cells-size has changed, making previous scroll offsets invalid
     */

  }, {
    key: 'componentWillUpdate',
    value: function componentWillUpdate(nextProps, nextState) {
      if (nextProps.cellCount === 0 && (nextState.scrollLeft !== 0 || nextState.scrollTop !== 0)) {
        this._setScrollPosition({
          scrollLeft: 0,
          scrollTop: 0
        });
      } else if (nextProps.scrollLeft !== this.props.scrollLeft || nextProps.scrollTop !== this.props.scrollTop) {
        this._setScrollPosition({
          scrollLeft: nextProps.scrollLeft,
          scrollTop: nextProps.scrollTop
        });
      }

      if (nextProps.cellCount !== this.props.cellCount || nextProps.cellLayoutManager !== this.props.cellLayoutManager || nextState.calculateSizeAndPositionDataOnNextUpdate) {
        nextProps.cellLayoutManager.calculateSizeAndPositionData();
      }

      if (nextState.calculateSizeAndPositionDataOnNextUpdate) {
        this.setState({
          calculateSizeAndPositionDataOnNextUpdate: false
        });
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props3 = this.props;
      var cellLayoutManager = _props3.cellLayoutManager;
      var className = _props3.className;
      var height = _props3.height;
      var noContentRenderer = _props3.noContentRenderer;
      var width = _props3.width;
      var _state2 = this.state;
      var isScrolling = _state2.isScrolling;
      var scrollLeft = _state2.scrollLeft;
      var scrollTop = _state2.scrollTop;


      var childrenToDisplay = height > 0 && width > 0 ? cellLayoutManager.renderCells({
        height: height,
        isScrolling: isScrolling,
        width: width,
        x: scrollLeft,
        y: scrollTop
      }) : [];

      var _cellLayoutManager$ge2 = cellLayoutManager.getTotalSize();

      var totalHeight = _cellLayoutManager$ge2.height;
      var totalWidth = _cellLayoutManager$ge2.width;


      var gridStyle = {
        height: height,
        width: width
      };

      // Force browser to hide scrollbars when we know they aren't necessary.
      // Otherwise once scrollbars appear they may not disappear again.
      // For more info see issue #116
      if (totalHeight <= height) {
        gridStyle.overflowY = 'hidden';
      }
      if (totalWidth <= width) {
        gridStyle.overflowX = 'hidden';
      }

      return _react2.default.createElement(
        'div',
        {
          ref: 'scrollingContainer',
          'aria-label': this.props['aria-label'],
          className: (0, _classnames2.default)('Collection', className),
          onScroll: this._onScroll,
          role: 'grid',
          style: gridStyle,
          tabIndex: 0
        },
        childrenToDisplay.length > 0 && _react2.default.createElement(
          'div',
          {
            className: 'Collection__innerScrollContainer',
            style: {
              height: totalHeight,
              maxHeight: totalHeight,
              maxWidth: totalWidth,
              pointerEvents: isScrolling ? 'none' : 'auto',
              width: totalWidth
            }
          },
          childrenToDisplay
        ),
        childrenToDisplay.length === 0 && noContentRenderer()
      );
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }

    /* ---------------------------- Helper methods ---------------------------- */

    /**
     * Sets an :isScrolling flag for a small window of time.
     * This flag is used to disable pointer events on the scrollable portion of the Collection.
     * This prevents jerky/stuttery mouse-wheel scrolling.
     */

  }, {
    key: '_enablePointerEventsAfterDelay',
    value: function _enablePointerEventsAfterDelay() {
      var _this2 = this;

      if (this._disablePointerEventsTimeoutId) {
        clearTimeout(this._disablePointerEventsTimeoutId);
      }

      this._disablePointerEventsTimeoutId = setTimeout(function () {
        _this2._disablePointerEventsTimeoutId = null;
        _this2.setState({
          isScrolling: false
        });
      }, IS_SCROLLING_TIMEOUT);
    }
  }, {
    key: '_invokeOnSectionRenderedHelper',
    value: function _invokeOnSectionRenderedHelper() {
      var _props4 = this.props;
      var cellLayoutManager = _props4.cellLayoutManager;
      var onSectionRendered = _props4.onSectionRendered;


      this._onSectionRenderedMemoizer({
        callback: onSectionRendered,
        indices: cellLayoutManager.getLastRenderedIndices()
      });
    }
  }, {
    key: '_invokeOnScrollMemoizer',
    value: function _invokeOnScrollMemoizer(_ref) {
      var _this3 = this;

      var scrollLeft = _ref.scrollLeft;
      var scrollTop = _ref.scrollTop;
      var totalHeight = _ref.totalHeight;
      var totalWidth = _ref.totalWidth;

      this._onScrollMemoizer({
        callback: function callback(_ref2) {
          var scrollLeft = _ref2.scrollLeft;
          var scrollTop = _ref2.scrollTop;
          var _props5 = _this3.props;
          var height = _props5.height;
          var onScroll = _props5.onScroll;
          var width = _props5.width;


          onScroll({
            clientHeight: height,
            clientWidth: width,
            scrollHeight: totalHeight,
            scrollLeft: scrollLeft,
            scrollTop: scrollTop,
            scrollWidth: totalWidth
          });
        },
        indices: {
          scrollLeft: scrollLeft,
          scrollTop: scrollTop
        }
      });
    }

    /**
     * Updates the state during the next animation frame.
     * Use this method to avoid multiple renders in a small span of time.
     * This helps performance for bursty events (like onScroll).
     */

  }, {
    key: '_setNextState',
    value: function _setNextState(state) {
      var _this4 = this;

      if (this._setNextStateAnimationFrameId) {
        _raf2.default.cancel(this._setNextStateAnimationFrameId);
      }

      this._setNextStateAnimationFrameId = (0, _raf2.default)(function () {
        _this4._setNextStateAnimationFrameId = null;
        _this4.setState(state);
      });
    }
  }, {
    key: '_setScrollPosition',
    value: function _setScrollPosition(_ref3) {
      var scrollLeft = _ref3.scrollLeft;
      var scrollTop = _ref3.scrollTop;

      var newState = {
        scrollPositionChangeReason: SCROLL_POSITION_CHANGE_REASONS.REQUESTED
      };

      if (scrollLeft >= 0) {
        newState.scrollLeft = scrollLeft;
      }

      if (scrollTop >= 0) {
        newState.scrollTop = scrollTop;
      }

      if (scrollLeft >= 0 && scrollLeft !== this.state.scrollLeft || scrollTop >= 0 && scrollTop !== this.state.scrollTop) {
        this.setState(newState);
      }
    }
  }, {
    key: '_updateScrollPositionForScrollToCell',
    value: function _updateScrollPositionForScrollToCell() {
      var _props6 = this.props;
      var cellLayoutManager = _props6.cellLayoutManager;
      var height = _props6.height;
      var scrollToCell = _props6.scrollToCell;
      var width = _props6.width;
      var _state3 = this.state;
      var scrollLeft = _state3.scrollLeft;
      var scrollTop = _state3.scrollTop;


      if (scrollToCell >= 0) {
        var scrollPosition = cellLayoutManager.getScrollPositionForCell({
          cellIndex: scrollToCell,
          height: height,
          scrollLeft: scrollLeft,
          scrollTop: scrollTop,
          width: width
        });

        if (scrollPosition.scrollLeft !== scrollLeft || scrollPosition.scrollTop !== scrollTop) {
          this._setScrollPosition(scrollPosition);
        }
      }
    }
  }, {
    key: '_onScroll',
    value: function _onScroll(event) {
      // In certain edge-cases React dispatches an onScroll event with an invalid target.scrollLeft / target.scrollTop.
      // This invalid event can be detected by comparing event.target to this component's scrollable DOM element.
      // See issue #404 for more information.
      if (event.target !== this.refs.scrollingContainer) {
        return;
      }

      // Prevent pointer events from interrupting a smooth scroll
      this._enablePointerEventsAfterDelay();

      // When this component is shrunk drastically, React dispatches a series of back-to-back scroll events,
      // Gradually converging on a scrollTop that is within the bounds of the new, smaller height.
      // This causes a series of rapid renders that is slow for long lists.
      // We can avoid that by doing some simple bounds checking to ensure that scrollTop never exceeds the total height.
      var _props7 = this.props;
      var cellLayoutManager = _props7.cellLayoutManager;
      var height = _props7.height;
      var width = _props7.width;

      var scrollbarSize = this._scrollbarSize;

      var _cellLayoutManager$ge3 = cellLayoutManager.getTotalSize();

      var totalHeight = _cellLayoutManager$ge3.height;
      var totalWidth = _cellLayoutManager$ge3.width;

      var scrollLeft = Math.min(totalWidth - width + scrollbarSize, event.target.scrollLeft);
      var scrollTop = Math.min(totalHeight - height + scrollbarSize, event.target.scrollTop);

      // Certain devices (like Apple touchpad) rapid-fire duplicate events.
      // Don't force a re-render if this is the case.
      // The mouse may move faster then the animation frame does.
      // Use requestAnimationFrame to avoid over-updating.
      if (this.state.scrollLeft !== scrollLeft || this.state.scrollTop !== scrollTop) {
        // Browsers with cancelable scroll events (eg. Firefox) interrupt scrolling animations if scrollTop/scrollLeft is set.
        // Other browsers (eg. Safari) don't scroll as well without the help under certain conditions (DOM or style changes during scrolling).
        // All things considered, this seems to be the best current work around that I'm aware of.
        // For more information see https://github.com/bvaughn/react-virtualized/pull/124
        var scrollPositionChangeReason = event.cancelable ? SCROLL_POSITION_CHANGE_REASONS.OBSERVED : SCROLL_POSITION_CHANGE_REASONS.REQUESTED;

        // Synchronously set :isScrolling the first time (since _setNextState will reschedule its animation frame each time it's called)
        if (!this.state.isScrolling) {
          this.setState({
            isScrolling: true
          });
        }

        this._setNextState({
          isScrolling: true,
          scrollLeft: scrollLeft,
          scrollPositionChangeReason: scrollPositionChangeReason,
          scrollTop: scrollTop
        });
      }

      this._invokeOnScrollMemoizer({
        scrollLeft: scrollLeft,
        scrollTop: scrollTop,
        totalWidth: totalWidth,
        totalHeight: totalHeight
      });
    }
  }]);

  return CollectionView;
}(_react.Component);

CollectionView.propTypes = {
  'aria-label': _react.PropTypes.string,

  /**
   * Number of cells in collection.
   */
  cellCount: _react.PropTypes.number.isRequired,

  /**
   * Calculates cell sizes and positions and manages rendering the appropriate cells given a specified window.
   */
  cellLayoutManager: _react.PropTypes.object.isRequired,

  /**
   * Optional custom CSS class name to attach to root Collection element.
   */
  className: _react.PropTypes.string,

  /**
   * Height of Collection; this property determines the number of visible (vs virtualized) rows.
   */
  height: _react.PropTypes.number.isRequired,

  /**
   * Optional renderer to be used in place of rows when either :rowsCount or :cellCount is 0.
   */
  noContentRenderer: _react.PropTypes.func.isRequired,

  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth }): void
   */
  onScroll: _react.PropTypes.func.isRequired,

  /**
   * Callback invoked with information about the section of the Collection that was just rendered.
   * This callback is passed an array of the most recently rendered section indices.
   */
  onSectionRendered: _react.PropTypes.func.isRequired,

  /**
   * Horizontal offset.
   */
  scrollLeft: _react.PropTypes.number,

  /**
   * Cell index to ensure visible (by forcefully scrolling if necessary).
   */
  scrollToCell: _react.PropTypes.number,

  /**
   * Vertical offset.
   */
  scrollTop: _react.PropTypes.number,

  /**
   * Width of Collection; this property determines the number of visible (vs virtualized) columns.
   */
  width: _react.PropTypes.number.isRequired
};
CollectionView.defaultProps = {
  'aria-label': 'grid',
  noContentRenderer: function noContentRenderer() {
    return null;
  },
  onScroll: function onScroll() {
    return null;
  },
  onSectionRendered: function onSectionRendered() {
    return null;
  }
};
exports.default = CollectionView;
},{"../utils/createCallbackMemoizer":64,"classnames":undefined,"dom-helpers/util/scrollbarSize":17,"raf":27,"react":undefined,"react-addons-shallow-compare":28}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * A section of the Window.
 * Window Sections are used to group nearby cells.
 * This enables us to more quickly determine which cells to display in a given region of the Window.
 * Sections have a fixed size and contain 0 to many cells (tracked by their indices).
 */

var Section = function () {
  function Section(_ref) {
    var height = _ref.height;
    var width = _ref.width;
    var x = _ref.x;
    var y = _ref.y;

    _classCallCheck(this, Section);

    this.height = height;
    this.width = width;
    this.x = x;
    this.y = y;

    this._indexMap = {};
    this._indices = [];
  }

  /** Add a cell to this section. */


  _createClass(Section, [{
    key: 'addCellIndex',
    value: function addCellIndex(index) {
      if (!this._indexMap[index]) {
        this._indexMap[index] = true;
        this._indices.push(index);
      }
    }

    /** Get all cell indices that have been added to this section. */

  }, {
    key: 'getCellIndices',
    value: function getCellIndices() {
      return this._indices;
    }

    /** Intended for debugger/test purposes only */

  }, {
    key: 'toString',
    value: function toString() {
      return this.x + ',' + this.y + ' ' + this.width + 'x' + this.height;
    }
  }]);

  return Section;
}(); /** @rlow */


exports.default = Section;
},{}],40:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Window Sections are used to group nearby cells.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * This enables us to more quickly determine which cells to display in a given region of the Window.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _Section = require('./Section');

var _Section2 = _interopRequireDefault(_Section);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SECTION_SIZE = 100;

/**
 * Contains 0 to many Sections.
 * Grows (and adds Sections) dynamically as cells are registered.
 * Automatically adds cells to the appropriate Section(s).
 */

var SectionManager = function () {
  function SectionManager() {
    var sectionSize = arguments.length <= 0 || arguments[0] === undefined ? SECTION_SIZE : arguments[0];

    _classCallCheck(this, SectionManager);

    this._sectionSize = sectionSize;

    this._cellMetadata = [];
    this._sections = {};
  }

  /**
   * Gets all cell indices contained in the specified region.
   * A region may encompass 1 or more Sections.
   */


  _createClass(SectionManager, [{
    key: 'getCellIndices',
    value: function getCellIndices(_ref) {
      var height = _ref.height;
      var width = _ref.width;
      var x = _ref.x;
      var y = _ref.y;

      var indices = {};

      this.getSections({ height: height, width: width, x: x, y: y }).forEach(function (section) {
        return section.getCellIndices().forEach(function (index) {
          return indices[index] = index;
        });
      });

      // Object keys are strings; this function returns numbers
      return Object.keys(indices).map(function (index) {
        return indices[index];
      });
    }

    /** Get size and position information for the cell specified. */

  }, {
    key: 'getCellMetadata',
    value: function getCellMetadata(index) {
      return this._cellMetadata[index];
    }

    /** Get all Sections overlapping the specified region. */

  }, {
    key: 'getSections',
    value: function getSections(_ref2) {
      var height = _ref2.height;
      var width = _ref2.width;
      var x = _ref2.x;
      var y = _ref2.y;

      var sectionXStart = Math.floor(x / this._sectionSize);
      var sectionXStop = Math.floor((x + width - 1) / this._sectionSize);
      var sectionYStart = Math.floor(y / this._sectionSize);
      var sectionYStop = Math.floor((y + height - 1) / this._sectionSize);

      var sections = [];

      for (var sectionX = sectionXStart; sectionX <= sectionXStop; sectionX++) {
        for (var sectionY = sectionYStart; sectionY <= sectionYStop; sectionY++) {
          var key = sectionX + '.' + sectionY;

          if (!this._sections[key]) {
            this._sections[key] = new _Section2.default({
              height: this._sectionSize,
              width: this._sectionSize,
              x: sectionX * this._sectionSize,
              y: sectionY * this._sectionSize
            });
          }

          sections.push(this._sections[key]);
        }
      }

      return sections;
    }

    /** Total number of Sections based on the currently registered cells. */

  }, {
    key: 'getTotalSectionCount',
    value: function getTotalSectionCount() {
      return Object.keys(this._sections).length;
    }

    /** Intended for debugger/test purposes only */

  }, {
    key: 'toString',
    value: function toString() {
      var _this = this;

      return Object.keys(this._sections).map(function (index) {
        return _this._sections[index].toString();
      });
    }

    /** Adds a cell to the appropriate Sections and registers it metadata for later retrievable. */

  }, {
    key: 'registerCell',
    value: function registerCell(_ref3) {
      var cellMetadatum = _ref3.cellMetadatum;
      var index = _ref3.index;

      this._cellMetadata[index] = cellMetadatum;

      this.getSections(cellMetadatum).forEach(function (section) {
        return section.addCellIndex(index);
      });
    }
  }]);

  return SectionManager;
}();

exports.default = SectionManager;
},{"./Section":39}],41:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Collection = exports.default = undefined;

var _Collection2 = require('./Collection');

var _Collection3 = _interopRequireDefault(_Collection2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _Collection3.default;
exports.Collection = _Collection3.default;
},{"./Collection":37}],42:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = calculateSizeAndPositionData;

var _SectionManager = require('../SectionManager');

var _SectionManager2 = _interopRequireDefault(_SectionManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function calculateSizeAndPositionData(_ref) {
  var cellCount = _ref.cellCount;
  var cellSizeAndPositionGetter = _ref.cellSizeAndPositionGetter;
  var sectionSize = _ref.sectionSize;

  var cellMetadata = [];
  var sectionManager = new _SectionManager2.default(sectionSize);
  var height = 0;
  var width = 0;

  for (var index = 0; index < cellCount; index++) {
    var cellMetadatum = cellSizeAndPositionGetter(index);

    if (cellMetadatum.height == null || isNaN(cellMetadatum.height) || cellMetadatum.width == null || isNaN(cellMetadatum.width) || cellMetadatum.x == null || isNaN(cellMetadatum.x) || cellMetadatum.y == null || isNaN(cellMetadatum.y)) {
      throw Error('Invalid metadata returned for cell ' + index + ':\n        x:' + cellMetadatum.x + ', y:' + cellMetadatum.y + ', width:' + cellMetadatum.width + ', height:' + cellMetadatum.height);
    }

    height = Math.max(height, cellMetadatum.y + cellMetadatum.height);
    width = Math.max(width, cellMetadatum.x + cellMetadatum.width);

    cellMetadata[index] = cellMetadatum;
    sectionManager.registerCell({
      cellMetadatum: cellMetadatum,
      index: index
    });
  }

  return {
    cellMetadata: cellMetadata,
    height: height,
    sectionManager: sectionManager,
    width: width
  };
}
},{"../SectionManager":40}],43:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

var _Grid = require('../Grid');

var _Grid2 = _interopRequireDefault(_Grid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * High-order component that auto-calculates column-widths for `Grid` cells.
 */

var ColumnSizer = function (_Component) {
  _inherits(ColumnSizer, _Component);

  function ColumnSizer(props, context) {
    _classCallCheck(this, ColumnSizer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ColumnSizer).call(this, props, context));

    _this._registerChild = _this._registerChild.bind(_this);
    return _this;
  }

  _createClass(ColumnSizer, [{
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps, prevState) {
      var _props = this.props;
      var columnMaxWidth = _props.columnMaxWidth;
      var columnMinWidth = _props.columnMinWidth;
      var columnsCount = _props.columnsCount;
      var width = _props.width;


      if (columnMaxWidth !== prevProps.columnMaxWidth || columnMinWidth !== prevProps.columnMinWidth || columnsCount !== prevProps.columnsCount || width !== prevProps.width) {
        if (this._registeredChild) {
          this._registeredChild.recomputeGridSize();
        }
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props;
      var children = _props2.children;
      var columnMaxWidth = _props2.columnMaxWidth;
      var columnMinWidth = _props2.columnMinWidth;
      var columnsCount = _props2.columnsCount;
      var width = _props2.width;


      var safeColumnMinWidth = columnMinWidth || 1;

      var safeColumnMaxWidth = columnMaxWidth ? Math.min(columnMaxWidth, width) : width;

      var columnWidth = width / columnsCount;
      columnWidth = Math.max(safeColumnMinWidth, columnWidth);
      columnWidth = Math.min(safeColumnMaxWidth, columnWidth);
      columnWidth = Math.floor(columnWidth);

      var adjustedWidth = Math.min(width, columnWidth * columnsCount);

      return children({
        adjustedWidth: adjustedWidth,
        getColumnWidth: function getColumnWidth() {
          return columnWidth;
        },
        registerChild: this._registerChild
      });
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_registerChild',
    value: function _registerChild(child) {
      if (child !== null && !(child instanceof _Grid2.default)) {
        throw Error('Unexpected child type registered; only Grid children are supported.');
      }

      this._registeredChild = child;

      if (this._registeredChild) {
        this._registeredChild.recomputeGridSize();
      }
    }
  }]);

  return ColumnSizer;
}(_react.Component);

ColumnSizer.propTypes = {
  /**
   * Function respondible for rendering a virtualized Grid.
   * This function should implement the following signature:
   * ({ adjustedWidth, getColumnWidth, registerChild }) => PropTypes.element
   *
   * The specified :getColumnWidth function should be passed to the Grid's :columnWidth property.
   * The :registerChild should be passed to the Grid's :ref property.
   * The :adjustedWidth property is optional; it reflects the lesser of the overall width or the width of all columns.
   */
  children: _react.PropTypes.func.isRequired,

  /** Optional maximum allowed column width */
  columnMaxWidth: _react.PropTypes.number,

  /** Optional minimum allowed column width */
  columnMinWidth: _react.PropTypes.number,

  /** Number of columns in Grid or FlexTable child */
  columnsCount: _react.PropTypes.number.isRequired,

  /** Width of Grid or FlexTable child */
  width: _react.PropTypes.number.isRequired
};
exports.default = ColumnSizer;
},{"../Grid":51,"react":undefined,"react-addons-shallow-compare":28}],44:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ColumnSizer = exports.default = undefined;

var _ColumnSizer2 = require('./ColumnSizer');

var _ColumnSizer3 = _interopRequireDefault(_ColumnSizer2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _ColumnSizer3.default;
exports.ColumnSizer = _ColumnSizer3.default;
},{"./ColumnSizer":43}],45:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultCellRenderer = defaultCellRenderer;
exports.defaultCellDataGetter = defaultCellDataGetter;
exports.defaultHeaderRenderer = defaultHeaderRenderer;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _SortIndicator = require('./SortIndicator');

var _SortIndicator2 = _interopRequireDefault(_SortIndicator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Default cell renderer that displays an attribute as a simple string
 * You should override the column's cellRenderer if your data is some other type of object.
 */
function defaultCellRenderer(cellData, cellDataKey, rowData, rowIndex, columnData) {
  if (cellData === null || cellData === undefined) {
    return '';
  } else {
    return String(cellData);
  }
}

/**
 * Default accessor for returning a cell value for a given attribute.
 * This function expects to operate on either a vanilla Object or an Immutable Map.
 * You should override the column's cellDataGetter if your data is some other type of object.
 */
function defaultCellDataGetter(dataKey, rowData, columnData) {
  if (rowData.get instanceof Function) {
    return rowData.get(dataKey);
  } else {
    return rowData[dataKey];
  }
}

/**
 * Default table header renderer.
 */
function defaultHeaderRenderer(_ref) {
  var columnData = _ref.columnData;
  var dataKey = _ref.dataKey;
  var disableSort = _ref.disableSort;
  var label = _ref.label;
  var sortBy = _ref.sortBy;
  var sortDirection = _ref.sortDirection;

  var showSortIndicator = sortBy === dataKey;
  var children = [_react2.default.createElement(
    'div',
    {
      className: 'FlexTable__headerTruncatedText',
      key: 'label',
      title: label
    },
    label
  )];

  if (showSortIndicator) {
    children.push(_react2.default.createElement(_SortIndicator2.default, {
      key: 'SortIndicator',
      sortDirection: sortDirection
    }));
  }

  return children;
}

/**
 * Describes the header and cell contents of a table column.
 */

var Column = function (_Component) {
  _inherits(Column, _Component);

  function Column() {
    _classCallCheck(this, Column);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Column).apply(this, arguments));
  }

  return Column;
}(_react.Component);

Column.defaultProps = {
  cellDataGetter: defaultCellDataGetter,
  cellRenderer: defaultCellRenderer,
  flexGrow: 0,
  flexShrink: 1,
  headerRenderer: defaultHeaderRenderer
};
Column.propTypes = {
  /** Optional aria-label value to set on the column header */
  'aria-label': _react.PropTypes.string,

  /** Optional CSS class to apply to cell */
  cellClassName: _react.PropTypes.string,

  /**
   * Callback responsible for returning a cell's data, given its :dataKey
   * (dataKey: string, rowData: any): any
   */
  cellDataGetter: _react.PropTypes.func,

  /**
   * Callback responsible for rendering a cell's contents.
   * (cellData: any, cellDataKey: string, rowData: any, rowIndex: number, columnData: any): element
   */
  cellRenderer: _react.PropTypes.func,

  /** Optional additional data passed to this column's :cellDataGetter */
  columnData: _react.PropTypes.object,

  /** Uniquely identifies the row-data attribute correspnding to this cell */
  dataKey: _react.PropTypes.any.isRequired,

  /** If sort is enabled for the table at large, disable it for this column */
  disableSort: _react.PropTypes.bool,

  /** Flex grow style; defaults to 0 */
  flexGrow: _react.PropTypes.number,

  /** Flex shrink style; defaults to 1 */
  flexShrink: _react.PropTypes.number,

  /** Optional CSS class to apply to this column's header */
  headerClassName: _react.PropTypes.string,

  /**
   * Optional callback responsible for rendering a column header contents.
   * ({ columnData: object, dataKey: string, disableSort: boolean, label: string, sortBy: string, sortDirection: string }): PropTypes.node
   */
  headerRenderer: _react.PropTypes.func.isRequired,

  /** Header label for this column */
  label: _react.PropTypes.string,

  /** Maximum width of column; this property will only be used if :flexGrow is > 0. */
  maxWidth: _react.PropTypes.number,

  /** Minimum width of column. */
  minWidth: _react.PropTypes.number,

  /** Flex basis (width) for this column; This value can grow or shrink based on :flexGrow and :flexShrink properties. */
  width: _react.PropTypes.number.isRequired
};
exports.default = Column;
},{"./SortIndicator":48,"react":undefined}],46:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _FlexColumn = require('./FlexColumn');

var _FlexColumn2 = _interopRequireDefault(_FlexColumn);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

var _Grid = require('../Grid');

var _Grid2 = _interopRequireDefault(_Grid);

var _SortDirection = require('./SortDirection');

var _SortDirection2 = _interopRequireDefault(_SortDirection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Table component with fixed headers and virtualized rows for improved performance with large data sets.
 * This component expects explicit width, height, and padding parameters.
 */

var FlexTable = function (_Component) {
  _inherits(FlexTable, _Component);

  function FlexTable(props) {
    _classCallCheck(this, FlexTable);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(FlexTable).call(this, props));

    _this.state = {
      scrollbarWidth: 0
    };

    _this._createRow = _this._createRow.bind(_this);
    return _this;
  }

  /**
   * See Grid#recomputeGridSize
   */


  _createClass(FlexTable, [{
    key: 'recomputeRowHeights',
    value: function recomputeRowHeights() {
      this.refs.Grid.recomputeGridSize();
    }
  }, {
    key: 'componentDidMount',
    value: function componentDidMount() {
      this._setScrollbarWidth();
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate() {
      this._setScrollbarWidth();
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _props = this.props;
      var className = _props.className;
      var disableHeader = _props.disableHeader;
      var headerHeight = _props.headerHeight;
      var height = _props.height;
      var noRowsRenderer = _props.noRowsRenderer;
      var onRowsRendered = _props.onRowsRendered;
      var _onScroll = _props.onScroll;
      var overscanRowsCount = _props.overscanRowsCount;
      var rowClassName = _props.rowClassName;
      var rowHeight = _props.rowHeight;
      var rowsCount = _props.rowsCount;
      var scrollToIndex = _props.scrollToIndex;
      var scrollTop = _props.scrollTop;
      var width = _props.width;
      var scrollbarWidth = this.state.scrollbarWidth;


      var availableRowsHeight = height - headerHeight;

      // This row-renderer wrapper function is necessary in order to trigger re-render when the
      // sort-by or sort-direction have changed (else Grid will not see any props changes)
      var rowRenderer = function rowRenderer(index) {
        return _this2._createRow(index);
      };

      var rowClass = rowClassName instanceof Function ? rowClassName(-1) : rowClassName;

      return _react2.default.createElement(
        'div',
        {
          className: (0, _classnames2.default)('FlexTable', className)
        },
        !disableHeader && _react2.default.createElement(
          'div',
          {
            className: (0, _classnames2.default)('FlexTable__headerRow', rowClass),
            style: {
              height: headerHeight,
              paddingRight: scrollbarWidth,
              width: width
            }
          },
          this._getRenderedHeaderRow()
        ),
        _react2.default.createElement(_Grid2.default, {
          'aria-label': this.props['aria-label'],
          ref: 'Grid',
          className: 'FlexTable__Grid',
          columnWidth: width,
          columnsCount: 1,
          height: availableRowsHeight,
          noContentRenderer: noRowsRenderer,
          onScroll: function onScroll(_ref) {
            var clientHeight = _ref.clientHeight;
            var scrollHeight = _ref.scrollHeight;
            var scrollTop = _ref.scrollTop;
            return _onScroll({ clientHeight: clientHeight, scrollHeight: scrollHeight, scrollTop: scrollTop });
          },
          onSectionRendered: function onSectionRendered(_ref2) {
            var rowOverscanStartIndex = _ref2.rowOverscanStartIndex;
            var rowOverscanStopIndex = _ref2.rowOverscanStopIndex;
            var rowStartIndex = _ref2.rowStartIndex;
            var rowStopIndex = _ref2.rowStopIndex;
            return onRowsRendered({
              overscanStartIndex: rowOverscanStartIndex,
              overscanStopIndex: rowOverscanStopIndex,
              startIndex: rowStartIndex,
              stopIndex: rowStopIndex
            });
          },
          overscanRowsCount: overscanRowsCount,
          renderCell: function renderCell(_ref3) {
            var columnIndex = _ref3.columnIndex;
            var rowIndex = _ref3.rowIndex;
            return rowRenderer(rowIndex);
          },
          rowHeight: rowHeight,
          rowsCount: rowsCount,
          scrollToRow: scrollToIndex,
          scrollTop: scrollTop,
          width: width
        })
      );
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_createColumn',
    value: function _createColumn(column, columnIndex, rowData, rowIndex) {
      var _column$props = column.props;
      var cellClassName = _column$props.cellClassName;
      var cellDataGetter = _column$props.cellDataGetter;
      var columnData = _column$props.columnData;
      var dataKey = _column$props.dataKey;
      var cellRenderer = _column$props.cellRenderer;

      var cellData = cellDataGetter(dataKey, rowData, columnData);
      var renderedCell = cellRenderer(cellData, dataKey, rowData, rowIndex, columnData);

      var style = this._getFlexStyleForColumn(column);

      var title = typeof renderedCell === 'string' ? renderedCell : null;

      return _react2.default.createElement(
        'div',
        {
          key: 'Row' + rowIndex + '-Col' + columnIndex,
          className: (0, _classnames2.default)('FlexTable__rowColumn', cellClassName),
          style: style
        },
        _react2.default.createElement(
          'div',
          {
            className: 'FlexTable__truncatedColumnText',
            title: title
          },
          renderedCell
        )
      );
    }
  }, {
    key: '_createHeader',
    value: function _createHeader(column, columnIndex) {
      var _props2 = this.props;
      var headerClassName = _props2.headerClassName;
      var onHeaderClick = _props2.onHeaderClick;
      var sort = _props2.sort;
      var sortBy = _props2.sortBy;
      var sortDirection = _props2.sortDirection;
      var _column$props2 = column.props;
      var dataKey = _column$props2.dataKey;
      var disableSort = _column$props2.disableSort;
      var headerRenderer = _column$props2.headerRenderer;
      var label = _column$props2.label;
      var columnData = _column$props2.columnData;

      var sortEnabled = !disableSort && sort;

      var classNames = (0, _classnames2.default)('FlexTable__headerColumn', headerClassName, column.props.headerClassName, {
        'FlexTable__sortableHeaderColumn': sortEnabled
      });
      var style = this._getFlexStyleForColumn(column);

      var renderedHeader = headerRenderer({
        columnData: columnData,
        dataKey: dataKey,
        disableSort: disableSort,
        label: label,
        sortBy: sortBy,
        sortDirection: sortDirection
      });

      var a11yProps = {};

      if (sortEnabled || onHeaderClick) {
        (function () {
          // If this is a sortable header, clicking it should update the table data's sorting.
          var newSortDirection = sortBy !== dataKey || sortDirection === _SortDirection2.default.DESC ? _SortDirection2.default.ASC : _SortDirection2.default.DESC;

          var onClick = function onClick() {
            sortEnabled && sort(dataKey, newSortDirection);
            onHeaderClick && onHeaderClick(dataKey, columnData);
          };

          var onKeyDown = function onKeyDown(event) {
            if (event.key === 'Enter' || event.key === ' ') {
              onClick();
            }
          };

          a11yProps['aria-label'] = column.props['aria-label'] || label || dataKey;
          a11yProps.role = 'rowheader';
          a11yProps.tabIndex = 0;
          a11yProps.onClick = onClick;
          a11yProps.onKeyDown = onKeyDown;
        })();
      }

      return _react2.default.createElement(
        'div',
        _extends({}, a11yProps, {
          key: 'Header-Col' + columnIndex,
          className: classNames,
          style: style
        }),
        renderedHeader
      );
    }
  }, {
    key: '_createRow',
    value: function _createRow(rowIndex) {
      var _this3 = this;

      var _props3 = this.props;
      var children = _props3.children;
      var onRowClick = _props3.onRowClick;
      var rowClassName = _props3.rowClassName;
      var rowGetter = _props3.rowGetter;
      var scrollbarWidth = this.state.scrollbarWidth;


      var rowClass = rowClassName instanceof Function ? rowClassName(rowIndex) : rowClassName;
      var rowData = rowGetter(rowIndex);

      var renderedRow = _react2.default.Children.toArray(children).map(function (column, columnIndex) {
        return _this3._createColumn(column, columnIndex, rowData, rowIndex);
      });

      var a11yProps = {};

      if (onRowClick) {
        a11yProps['aria-label'] = 'row';
        a11yProps.role = 'row';
        a11yProps.tabIndex = 0;
        a11yProps.onClick = function () {
          return onRowClick(rowIndex);
        };
      }

      return _react2.default.createElement(
        'div',
        _extends({}, a11yProps, {
          key: rowIndex,
          className: (0, _classnames2.default)('FlexTable__row', rowClass),
          style: {
            height: this._getRowHeight(rowIndex),
            paddingRight: scrollbarWidth
          }
        }),
        renderedRow
      );
    }

    /**
     * Determines the flex-shrink, flex-grow, and width values for a cell (header or column).
     */

  }, {
    key: '_getFlexStyleForColumn',
    value: function _getFlexStyleForColumn(column) {
      var flexValue = column.props.flexGrow + ' ' + column.props.flexShrink + ' ' + column.props.width + 'px';

      var style = {
        flex: flexValue,
        msFlex: flexValue,
        WebkitFlex: flexValue
      };

      if (column.props.maxWidth) {
        style.maxWidth = column.props.maxWidth;
      }

      if (column.props.minWidth) {
        style.minWidth = column.props.minWidth;
      }

      return style;
    }
  }, {
    key: '_getRenderedHeaderRow',
    value: function _getRenderedHeaderRow() {
      var _this4 = this;

      var _props4 = this.props;
      var children = _props4.children;
      var disableHeader = _props4.disableHeader;

      var items = disableHeader ? [] : _react2.default.Children.toArray(children);

      return items.map(function (column, index) {
        return _this4._createHeader(column, index);
      });
    }
  }, {
    key: '_getRowHeight',
    value: function _getRowHeight(rowIndex) {
      var rowHeight = this.props.rowHeight;


      return rowHeight instanceof Function ? rowHeight(rowIndex) : rowHeight;
    }
  }, {
    key: '_setScrollbarWidth',
    value: function _setScrollbarWidth() {
      var Grid = (0, _reactDom.findDOMNode)(this.refs.Grid);
      var clientWidth = Grid.clientWidth || 0;
      var offsetWidth = Grid.offsetWidth || 0;
      var scrollbarWidth = offsetWidth - clientWidth;

      this.setState({ scrollbarWidth: scrollbarWidth });
    }
  }]);

  return FlexTable;
}(_react.Component);

FlexTable.propTypes = {
  'aria-label': _react.PropTypes.string,

  /** One or more FlexColumns describing the data displayed in this row */
  children: function children(props, propName, componentName) {
    var children = _react2.default.Children.toArray(props.children);
    for (var i = 0; i < children.length; i++) {
      if (children[i].type !== _FlexColumn2.default) {
        return new Error('FlexTable only accepts children of type FlexColumn');
      }
    }
  },

  /** Optional CSS class name */
  className: _react.PropTypes.string,

  /** Disable rendering the header at all */
  disableHeader: _react.PropTypes.bool,

  /** Optional CSS class to apply to all column headers */
  headerClassName: _react.PropTypes.string,

  /** Fixed height of header row */
  headerHeight: _react.PropTypes.number.isRequired,

  /** Fixed/available height for out DOM element */
  height: _react.PropTypes.number.isRequired,

  /** Optional renderer to be used in place of table body rows when rowsCount is 0 */
  noRowsRenderer: _react.PropTypes.func,

  /**
  * Optional callback when a column's header is clicked.
  * (dataKey: string): void
  */
  onHeaderClick: _react.PropTypes.func,

  /**
   * Callback invoked when a user clicks on a table row.
   * (rowIndex: number): void
   */
  onRowClick: _react.PropTypes.func,

  /**
   * Callback invoked with information about the slice of rows that were just rendered.
   * ({ startIndex, stopIndex }): void
   */
  onRowsRendered: _react.PropTypes.func,

  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, scrollHeight, scrollTop }): void
   */
  onScroll: _react.PropTypes.func.isRequired,

  /**
   * Number of rows to render above/below the visible bounds of the list.
   * These rows can help for smoother scrolling on touch devices.
   */
  overscanRowsCount: _react.PropTypes.number.isRequired,

  /**
   * Optional CSS class to apply to all table rows (including the header row).
   * This property can be a CSS class name (string) or a function that returns a class name.
   * If a function is provided its signature should be: (rowIndex: number): string
   */
  rowClassName: _react.PropTypes.oneOfType([_react.PropTypes.string, _react.PropTypes.func]),

  /**
   * Callback responsible for returning a data row given an index.
   * (index: number): any
   */
  rowGetter: _react.PropTypes.func.isRequired,

  /**
   * Either a fixed row height (number) or a function that returns the height of a row given its index.
   * (index: number): number
   */
  rowHeight: _react.PropTypes.oneOfType([_react.PropTypes.number, _react.PropTypes.func]).isRequired,

  /** Number of rows in table. */
  rowsCount: _react.PropTypes.number.isRequired,

  /** Row index to ensure visible (by forcefully scrolling if necessary) */
  scrollToIndex: _react.PropTypes.number,

  /** Vertical offset. */
  scrollTop: _react.PropTypes.number,

  /**
   * Sort function to be called if a sortable header is clicked.
   * (dataKey: string, sortDirection: SortDirection): void
   */
  sort: _react.PropTypes.func,

  /** FlexTable data is currently sorted by this :dataKey (if it is sorted at all) */
  sortBy: _react.PropTypes.string,

  /** FlexTable data is currently sorted in this direction (if it is sorted at all) */
  sortDirection: _react.PropTypes.oneOf([_SortDirection2.default.ASC, _SortDirection2.default.DESC]),

  /** Width of list */
  width: _react.PropTypes.number.isRequired
};
FlexTable.defaultProps = {
  disableHeader: false,
  headerHeight: 0,
  noRowsRenderer: function noRowsRenderer() {
    return null;
  },
  onRowsRendered: function onRowsRendered() {
    return null;
  },
  onScroll: function onScroll() {
    return null;
  },
  overscanRowsCount: 10
};
exports.default = FlexTable;
},{"../Grid":51,"./FlexColumn":45,"./SortDirection":47,"classnames":undefined,"react":undefined,"react-addons-shallow-compare":28,"react-dom":undefined}],47:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var SortDirection = {
  /**
   * Sort items in ascending order.
   * This means arranging from the lowest value to the highest (e.g. a-z, 0-9).
   */
  ASC: 'ASC',

  /**
   * Sort items in descending order.
   * This means arranging from the highest value to the lowest (e.g. z-a, 9-0).
   */
  DESC: 'DESC'
};

exports.default = SortDirection;
},{}],48:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = SortIndicator;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _SortDirection = require('./SortDirection');

var _SortDirection2 = _interopRequireDefault(_SortDirection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Displayed beside a header to indicate that a FlexTable is currently sorted by this column.
 */
function SortIndicator(_ref) {
  var sortDirection = _ref.sortDirection;

  var classNames = (0, _classnames2.default)('FlexTable__sortableHeaderIcon', {
    'FlexTable__sortableHeaderIcon--ASC': sortDirection === _SortDirection2.default.ASC,
    'FlexTable__sortableHeaderIcon--DESC': sortDirection === _SortDirection2.default.DESC
  });

  return _react2.default.createElement(
    'svg',
    {
      className: classNames,
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      xmlns: 'http://www.w3.org/2000/svg'
    },
    sortDirection === _SortDirection2.default.ASC ? _react2.default.createElement('path', { d: 'M7 14l5-5 5 5z' }) : _react2.default.createElement('path', { d: 'M7 10l5 5 5-5z' }),
    _react2.default.createElement('path', { d: 'M0 0h24v24H0z', fill: 'none' })
  );
}
SortIndicator.propTypes = {
  sortDirection: _react.PropTypes.oneOf([_SortDirection2.default.ASC, _SortDirection2.default.DESC])
};
},{"./SortDirection":47,"classnames":undefined,"react":undefined}],49:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SortIndicator = exports.SortDirection = exports.FlexColumn = exports.FlexTable = exports.default = undefined;

var _FlexTable2 = require('./FlexTable');

var _FlexTable3 = _interopRequireDefault(_FlexTable2);

var _FlexColumn2 = require('./FlexColumn');

var _FlexColumn3 = _interopRequireDefault(_FlexColumn2);

var _SortDirection2 = require('./SortDirection');

var _SortDirection3 = _interopRequireDefault(_SortDirection2);

var _SortIndicator2 = require('./SortIndicator');

var _SortIndicator3 = _interopRequireDefault(_SortIndicator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _FlexTable3.default;
exports.FlexTable = _FlexTable3.default;
exports.FlexColumn = _FlexColumn3.default;
exports.SortDirection = _SortDirection3.default;
exports.SortIndicator = _SortIndicator3.default;
},{"./FlexColumn":45,"./FlexTable":46,"./SortDirection":47,"./SortIndicator":48}],50:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _calculateSizeAndPositionDataAndUpdateScrollOffset = require('./utils/calculateSizeAndPositionDataAndUpdateScrollOffset');

var _calculateSizeAndPositionDataAndUpdateScrollOffset2 = _interopRequireDefault(_calculateSizeAndPositionDataAndUpdateScrollOffset);

var _createCallbackMemoizer = require('../utils/createCallbackMemoizer');

var _createCallbackMemoizer2 = _interopRequireDefault(_createCallbackMemoizer);

var _getNearestIndex = require('./utils/getNearestIndex');

var _getNearestIndex2 = _interopRequireDefault(_getNearestIndex);

var _getOverscanIndices = require('./utils/getOverscanIndices');

var _getOverscanIndices2 = _interopRequireDefault(_getOverscanIndices);

var _scrollbarSize = require('dom-helpers/util/scrollbarSize');

var _scrollbarSize2 = _interopRequireDefault(_scrollbarSize);

var _getUpdatedOffsetForIndex = require('../utils/getUpdatedOffsetForIndex');

var _getUpdatedOffsetForIndex2 = _interopRequireDefault(_getUpdatedOffsetForIndex);

var _getVisibleCellIndices = require('./utils/getVisibleCellIndices');

var _getVisibleCellIndices2 = _interopRequireDefault(_getVisibleCellIndices);

var _initCellMetadata = require('../utils/initCellMetadata');

var _initCellMetadata2 = _interopRequireDefault(_initCellMetadata);

var _raf = require('raf');

var _raf2 = _interopRequireDefault(_raf);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

var _updateScrollIndexHelper = require('./utils/updateScrollIndexHelper');

var _updateScrollIndexHelper2 = _interopRequireDefault(_updateScrollIndexHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Specifies the number of miliseconds during which to disable pointer events while a scroll is in progress.
 * This improves performance and makes scrolling smoother.
 */
var IS_SCROLLING_TIMEOUT = 150;

/**
 * Controls whether the Grid updates the DOM element's scrollLeft/scrollTop based on the current state or just observes it.
 * This prevents Grid from interrupting mouse-wheel animations (see issue #2).
 */
var SCROLL_POSITION_CHANGE_REASONS = {
  OBSERVED: 'observed',
  REQUESTED: 'requested'
};

/**
 * Renders tabular data with virtualization along the vertical and horizontal axes.
 * Row heights and column widths must be known ahead of time and specified as properties.
 */

var Grid = function (_Component) {
  _inherits(Grid, _Component);

  function Grid(props, context) {
    _classCallCheck(this, Grid);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Grid).call(this, props, context));

    _this.state = {
      computeGridMetadataOnNextUpdate: false,
      isScrolling: false,
      scrollLeft: 0,
      scrollTop: 0
    };

    // Invokes onSectionRendered callback only when start/stop row or column indices change
    _this._onGridRenderedMemoizer = (0, _createCallbackMemoizer2.default)();
    _this._onScrollMemoizer = (0, _createCallbackMemoizer2.default)(false);

    // Bind functions to instance so they don't lose context when passed around
    _this._computeColumnMetadata = _this._computeColumnMetadata.bind(_this);
    _this._computeRowMetadata = _this._computeRowMetadata.bind(_this);
    _this._invokeOnGridRenderedHelper = _this._invokeOnGridRenderedHelper.bind(_this);
    _this._onScroll = _this._onScroll.bind(_this);
    _this._updateScrollLeftForScrollToColumn = _this._updateScrollLeftForScrollToColumn.bind(_this);
    _this._updateScrollTopForScrollToRow = _this._updateScrollTopForScrollToRow.bind(_this);
    return _this;
  }

  /**
   * Forced recompute of row heights and column widths.
   * This function should be called if dynamic column or row sizes have changed but nothing else has.
   * Since Grid only receives :columnsCount and :rowsCount it has no way of detecting when the underlying data changes.
   */


  _createClass(Grid, [{
    key: 'recomputeGridSize',
    value: function recomputeGridSize() {
      this.setState({
        computeGridMetadataOnNextUpdate: true
      });
    }
  }, {
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _props = this.props;
      var scrollLeft = _props.scrollLeft;
      var scrollToColumn = _props.scrollToColumn;
      var scrollTop = _props.scrollTop;
      var scrollToRow = _props.scrollToRow;


      this._scrollbarSize = (0, _scrollbarSize2.default)();

      if (scrollLeft >= 0 || scrollTop >= 0) {
        this._setScrollPosition({ scrollLeft: scrollLeft, scrollTop: scrollTop });
      }

      if (scrollToColumn >= 0 || scrollToRow >= 0) {
        this._updateScrollLeftForScrollToColumn();
        this._updateScrollTopForScrollToRow();
      }

      // Update onRowsRendered callback
      this._invokeOnGridRenderedHelper();

      // Initialize onScroll callback
      this._invokeOnScrollMemoizer({
        scrollLeft: scrollLeft || 0,
        scrollTop: scrollTop || 0,
        totalColumnsWidth: this._getTotalColumnsWidth(),
        totalRowsHeight: this._getTotalRowsHeight()
      });
    }

    /**
     * @private
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) New scroll-to-cell props have been set
     */

  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps, prevState) {
      var _this2 = this;

      var _props2 = this.props;
      var columnsCount = _props2.columnsCount;
      var columnWidth = _props2.columnWidth;
      var height = _props2.height;
      var rowHeight = _props2.rowHeight;
      var rowsCount = _props2.rowsCount;
      var scrollToColumn = _props2.scrollToColumn;
      var scrollToRow = _props2.scrollToRow;
      var width = _props2.width;
      var _state = this.state;
      var scrollLeft = _state.scrollLeft;
      var scrollPositionChangeReason = _state.scrollPositionChangeReason;
      var scrollTop = _state.scrollTop;

      // Make sure requested changes to :scrollLeft or :scrollTop get applied.
      // Assigning to scrollLeft/scrollTop tells the browser to interrupt any running scroll animations,
      // And to discard any pending async changes to the scroll position that may have happened in the meantime (e.g. on a separate scrolling thread).
      // So we only set these when we require an adjustment of the scroll position.
      // See issue #2 for more information.

      if (scrollPositionChangeReason === SCROLL_POSITION_CHANGE_REASONS.REQUESTED) {
        if (scrollLeft >= 0 && scrollLeft !== prevState.scrollLeft && scrollLeft !== this.refs.scrollingContainer.scrollLeft) {
          this.refs.scrollingContainer.scrollLeft = scrollLeft;
        }
        if (scrollTop >= 0 && scrollTop !== prevState.scrollTop && scrollTop !== this.refs.scrollingContainer.scrollTop) {
          this.refs.scrollingContainer.scrollTop = scrollTop;
        }
      }

      // Update scroll offsets if the current :scrollToColumn or :scrollToRow values requires it
      // @TODO Do we also need this check or can the one in componentWillUpdate() suffice?
      (0, _updateScrollIndexHelper2.default)({
        cellCount: columnsCount,
        cellMetadata: this._columnMetadata,
        cellSize: columnWidth,
        previousCellsCount: prevProps.columnsCount,
        previousCellSize: prevProps.columnWidth,
        previousScrollToIndex: prevProps.scrollToColumn,
        previousSize: prevProps.width,
        scrollOffset: scrollLeft,
        scrollToIndex: scrollToColumn,
        size: width,
        updateScrollIndexCallback: function updateScrollIndexCallback(scrollToColumn) {
          return _this2._updateScrollLeftForScrollToColumn(_extends({}, _this2.props, { scrollToColumn: scrollToColumn }));
        }
      });
      (0, _updateScrollIndexHelper2.default)({
        cellCount: rowsCount,
        cellMetadata: this._rowMetadata,
        cellSize: rowHeight,
        previousCellsCount: prevProps.rowsCount,
        previousCellSize: prevProps.rowHeight,
        previousScrollToIndex: prevProps.scrollToRow,
        previousSize: prevProps.height,
        scrollOffset: scrollTop,
        scrollToIndex: scrollToRow,
        size: height,
        updateScrollIndexCallback: function updateScrollIndexCallback(scrollToRow) {
          return _this2._updateScrollTopForScrollToRow(_extends({}, _this2.props, { scrollToRow: scrollToRow }));
        }
      });

      // Update onRowsRendered callback if start/stop indices have changed
      this._invokeOnGridRenderedHelper();
    }
  }, {
    key: 'componentWillMount',
    value: function componentWillMount() {
      this._computeColumnMetadata(this.props);
      this._computeRowMetadata(this.props);
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      if (this._disablePointerEventsTimeoutId) {
        clearTimeout(this._disablePointerEventsTimeoutId);
      }

      if (this._setNextStateAnimationFrameId) {
        _raf2.default.cancel(this._setNextStateAnimationFrameId);
      }
    }

    /**
     * @private
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) Empty content (0 rows or columns)
     * 2) New scroll props overriding the current state
     * 3) Cells-count or cells-size has changed, making previous scroll offsets invalid
     */

  }, {
    key: 'componentWillUpdate',
    value: function componentWillUpdate(nextProps, nextState) {
      var _this3 = this;

      if (nextProps.columnsCount === 0 && nextState.scrollLeft !== 0 || nextProps.rowsCount === 0 && nextState.scrollTop !== 0) {
        this._setScrollPosition({
          scrollLeft: 0,
          scrollTop: 0
        });
      } else if (nextProps.scrollLeft !== this.props.scrollLeft || nextProps.scrollTop !== this.props.scrollTop) {
        this._setScrollPosition({
          scrollLeft: nextProps.scrollLeft,
          scrollTop: nextProps.scrollTop
        });
      }

      // Update scroll offsets if the size or number of cells have changed, invalidating the previous value
      (0, _calculateSizeAndPositionDataAndUpdateScrollOffset2.default)({
        cellCount: this.props.columnsCount,
        cellSize: this.props.columnWidth,
        computeMetadataCallback: this._computeColumnMetadata,
        computeMetadataCallbackProps: nextProps,
        computeMetadataOnNextUpdate: nextState.computeGridMetadataOnNextUpdate,
        nextCellsCount: nextProps.columnsCount,
        nextCellSize: nextProps.columnWidth,
        nextScrollToIndex: nextProps.scrollToColumn,
        scrollToIndex: this.props.scrollToColumn,
        updateScrollOffsetForScrollToIndex: function updateScrollOffsetForScrollToIndex() {
          return _this3._updateScrollLeftForScrollToColumn(nextProps, nextState);
        }
      });
      (0, _calculateSizeAndPositionDataAndUpdateScrollOffset2.default)({
        cellCount: this.props.rowsCount,
        cellSize: this.props.rowHeight,
        computeMetadataCallback: this._computeRowMetadata,
        computeMetadataCallbackProps: nextProps,
        computeMetadataOnNextUpdate: nextState.computeGridMetadataOnNextUpdate,
        nextCellsCount: nextProps.rowsCount,
        nextCellSize: nextProps.rowHeight,
        nextScrollToIndex: nextProps.scrollToRow,
        scrollToIndex: this.props.scrollToRow,
        updateScrollOffsetForScrollToIndex: function updateScrollOffsetForScrollToIndex() {
          return _this3._updateScrollTopForScrollToRow(nextProps, nextState);
        }
      });

      this.setState({
        computeGridMetadataOnNextUpdate: false
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var _props3 = this.props;
      var className = _props3.className;
      var columnsCount = _props3.columnsCount;
      var height = _props3.height;
      var noContentRenderer = _props3.noContentRenderer;
      var overscanColumnsCount = _props3.overscanColumnsCount;
      var overscanRowsCount = _props3.overscanRowsCount;
      var renderCell = _props3.renderCell;
      var renderCellRanges = _props3.renderCellRanges;
      var rowsCount = _props3.rowsCount;
      var width = _props3.width;
      var _state2 = this.state;
      var isScrolling = _state2.isScrolling;
      var scrollLeft = _state2.scrollLeft;
      var scrollTop = _state2.scrollTop;


      var childrenToDisplay = [];

      // Render only enough columns and rows to cover the visible area of the grid.
      if (height > 0 && width > 0) {
        var visibleColumnIndices = (0, _getVisibleCellIndices2.default)({
          cellMetadata: this._columnMetadata,
          containerSize: width,
          currentOffset: scrollLeft
        });

        var visibleRowIndices = (0, _getVisibleCellIndices2.default)({
          cellMetadata: this._rowMetadata,
          containerSize: height,
          currentOffset: scrollTop
        });

        // Store for _invokeOnGridRenderedHelper()
        this._renderedColumnStartIndex = visibleColumnIndices.start;
        this._renderedColumnStopIndex = visibleColumnIndices.stop;
        this._renderedRowStartIndex = visibleRowIndices.start;
        this._renderedRowStopIndex = visibleRowIndices.stop;

        var overscanColumnIndices = (0, _getOverscanIndices2.default)({
          cellCount: columnsCount,
          overscanCellsCount: overscanColumnsCount,
          startIndex: this._renderedColumnStartIndex,
          stopIndex: this._renderedColumnStopIndex
        });

        var overscanRowIndices = (0, _getOverscanIndices2.default)({
          cellCount: rowsCount,
          overscanCellsCount: overscanRowsCount,
          startIndex: this._renderedRowStartIndex,
          stopIndex: this._renderedRowStopIndex
        });

        // Store for _invokeOnGridRenderedHelper()
        this._columnStartIndex = overscanColumnIndices.overscanStartIndex;
        this._columnStopIndex = overscanColumnIndices.overscanStopIndex;
        this._rowStartIndex = overscanRowIndices.overscanStartIndex;
        this._rowStopIndex = overscanRowIndices.overscanStopIndex;

        childrenToDisplay = renderCellRanges({
          columnMetadata: this._columnMetadata,
          columnStartIndex: this._columnStartIndex,
          columnStopIndex: this._columnStopIndex,
          renderCell: renderCell,
          rowMetadata: this._rowMetadata,
          rowStartIndex: this._rowStartIndex,
          rowStopIndex: this._rowStopIndex
        });
      }

      var gridStyle = {
        height: height,
        width: width
      };

      var totalColumnsWidth = this._getTotalColumnsWidth();
      var totalRowsHeight = this._getTotalRowsHeight();

      // Force browser to hide scrollbars when we know they aren't necessary.
      // Otherwise once scrollbars appear they may not disappear again.
      // For more info see issue #116
      if (totalColumnsWidth <= width) {
        gridStyle.overflowX = 'hidden';
      }

      if (totalRowsHeight <= height) {
        gridStyle.overflowY = 'hidden';
      }

      return _react2.default.createElement(
        'div',
        {
          ref: 'scrollingContainer',
          'aria-label': this.props['aria-label'],
          className: (0, _classnames2.default)('Grid', className),
          onScroll: this._onScroll,
          role: 'grid',
          style: gridStyle,
          tabIndex: 0
        },
        childrenToDisplay.length > 0 && _react2.default.createElement(
          'div',
          {
            className: 'Grid__innerScrollContainer',
            style: {
              width: totalColumnsWidth,
              height: totalRowsHeight,
              maxWidth: totalColumnsWidth,
              maxHeight: totalRowsHeight,
              pointerEvents: isScrolling ? 'none' : 'auto'
            }
          },
          childrenToDisplay
        ),
        childrenToDisplay.length === 0 && noContentRenderer()
      );
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }

    /* ---------------------------- Helper methods ---------------------------- */

  }, {
    key: '_computeColumnMetadata',
    value: function _computeColumnMetadata(props) {
      var columnsCount = props.columnsCount;
      var columnWidth = props.columnWidth;


      this._columnMetadata = (0, _initCellMetadata2.default)({
        cellCount: columnsCount,
        size: columnWidth
      });
    }
  }, {
    key: '_computeRowMetadata',
    value: function _computeRowMetadata(props) {
      var rowHeight = props.rowHeight;
      var rowsCount = props.rowsCount;


      this._rowMetadata = (0, _initCellMetadata2.default)({
        cellCount: rowsCount,
        size: rowHeight
      });
    }

    /**
     * Sets an :isScrolling flag for a small window of time.
     * This flag is used to disable pointer events on the scrollable portion of the Grid.
     * This prevents jerky/stuttery mouse-wheel scrolling.
     */

  }, {
    key: '_enablePointerEventsAfterDelay',
    value: function _enablePointerEventsAfterDelay() {
      var _this4 = this;

      if (this._disablePointerEventsTimeoutId) {
        clearTimeout(this._disablePointerEventsTimeoutId);
      }

      this._disablePointerEventsTimeoutId = setTimeout(function () {
        _this4._disablePointerEventsTimeoutId = null;
        _this4.setState({
          isScrolling: false
        });
      }, IS_SCROLLING_TIMEOUT);
    }
  }, {
    key: '_getTotalColumnsWidth',
    value: function _getTotalColumnsWidth() {
      if (this._columnMetadata.length === 0) {
        return 0;
      }

      var datum = this._columnMetadata[this._columnMetadata.length - 1];
      return datum.offset + datum.size;
    }
  }, {
    key: '_getTotalRowsHeight',
    value: function _getTotalRowsHeight() {
      if (this._rowMetadata.length === 0) {
        return 0;
      }

      var datum = this._rowMetadata[this._rowMetadata.length - 1];
      return datum.offset + datum.size;
    }
  }, {
    key: '_invokeOnGridRenderedHelper',
    value: function _invokeOnGridRenderedHelper() {
      var onSectionRendered = this.props.onSectionRendered;


      this._onGridRenderedMemoizer({
        callback: onSectionRendered,
        indices: {
          columnOverscanStartIndex: this._columnStartIndex,
          columnOverscanStopIndex: this._columnStopIndex,
          columnStartIndex: this._renderedColumnStartIndex,
          columnStopIndex: this._renderedColumnStopIndex,
          rowOverscanStartIndex: this._rowStartIndex,
          rowOverscanStopIndex: this._rowStopIndex,
          rowStartIndex: this._renderedRowStartIndex,
          rowStopIndex: this._renderedRowStopIndex
        }
      });
    }
  }, {
    key: '_invokeOnScrollMemoizer',
    value: function _invokeOnScrollMemoizer(_ref) {
      var _this5 = this;

      var scrollLeft = _ref.scrollLeft;
      var scrollTop = _ref.scrollTop;
      var totalColumnsWidth = _ref.totalColumnsWidth;
      var totalRowsHeight = _ref.totalRowsHeight;

      this._onScrollMemoizer({
        callback: function callback(_ref2) {
          var scrollLeft = _ref2.scrollLeft;
          var scrollTop = _ref2.scrollTop;
          var _props4 = _this5.props;
          var height = _props4.height;
          var onScroll = _props4.onScroll;
          var width = _props4.width;


          onScroll({
            clientHeight: height,
            clientWidth: width,
            scrollHeight: totalRowsHeight,
            scrollLeft: scrollLeft,
            scrollTop: scrollTop,
            scrollWidth: totalColumnsWidth
          });
        },
        indices: {
          scrollLeft: scrollLeft,
          scrollTop: scrollTop
        }
      });
    }

    /**
     * Updates the state during the next animation frame.
     * Use this method to avoid multiple renders in a small span of time.
     * This helps performance for bursty events (like onScroll).
     */

  }, {
    key: '_setNextState',
    value: function _setNextState(state) {
      var _this6 = this;

      if (this._setNextStateAnimationFrameId) {
        _raf2.default.cancel(this._setNextStateAnimationFrameId);
      }

      this._setNextStateAnimationFrameId = (0, _raf2.default)(function () {
        _this6._setNextStateAnimationFrameId = null;
        _this6.setState(state);
      });
    }
  }, {
    key: '_setScrollPosition',
    value: function _setScrollPosition(_ref3) {
      var scrollLeft = _ref3.scrollLeft;
      var scrollTop = _ref3.scrollTop;

      var newState = {
        scrollPositionChangeReason: SCROLL_POSITION_CHANGE_REASONS.REQUESTED
      };

      if (scrollLeft >= 0) {
        newState.scrollLeft = scrollLeft;
      }

      if (scrollTop >= 0) {
        newState.scrollTop = scrollTop;
      }

      if (scrollLeft >= 0 && scrollLeft !== this.state.scrollLeft || scrollTop >= 0 && scrollTop !== this.state.scrollTop) {
        this.setState(newState);
      }
    }
  }, {
    key: '_updateScrollLeftForScrollToColumn',
    value: function _updateScrollLeftForScrollToColumn() {
      var props = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var state = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var _ref4 = props || this.props;

      var columnsCount = _ref4.columnsCount;
      var scrollToColumn = _ref4.scrollToColumn;
      var width = _ref4.width;

      var _ref5 = state || this.state;

      var scrollLeft = _ref5.scrollLeft;


      if (scrollToColumn >= 0 && columnsCount > 0) {
        var targetIndex = (0, _getNearestIndex2.default)({
          cellCount: this._columnMetadata.length,
          targetIndex: scrollToColumn
        });

        var columnMetadata = this._columnMetadata[targetIndex];

        var calculatedScrollLeft = (0, _getUpdatedOffsetForIndex2.default)({
          cellOffset: columnMetadata.offset,
          cellSize: columnMetadata.size,
          containerSize: width,
          currentOffset: scrollLeft,
          targetIndex: scrollToColumn
        });

        if (scrollLeft !== calculatedScrollLeft) {
          this._setScrollPosition({
            scrollLeft: calculatedScrollLeft
          });
        }
      }
    }
  }, {
    key: '_updateScrollTopForScrollToRow',
    value: function _updateScrollTopForScrollToRow() {
      var props = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var state = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var _ref6 = props || this.props;

      var height = _ref6.height;
      var rowsCount = _ref6.rowsCount;
      var scrollToRow = _ref6.scrollToRow;

      var _ref7 = state || this.state;

      var scrollTop = _ref7.scrollTop;


      if (scrollToRow >= 0 && rowsCount > 0) {
        var targetIndex = (0, _getNearestIndex2.default)({
          cellCount: this._rowMetadata.length,
          targetIndex: scrollToRow
        });

        var rowMetadata = this._rowMetadata[targetIndex];

        var calculatedScrollTop = (0, _getUpdatedOffsetForIndex2.default)({
          cellOffset: rowMetadata.offset,
          cellSize: rowMetadata.size,
          containerSize: height,
          currentOffset: scrollTop,
          targetIndex: scrollToRow
        });

        if (scrollTop !== calculatedScrollTop) {
          this._setScrollPosition({
            scrollTop: calculatedScrollTop
          });
        }
      }
    }
  }, {
    key: '_onScroll',
    value: function _onScroll(event) {
      // In certain edge-cases React dispatches an onScroll event with an invalid target.scrollLeft / target.scrollTop.
      // This invalid event can be detected by comparing event.target to this component's scrollable DOM element.
      // See issue #404 for more information.
      if (event.target !== this.refs.scrollingContainer) {
        return;
      }

      // Prevent pointer events from interrupting a smooth scroll
      this._enablePointerEventsAfterDelay();

      // When this component is shrunk drastically, React dispatches a series of back-to-back scroll events,
      // Gradually converging on a scrollTop that is within the bounds of the new, smaller height.
      // This causes a series of rapid renders that is slow for long lists.
      // We can avoid that by doing some simple bounds checking to ensure that scrollTop never exceeds the total height.
      var _props5 = this.props;
      var height = _props5.height;
      var width = _props5.width;

      var scrollbarSize = this._scrollbarSize;
      var totalRowsHeight = this._getTotalRowsHeight();
      var totalColumnsWidth = this._getTotalColumnsWidth();
      var scrollLeft = Math.min(totalColumnsWidth - width + scrollbarSize, event.target.scrollLeft);
      var scrollTop = Math.min(totalRowsHeight - height + scrollbarSize, event.target.scrollTop);

      // Certain devices (like Apple touchpad) rapid-fire duplicate events.
      // Don't force a re-render if this is the case.
      // The mouse may move faster then the animation frame does.
      // Use requestAnimationFrame to avoid over-updating.
      if (this.state.scrollLeft !== scrollLeft || this.state.scrollTop !== scrollTop) {
        // Browsers with cancelable scroll events (eg. Firefox) interrupt scrolling animations if scrollTop/scrollLeft is set.
        // Other browsers (eg. Safari) don't scroll as well without the help under certain conditions (DOM or style changes during scrolling).
        // All things considered, this seems to be the best current work around that I'm aware of.
        // For more information see https://github.com/bvaughn/react-virtualized/pull/124
        var scrollPositionChangeReason = event.cancelable ? SCROLL_POSITION_CHANGE_REASONS.OBSERVED : SCROLL_POSITION_CHANGE_REASONS.REQUESTED;

        if (!this.state.isScrolling) {
          this.setState({
            isScrolling: true
          });
        }

        this._setNextState({
          isScrolling: true,
          scrollLeft: scrollLeft,
          scrollPositionChangeReason: scrollPositionChangeReason,
          scrollTop: scrollTop
        });
      }

      this._invokeOnScrollMemoizer({ scrollLeft: scrollLeft, scrollTop: scrollTop, totalColumnsWidth: totalColumnsWidth, totalRowsHeight: totalRowsHeight });
    }
  }]);

  return Grid;
}(_react.Component);

Grid.propTypes = {
  'aria-label': _react.PropTypes.string,

  /**
   * Optional custom CSS class name to attach to root Grid element.
   */
  className: _react.PropTypes.string,

  /**
   * Number of columns in grid.
   */
  columnsCount: _react.PropTypes.number.isRequired,

  /**
   * Either a fixed column width (number) or a function that returns the width of a column given its index.
   * Should implement the following interface: (index: number): number
   */
  columnWidth: _react.PropTypes.oneOfType([_react.PropTypes.number, _react.PropTypes.func]).isRequired,

  /**
   * Height of Grid; this property determines the number of visible (vs virtualized) rows.
   */
  height: _react.PropTypes.number.isRequired,

  /**
   * Optional renderer to be used in place of rows when either :rowsCount or :columnsCount is 0.
   */
  noContentRenderer: _react.PropTypes.func.isRequired,

  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth }): void
   */
  onScroll: _react.PropTypes.func.isRequired,

  /**
   * Callback invoked with information about the section of the Grid that was just rendered.
   * ({ columnStartIndex, columnStopIndex, rowStartIndex, rowStopIndex }): void
   */
  onSectionRendered: _react.PropTypes.func.isRequired,

  /**
   * Number of columns to render before/after the visible section of the grid.
   * These columns can help for smoother scrolling on touch devices or browsers that send scroll events infrequently.
   */
  overscanColumnsCount: _react.PropTypes.number.isRequired,

  /**
   * Number of rows to render above/below the visible section of the grid.
   * These rows can help for smoother scrolling on touch devices or browsers that send scroll events infrequently.
   */
  overscanRowsCount: _react.PropTypes.number.isRequired,

  /**
   * Responsible for rendering a cell given an row and column index.
   * Should implement the following interface: ({ columnIndex: number, rowIndex: number }): PropTypes.node
   */
  renderCell: _react.PropTypes.func.isRequired,

  /**
   * Responsible for rendering a group of cells given their index ranges.
   * Should implement the following interface: ({
   *   columnMetadata:Array<Object>,
   *   columnStartIndex: number,
   *   columnStopIndex: number,
   *   renderCell: Function,
   *   rowMetadata:Array<Object>,
   *   rowStartIndex: number,
   *   rowStopIndex: number
   * }): Array<PropTypes.node>
   */
  renderCellRanges: _react.PropTypes.func.isRequired,

  /**
   * Either a fixed row height (number) or a function that returns the height of a row given its index.
   * Should implement the following interface: (index: number): number
   */
  rowHeight: _react.PropTypes.oneOfType([_react.PropTypes.number, _react.PropTypes.func]).isRequired,

  /**
   * Number of rows in grid.
   */
  rowsCount: _react.PropTypes.number.isRequired,

  /** Horizontal offset. */
  scrollLeft: _react.PropTypes.number,

  /**
   * Column index to ensure visible (by forcefully scrolling if necessary)
   */
  scrollToColumn: _react.PropTypes.number,

  /** Vertical offset. */
  scrollTop: _react.PropTypes.number,

  /**
   * Row index to ensure visible (by forcefully scrolling if necessary)
   */
  scrollToRow: _react.PropTypes.number,

  /**
   * Width of Grid; this property determines the number of visible (vs virtualized) columns.
   */
  width: _react.PropTypes.number.isRequired
};
Grid.defaultProps = {
  'aria-label': 'grid',
  noContentRenderer: function noContentRenderer() {
    return null;
  },
  onScroll: function onScroll() {
    return null;
  },
  onSectionRendered: function onSectionRendered() {
    return null;
  },
  overscanColumnsCount: 0,
  overscanRowsCount: 10,
  renderCellRanges: defaultRenderCellRanges
};
exports.default = Grid;


function defaultRenderCellRanges(_ref8) {
  var columnMetadata = _ref8.columnMetadata;
  var columnStartIndex = _ref8.columnStartIndex;
  var columnStopIndex = _ref8.columnStopIndex;
  var renderCell = _ref8.renderCell;
  var rowMetadata = _ref8.rowMetadata;
  var rowStartIndex = _ref8.rowStartIndex;
  var rowStopIndex = _ref8.rowStopIndex;

  var renderedCells = [];

  for (var rowIndex = rowStartIndex; rowIndex <= rowStopIndex; rowIndex++) {
    var rowDatum = rowMetadata[rowIndex];

    for (var columnIndex = columnStartIndex; columnIndex <= columnStopIndex; columnIndex++) {
      var columnDatum = columnMetadata[columnIndex];
      var renderedCell = renderCell({ columnIndex: columnIndex, rowIndex: rowIndex });
      var key = rowIndex + '-' + columnIndex;

      if (renderedCell == null || renderedCell === false) {
        continue;
      }

      var child = _react2.default.createElement(
        'div',
        {
          key: key,
          className: 'Grid__cell',
          style: {
            height: rowDatum.size,
            left: columnDatum.offset,
            top: rowDatum.offset,
            width: columnDatum.size
          }
        },
        renderedCell
      );

      renderedCells.push(child);
    }
  }

  return renderedCells;
}
},{"../utils/createCallbackMemoizer":64,"../utils/getUpdatedOffsetForIndex":65,"../utils/initCellMetadata":66,"./utils/calculateSizeAndPositionDataAndUpdateScrollOffset":52,"./utils/getNearestIndex":53,"./utils/getOverscanIndices":54,"./utils/getVisibleCellIndices":55,"./utils/updateScrollIndexHelper":56,"classnames":undefined,"dom-helpers/util/scrollbarSize":17,"raf":27,"react":undefined,"react-addons-shallow-compare":28}],51:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Grid = exports.default = undefined;

var _Grid2 = require('./Grid');

var _Grid3 = _interopRequireDefault(_Grid2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _Grid3.default;
exports.Grid = _Grid3.default;
},{"./Grid":50}],52:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = calculateSizeAndPositionDataAndUpdateScrollOffset;
/**
 * Helper method that determines when to recalculate row or column metadata.
 *
 * @param cellCount Number of rows or columns in the current axis
 * @param cellsSize Width or height of cells for the current axis
 * @param computeMetadataCallback Method to invoke if cell metadata should be recalculated
 * @param computeMetadataCallbackProps Parameters to pass to :computeMetadataCallback
 * @param computeMetadataOnNextUpdate Flag specifying that metadata should be recalculated
 * @param nextCellsCount Newly updated number of rows or columns in the current axis
 * @param nextCellsSize Newly updated width or height of cells for the current axis
 * @param nextScrollToIndex Newly updated scroll-to-index
 * @param scrollToIndex Scroll-to-index
 * @param updateScrollOffsetForScrollToIndex Callback to invoke if the scroll position should be recalculated
 */
function calculateSizeAndPositionDataAndUpdateScrollOffset(_ref) {
  var cellCount = _ref.cellCount;
  var cellSize = _ref.cellSize;
  var computeMetadataCallback = _ref.computeMetadataCallback;
  var computeMetadataCallbackProps = _ref.computeMetadataCallbackProps;
  var computeMetadataOnNextUpdate = _ref.computeMetadataOnNextUpdate;
  var nextCellsCount = _ref.nextCellsCount;
  var nextCellSize = _ref.nextCellSize;
  var nextScrollToIndex = _ref.nextScrollToIndex;
  var scrollToIndex = _ref.scrollToIndex;
  var updateScrollOffsetForScrollToIndex = _ref.updateScrollOffsetForScrollToIndex;

  // Don't compare cell sizes if they are functions because inline functions would cause infinite loops.
  // In that event users should use the manual recompute methods to inform of changes.
  if (computeMetadataOnNextUpdate || cellCount !== nextCellsCount || (typeof cellSize === 'number' || typeof nextCellSize === 'number') && cellSize !== nextCellSize) {
    computeMetadataCallback(computeMetadataCallbackProps);

    // Updated cell metadata may have hidden the previous scrolled-to item.
    // In this case we should also update the scrollTop to ensure it stays visible.
    if (scrollToIndex >= 0 && scrollToIndex === nextScrollToIndex) {
      updateScrollOffsetForScrollToIndex();
    }
  }
}
},{}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getNearestIndex;
/**
 * Finds the nearest valid index to the one specified if the specified index is invalid.
 * @param cellCount Number of rows or columns in the current axis
 * @param targetIndex Index to use if possible
 */
function getNearestIndex(_ref) {
  var cellCount = _ref.cellCount;
  var targetIndex = _ref.targetIndex;

  return Math.max(0, Math.min(cellCount - 1, targetIndex));
}
},{}],54:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getOverscanIndices;
/**
 * Calculates the number of cells to overscan before and after a specified range.
 * This function ensures that overscanning doesn't exceed the available cells.
 * @param cellCount Number of rows or columns in the current axis
 * @param overscanCellsCount Maximum number of cells to over-render in either direction
 * @param startIndex Begin of range of visible cells
 * @param stopIndex End of range of visible cells
 */
function getOverscanIndices(_ref) {
  var cellCount = _ref.cellCount;
  var overscanCellsCount = _ref.overscanCellsCount;
  var startIndex = _ref.startIndex;
  var stopIndex = _ref.stopIndex;

  return {
    overscanStartIndex: Math.max(0, startIndex - overscanCellsCount),
    overscanStopIndex: Math.min(cellCount - 1, stopIndex + overscanCellsCount)
  };
}
},{}],55:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getVisibleCellIndices;
/**
 * Determines the range of cells to display for a given offset in order to fill the specified container.
 *
 * @param cellMetadata Metadata initially computed by initCellMetadata()
 * @param containerSize Total size (width or height) of the container
 * @param currentOffset Container's current (x or y) offset
 * @return An object containing :start and :stop attributes, each specifying a cell index
 */
function getVisibleCellIndices(_ref) {
  var cellMetadata = _ref.cellMetadata;
  var containerSize = _ref.containerSize;
  var currentOffset = _ref.currentOffset;

  var cellCount = cellMetadata.length;

  if (cellCount === 0) {
    return {};
  }

  // TODO Add better guards here against NaN offset

  var lastDatum = cellMetadata[cellMetadata.length - 1];
  var totalCellSize = lastDatum.offset + lastDatum.size;

  // Ensure offset is within reasonable bounds
  currentOffset = Math.max(0, Math.min(totalCellSize - containerSize, currentOffset));

  var maxOffset = Math.min(totalCellSize, currentOffset + containerSize);

  var start = findNearestCell({
    cellMetadata: cellMetadata,
    mode: EQUAL_OR_LOWER,
    offset: currentOffset
  });

  var datum = cellMetadata[start];
  currentOffset = datum.offset + datum.size;

  var stop = start;

  while (currentOffset < maxOffset && stop < cellCount - 1) {
    stop++;

    currentOffset += cellMetadata[stop].size;
  }

  return {
    start: start,
    stop: stop
  };
}

/**
 * Binary search function inspired by react-infinite.
 */
function findNearestCell(_ref2) {
  var cellMetadata = _ref2.cellMetadata;
  var mode = _ref2.mode;
  var offset = _ref2.offset;

  var high = cellMetadata.length - 1;
  var low = 0;
  var middle = undefined;
  var currentOffset = undefined;

  // TODO Add better guards here against NaN offset

  while (low <= high) {
    middle = low + Math.floor((high - low) / 2);
    currentOffset = cellMetadata[middle].offset;

    if (currentOffset === offset) {
      return middle;
    } else if (currentOffset < offset) {
      low = middle + 1;
    } else if (currentOffset > offset) {
      high = middle - 1;
    }
  }

  if (mode === EQUAL_OR_LOWER && low > 0) {
    return low - 1;
  } else if (mode === EQUAL_OR_HIGHER && high < cellMetadata.length - 1) {
    return high + 1;
  }
}

var EQUAL_OR_LOWER = 1;
var EQUAL_OR_HIGHER = 2;
},{}],56:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = updateScrollIndexHelper;

var _getNearestIndex = require('./getNearestIndex');

var _getNearestIndex2 = _interopRequireDefault(_getNearestIndex);

var _getUpdatedOffsetForIndex = require('../../utils/getUpdatedOffsetForIndex');

var _getUpdatedOffsetForIndex2 = _interopRequireDefault(_getUpdatedOffsetForIndex);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Helper function that determines when to update scroll offsets to ensure that a scroll-to-index remains visible.
 *
 * @param cellMetadata Metadata initially computed by initCellMetadata()
 * @param cellCount Number of rows or columns in the current axis
 * @param cellsSize Width or height of cells for the current axis
 * @param previousCellsCount Previous number of rows or columns
 * @param previousCellsSize Previous width or height of cells
 * @param previousScrollToIndex Previous scroll-to-index
 * @param previousSize Previous width or height of the virtualized container
 * @param scrollOffset Current scrollLeft or scrollTop
 * @param scrollToIndex Scroll-to-index
 * @param size Width or height of the virtualized container
 * @param updateScrollIndexCallback Callback to invoke with an scroll-to-index value
 */
function updateScrollIndexHelper(_ref) {
  var cellMetadata = _ref.cellMetadata;
  var cellCount = _ref.cellCount;
  var cellSize = _ref.cellSize;
  var previousCellsCount = _ref.previousCellsCount;
  var previousCellSize = _ref.previousCellSize;
  var previousScrollToIndex = _ref.previousScrollToIndex;
  var previousSize = _ref.previousSize;
  var scrollOffset = _ref.scrollOffset;
  var scrollToIndex = _ref.scrollToIndex;
  var size = _ref.size;
  var updateScrollIndexCallback = _ref.updateScrollIndexCallback;

  var hasScrollToIndex = scrollToIndex >= 0 && scrollToIndex < cellCount;
  var sizeHasChanged = size !== previousSize || !previousCellSize || typeof cellSize === 'number' && cellSize !== previousCellSize;

  // If we have a new scroll target OR if height/row-height has changed,
  // We should ensure that the scroll target is visible.
  if (hasScrollToIndex && (sizeHasChanged || scrollToIndex !== previousScrollToIndex)) {
    updateScrollIndexCallback(scrollToIndex);

    // If we don't have a selected item but list size or number of children have decreased,
    // Make sure we aren't scrolled too far past the current content.
  } else if (!hasScrollToIndex && cellCount > 0 && (size < previousSize || cellCount < previousCellsCount)) {
      scrollToIndex = (0, _getNearestIndex2.default)({
        cellCount: cellCount,
        targetIndex: cellCount - 1
      });

      if (scrollToIndex < cellCount) {
        var cellMetadatum = cellMetadata[scrollToIndex];
        var calculatedScrollOffset = (0, _getUpdatedOffsetForIndex2.default)({
          cellOffset: cellMetadatum.offset,
          cellSize: cellMetadatum.size,
          containerSize: size,
          currentOffset: scrollOffset
        });

        // Only adjust the scroll position if we've scrolled below the last set of rows.
        if (calculatedScrollOffset < scrollOffset) {
          updateScrollIndexCallback(cellCount - 1);
        }
      }
    }
}
},{"../../utils/getUpdatedOffsetForIndex":65,"./getNearestIndex":53}],57:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.isRangeVisible = isRangeVisible;
exports.scanForUnloadedRanges = scanForUnloadedRanges;

var _react = require('react');

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Higher-order component that manages lazy-loading for "infinite" data.
 * This component decorates a virtual component and just-in-time prefetches rows as a user scrolls.
 * It is intended as a convenience component; fork it if you'd like finer-grained control over data-loading.
 */

var InfiniteLoader = function (_Component) {
  _inherits(InfiniteLoader, _Component);

  function InfiniteLoader(props, context) {
    _classCallCheck(this, InfiniteLoader);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(InfiniteLoader).call(this, props, context));

    _this._onRowsRendered = _this._onRowsRendered.bind(_this);
    _this._registerChild = _this._registerChild.bind(_this);
    return _this;
  }

  _createClass(InfiniteLoader, [{
    key: 'render',
    value: function render() {
      var children = this.props.children;


      return children({
        onRowsRendered: this._onRowsRendered,
        registerChild: this._registerChild
      });
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_onRowsRendered',
    value: function _onRowsRendered(_ref) {
      var _this2 = this;

      var startIndex = _ref.startIndex;
      var stopIndex = _ref.stopIndex;
      var _props = this.props;
      var isRowLoaded = _props.isRowLoaded;
      var loadMoreRows = _props.loadMoreRows;
      var minimumBatchSize = _props.minimumBatchSize;
      var rowsCount = _props.rowsCount;
      var threshold = _props.threshold;


      this._lastRenderedStartIndex = startIndex;
      this._lastRenderedStopIndex = stopIndex;

      var unloadedRanges = scanForUnloadedRanges({
        isRowLoaded: isRowLoaded,
        minimumBatchSize: minimumBatchSize,
        rowsCount: rowsCount,
        startIndex: Math.max(0, startIndex - threshold),
        stopIndex: Math.min(rowsCount - 1, stopIndex + threshold)
      });

      unloadedRanges.forEach(function (unloadedRange) {
        var promise = loadMoreRows(unloadedRange);
        if (promise) {
          promise.then(function () {
            // Refresh the visible rows if any of them have just been loaded.
            // Otherwise they will remain in their unloaded visual state.
            if (isRangeVisible({
              lastRenderedStartIndex: _this2._lastRenderedStartIndex,
              lastRenderedStopIndex: _this2._lastRenderedStopIndex,
              startIndex: unloadedRange.startIndex,
              stopIndex: unloadedRange.stopIndex
            })) {
              if (_this2._registeredChild) {
                _this2._registeredChild.forceUpdate();
              }
            }
          });
        }
      });
    }
  }, {
    key: '_registerChild',
    value: function _registerChild(registeredChild) {
      this._registeredChild = registeredChild;
    }
  }]);

  return InfiniteLoader;
}(_react.Component);

/**
 * Determines if the specified start/stop range is visible based on the most recently rendered range.
 */


InfiniteLoader.propTypes = {
  /**
   * Function respondible for rendering a virtualized component.
   * This function should implement the following signature:
   * ({ onRowsRendered, registerChild }) => PropTypes.element
   *
   * The specified :onRowsRendered function should be passed through to the child's :onRowsRendered property.
   * The :registerChild callback should be set as the virtualized component's :ref.
   */
  children: _react.PropTypes.func.isRequired,

  /**
   * Function responsible for tracking the loaded state of each row.
   * It should implement the following signature: (index: number): boolean
   */
  isRowLoaded: _react.PropTypes.func.isRequired,

  /**
   * Callback to be invoked when more rows must be loaded.
   * It should implement the following signature: ({ startIndex, stopIndex }): Promise
   * The returned Promise should be resolved once row data has finished loading.
   * It will be used to determine when to refresh the list with the newly-loaded data.
   * This callback may be called multiple times in reaction to a single scroll event.
   */
  loadMoreRows: _react.PropTypes.func.isRequired,

  /**
   * Minimum number of rows to be loaded at a time.
   * This property can be used to batch requests to reduce HTTP requests.
   */
  minimumBatchSize: _react.PropTypes.number.isRequired,

  /**
   * Number of rows in list; can be arbitrary high number if actual number is unknown.
   */
  rowsCount: _react.PropTypes.number.isRequired,

  /**
   * Threshold at which to pre-fetch data.
   * A threshold X means that data will start loading when a user scrolls within X rows.
   * This value defaults to 15.
   */
  threshold: _react.PropTypes.number.isRequired
};
InfiniteLoader.defaultProps = {
  minimumBatchSize: 10,
  rowsCount: 0,
  threshold: 15
};
exports.default = InfiniteLoader;
function isRangeVisible(_ref2) {
  var lastRenderedStartIndex = _ref2.lastRenderedStartIndex;
  var lastRenderedStopIndex = _ref2.lastRenderedStopIndex;
  var startIndex = _ref2.startIndex;
  var stopIndex = _ref2.stopIndex;

  return !(startIndex > lastRenderedStopIndex || stopIndex < lastRenderedStartIndex);
}

/**
 * Returns all of the ranges within a larger range that contain unloaded rows.
 */
function scanForUnloadedRanges(_ref3) {
  var isRowLoaded = _ref3.isRowLoaded;
  var minimumBatchSize = _ref3.minimumBatchSize;
  var rowsCount = _ref3.rowsCount;
  var startIndex = _ref3.startIndex;
  var stopIndex = _ref3.stopIndex;

  var unloadedRanges = [];

  var rangeStartIndex = null;
  var rangeStopIndex = null;

  for (var i = startIndex; i <= stopIndex; i++) {
    var loaded = isRowLoaded(i);

    if (!loaded) {
      rangeStopIndex = i;
      if (rangeStartIndex === null) {
        rangeStartIndex = i;
      }
    } else if (rangeStopIndex !== null) {
      unloadedRanges.push({
        startIndex: rangeStartIndex,
        stopIndex: rangeStopIndex
      });

      rangeStartIndex = rangeStopIndex = null;
    }
  }

  if (rangeStopIndex !== null) {
    // Attempt to satisfy :minimumBatchSize requirement but don't exceed :rowsCount
    var potentialStopIndex = Math.min(Math.max(rangeStopIndex, rangeStartIndex + minimumBatchSize - 1), rowsCount - 1);

    for (var i = rangeStopIndex + 1; i <= potentialStopIndex; i++) {
      if (!isRowLoaded(i)) {
        rangeStopIndex = i;
      } else {
        break;
      }
    }

    unloadedRanges.push({
      startIndex: rangeStartIndex,
      stopIndex: rangeStopIndex
    });
  }

  return unloadedRanges;
}
},{"react":undefined,"react-addons-shallow-compare":28}],58:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InfiniteLoader = exports.default = undefined;

var _InfiniteLoader2 = require('./InfiniteLoader');

var _InfiniteLoader3 = _interopRequireDefault(_InfiniteLoader2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _InfiniteLoader3.default;
exports.InfiniteLoader = _InfiniteLoader3.default;
},{"./InfiniteLoader":57}],59:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * HOC that simplifies the process of synchronizing scrolling between two or more virtualized components.
 */

var ScrollSync = function (_Component) {
  _inherits(ScrollSync, _Component);

  function ScrollSync(props, context) {
    _classCallCheck(this, ScrollSync);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ScrollSync).call(this, props, context));

    _this.state = {
      clientHeight: 0,
      clientWidth: 0,
      scrollHeight: 0,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 0
    };

    _this._onScroll = _this._onScroll.bind(_this);
    return _this;
  }

  _createClass(ScrollSync, [{
    key: 'render',
    value: function render() {
      var children = this.props.children;
      var _state = this.state;
      var clientHeight = _state.clientHeight;
      var clientWidth = _state.clientWidth;
      var scrollHeight = _state.scrollHeight;
      var scrollLeft = _state.scrollLeft;
      var scrollTop = _state.scrollTop;
      var scrollWidth = _state.scrollWidth;


      return children({
        clientHeight: clientHeight,
        clientWidth: clientWidth,
        onScroll: this._onScroll,
        scrollHeight: scrollHeight,
        scrollLeft: scrollLeft,
        scrollTop: scrollTop,
        scrollWidth: scrollWidth
      });
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }, {
    key: '_onScroll',
    value: function _onScroll(_ref) {
      var clientHeight = _ref.clientHeight;
      var clientWidth = _ref.clientWidth;
      var scrollHeight = _ref.scrollHeight;
      var scrollLeft = _ref.scrollLeft;
      var scrollTop = _ref.scrollTop;
      var scrollWidth = _ref.scrollWidth;

      this.setState({ clientHeight: clientHeight, clientWidth: clientWidth, scrollHeight: scrollHeight, scrollLeft: scrollLeft, scrollTop: scrollTop, scrollWidth: scrollWidth });
    }
  }]);

  return ScrollSync;
}(_react.Component);

ScrollSync.propTypes = {
  /**
   * Function respondible for rendering 2 or more virtualized components.
   * This function should implement the following signature:
   * ({ onScroll, scrollLeft, scrollTop }) => PropTypes.element
   */
  children: _react.PropTypes.func.isRequired
};
exports.default = ScrollSync;
},{"react":undefined,"react-addons-shallow-compare":28}],60:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ScrollSync = exports.default = undefined;

var _ScrollSync2 = require('./ScrollSync');

var _ScrollSync3 = _interopRequireDefault(_ScrollSync2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _ScrollSync3.default;
exports.ScrollSync = _ScrollSync3.default;
},{"./ScrollSync":59}],61:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Grid = require('../Grid');

var _Grid2 = _interopRequireDefault(_Grid);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _reactAddonsShallowCompare = require('react-addons-shallow-compare');

var _reactAddonsShallowCompare2 = _interopRequireDefault(_reactAddonsShallowCompare);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * It is inefficient to create and manage a large list of DOM elements within a scrolling container
 * if only a few of those elements are visible. The primary purpose of this component is to improve
 * performance by only rendering the DOM nodes that a user is able to see based on their current
 * scroll position.
 *
 * This component renders a virtualized list of elements with either fixed or dynamic heights.
 */

var VirtualScroll = function (_Component) {
  _inherits(VirtualScroll, _Component);

  function VirtualScroll() {
    _classCallCheck(this, VirtualScroll);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(VirtualScroll).apply(this, arguments));
  }

  _createClass(VirtualScroll, [{
    key: 'recomputeRowHeights',


    /**
     * See Grid#recomputeGridSize
     */
    value: function recomputeRowHeights() {
      this.refs.Grid.recomputeGridSize();
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props;
      var className = _props.className;
      var height = _props.height;
      var noRowsRenderer = _props.noRowsRenderer;
      var onRowsRendered = _props.onRowsRendered;
      var _onScroll = _props.onScroll;
      var rowHeight = _props.rowHeight;
      var rowRenderer = _props.rowRenderer;
      var overscanRowsCount = _props.overscanRowsCount;
      var rowsCount = _props.rowsCount;
      var scrollToIndex = _props.scrollToIndex;
      var scrollTop = _props.scrollTop;
      var width = _props.width;


      var classNames = (0, _classnames2.default)('VirtualScroll', className);

      return _react2.default.createElement(_Grid2.default, {
        ref: 'Grid',
        'aria-label': this.props['aria-label'],
        className: classNames,
        columnWidth: width,
        columnsCount: 1,
        height: height,
        noContentRenderer: noRowsRenderer,
        onScroll: function onScroll(_ref) {
          var clientHeight = _ref.clientHeight;
          var scrollHeight = _ref.scrollHeight;
          var scrollTop = _ref.scrollTop;
          return _onScroll({ clientHeight: clientHeight, scrollHeight: scrollHeight, scrollTop: scrollTop });
        },
        onSectionRendered: function onSectionRendered(_ref2) {
          var rowOverscanStartIndex = _ref2.rowOverscanStartIndex;
          var rowOverscanStopIndex = _ref2.rowOverscanStopIndex;
          var rowStartIndex = _ref2.rowStartIndex;
          var rowStopIndex = _ref2.rowStopIndex;
          return onRowsRendered({
            overscanStartIndex: rowOverscanStartIndex,
            overscanStopIndex: rowOverscanStopIndex,
            startIndex: rowStartIndex,
            stopIndex: rowStopIndex
          });
        },
        overscanRowsCount: overscanRowsCount,
        renderCell: function renderCell(_ref3) {
          var columnIndex = _ref3.columnIndex;
          var rowIndex = _ref3.rowIndex;
          return rowRenderer(rowIndex);
        },
        rowHeight: rowHeight,
        rowsCount: rowsCount,
        scrollToRow: scrollToIndex,
        scrollTop: scrollTop,
        width: width
      });
    }
  }, {
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _reactAddonsShallowCompare2.default)(this, nextProps, nextState);
    }
  }]);

  return VirtualScroll;
}(_react.Component);

VirtualScroll.propTypes = {
  'aria-label': _react.PropTypes.string,

  /** Optional CSS class name */
  className: _react.PropTypes.string,

  /** Height constraint for list (determines how many actual rows are rendered) */
  height: _react.PropTypes.number.isRequired,

  /** Optional renderer to be used in place of rows when rowsCount is 0 */
  noRowsRenderer: _react.PropTypes.func.isRequired,

  /**
   * Callback invoked with information about the slice of rows that were just rendered.
   * ({ startIndex, stopIndex }): void
   */
  onRowsRendered: _react.PropTypes.func.isRequired,

  /**
   * Number of rows to render above/below the visible bounds of the list.
   * These rows can help for smoother scrolling on touch devices.
   */
  overscanRowsCount: _react.PropTypes.number.isRequired,

  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, scrollHeight, scrollTop }): void
   */
  onScroll: _react.PropTypes.func.isRequired,

  /**
   * Either a fixed row height (number) or a function that returns the height of a row given its index.
   * (index: number): number
   */
  rowHeight: _react.PropTypes.oneOfType([_react.PropTypes.number, _react.PropTypes.func]).isRequired,

  /** Responsbile for rendering a row given an index */
  rowRenderer: _react.PropTypes.func.isRequired,

  /** Number of rows in list. */
  rowsCount: _react.PropTypes.number.isRequired,

  /** Row index to ensure visible (by forcefully scrolling if necessary) */
  scrollToIndex: _react.PropTypes.number,

  /** Vertical offset. */
  scrollTop: _react.PropTypes.number,

  /** Width of list */
  width: _react.PropTypes.number.isRequired
};
VirtualScroll.defaultProps = {
  noRowsRenderer: function noRowsRenderer() {
    return null;
  },
  onRowsRendered: function onRowsRendered() {
    return null;
  },
  onScroll: function onScroll() {
    return null;
  },
  overscanRowsCount: 10
};
exports.default = VirtualScroll;
},{"../Grid":51,"classnames":undefined,"react":undefined,"react-addons-shallow-compare":28}],62:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VirtualScroll = exports.default = undefined;

var _VirtualScroll2 = require('./VirtualScroll');

var _VirtualScroll3 = _interopRequireDefault(_VirtualScroll2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _VirtualScroll3.default;
exports.VirtualScroll = _VirtualScroll3.default;
},{"./VirtualScroll":61}],63:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ArrowKeyStepper = require('./ArrowKeyStepper');

Object.defineProperty(exports, 'ArrowKeyStepper', {
  enumerable: true,
  get: function get() {
    return _ArrowKeyStepper.ArrowKeyStepper;
  }
});

var _AutoSizer = require('./AutoSizer');

Object.defineProperty(exports, 'AutoSizer', {
  enumerable: true,
  get: function get() {
    return _AutoSizer.AutoSizer;
  }
});

var _Collection = require('./Collection');

Object.defineProperty(exports, 'Collection', {
  enumerable: true,
  get: function get() {
    return _Collection.Collection;
  }
});

var _ColumnSizer = require('./ColumnSizer');

Object.defineProperty(exports, 'ColumnSizer', {
  enumerable: true,
  get: function get() {
    return _ColumnSizer.ColumnSizer;
  }
});

var _FlexTable = require('./FlexTable');

Object.defineProperty(exports, 'FlexTable', {
  enumerable: true,
  get: function get() {
    return _FlexTable.FlexTable;
  }
});
Object.defineProperty(exports, 'FlexColumn', {
  enumerable: true,
  get: function get() {
    return _FlexTable.FlexColumn;
  }
});
Object.defineProperty(exports, 'SortDirection', {
  enumerable: true,
  get: function get() {
    return _FlexTable.SortDirection;
  }
});
Object.defineProperty(exports, 'SortIndicator', {
  enumerable: true,
  get: function get() {
    return _FlexTable.SortIndicator;
  }
});

var _Grid = require('./Grid');

Object.defineProperty(exports, 'Grid', {
  enumerable: true,
  get: function get() {
    return _Grid.Grid;
  }
});

var _InfiniteLoader = require('./InfiniteLoader');

Object.defineProperty(exports, 'InfiniteLoader', {
  enumerable: true,
  get: function get() {
    return _InfiniteLoader.InfiniteLoader;
  }
});

var _ScrollSync = require('./ScrollSync');

Object.defineProperty(exports, 'ScrollSync', {
  enumerable: true,
  get: function get() {
    return _ScrollSync.ScrollSync;
  }
});

var _VirtualScroll = require('./VirtualScroll');

Object.defineProperty(exports, 'VirtualScroll', {
  enumerable: true,
  get: function get() {
    return _VirtualScroll.VirtualScroll;
  }
});
},{"./ArrowKeyStepper":34,"./AutoSizer":36,"./Collection":41,"./ColumnSizer":44,"./FlexTable":49,"./Grid":51,"./InfiniteLoader":58,"./ScrollSync":60,"./VirtualScroll":62}],64:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createCallbackMemoizer;
/**
 * Helper utility that updates the specified callback whenever any of the specified indices have changed.
 */
function createCallbackMemoizer() {
  var requireAllKeys = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

  var cachedIndices = {};

  return function (_ref) {
    var callback = _ref.callback;
    var indices = _ref.indices;

    var keys = Object.keys(indices);
    var allInitialized = !requireAllKeys || keys.every(function (key) {
      return indices[key] >= 0;
    });
    var indexChanged = keys.length !== Object.keys(cachedIndices).length || keys.some(function (key) {
      return cachedIndices[key] !== indices[key];
    });

    cachedIndices = indices;

    if (allInitialized && indexChanged) {
      callback(indices);
    }
  };
}
},{}],65:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getUpdatedOffsetForIndex;
/**
 * Determines a new offset that ensures a certain cell is visible, given the current offset.
 * If the cell is already visible then the current offset will be returned.
 * If the current offset is too great or small, it will be adjusted just enough to ensure the specified index is visible.
 *
 * @param cellOffset Offset (x or y) position for cell
 * @param cellSize Size (width or height) of cell
 * @param containerSize Total size (width or height) of the container
 * @param currentOffset Container's current (x or y) offset
 * @return Offset to use to ensure the specified cell is visible
 */
function getUpdatedOffsetForIndex(_ref) {
  var cellOffset = _ref.cellOffset;
  var cellSize = _ref.cellSize;
  var containerSize = _ref.containerSize;
  var currentOffset = _ref.currentOffset;

  var maxOffset = cellOffset;
  var minOffset = maxOffset - containerSize + cellSize;
  var newOffset = Math.max(minOffset, Math.min(maxOffset, currentOffset));

  return newOffset;
}
},{}],66:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = initCellMetadata;
/**
 * Initializes metadata for an axis and its cells.
 * This data is used to determine which cells are visible given a container size and scroll position.
 *
 * @param cellCount Total number of cells.
 * @param size Either a fixed size or a function that returns the size for a given given an index.
 * @return Object mapping cell index to cell metadata (size, offset)
 */
function initCellMetadata(_ref) {
  var cellCount = _ref.cellCount;
  var size = _ref.size;

  var sizeGetter = size instanceof Function ? size : function (index) {
    return size;
  };

  var cellMetadata = [];
  var offset = 0;

  for (var i = 0; i < cellCount; i++) {
    var _size = sizeGetter(i);

    if (_size == null || isNaN(_size)) {
      throw Error("Invalid size returned for cell " + i + " of value " + _size);
    }

    cellMetadata[i] = {
      size: _size,
      offset: offset
    };

    offset += _size;
  }

  return cellMetadata;
}
},{}],67:[function(require,module,exports){
'use strict';

/**
* Detect Element Resize.
* Forked in order to guard against unsafe 'window' and 'document' references.
*
* https://github.com/sdecima/javascript-detect-element-resize
* Sebastian Decima
*
* version: 0.5.3
**/

// Check `document` and `window` in case of server-side rendering
var _window;
if (typeof window !== 'undefined') {
  _window = window;
} else if (typeof self !== 'undefined') {
  _window = self;
} else {
  _window = undefined;
}

var attachEvent = typeof document !== 'undefined' && document.attachEvent;
var stylesCreated = false;

if (!attachEvent) {
  var requestFrame = function () {
    var raf = _window.requestAnimationFrame || _window.mozRequestAnimationFrame || _window.webkitRequestAnimationFrame || function (fn) {
      return _window.setTimeout(fn, 20);
    };
    return function (fn) {
      return raf(fn);
    };
  }();

  var cancelFrame = function () {
    var cancel = _window.cancelAnimationFrame || _window.mozCancelAnimationFrame || _window.webkitCancelAnimationFrame || _window.clearTimeout;
    return function (id) {
      return cancel(id);
    };
  }();

  var resetTriggers = function resetTriggers(element) {
    var triggers = element.__resizeTriggers__,
        expand = triggers.firstElementChild,
        contract = triggers.lastElementChild,
        expandChild = expand.firstElementChild;
    contract.scrollLeft = contract.scrollWidth;
    contract.scrollTop = contract.scrollHeight;
    expandChild.style.width = expand.offsetWidth + 1 + 'px';
    expandChild.style.height = expand.offsetHeight + 1 + 'px';
    expand.scrollLeft = expand.scrollWidth;
    expand.scrollTop = expand.scrollHeight;
  };

  var checkTriggers = function checkTriggers(element) {
    return element.offsetWidth != element.__resizeLast__.width || element.offsetHeight != element.__resizeLast__.height;
  };

  var scrollListener = function scrollListener(e) {
    var element = this;
    resetTriggers(this);
    if (this.__resizeRAF__) cancelFrame(this.__resizeRAF__);
    this.__resizeRAF__ = requestFrame(function () {
      if (checkTriggers(element)) {
        element.__resizeLast__.width = element.offsetWidth;
        element.__resizeLast__.height = element.offsetHeight;
        element.__resizeListeners__.forEach(function (fn) {
          fn.call(element, e);
        });
      }
    });
  };

  /* Detect CSS Animations support to detect element display/re-attach */
  var animation = false,
      animationstring = 'animation',
      keyframeprefix = '',
      animationstartevent = 'animationstart',
      domPrefixes = 'Webkit Moz O ms'.split(' '),
      startEvents = 'webkitAnimationStart animationstart oAnimationStart MSAnimationStart'.split(' '),
      pfx = '';
  {
    var elm = document.createElement('fakeelement');
    if (elm.style.animationName !== undefined) {
      animation = true;
    }

    if (animation === false) {
      for (var i = 0; i < domPrefixes.length; i++) {
        if (elm.style[domPrefixes[i] + 'AnimationName'] !== undefined) {
          pfx = domPrefixes[i];
          animationstring = pfx + 'Animation';
          keyframeprefix = '-' + pfx.toLowerCase() + '-';
          animationstartevent = startEvents[i];
          animation = true;
          break;
        }
      }
    }
  }

  var animationName = 'resizeanim';
  var animationKeyframes = '@' + keyframeprefix + 'keyframes ' + animationName + ' { from { opacity: 0; } to { opacity: 0; } } ';
  var animationStyle = keyframeprefix + 'animation: 1ms ' + animationName + '; ';
}

var createStyles = function createStyles() {
  if (!stylesCreated) {
    //opacity:0 works around a chrome bug https://code.google.com/p/chromium/issues/detail?id=286360
    var css = (animationKeyframes ? animationKeyframes : '') + '.resize-triggers { ' + (animationStyle ? animationStyle : '') + 'visibility: hidden; opacity: 0; } ' + '.resize-triggers, .resize-triggers > div, .contract-trigger:before { content: \" \"; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }',
        head = document.head || document.getElementsByTagName('head')[0],
        style = document.createElement('style');

    style.type = 'text/css';
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
    stylesCreated = true;
  }
};

var addResizeListener = function addResizeListener(element, fn) {
  if (attachEvent) element.attachEvent('onresize', fn);else {
    if (!element.__resizeTriggers__) {
      if (getComputedStyle(element).position == 'static') element.style.position = 'relative';
      createStyles();
      element.__resizeLast__ = {};
      element.__resizeListeners__ = [];
      (element.__resizeTriggers__ = document.createElement('div')).className = 'resize-triggers';
      element.__resizeTriggers__.innerHTML = '<div class="expand-trigger"><div></div></div>' + '<div class="contract-trigger"></div>';
      element.appendChild(element.__resizeTriggers__);
      resetTriggers(element);
      element.addEventListener('scroll', scrollListener, true);

      /* Listen for a css animation to detect element display/re-attach */
      animationstartevent && element.__resizeTriggers__.addEventListener(animationstartevent, function (e) {
        if (e.animationName == animationName) resetTriggers(element);
      });
    }
    element.__resizeListeners__.push(fn);
  }
};

var removeResizeListener = function removeResizeListener(element, fn) {
  if (attachEvent) element.detachEvent('onresize', fn);else {
    element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
    if (!element.__resizeListeners__.length) {
      element.removeEventListener('scroll', scrollListener);
      element.__resizeTriggers__ = !element.removeChild(element.__resizeTriggers__);
    }
  }
};

module.exports = {
  addResizeListener: addResizeListener,
  removeResizeListener: removeResizeListener
};
},{}],68:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
* @providesModule shallowCompare
*/

'use strict';

var shallowEqual = require('fbjs/lib/shallowEqual');

/**
 * Does a shallow comparison for props and state.
 * See ReactComponentWithPureRenderMixin
 * See also https://facebook.github.io/react/docs/shallow-compare.html
 */
function shallowCompare(instance, nextProps, nextState) {
  return !shallowEqual(instance.props, nextProps) || !shallowEqual(instance.state, nextState);
}

module.exports = shallowCompare;
},{"fbjs/lib/shallowEqual":18}],69:[function(require,module,exports){
'use strict';
module.exports = function (str) {
	return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
		return '%' + c.charCodeAt(0).toString(16).toUpperCase();
	});
};

},{}],70:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}]},{},[1]);
