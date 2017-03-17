'use strict';
/* global describe, it, beforeEach */
/* eslint react/jsx-boolean-value: 0 */

var jsdomHelper = require('../testHelpers/jsdomHelper');

var sinon = require('sinon');
var unexpected = require('unexpected');
var unexpectedDom = require('unexpected-dom');
var unexpectedSinon = require('unexpected-sinon');
var unexpectedReact = require('unexpected-react');
var expect = unexpected
	.clone()
	.installPlugin(unexpectedDom)
	.installPlugin(unexpectedSinon)
	.installPlugin(unexpectedReact)
	.installPlugin(require('../testHelpers/nodeListType'));

jsdomHelper();

var React = require('react');
var ReactDOM = require('react-dom');
var TestUtils = require('react-addons-test-utils');

var Select = require('../src/Select');
var Value = require('../src/Value');

// The displayed text of the currently selected item, when items collapsed
var DISPLAYED_SELECTION_SELECTOR = '.Select-value';
var FORM_VALUE_SELECTOR = '.Select > input';
var PLACEHOLDER_SELECTOR = '.Select-placeholder';

var ARROW_UP = { keyCode: 38, key: 'ArrowUp' };
var ARROW_DOWN = { keyCode: 40, key: 'ArrowDown' };
var KEY_ENTER = { keyCode: 13, key: 'Enter' };

class PropsWrapper extends React.Component {

	constructor(props) {
		super(props);
		this.state = props || {};
	}

	setPropsForChild(props) {
		this.setState(props);
	}

	getChild() {
		return this.child;
	}

	render() {
		var Component = this.props.childComponent; // eslint-disable-line react/prop-types
		return <Component {...this.state} ref={(ref) => this.child = ref} />;
	}
}

describe('Select', () => {
	var options, onChange, onInputChange;
	var instance, wrapper;
	var searchInputNode;

	var getSelectControl = (instance) => {
		return ReactDOM.findDOMNode(instance).querySelector('.Select-control');
	};

	var enterSingleCharacter = ()  =>{
		TestUtils.Simulate.keyDown(searchInputNode, { keyCode: 65, key: 'a' });
	};

	var pressEnterToAccept = () => {
		TestUtils.Simulate.keyDown(searchInputNode, { keyCode: 13, key: 'Enter' });
	};

	var pressTabToAccept = () => {
		TestUtils.Simulate.keyDown(searchInputNode, { keyCode: 9, key: 'Tab' });
	};

	var pressEscape = () => {
		TestUtils.Simulate.keyDown(searchInputNode, { keyCode: 27, key: 'Escape' });
	};

	var pressBackspace = () => {
		TestUtils.Simulate.keyDown(searchInputNode, { keyCode: 8, key: 'Backspace' });
	};

	var pressUp = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 38, key: 'ArrowUp' });
	};

	var pressDown = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
	};

	var pressPageUp = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 33, key: 'PageUp' });
	};

	var pressPageDown = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 34, key: 'PageDown' });
	};

	var pressEndDown = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 35, key: 'End' });
	};

	var pressHomeDown = () => {
		TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 36, key: 'Home' });
	};

	var typeSearchText = (text) => {
		TestUtils.Simulate.change(searchInputNode, { target: { value: text } });
	};

	var clickArrowToOpen = () => {
		var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
		TestUtils.Simulate.mouseDown(selectArrow, { button: 0 });
	};

	var findAndFocusInputControl = () => {
		// Focus on the input, such that mouse events are accepted
		var searchInstance = ReactDOM.findDOMNode(instance.input);
		searchInputNode = null;
		if (searchInstance) {
			searchInputNode = searchInstance.querySelector('input');
			if (searchInputNode) {
				TestUtils.Simulate.focus(searchInputNode);
			}
		}
	};

	var createControl = (props, options) => {

		options = options || {};

		onChange = sinon.spy();
		onInputChange = sinon.spy();
		// Render an instance of the component
		instance = TestUtils.renderIntoDocument(
			<Select
				onChange={onChange}
				onInputChange={onInputChange}
				{...props}
				/>
		);
		if (options.initialFocus !== false) {
			findAndFocusInputControl();
		}
		return instance;

	};

	var setValueProp = value => wrapper.setPropsForChild({ value });

	var createControlWithWrapper = (props, options) => {

		options = options || {};

		if (options.wireUpOnChangeToValue) {
			onChange = sinon.spy(setValueProp);
		} else {
			onChange = sinon.spy();
		}

		onInputChange = sinon.spy();

		wrapper = TestUtils.renderIntoDocument(
			<PropsWrapper
				childComponent={Select}
				onChange={onChange}
				onInputChange={onInputChange}
				{...props}
				/>
		);

		instance = wrapper.getChild();

		if (options.initialFocus !== false) {
			findAndFocusInputControl();
		}

		return wrapper;
	};

	var defaultOptions = [
		{ value: 'one', label: 'One' },
		{ value: 'two', label: '222' },
		{ value: 'three', label: 'Three' },
		{ value: 'four', label: 'AbcDef' }
	];

	var longerListOptions = [
		{ value: 'one', label: 'One' },
		{ value: 'two', label: 'Two' },
		{ value: 'three', label: 'Three' },
		{ value: 'four', label: 'Four' },
		{ value: 'five', label: 'Five' },
		{ value: 'six', label: 'Six' },
		{ value: 'seven', label: 'Seven' },
		{ value: 'eight', label: 'Eight' },
		{ value: 'nine', label: 'Nine' },
		{ value: 'ten', label: 'ten' }
	];

	describe('has refs', () => {
		beforeEach(() => {
			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'three', label: 'Three' }
			];

			instance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: options,
				simpleValue: true,
				joinValues: true,
			});
		});

		it('input', () => {
			expect(instance.input, 'not to equal', undefined);
		});

		it('value', () => {
			typeSearchText('o');
			expect(instance.value, 'not to equal', undefined);
		});

		it('menuContainer', () => {
			clickArrowToOpen();
			expect(instance.menuContainer, 'not to equal', undefined);
		});

		it('menu', () => {
			clickArrowToOpen();
			expect(instance.menu, 'not to equal', undefined);
		});

		it('wrapper', () => {
			expect(instance.wrapper, 'not to equal', undefined);
		});

		it('control', () => {
			expect(instance.control, 'not to equal', undefined);
		});
	});

	describe('with simple options', () => {
		beforeEach(() => {
			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'three', label: 'Three' }
			];

			instance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: options,
				simpleValue: true,
			});
		});

		it('should assign the given name', () => {
			var selectInputElement = TestUtils.scryRenderedDOMComponentsWithTag(instance, 'input')[0];
			expect(ReactDOM.findDOMNode(selectInputElement).name, 'to equal', 'form-field-name');
		});

		it('should show the options on mouse click', function () {
			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-control'), { button: 0 });
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option', 'to have length', 3);
		});

		it('should display the labels on mouse click', () => {
			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-control'), { button: 0 });
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option:nth-child(1)', 'to have items satisfying', 'to have text', 'One');
			expect(node, 'queried for', '.Select-option:nth-child(2)', 'to have items satisfying', 'to have text', 'Two');
			expect(node, 'queried for', '.Select-option:nth-child(3)', 'to have items satisfying', 'to have text', 'Three');
		});

		it('should filter after entering some text', () => {
			typeSearchText('T');
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option:nth-child(1)', 'to have items satisfying', 'to have text', 'Two');
			expect(node, 'queried for', '.Select-option:nth-child(2)', 'to have items satisfying', 'to have text', 'Three');
			expect(node, 'queried for', '.Select-option', 'to have length', 2);
		});

		it('should pass input value when entering text', () => {
			typeSearchText('a');
			enterSingleCharacter('a');
			expect(onInputChange, 'was called with', 'a');
		});

		it('should filter case insensitively', () => {
			typeSearchText('t');
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option:nth-child(1)', 'to have items satisfying', 'to have text', 'Two');
			expect(node, 'queried for', '.Select-option:nth-child(2)', 'to have items satisfying', 'to have text', 'Three');
			expect(node, 'queried for', '.Select-option', 'to have length', 2);
		});

		it('should filter using "contains"', () => {
			// Search 'h', should only show 'Three'
			typeSearchText('h');
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option:nth-child(1)', 'to have items satisfying', 'to have text', 'Three');
			expect(node, 'queried for', '.Select-option', 'to have length', 1);
		});

		it('should accept when enter is pressed', () => {
			// Search 'h', should only show 'Three'
			typeSearchText('h');
			pressEnterToAccept();
			expect(onChange, 'was called with', 'three');
		});

		it('should accept when tab is pressed', () => {
			// Search 'h', should only show 'Three'
			typeSearchText('h');
			pressTabToAccept();
			expect(onChange, 'was called with', 'three');
		});

		describe('pressing escape', () => {
			beforeEach(() => {
				typeSearchText('h');
				pressTabToAccept();
				expect(onChange, 'was called with', 'three');
				onChange.reset();
				pressEscape();
			});

			it('should call onChange with a empty value', () => {
				expect(onChange, 'was called with', null);
			});

		});

		it('should display the options menu when tapped', function() {
			TestUtils.Simulate.touchStart(getSelectControl(instance));
			TestUtils.Simulate.touchEnd(getSelectControl(instance));
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', '.Select-option', 'to have length', 3);
		});

		it('should not display the options menu when touched and dragged', function() {
			TestUtils.Simulate.touchStart(getSelectControl(instance));
			TestUtils.Simulate.touchMove(getSelectControl(instance));
			TestUtils.Simulate.touchEnd(getSelectControl(instance));
			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'to contain no elements matching', '.Select-option');
		});

		it('should focus the first value on mouse click', () => {
			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-control'), { button: 0 });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should move the focused value to the second value when down pressed', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Two');
		});

		it('should move the focused value to the second value when down pressed', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Three');
		});

		it('should loop round to top item when down is pressed on the last item', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should loop round to bottom item when up is pressed on the first item', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 38, key: 'ArrowUp' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Three');
		});

		it('should move the focused value to the second item when up pressed twice', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 38, key: 'ArrowUp' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 38, key: 'ArrowUp' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Two');
		});

		it('should move the focused value to the end when pressing end', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 35, key: 'End' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Three');
		});

		it('should move the focused value to the beginning when pressing home', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl);
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 35, key: 'End' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 36, key: 'Home' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should move the focused value to the end if page down is pressed and number of items is less than page size', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 34, key: 'PageDown' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Three');
		});

		it('should move the focused value down by page size on page down using default page size', () => {

			var longerListInstance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: longerListOptions,
				simpleValue: true,
			});

			var selectControl = getSelectControl(longerListInstance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 34, key: 'PageDown' });
			expect(ReactDOM.findDOMNode(longerListInstance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Six');
		});

		it('should move the focused value down by page size on page down using custom page size', () => {

			var longerListInstance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: longerListOptions,
				simpleValue: true,
				pageSize: 7
			});

			var selectControl = getSelectControl(longerListInstance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 34, key: 'PageDown' });
			expect(ReactDOM.findDOMNode(longerListInstance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Eight');
		});

		it('should move the focused value to the start if page up is pressed and number of items is less than page size', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 34, key: 'PageDown' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 33, key: 'PageUp' });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should move the focused value up by page size on page up using default page size', () => {

			var longerListInstance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: longerListOptions,
				simpleValue: true,
			});

			var selectControl = getSelectControl(longerListInstance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 35, key: 'End' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 33, key: 'PageUp' });
			expect(ReactDOM.findDOMNode(longerListInstance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Five');
		});

		it('should move the focused value up by page size on page up using custom page size', () => {

			var longerListInstance = createControl({
				name: 'form-field-name',
				value: 'one',
				options: longerListOptions,
				simpleValue: true,
				pageSize: 7
			});

			var selectControl = getSelectControl(longerListInstance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 35, key: 'End' });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 33, key: 'PageUp' });
			expect(ReactDOM.findDOMNode(longerListInstance), 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'Three');
		});


		it('should clear the selection on escape', () => {
			var selectControl = getSelectControl(instance);
			TestUtils.Simulate.mouseDown(selectControl, { button: 0 });
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 27, key: 'Escape' });
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');

		});

		it('should open the options on arrow down with the top option focused, when the options are closed', () => {

			var selectControl = getSelectControl(instance);
			var domNode = ReactDOM.findDOMNode(instance);
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 38, key: 'ArrowDown' });
			expect(domNode, 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should open the options on arrow up with the top option focused, when the options are closed', () => {
			var selectControl = getSelectControl(instance);
			var domNode = ReactDOM.findDOMNode(instance);
			TestUtils.Simulate.keyDown(selectControl, { keyCode: 40, key: 'ArrowDown' });
			expect(domNode, 'queried for', '.Select-option.is-focused',
				'to have items satisfying',
				'to have text', 'One');
		});

		it('should close the options one the second click on the arrow', () => {
			var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
			TestUtils.Simulate.mouseDown(selectArrow, { button: 0 });
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option'), 'to have length', 3);

			TestUtils.Simulate.mouseDown(selectArrow, { button: 0 });
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
		});

		it('should ignore a right mouse click on the arrow', () => {
			var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
			TestUtils.Simulate.mouseDown(selectArrow, { button: 1 });
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
		});

		it('the input should not have a required attribute', () => {
			var inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
			expect(inputNode, 'to have attributes', {
				required: undefined
			});
		});
	});

	describe('with a return from onInputChange', () => {

		let onInputChangeOverride;
		beforeEach(() => {
			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'three', label: 'Three' }
			];

			onInputChangeOverride = sinon.stub();

			wrapper = createControlWithWrapper({
				name: 'field-onChange',
				value: 'one',
				options: options,
				simpleValue: true,
				onInputChange: onInputChangeOverride
			});
		});

		it('should change the value when onInputChange returns a value', () => {
			onInputChangeOverride.returns('2');
			typeSearchText('1');
			expect(instance.state.inputValue, 'to equal', '2');
		});

		it('should return the input when onInputChange returns undefined', () => {
			onInputChangeOverride.returns(undefined);  // Not actually necessary as undefined is the default, but makes this clear
			typeSearchText('Test');
			expect(instance.state.inputValue, 'to equal', 'Test');
		});

		it('should return the input when onInputChange returns null', () => {
			onInputChangeOverride.returns(null);
			typeSearchText('Test');
			expect(instance.state.inputValue, 'to equal', 'Test');
		});

		it('should update the input when onInputChange returns a number', () => {
			onInputChangeOverride.returns(5);
			typeSearchText('Test');
			expect(instance.state.inputValue, 'to equal', '5');
		});

		it('displays the new value in the input box', () => {
			onInputChangeOverride.returns('foo');
			typeSearchText('Test');
			const displayedValue = ReactDOM.findDOMNode(instance).querySelector('.Select-input input').value;
			expect(displayedValue, 'to equal', 'foo');
		});
	});

	describe('with values as numbers', () => {
		beforeEach(() => {
			options = [
				{ value: 0, label: 'Zero' },
				{ value: 1, label: 'One' },
				{ value: 2, label: 'Two' },
				{ value: 3, label: 'Three' }
			];

			wrapper = createControlWithWrapper({
				value: 2,
				name: 'field',
				options: options,
				simpleValue: true,
			});
		});

		it('selects the initial value', () => {
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have text', 'Two');
		});

		it('set the initial value of the hidden input control', () => {
			expect(ReactDOM.findDOMNode(wrapper).querySelector(FORM_VALUE_SELECTOR).value, 'to equal', '2' );
		});

		it('updates the value when the value prop is set', () => {
			wrapper.setPropsForChild({ value: 3 });
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have text', 'Three');
		});

		it('updates the value of the hidden input control after new value prop', () => {
			wrapper.setPropsForChild({ value: 3 });
			expect(ReactDOM.findDOMNode(wrapper).querySelector(FORM_VALUE_SELECTOR).value, 'to equal', '3' );
		});

		it('calls onChange with the new value as a number', () => {

			clickArrowToOpen();
			pressDown();
			pressEnterToAccept();
			expect(onChange, 'was called with', 3);
		});

		it('supports setting the value to 0 via prop', () => {

			wrapper.setPropsForChild({ value: 0 });
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have text', 'Zero');
		});

		it('supports selecting the zero value', () => {

			clickArrowToOpen();
			pressUp();
			pressUp();
			pressEnterToAccept();
			expect(onChange, 'was called with', 0);
		});

		describe('with multi=true', () => {

			beforeEach(() => {

				options = [
					{ value: 0, label: 'Zero' },
					{ value: 1, label: 'One' },
					{ value: 2, label: 'Two' },
					{ value: 3, label: 'Three' },
					{ value: 4, label: 'Four' }
				];

				wrapper = createControlWithWrapper({
					value: [2, 1],
					options: options,
					multi: true,
					searchable: true
				});
			});

			it('selects the initial value', () => {

				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Two</span></div>
                        <div><span className="Select-value-label">One</span></div>
					</span>);
			});

			it('calls onChange with the correct value when 1 option is selected', () => {

				var removeIcons = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-value .Select-value-icon');
				TestUtils.Simulate.mouseDown(removeIcons[0]);
				expect(onChange, 'was called with', [{ value: 1, label: 'One' }]);
			});

			it('supports updating the values via props', () => {

				wrapper.setPropsForChild({
					value: [3, 4]
				});

				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Three</span></div>
                        <div><span className="Select-value-label">Four</span></div>
					</span>);
			});

			it('supports updating the value to a single value', () => {

				wrapper.setPropsForChild({
					value: 1
				});

				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">One</span></div>
					</span>);
			});

			it('supports updating the value to single value of 0', () => {

				// This test is specifically in case there's a "if (value) {... " somewhere
				wrapper.setPropsForChild({
					value: 0
				});

				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Zero</span></div>
					</span>);
			});

			it('calls onChange with the correct values when multiple options are selected', () => {

				typeSearchText('fo');
				pressEnterToAccept(); // Select 'Four'

				expect(onChange, 'was called with', [
					{ value: 2, label: 'Two' },
					{ value: 1, label: 'One' },
					{ value: 4, label: 'Four' }
				]);
			});
		});

		describe('searching', () => {

			let searchOptions = [
				{ value: 1, label: 'One' },
				{ value: 2, label: 'Two' },
				{ value: 10, label: 'Ten' },
				{ value: 20, label: 'Twenty' },
				{ value: 21, label: 'Twenty-one' },
				{ value: 34, label: 'Thirty-four' },
				{ value: 54, label: 'Fifty-four' }
			];

			describe('with matchPos=any and matchProp=any', () => {
				beforeEach(() => {
					instance = createControl({
						matchPos: 'any',
						matchProp: 'any',
						options: searchOptions
					});
				});

				it('finds text anywhere in value', () => {

					typeSearchText('1');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
					'to satisfy', [
							expect.it('to have text', 'One'),
							expect.it('to have text', 'Ten'),
							expect.it('to have text', 'Twenty-one')
						]);
				});

				it('finds text at end', () => {

					typeSearchText('4');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
						'to satisfy', [
							expect.it('to have text', 'Thirty-four'),
							expect.it('to have text', 'Fifty-four')
						]);
				});
			});

			describe('with matchPos=start and matchProp=any', () => {

				beforeEach(() => {
					instance = createControl({
						matchPos: 'start',
						matchProp: 'any',
						options: searchOptions
					});
				});

				it('finds text at the start of the value', () => {

					typeSearchText('1');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
						'to satisfy', [
							expect.it('to have text', 'One'),
							expect.it('to have text', 'Ten')
						]);
				});

				it('does not match text at end', () => {

					typeSearchText('4');
					expect(ReactDOM.findDOMNode(instance), 'to contain elements matching',
						'.Select-noresults');
					expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching',
						'.Select-option');
				});
			});

			describe('with matchPos=any and matchProp=value', () => {
				beforeEach(() => {
					instance = createControl({
						matchPos: 'any',
						matchProp: 'value',
						options: searchOptions
					});
				});

				it('finds text anywhere in value', () => {

					typeSearchText('1');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
						'to satisfy', [
							expect.it('to have text', 'One'),
							expect.it('to have text', 'Ten'),
							expect.it('to have text', 'Twenty-one')
						]);
				});

				it('finds text at end', () => {

					typeSearchText('4');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
						'to satisfy', [
							expect.it('to have text', 'Thirty-four'),
							expect.it('to have text', 'Fifty-four')
						]);
				});
			});

			describe('with matchPos=start and matchProp=value', () => {

				beforeEach(() => {
					instance = createControl({
						matchPos: 'start',
						matchProp: 'value',
						options: searchOptions
					});
				});

				it('finds text at the start of the value', () => {

					typeSearchText('1');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
						'to satisfy', [
							expect.it('to have text', 'One'),
							expect.it('to have text', 'Ten')
						]);
				});

				it('does not match text at end', () => {

					typeSearchText('4');
					expect(ReactDOM.findDOMNode(instance), 'to contain elements matching',
						'.Select-noresults');
					expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching',
						'.Select-option');
				});
			});
		});
	});

	describe('with values as booleans', () => {
		beforeEach(() => {
			options = [
				{ value: true, label: 'Yes' },
				{ value: false, label: 'No' },
			];

			wrapper = createControlWithWrapper({
				value: true,
				name: 'field',
				options: options,
				simpleValue: true,
			});
		});

		it('selects the initial value', () => {
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
					'to have text', 'Yes');
		});

		it('set the initial value of the hidden input control', () => {
			expect(ReactDOM.findDOMNode(wrapper).querySelector(FORM_VALUE_SELECTOR).value, 'to equal', 'true' );
		});

		it('updates the value when the value prop is set', () => {
			wrapper.setPropsForChild({ value: false });
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
					'to have text', 'No');
		});

		it('updates the value of the hidden input control after new value prop', () => {
			wrapper.setPropsForChild({ value: false });
			expect(ReactDOM.findDOMNode(wrapper).querySelector(FORM_VALUE_SELECTOR).value, 'to equal', 'false' );
		});

		it('calls onChange with the new value as a boolean', () => {
			clickArrowToOpen();
			pressDown();
			pressEnterToAccept();
			expect(onChange, 'was called with', false);
		});

		it('supports setting the value via prop', () => {
			wrapper.setPropsForChild({ value: false });
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
					'to have text', 'No');
		});

		describe('with multi=true', () => {

			beforeEach(() => {

				options = [
					{ value: true, label: 'Yes' },
					{ value: false, label: 'No' }
				];

				wrapper = createControlWithWrapper({
					value: [true, false],
					options: options,
					multi: true,
					searchable: true
				});
			});

			it('selects the initial value', () => {

				expect(instance, 'to contain',
						<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Yes</span></div>
                        <div><span className="Select-value-label">No</span></div>
					</span>);
			});

			it('calls onChange with the correct value when true option is deselected', () => {

				var removeIcons = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-value .Select-value-icon');
				TestUtils.Simulate.mouseDown(removeIcons[0]);
				expect(onChange, 'was called with', [{ value: false, label: 'No' }]);
			});

			it('supports updating the values via props', () => {

				wrapper.setPropsForChild({
					value: [false]
				});

				expect(instance, 'to contain',
						<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">No</span></div>
					</span>);
			});

			it('supports updating the value to a single value', () => {

				wrapper.setPropsForChild({
					value: true
				});

				expect(instance, 'to contain',
						<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Yes</span></div>
					</span>);
			});

			it('supports updating the value to single value of false', () => {

				// This test is specifically in case there's a "if (value) {... " somewhere
				wrapper.setPropsForChild({
					value: false
				});

				expect(instance, 'to contain',
						<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">No</span></div>
					</span>);
			});

			it('calls onChange with the correct values when multiple options are selected', () => {
				wrapper.setPropsForChild({
					value: [true]
				});

				typeSearchText('No');
				pressEnterToAccept(); // Select 'No'

				expect(onChange, 'was called with', [
					{ value: true, label: 'Yes' },
					{ value: false, label: 'No' }
				]);
			});
		});

		describe('searching', () => {

			let searchOptions = [
				{ value: true, label: 'Yes' },
				{ value: false, label: 'No' }
			];

			describe('with matchPos=any and matchProp=any', () => {
				beforeEach(() => {
					instance = createControl({
						matchPos: 'any',
						matchProp: 'any',
						options: searchOptions
					});
				});

				it('finds text anywhere in value', () => {

					typeSearchText('fal');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'No'),
							]);
				});

				it('finds text at end', () => {

					typeSearchText('se');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'No'),
							]);
				});
			});

			describe('with matchPos=start and matchProp=any', () => {

				beforeEach(() => {
					instance = createControl({
						matchPos: 'start',
						matchProp: 'any',
						options: searchOptions
					});
				});

				it('finds text at the start of the value', () => {

					typeSearchText('fa');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'No')
							]);
				});

				it('does not match text at end', () => {

					typeSearchText('se');
					expect(ReactDOM.findDOMNode(instance), 'to contain elements matching',
							'.Select-noresults');
					expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching',
							'.Select-option');
				});
			});

			describe('with matchPos=any and matchProp=value', () => {
				beforeEach(() => {
					instance = createControl({
						matchPos: 'any',
						matchProp: 'value',
						options: searchOptions
					});
				});

				it('finds text anywhere in value', () => {

					typeSearchText('al');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'No'),
							]);
				});

				it('finds text at end', () => {

					typeSearchText('e');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'Yes'),
								expect.it('to have text', 'No')
							]);
				});
			});

			describe('with matchPos=start and matchProp=value', () => {

				beforeEach(() => {
					instance = createControl({
						matchPos: 'start',
						matchProp: 'value',
						options: searchOptions
					});
				});

				it('finds text at the start of the value', () => {

					typeSearchText('tr');
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
							'to satisfy', [
								expect.it('to have text', 'Yes')
							]);
				});

				it('does not match text at end', () => {

					typeSearchText('e');
					expect(ReactDOM.findDOMNode(instance), 'to contain elements matching',
							'.Select-noresults');
					expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching',
							'.Select-option');
				});
			});
		});
	});

	describe('with options and value', () => {
		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'three', label: 'Three' }
			];

			// Render an instance of the component
			wrapper = createControlWithWrapper({
				name: 'out-select-control',
				value: 'one',
				options: options,
				searchable: true
			});
		});

		it('starts with the given value', () => {

			var node = ReactDOM.findDOMNode(instance);
			expect(node, 'queried for', DISPLAYED_SELECTION_SELECTOR,
				'to have items satisfying', 'to have text', 'One');
		});

		it('supports setting the value via prop', () => {

			wrapper.setPropsForChild({
				value: 'three'
			});

			expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
				'to have items satisfying', 'to have text', 'Three');
		});

		it('sets the value of the hidden form node', () => {

			wrapper.setPropsForChild({
				value: 'three'
			});

			expect(ReactDOM.findDOMNode(wrapper).querySelector(FORM_VALUE_SELECTOR).value, 'to equal', 'three' );
		});

		it('display the raw value if the option is not available', () => {

			wrapper.setPropsForChild({
				value: { value: 'new', label: 'something new' }
			});

			expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
				'to have items satisfying', 'to have text', 'something new');
		});

		it('updates the display text if the option appears later', () => {

			wrapper.setPropsForChild({
				value: 'new'
			});

			wrapper.setPropsForChild({
				options: [
					{ value: 'one', label: 'One' },
					{ value: 'two', labal: 'Two' },
					{ value: 'new', label: 'New item in the options' },
					{ value: 'three', label: 'Three' }
				]
			});

			expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
				'to have items satisfying', 'to have text', 'New item in the options');

		});

		it('the input should not have a required attribute', () => {
			var inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
			expect(inputNode, 'to have attributes', {
				required: undefined
			});
		});
	});

	describe('with a disabled option', () => {

		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two', disabled: true },
				{ value: 'three', label: 'Three' }
			];

			wrapper = createControlWithWrapper({
				options: options,
				searchable: true
			});
		});

		it('adds the is-disabled class to the disabled option', () => {

			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[1],
				'to have attributes', {
					class: 'is-disabled'
            });
		});

		it('is not selectable by clicking', () => {

			clickArrowToOpen();
			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[1]);

			expect(onChange, 'was not called');
			expect(ReactDOM.findDOMNode(instance), 'queried for first', PLACEHOLDER_SELECTOR,
				'to have text', 'Select...');
		});

		it('is not selectable by keyboard', () => {

			clickArrowToOpen();
			// Press down to get to the second option
			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
			// Check the disable option is not focused
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option.is-disabled.is-focused');
		});

		it('jumps over the disabled option', () => {

			clickArrowToOpen();
			// Press down to get to the second option
			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
			// Check the focused option is the one after the disabled option
			expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-option.is-focused',
				'to have text', 'Three');
		});

		it('jumps back to beginning when disabled option is last option', () => {

			wrapper = createControlWithWrapper({
				options: [
					{ value: 'one', label: 'One' },
					{ value: 'two', label: 'Two' },
					{ value: 'three', label: 'Three', disabled: true }
				]
			});

			clickArrowToOpen();
			// Down twice
			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });

			// Selected option should be back to 'One'
			expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-option.is-focused',
				'to have text', 'One');
		});

		it('skips over last option when looping round when last option is disabled', () => {

			wrapper = createControlWithWrapper({
				options: [
					{ value: 'one', label: 'One' },
					{ value: 'two', label: 'Two' },
					{ value: 'three', label: 'Three', disabled: true }
				]
			});

			clickArrowToOpen();
			// Press up, should skip the bottom entry 'Three'...
			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 38, key: 'ArrowUp' });

			// ... and land on 'Two'
			expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-option.is-focused',
				'to have text', 'Two');
		});

		it('focuses initially on the second option when the first is disabled', () => {

			wrapper = createControlWithWrapper({
				options: [
					{ value: 'one', label: 'One', disabled: true },
					{ value: 'two', label: 'Two' },
					{ value: 'three', label: 'Three' }
				]
			});

			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-option.is-focused',
				'to have text', 'Two');
		});

		it('doesn\'t focus anything when all options are disabled', () => {

			wrapper = createControlWithWrapper({
				options: [
					{ value: 'one', label: 'One', disabled: true },
					{ value: 'two', label: 'Two', disabled: true },
					{ value: 'three', label: 'Three', disabled: true }
				]
			});

			clickArrowToOpen();

			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option.is-focused');
		});

		it('doesn\'t select anything when all options are disabled and enter is pressed', () => {

			wrapper = createControlWithWrapper({
				options: [
					{ value: 'one', label: 'One', disabled: true },
					{ value: 'two', label: 'Two', disabled: true },
					{ value: 'three', label: 'Three', disabled: true }
				]
			});

			clickArrowToOpen();

			TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 13, key: 'Enter' });
			expect(onChange, 'was not called');
			expect(ReactDOM.findDOMNode(instance), 'queried for first', PLACEHOLDER_SELECTOR,
				'to have text', 'Select...');
		});

		it("doesn't select anything when a disabled option is the only item in the list after a search", () => {

			typeSearchText('tw'); // Only 'two' in the list
			pressEnterToAccept();
			expect(onChange, 'was not called');
			// And the menu is still open
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', DISPLAYED_SELECTION_SELECTOR);
			expect(ReactDOM.findDOMNode(instance), 'queried for' , '.Select-option',
				'to satisfy', [
					expect.it('to have text', 'Two')
				]);
		});

		it("doesn't select anything when a disabled option value matches the entered text", () => {

			typeSearchText('two');  // Matches value
			pressEnterToAccept();
			expect(onChange, 'was not called');
			// And the menu is still open
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', DISPLAYED_SELECTION_SELECTOR);
			expect(ReactDOM.findDOMNode(instance), 'queried for' , '.Select-option',
				'to satisfy', [
					expect.it('to have text', 'Two')
				]);
		});

		it("doesn't select anything when a disabled option label matches the entered text", () => {

			typeSearchText('Two');  // Matches label
			pressEnterToAccept();
			expect(onChange, 'was not called');
			// And the menu is still open
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', DISPLAYED_SELECTION_SELECTOR);
			expect(ReactDOM.findDOMNode(instance), 'queried for' , '.Select-option',
				'to satisfy', [
					expect.it('to have text', 'Two')
				]);
		});

		it('shows disabled results in a search', () => {

			typeSearchText('t');
			var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			expect(options[0], 'to have text', 'Two');
			expect(options[0], 'to have attributes', {
				class: 'is-disabled'
			});
			expect(options[1], 'to have text', 'Three');
		});

		it('is does not close menu when disabled option is clicked', () => {

			clickArrowToOpen();
			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[1]);

			var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			expect(options.length, 'to equal', 3);
		});
	});

	describe('with styled options', () => {

		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One', className: 'extra-one', title: 'Eins' },
				{ value: 'two', label: 'Two', className: 'extra-two', title: 'Zwei' },
				{ value: 'three', label: 'Three', style: { fontSize: 25 } }
			];

			wrapper = createControlWithWrapper({
				options: options
			}, {
				wireUpOnChangeToValue: true
			});
		});

		it('uses the given className for an option', () => {

			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[0], 'to have attributes',
				{
					class: 'extra-one'
				});
		});

		it('uses the given style for an option', () => {

			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[2], 'to have attributes',
				{
					style: { 'font-size': '25px' }
				});
		});

		it('uses the given title for an option', () => {

			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option')[1], 'to have attributes',
				{
					title: 'Zwei'
				});
		});

		it('uses the given className for a single selection', () => {

			typeSearchText('tw');
			pressEnterToAccept();
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have attributes', {
					class: 'extra-two'
				});
		});

		it('uses the given style for a single selection', () => {

			typeSearchText('th');
			pressEnterToAccept();
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have attributes', {
					style: {
						'font-size': '25px'
					}
				});
		});

		it('uses the given title for a single selection', () => {

			typeSearchText('tw');
			pressEnterToAccept();
			expect(ReactDOM.findDOMNode(instance), 'queried for first', DISPLAYED_SELECTION_SELECTOR,
				'to have attributes', {
					title: 'Zwei'
				});
		});

		describe('with multi', () => {

			beforeEach(() => {

				wrapper.setPropsForChild({ multi: true });
			});


			it('uses the given className for a selected value', () => {

				typeSearchText('tw');
				pressEnterToAccept();
				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-value',
					'to have attributes', {
						class: 'extra-two'
					});
			});

			it('uses the given style for a selected value', () => {

				typeSearchText('th');
				pressEnterToAccept();
				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-value',
					'to have attributes', {
						style: {
							'font-size': '25px'
						}
					});
			});

			it('uses the given title for a selected value', () => {

				typeSearchText('tw');
				pressEnterToAccept();
				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-value',
					'to have attributes', {
						title: 'Zwei'
					});
			});

		});

	});

	describe('with allowCreate=true', () => {

		// TODO: allowCreate hasn't been implemented yet in 1.x
		return;

		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'got spaces', label: 'Label for spaces' },
				{ value: 'gotnospaces', label: 'Label for gotnospaces' },
				{ value: 'abc 123', label: 'Label for abc 123' },
				{ value: 'three', label: 'Three' },
				{ value: 'zzzzz', label: 'test value' }
			];

			// Render an instance of the component
			wrapper = createControlWithWrapper({
				value: 'one',
				options: options,
				allowCreate: true,
				searchable: true,
				addLabelText: 'Add {label} to values?'
			});
		});

		it('has an "Add xyz" option when entering xyz', () => {
			typeSearchText('xyz');

			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-menu .Select-option',
				'to have items satisfying', 'to have text', 'Add xyz to values?');
		});

		it('fires an onChange with the new value when selecting the Add option', () => {

			typeSearchText('xyz');
			TestUtils.Simulate.click(ReactDOM.findDOMNode(instance).querySelector('.Select-menu .Select-option'));

			expect(onChange, 'was called with', 'xyz');
		});

		it('allows updating the options with a new label, following the onChange', () => {

			typeSearchText('xyz');
			TestUtils.Simulate.click(ReactDOM.findDOMNode(instance).querySelector('.Select-menu .Select-option'));

			expect(onChange, 'was called with', 'xyz');

			// Now the client adds the option, with a new label
			wrapper.setPropsForChild({
				options: [
					{ value: 'one', label: 'One' },
					{ value: 'xyz', label: 'XYZ Label' }
				],
				value: 'xyz'
			});

			expect(ReactDOM.findDOMNode(instance).querySelector(DISPLAYED_SELECTION_SELECTOR),
				'to have text', 'XYZ Label');
		});

		it('displays an add option when a value with spaces is entered', () => {

			typeSearchText('got');

			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option')[0],
				'to have text', 'Add got to values?');
		});

		it('displays an add option when a value with spaces is entered', () => {

			typeSearchText('got');

			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option')[0],
				'to have text', 'Add got to values?');
		});

		it('displays an add option when a label with spaces is entered', () => {

			typeSearchText('test');

			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option')[0],
				'to have text', 'Add test to values?');
		});

		it('does not display the option label when an existing value is entered', () => {

			typeSearchText('zzzzz');

			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option'),
				'to have length', 1);
			expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-menu .Select-option',
				'to have text', 'Add zzzzz to values?');
		});

		it('renders the existing option and an add option when an existing display label is entered', () => {

			typeSearchText('test value');

			// First item should be the add option (as the "value" is not in the collection)
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option')[0],
				'to have text', 'Add test value to values?');
			// Second item should be the existing option with the matching label
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option')[1],
				'to have text', 'test value');
			expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-menu .Select-option'),
				'to have length', 2);
		});
	});

	describe('with multi-select', () => {

		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two', clearableValue: false },
				{ value: 'three', label: 'Three' },
				{ value: 'four', label: 'Four' }
			];

			// Render an instance of the component
			wrapper = createControlWithWrapper({
				value: '',
				options: options,
				searchable: true,
				multi: true
			});
		});

		it('selects a single option on enter', () => {

			typeSearchText('fo');
			pressEnterToAccept();
			expect(onChange, 'was called with', [{ label: 'Four', value: 'four' }]);
		});

		describe('when using the option value object', () => {

			it('selects an additional option', () => {

				setValueProp(options[3]);
				typeSearchText('th');
				onChange.reset();  // Ignore previous onChange calls
				pressEnterToAccept();

				expect(onChange, 'was called with',
					[{ label: 'Four', value: 'four' }, { label: 'Three', value: 'three' }]);
			});

			it('displays both selected options', () => {

				setValueProp([options[3], options[2]]);
				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Four</span></div>
                        <div><span className="Select-value-label">Three</span></div>
					</span>);
			});
		});

		describe('when using the option value', () => {

			it('selects an additional option', () => {

				setValueProp('four');
				typeSearchText('th');
				onChange.reset();  // Ignore previous onChange calls
				pressEnterToAccept();

				expect(onChange, 'was called with',
					[{ label: 'Four', value: 'four' }, { label: 'Three', value: 'three' }]);
			});

			it('displays both selected options', () => {

				setValueProp(['four', 'three']);
				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">Four</span></div>
                        <div><span className="Select-value-label">Three</span></div>
					</span>);
			});
		});

		it('filters the existing selections from the options', () => {

			setValueProp(['four','three']);

			typeSearchText('o');

			var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');

			expect(options[0], 'to have text', 'One');
			expect(options[1], 'to have text', 'Two');
			expect(options, 'to have length', 2);  // No "Four", as already selected
		});

		it('removes the last selected option with backspace', () => {

			setValueProp(['four','three']);
			onChange.reset();  // Ignore previous onChange calls
			pressBackspace();
			expect(onChange, 'was called with', [{ label: 'Four', value: 'four' }]);
		});

		it('does not remove the last selected option with backspace when backspaceRemoves=false', () => {

			// Disable backspace
			wrapper.setPropsForChild({
				backspaceRemoves: false,
				value: ['four', 'three']
			});
			onChange.reset();  // Ignore previous onChange calls

			pressBackspace();
			expect(onChange, 'was not called');
			expect(instance, 'to contain',
				<span className="Select-multi-value-wrapper">
                    <div><span className="Select-value-label">Four</span></div>
                    <div><span className="Select-value-label">Three</span></div>
                </span>);
		});

		it('removes an item when clicking on the X', () => {

			setValueProp(['four', 'three', 'two']);
			onChange.reset();  // Ignore previous onChange calls

			var threeDeleteButton = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-value-icon')[1];
			TestUtils.Simulate.mouseDown(threeDeleteButton);

			expect(onChange, 'was called with', [
				{ label: 'Four', value: 'four' },
				{ label: 'Two', value: 'two' }
			]);
		});

		it('doesn\'t show the X if clearableValue=false', () => {

			setValueProp(['two']);
			onChange.reset();  // Ignore previous onChange calls

			var twoDeleteButton = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-value-icon')[0];

			expect(twoDeleteButton, 'to be', undefined);
		});

		it('doesn\'t allow clearing with backspace if clearableValue=false on the latest element', () => {

			setValueProp(['four', 'two']);
			onChange.reset();  // Ignore previous onChange calls

			pressBackspace();
			expect(onChange, 'was not called');
			expect(instance, 'to contain',
				<span className="Select-multi-value-wrapper">
                    <div><span className="Select-value-label">Four</span></div>
                    <div><span className="Select-value-label">Two</span></div>
                </span>);
		});

		describe('with late options', () => {

			beforeEach(() => {

				wrapper = createControlWithWrapper({
					multi: true,
					options: options,
					value: 'one,two'
				});
			});

			it('updates the label when the options are updated', () => {

				wrapper.setPropsForChild({
					options: [
						{ value: 'one', label: 'new label for One' },
						{ value: 'two', label: 'new label for Two' },
						{ value: 'three', label: 'new label for Three' }
					]
				});


				expect(instance, 'to contain',
					<span className="Select-multi-value-wrapper">
                        <div><span className="Select-value-label">new label for One</span></div>
                        <div><span className="Select-value-label">new label for Two</span></div>
					</span>);
			});
		});

	});

	describe('with multi=true and clearable=true', () => {
		beforeEach(() => {

			options = [
				{ value: 0, label: 'Zero' },
				{ value: 1, label: 'One' }
			];

			wrapper = createControlWithWrapper({
				value: [0],
				options: options,
				multi: true,
				clearable: true
			});

		});

		it('calls onChange with an empty list when cleared', () => {

			TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'), { button: 0 });
			expect(onChange, 'was called with', []);
		});
	});

	describe('with multi=true and searchable=false', () => {

		beforeEach(() => {

			options = [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' },
				{ value: 'three', label: 'Three' },
				{ value: 'four', label: 'Four' }
			];

			// Render an instance of the component
			wrapper = createControlWithWrapper({
				value: '',
				options: options,
				searchable: false,
				multi: true
			}, {
				wireUpOnChangeToValue: true
			});

			// We need a hack here.
			// JSDOM (at least v3.x) doesn't appear to support div's with tabindex
			// This just hacks that we are focused
			// This is (obviously) implementation dependent, and may need to change
			instance.setState({
				isFocused: true
			});

		});

		it('selects multiple options', () => {

			clickArrowToOpen();

			expect(instance,
				'with event mouseDown', 'on', <div className="Select-option">Two</div>,
				'with event mouseDown', 'on', <div className="Select-option">One</div>,
				'to contain',
				<span className="Select-multi-value-wrapper">
					<div><span className="Select-value-label">Two</span></div>
					<div><span className="Select-value-label">One</span></div>
				</span>);
		});

		it('calls onChange when each option is selected', () => {

			clickArrowToOpen();
			// First item
			var items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			TestUtils.Simulate.mouseDown(items[1]);
			expect(onChange, 'was called once');
			expect(onChange, 'was called with', [{ value: 'two', label: 'Two' }]);

			// Second item

			items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			TestUtils.Simulate.mouseDown(items[0]);
			expect(onChange, 'was called twice');
		});

		it('removes the selected options from the menu', () => {

			clickArrowToOpen();

			var items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');

			// Click the option "Two" to select it
			expect(items[1], 'to have text', 'Two');
			TestUtils.Simulate.mouseDown(items[1]);
			expect(onChange, 'was called times', 1);

			// Now get the list again
			items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			expect(items[0], 'to have text', 'One');
			expect(items[1], 'to have text', 'Three');
			expect(items[2], 'to have text', 'Four');
			expect(items, 'to have length', 3);

			// Click first item, 'One'
			TestUtils.Simulate.mouseDown(items[0]);

			expect(onChange, 'was called times', 2);
			items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			expect(items[0], 'to have text', 'Three');
			expect(items[1], 'to have text', 'Four');
			expect(items, 'to have length', 2);

			// Click second item, 'Four'
			TestUtils.Simulate.mouseDown(items[1]);
			expect(onChange, 'was called times', 3);

			items = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
			expect(items[0], 'to have text', 'Three');
			expect(items, 'to have length', 1);
		});

	});

	describe('with props', () => {

		describe('className', () => {

			it('assigns the className to the outer-most element', () => {

				var instance = createControl({ className: 'test-class' });
				expect(ReactDOM.findDOMNode(instance), 'to have attributes', {
					class: 'test-class'
				});
			});
		});

		describe('clearable=true', () => {

			beforeEach(() => {

				var wrapper = createControlWithWrapper({
					clearable: true,
					options: defaultOptions,
					value: 'three'
				}, {
					wireUpOnChangeToValue: true
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
					'to have items satisfying', 'to have text', 'Three');

			});

			describe('on pressing escape', () => {

				beforeEach(() => {

					pressEscape();
				});

				it('calls onChange with null', () => {

					expect(onChange, 'was called with', null);
				});

				it('resets the display value', () => {

					expect(ReactDOM.findDOMNode(instance), 'queried for', PLACEHOLDER_SELECTOR,
						'to have items satisfying', 'to have text', 'Select...');
				});

				it('resets the control value', () => {

					expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', '');
				});
			});

			describe('on clicking `clear`', () => {
				beforeEach(() => {
					TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'), { button: 0 });
				});

				it('calls onChange with empty', () => {
					expect(onChange, 'was called with', null);
				});

				it('resets the display value', () => {
					expect(ReactDOM.findDOMNode(instance), 'queried for', PLACEHOLDER_SELECTOR,
						'to have items satisfying', 'to have text', 'Select...');
				});

				it('resets the control value', () => {
					expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', '');
				});
			});

			describe('on tapping `clear`', () => {
				beforeEach(() => {
					TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'));
					TestUtils.Simulate.touchEnd(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'));
				});

				it('calls onChange with empty', () => {
					expect(onChange, 'was called with', null);
				});

				it('resets the display value', () => {
					expect(ReactDOM.findDOMNode(instance), 'queried for', PLACEHOLDER_SELECTOR,
						'to have items satisfying', 'to have text', 'Select...');
				});

				it('resets the control value', () => {
					expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', '');
				});
			});

			describe('on clicking `clear` with a custom resetValue', () => {
				beforeEach(() => {
					createControlWithWrapper({
						clearable: true,
						options: defaultOptions,
						value: 'three',
						resetValue: 'reset'
					});

					expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
						'to have items satisfying', 'to have text', 'Three');
				});

				it('calls onChange with a custom resetValue', () => {
					TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'), { button: 0 });
					expect(onChange, 'was called with', 'reset');
				});
			});

			describe('on tapping and dragging `clear`', () => {
				beforeEach(() => {
					TestUtils.Simulate.touchStart(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'));
					TestUtils.Simulate.touchMove(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'));
					TestUtils.Simulate.touchEnd(ReactDOM.findDOMNode(instance).querySelector('.Select-clear'));
				});

				it('calls onChange with empty', () => {
					expect(onChange, 'was not called');
				});

				it('resets the display value', () => {
					expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', PLACEHOLDER_SELECTOR);
				});
			});
		});

		describe('clearable=false', () => {

			beforeEach(() => {

				var wrapper = createControlWithWrapper({
					clearable: false,
					options: defaultOptions,
					value: 'three',
					name: 'selectHiddenControl',
					searchable: true
				}, {
					wireUpOnChangeToValue: true
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
					'to have items satisfying', 'to have text', 'Three');

			});

			it('does not render a clear button', () => {

				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-clear');
			});

			describe('on escape', () => {
				beforeEach(() => {

					pressEscape();
				});

				it('does not call onChange', () => {

					expect(onChange, 'was not called');
				});

				it('does not reset the display value', () => {

					expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
						'to have items satisfying', 'to have text', 'Three');
				});

				it('does not reset the control value', () => {

					expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', 'three');
				});

			});

			describe('when open', () => {

				beforeEach(() => {

					typeSearchText('abc');
					expect(ReactDOM.findDOMNode(instance), 'to contain elements matching', '.Select-menu');
				});

				describe('on escape', () => {

					beforeEach(() => {
						pressEscape();
					});

					it('closes the menu', () => {

						expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-menu');
					});

					it('resets the control value to the original', () => {

						expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', 'three');
					});

					it('does not call onChange', () => {
						expect(onChange, 'was not called');
					});

					it('renders the original display label', () => {

						expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
							'to have items satisfying', 'to have text', 'Three');
					});
				});
			});
		});

		describe('clearAllText', () => {

			beforeEach(() => {

				instance = createControl({
					multi: true,
					clearable: true,
					value: 'three',
					clearAllText: 'Remove All Items Test Title',
					clearValueText: 'Remove Value Test Title',  // Should be ignored, multi=true
					options: defaultOptions
				});
			});

			it('uses the prop as the title for clear', () => {

				expect(ReactDOM.findDOMNode(instance).querySelector('.Select-clear-zone'), 'to have attributes', {
					title: 'Remove All Items Test Title'
				});
			});
		});

		describe('clearValueText', () => {

			beforeEach(() => {

				instance = createControl({
					multi: false,
					clearable: true,
					value: 'three',
					clearAllText: 'Remove All Items Test Title', // Should be ignored, multi=false
					clearValueText: 'Remove Value Test Title',
					options: defaultOptions
				});
			});

			it('uses the prop as the title for clear', () => {

				expect(ReactDOM.findDOMNode(instance).querySelector('.Select-clear-zone'), 'to have attributes', {
					title: 'Remove Value Test Title'
				});
			});
		});

		describe('delimiter', () => {

			describe('is ;', () => {

				beforeEach(() => {

					instance = createControl({
						multi: true,
						simpleValue: true,
						value: 'four;three',
						delimiter: ';',
						options: defaultOptions
					});
				});

				it('interprets the initial options correctly', () => {

					expect(instance, 'to contain', <span className="Select-value-label">AbcDef</span>);
					expect(instance, 'to contain', <span className="Select-value-label">Three</span>);
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-value-label', 'to have length', 2);
				});

				it('adds an additional option with the correct delimiter', () => {

					typeSearchText('one');
					pressEnterToAccept();
					expect(onChange, 'was called with', 'four;three;one');
				});
			});

			describe('is a multi-character string (`==XXX==`)', () => {

				beforeEach(() => {

					wrapper = createControlWithWrapper({
						multi: true,
						simpleValue: true,
						value: 'four==XXX==three',
						delimiter: '==XXX==',
						options: defaultOptions
					}, {
						wireUpOnChangeToValue: true
					});
				});

				it('interprets the initial options correctly', () => {

					expect(instance, 'to contain', <span className="Select-value-label">AbcDef</span>);
					expect(instance, 'to contain', <span className="Select-value-label">Three</span>);
					expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-value-label', 'to have length', 2);
				});

				it('adds an additional option with the correct delimiter', () => {

					typeSearchText('one');
					pressEnterToAccept();
					expect(onChange, 'was called with', 'four==XXX==three==XXX==one');
				});
			});
		});

		describe('disabled=true', () => {

			beforeEach(() => {

				instance = createControl({
					options: defaultOptions,
					value: 'three',
					disabled: true,
					searchable: true
				});
			});

			it('does not render an input search control', () => {

				expect(searchInputNode, 'to be null');
			});

			it('does not react to keyDown', () => {

				TestUtils.Simulate.keyDown(getSelectControl(instance), { keyCode: 40, key: 'ArrowDown' });
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
			});

			it('does not respond to mouseDown', () => {

				TestUtils.Simulate.mouseDown(getSelectControl(instance));
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
			});

			it('does not respond to mouseDown on the arrow', () => {

				TestUtils.Simulate.mouseDown(getSelectControl(instance).querySelector('.Select-arrow'));
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
			});

			it('renders the given value', () => {

				expect(ReactDOM.findDOMNode(instance).querySelector(DISPLAYED_SELECTION_SELECTOR), 'to have text', 'Three');
			});

			describe('toggling disabled=false/disabled=true', () => {
				// ReactDOM.render is used instead of createControl in order for the React component to update props
				// See for more info: http://stackoverflow.com/questions/30614454/how-to-test-a-prop-update-on-react-component

				let node, component;
				beforeEach(() => {
				    node = document.createElement('div');
				    instance = ReactDOM.render(<Select searchable={true} value="three" options={defaultOptions} />, node);
				});

				it('should set the isFocused state to false if disabled=true', function(){

						expect(instance.state.isFocused, 'to equal', false);
						findAndFocusInputControl();
						expect(instance.state.isFocused, 'to equal', true);
				    ReactDOM.render(<Select disabled={true} searchable={true} value="three" options={defaultOptions} />, node);
						expect(instance.state.isFocused, 'to equal', false);
				});

				it('should close the opened menu if disabled=true', function(){

					findAndFocusInputControl();
					TestUtils.Simulate.mouseDown(getSelectControl(instance), { button: 0 });
					expect(node, 'queried for', '.Select-option', 'to have length', 4);
					ReactDOM.render(<Select disabled={true} searchable={true} value="three" options={defaultOptions} />, node);
					expect(node, 'to contain no elements matching', '.Select-option');
				});
			});
		});

		describe('custom filterOption function', () => {

			// Custom function returns true only for value "four"
			var filterOption = (option) => {
				if (option.value === 'four') {
					return true;
				}

				return false;
			};
			var spyFilterOption;

			beforeEach(() => {

				spyFilterOption = sinon.spy(filterOption);

				wrapper = createControlWithWrapper({
					options: defaultOptions,
					filterOption: spyFilterOption
				}, {
					initialFocus: false
				});
			});

			it('calls the filter with each option', () => {

				expect(spyFilterOption, 'was called times', 4);
				expect(spyFilterOption, 'was called with', defaultOptions[0], '');
				expect(spyFilterOption, 'was called with', defaultOptions[1], '');
				expect(spyFilterOption, 'was called with', defaultOptions[2], '');
				expect(spyFilterOption, 'was called with', defaultOptions[3], '');
			});

			describe('when entering text', () => {

				beforeEach(() => {

					findAndFocusInputControl();
					spyFilterOption.reset();
					typeSearchText('xyz');
				});

				it('calls the filterOption function for each option', () => {

					expect(spyFilterOption, 'was called times', 4);
					expect(spyFilterOption, 'was called with', defaultOptions[0], 'xyz');
					expect(spyFilterOption, 'was called with', defaultOptions[1], 'xyz');
					expect(spyFilterOption, 'was called with', defaultOptions[2], 'xyz');
					expect(spyFilterOption, 'was called with', defaultOptions[3], 'xyz');
				});

				it('only shows the filtered option', () => {

					expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option'),
						'to have length', 1);

					expect(ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option'),
						'to have items satisfying',
						'to have text', 'AbcDef');
				});
			});
		});

		describe('custom filterOptions function', () => {

			var spyFilterOptions;

			beforeEach(() => {

				spyFilterOptions = sinon.stub();
				spyFilterOptions.returns([
					{ label: 'Return One', value: 'one' },
					{ label: 'Return Two', value: 'two' }
				]);

				instance = createControl({
					options: defaultOptions,
					filterOptions: spyFilterOptions,
					searchable: true
				});
			});

			it('calls the filterOptions function initially', () => {

				expect(spyFilterOptions, 'was called');
			});

			it('calls the filterOptions function initially with the initial options', () => {

				expect(spyFilterOptions, 'was called with', defaultOptions, '');
			});

			it('uses the returned options', () => {

				TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-arrow'), { button: 0 });

				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options[0], 'to have text', 'Return One');
				expect(options[1], 'to have text', 'Return Two');
				expect(options, 'to have length', 2);
			});

			it('calls the filterOptions function on text change', () => {

				typeSearchText('xyz');
				expect(spyFilterOptions, 'was called with', defaultOptions, 'xyz');
			});

			it('uses new options after text change', () => {

				spyFilterOptions.returns([
					{ value: 'abc', label: 'AAbbcc' },
					{ value: 'def', label: 'DDeeff' }
				]);
				typeSearchText('xyz');

				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options[0], 'to have text', 'AAbbcc');
				expect(options[1], 'to have text', 'DDeeff');
				expect(options, 'to have length', 2);
			});
		});

		describe('ignoreCase=false', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					ignoreCase: false,
					options: defaultOptions
				});
			});

			it('does not find options in a different case', () => {

				typeSearchText('def');
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
			});

			it('finds options in the same case', () => {

				typeSearchText('Def');
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options[0], 'to have text', 'AbcDef');
				expect(options, 'to have length', 1);
			});
		});

		describe('inputProps', () => {


			beforeEach(() => {

				instance = createControl({
					searchable: true,
					inputProps: {
						inputClassName: 'extra-input-class',
						className: 'extra-class-name',
						id: 'search-input-id'
					},
					options: defaultOptions
				});
			});

			it('passes id through to the search input box', () => {
				expect(searchInputNode, 'to have attributes', {
					id: 'search-input-id'
				});
			});

			it('passes the inputClassName to the search input box', () => {

				expect(searchInputNode, 'to have attributes', {
					class: 'extra-input-class'
				});
			});

			it('adds the className on to the auto-size input', () => {

				expect(ReactDOM.findDOMNode(instance.input),
					'to have attributes', {
						class: ['extra-class-name', 'Select-input']
					});
			});

			describe('and not searchable', () => {

				beforeEach(() => {

					instance = createControl({
						searchable: false,
						inputProps: {
							inputClassName: 'extra-input-class',
							className: 'extra-class-name',
							id: 'search-input-id'
						},
						options: defaultOptions
					});
				});

				it('sets the className and id on the placeholder for the input', () => {

					expect(ReactDOM.findDOMNode(instance).querySelector('.extra-class-name'),
						'to have attributes', {
							id: 'search-input-id'
						});
				});
			});

			// TODO: Disabled inputs no longer have an <input>, let's wait until that settles
			// down before updating this test to match.

			// describe('and disabled', () => {
			//
			// 	beforeEach(() => {
			//
			// 		instance = createControl({
			// 			searchable: true,
			// 			disabled: true,
			// 			inputProps: {
			// 				inputClassName: 'extra-input-class',
			// 				className: 'extra-class-name',
			// 				id: 'search-input-id'
			// 			},
			// 			options: defaultOptions
			// 		});
			// 	});
			//
			// 	it('makes the input readonly', () => {
			// 		expect(React.findDOMNode(instance),
			// 			'queried for first', 'input.Select-input',
			// 			'to have attribute', 'readonly');
			// 	});
			// });
		});

		describe('matchPos=start', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					matchPos: 'start',
					options: defaultOptions
				});
			});

			it('searches only at the start', () => {

				typeSearchText('o');
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options[0], 'to have text', 'One');
				expect(options, 'to have length', 1);
			});
		});

		describe('matchProp=value', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					matchProp: 'value',
					options: [
						{ value: 'aaa', label: '111' },
						{ value: 'bbb', label: '222' },
						{ value: 'ccc', label: 'Three' },
						{ value: 'four', label: 'Abcaaa' }
					]
				});
			});

			it('searches only the value', () => {

				typeSearchText('aa');  // Matches value "three", and label "AbcDef"
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options, 'to have length', 1);
				expect(options[0], 'to have text', '111');
			});
		});

		describe('matchProp=label', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					matchProp: 'label',
					options: [
						{ value: 'aaa', label: 'bbb' },
						{ value: 'bbb', label: '222' },
						{ value: 'ccc', label: 'Three' },
						{ value: 'four', label: 'Abcaaa' }
					]
				});
			});

			it('searches only the value', () => {

				typeSearchText('bb');  // Matches value "three", and label "AbcDef"
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options, 'to have length', 1);
				expect(options[0], 'to have text', 'bbb');
			});
		});

		describe('matchPos=start and matchProp=value', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					matchProp: 'value',
					matchPos: 'start',
					options: [
						{ value: 'aaa', label: '111' },
						{ value: 'bbb', label: '222' },
						{ value: 'cccaa', label: 'Three' },
						{ value: 'four', label: 'aaAbca' }
					]
				});
			});

			it('searches only the value', () => {

				typeSearchText('aa');  // Matches value "three", and label "AbcDef"
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options, 'to have length', 1);
				expect(options[0], 'to have text', '111');
			});
		});

		describe('matchPos=start and matchProp=label', () => {

			beforeEach(() => {

				instance = createControl({
					searchable: true,
					matchProp: 'label',
					matchPos: 'start',
					options: [
						{ value: 'aaa', label: 'bbb' },
						{ value: 'bbb', label: '222' },
						{ value: 'cccbbb', label: 'Three' },
						{ value: 'four', label: 'Abcbbb' }
					]
				});
			});

			it('searches only the label', () => {

				typeSearchText('bb');  // Matches value "three", and label "AbcDef"
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				expect(options, 'to have length', 1);
				expect(options[0], 'to have text', 'bbb');
			});
		});

		describe('noResultsText', () => {

			beforeEach(() => {

				wrapper = createControlWithWrapper({
					searchable: true,
					options: defaultOptions,
					noResultsText: 'No results unit test'
				});
			});

			it('displays the text when no results are found', () => {

				typeSearchText('DOES NOT EXIST');
				expect(ReactDOM.findDOMNode(instance).querySelector('.Select-menu'),
					'to have text', 'No results unit test');
			});

			it('doesn\'t displays the text when no results are found and noResultsText is falsy', () => {

				wrapper.setPropsForChild({
					noResultsText: ''
				});

				typeSearchText('DOES NOT EXIST');
				expect(ReactDOM.findDOMNode(instance),
					'to contain no elements matching', '.Select-noresults');
			});

			it('doesn\'t displays outer when menu is null', () => {

				wrapper.setPropsForChild({
					noResultsText: ''
				});

				typeSearchText('DOES NOT EXIST');
				expect(ReactDOM.findDOMNode(instance),
					'to contain no elements matching', '.Select-menu-outer');
			});

			it('supports updating the text', () => {

				wrapper.setPropsForChild({
					noResultsText: 'Updated no results text'
				});

				typeSearchText('DOES NOT EXIST');
				expect(ReactDOM.findDOMNode(instance).querySelector('.Select-menu'),
					'to have text', 'Updated no results text');
			});
		});

		describe('onBlur', () => {

			var onBlur;

			it('calls the onBlur prop when blurring the input', () => {

				onBlur = sinon.spy();

				instance = createControl({
					options: defaultOptions,
					onBlur: onBlur
				});

				TestUtils.Simulate.blur(searchInputNode);
				expect(onBlur, 'was called once');
			});

			/*
			TODO: This test doesn't work now that we're checking
			this.menu === document.activeElement in the method. Needs and review to work
			out whether it's possible to mock this.

			it( 'should focus on the input when the menu is active', () => {
				instance = createControl({
					options: defaultOptions
				});

				clickArrowToOpen();
				instance.menu.focus();

				var inputFocus = sinon.spy( instance.input, 'focus' );
				instance.handleInputBlur();

				expect( instance.input.focus, 'was called once' );
			} );
			*/

			it( 'should not focus the input when menu is not active', () => {
				instance = createControl({
					options: defaultOptions
				});

				var inputFocus = sinon.spy( instance.input, 'focus' );
				instance.handleInputBlur();

				expect( instance.input.focus, 'was not called' );
			} );

			it( 'should set onBlurredState', () => {
				instance = createControl({
					options: defaultOptions
				});

				var inputFocus = sinon.spy( instance.input, 'focus' );
				instance.handleInputBlur();

				expect( instance.state.isFocused, 'to be false');
				expect( instance.state.isOpen, 'to be false');
				expect( instance.state.isPseudoFocused, 'to be false');

			} );
		});

		describe('with onBlurResetsInput=true', () => {
			beforeEach(() => {
				instance = createControl({
					options: defaultOptions,
					onBlurResetsInput: true
				});
				typeSearchText('test');
			});

			it('should clear the search input after calling onBlur', () => {
				TestUtils.Simulate.blur(searchInputNode);
				expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', '');
			});
		});

		describe('with onBlurResetsInput=false', () => {
			beforeEach(() => {
				instance = createControl({
					options: defaultOptions,
					onBlurResetsInput: false
				});
				typeSearchText('test');
			});

			it('shouldn\'t clear the search input after calling onBlur', () => {
				TestUtils.Simulate.blur(searchInputNode);
				expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', 'test');
			});
		});

		describe('onFocus', () => {

			var onFocus;

			beforeEach(() => {

				onFocus = sinon.spy();

				instance = createControl({
					options: defaultOptions,
					onFocus: onFocus
				});
			});

			it('calls the onFocus prop when focusing the control', () => {

				expect(onFocus, 'was called once');
			});
		});

		describe('openAfterFocus', () => {

			var openAfterFocus;

			beforeEach(() => {
				openAfterFocus = sinon.spy();

				instance = createControl({
					options: defaultOptions,
					openAfterFocus: true
				});
			});

			it('should show the options when focused', () => {
				instance.focus();

				if (instance.state.isFocused && instance.state.openAfterFocus) {
					expect(instance.state.isOpen, 'to equal', true);
				}
			});

		});

		describe('onValueClick', () => {
			var onValueClick;

			beforeEach(() => {

				onValueClick = sinon.spy();

				instance = createControl({
					options: defaultOptions,
					multi: true,
					value: ['two', 'one'],
					onValueClick: onValueClick
				});
			});

			it('calls the function when clicking on a label', () => {

				TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('a.Select-value-label'), { button: 0 });
				expect(onValueClick, 'was called once');
			});

			it('calls the function with the value', () => {

				TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelectorAll('a.Select-value-label')[0], { button: 0 });
				expect(onValueClick, 'was called with', { value: 'two', label: '222' });
			});
		});

		describe('onOpen', () => {
			let instance = null;
			let eventHandler = null;

			beforeEach(() => {
				eventHandler = sinon.spy();
				instance = createControl({
					options: defaultOptions,
					multi: true,
					value: ['two', 'one'],
					onOpen: eventHandler
				});
			});

			it('is called when the options are displayed', () => {
				TestUtils.Simulate.mouseDown(ReactDOM.findDOMNode(instance).querySelector('.Select-control'), { button: 0 });
				expect(eventHandler, 'was called once');
			});
		});

		describe('onClose', () => {
			let instance = null;
			let eventHandler = null;

			beforeEach(() => {
				eventHandler = sinon.spy();
				instance = createControl({
					options: defaultOptions,
					multi: true,
					value: ['two', 'one'],
					onClose: eventHandler
				});
			});

			it('is called after the options are hidden', () => {
				const domNode = ReactDOM.findDOMNode(instance);
				TestUtils.Simulate.mouseDown(domNode.querySelector('.Select-control'));
				eventHandler.reset();

				TestUtils.Simulate.keyDown(domNode.querySelector('input'), { keyCode: 27, key: 'Escape' });
				expect(eventHandler, 'was called once');
			});
		});

		describe('with onCloseResetsInput=true', () => {
			beforeEach(() => {
				instance = createControl({
					options: defaultOptions,
					onCloseResetsInput: true
				});
				typeSearchText('test');
			});

			it('should clear the search input after calling onBlur', () => {
				const domNode = ReactDOM.findDOMNode(instance);
				TestUtils.Simulate.mouseDown(domNode.querySelector('.Select-control'));
				TestUtils.Simulate.keyDown(domNode.querySelector('input'), { keyCode: 27, key: 'Escape' });
				expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', '');
			});
		});

		describe('with onCloseResetsInput=false', () => {
			beforeEach(() => {
				instance = createControl({
					options: defaultOptions,
					onCloseResetsInput: false
				});
				typeSearchText('test');
			});

			it('should clear the search input after calling onClose', () => {
				const domNode = ReactDOM.findDOMNode(instance);
				TestUtils.Simulate.mouseDown(domNode.querySelector('.Select-control'));
				TestUtils.Simulate.keyDown(domNode.querySelector('input'), { keyCode: 27, key: 'Escape' });
				expect(ReactDOM.findDOMNode(instance).querySelector('input').value, 'to equal', 'test');
			});
		});

		describe('optionRenderer', () => {

			var optionRenderer;

			beforeEach(() => {

				optionRenderer = (option) => {
					return (
						<span id={'TESTOPTION_' + option.value}>{option.label.toUpperCase()}</span>
					);
				};

				optionRenderer = sinon.spy(optionRenderer);

				instance = createControl({
					options: defaultOptions,
					optionRenderer: optionRenderer
				});
			});

			it('renders the options using the optionRenderer', () => {

				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow, { button: 0 });
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');

				expect(options[0].querySelector('span'), 'to have attributes', {
					id: 'TESTOPTION_one'
				});
				expect(options[0].querySelector('span'), 'to have text', 'ONE');
				expect(options[1].querySelector('span'), 'to have attributes', {
					id: 'TESTOPTION_two'
				});
				expect(options[1].querySelector('span'), 'to have text', '222');
			});

			it('calls the renderer exactly once for each option', () => {
				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow, { button: 0 });
				expect(optionRenderer, 'was called times', 4);
			});
		});

		describe('optionRendererDisabled', () => {

			// TODO: These tests are failing after JSDOM 8.x
			// Need to find a new way to test whether a link has been followed
			return;

			var optionRenderer;
			var renderLink = (props) => {
				return <a {...props} >Upgrade here!</a>;
			};

			var links = [
				{ href: 'http://keystonejs.com' },
				{ href: 'http://thinkmill.com.au', target: '_blank' }
			];

			var ops = [
				{ label: 'Disabled', value: 'disabled', disabled: true, link: renderLink(links[0]) },
				{ label: 'Disabled 2', value: 'disabled_2', disabled: true, link: renderLink(links[1]) },
				{ label: 'Enabled', value: 'enabled' }
			];

			/**
			 * Since we don't have access to an actual Location object,
			 * this method will test a string (path) by the end of global.window.location.href
			 * @param  {string}  path Ending href path to check
			 * @return {Boolean}      Whether the location is at the path
			 */
			var isNavigated = (path) => {
				var window_location = global.window.location.href;
				return window_location.indexOf(path, window_location.length - path.length) !== -1;
			};

			var startUrl = 'http://dummy/startLink';

			beforeEach(() => {
				window.location.href = startUrl;

				optionRenderer = (option) => {
					return (
						<span>{option.label} {option.link} </span>
					);
				};

				optionRenderer = sinon.spy(optionRenderer);

				instance = createControl({
					options: ops,
					optionRenderer: optionRenderer
				});
			});

			it('disabled option link is still clickable', () => {
				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow);
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				var link = options[0].querySelector('a');
				expect(link, 'to have attributes', {
					href: links[0].href
				});

				expect(isNavigated(links[0].href), 'to be false');
				TestUtils.Simulate.click(link);
				expect(isNavigated(links[0].href), 'to be true');
			});

			it('disabled option link with target doesn\'t navigate the current window', () => {
				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow);
				var options = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-option');
				var link = options[1].querySelector('a');
				expect(link, 'to have attributes', {
					href: links[1].href,
					target: '_blank'
				});

				expect(isNavigated(startUrl), 'to be true');
				TestUtils.Simulate.click(link);
				expect(isNavigated(links[1].href), 'to be false');
			});
		});

		describe('placeholder', () => {

			beforeEach(() => {

				wrapper = createControlWithWrapper({
					value: null,
					options: defaultOptions,
					placeholder: 'Choose Option Placeholder test'
				});
			});

			it('uses the placeholder initially', () => {
				expect(ReactDOM.findDOMNode(instance), 'queried for', PLACEHOLDER_SELECTOR,
					'to have items satisfying',
					'to have text', 'Choose Option Placeholder test');
			});

			it('displays a selected value', () => {

				wrapper.setPropsForChild({
					value: 'three'
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', DISPLAYED_SELECTION_SELECTOR,
					'to have items satisfying',
					'to have text', 'Three');
			});

			it('returns to the default placeholder when value is cleared', () => {

				wrapper.setPropsForChild({
					value: 'three'
				});

				wrapper.setPropsForChild({
					value: null
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-placeholder',
					'to have items satisfying',
					'to have text', 'Choose Option Placeholder test');
			});

			it('allows changing the placeholder via props', () => {

				wrapper.setPropsForChild({
					placeholder: 'New placeholder from props'
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-placeholder',
					'to have items satisfying',
					'to have text', 'New placeholder from props');
			});

			it('allows setting the placeholder to the selected value', () => {

				/*  This is an unlikely scenario, but given that the current
				 *  implementation uses the placeholder to display the selected value,
				 *  it seems prudent to check that this obscure case still works
				 *
				 *  We set the value via props, then change the placeholder to the
				 *  same as the display label for the chosen option, then reset
				 *  the value (to null).
				 *
				 *  The expected result is that the display does NOT change, as the
				 *  placeholder is now the same as label.
				 */

				wrapper.setPropsForChild({
					value: 'three'
				});

				wrapper.setPropsForChild({
					placeholder: 'Three'    // Label for value 'three'
				});

				wrapper.setPropsForChild({
					value: null
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-placeholder',
					'to have items satisfying',
					'to have text', 'Three');

			});
		});

		describe('searchingText', () => {

			// TODO: Need to use the new Select.Async control for this
			return;

			var asyncOptions;
			var asyncOptionsCallback;

			beforeEach(() => {

				asyncOptions = sinon.spy();

				instance = createControl({
					asyncOptions: asyncOptions,
					autoload: false,
					searchingText: 'Testing async loading...',
					noResultsText: 'Testing No results found',
					searchPromptText: 'Testing enter search query'
				});
			});

			it('uses the searchingText whilst the asyncOptions are loading', () => {

				clickArrowToOpen();
				expect(asyncOptions, 'was not called');
				typeSearchText('abc');
				expect(asyncOptions, 'was called');
				expect(ReactDOM.findDOMNode(instance), 'to contain elements matching', '.Select-loading');
				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-searching',
					'to have text', 'Testing async loading...');
			});

			it('clears the searchingText when results arrive', () => {

				clickArrowToOpen();
				typeSearchText('abc');

				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-searching',
					'to have text', 'Testing async loading...');

				asyncOptions.args[0][1](null, {
					options: [{ value: 'abc', label: 'Abc' }]
				});

				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-noresults');
			});

			it('switches the searchingText to noResultsText when options arrive, but empty', () => {

				clickArrowToOpen();
				typeSearchText('abc');

				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-searching',
					'to have text', 'Testing async loading...');
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-noresults');

				asyncOptions.args[0][1](null, {
					options: []
				});

				expect(ReactDOM.findDOMNode(instance), 'queried for first', '.Select-noresults',
					'to have text', 'Testing No results found');
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-searching');
			});
		});

		describe('searchPromptText', () => {

			// TODO: Need to use the new Select.Async control for this
			return;

			var asyncOptions;

			beforeEach(() => {

				asyncOptions = sinon.stub();

				instance = createControl({
					asyncOptions: asyncOptions,
					autoload: false,
					searchPromptText: 'Unit test prompt text'
				});
			});

			it('uses the searchPromptText before text is entered', () => {

				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow);

				expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-search-prompt',
					'to have items satisfying',
					'to have text', 'Unit test prompt text');
			});

			it('clears the searchPromptText when results arrive', () => {

				asyncOptions.callsArgWith(1, null, {
					options: [{ value: 'abcd', label: 'ABCD' }]
				});

				var selectArrow = ReactDOM.findDOMNode(instance).querySelector('.Select-arrow');
				TestUtils.Simulate.mouseDown(selectArrow);

				typeSearchText('abc');
				expect(asyncOptions, 'was called once');

				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-prompt');
				expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-noresults');
			});
		});

		describe('with tabSelectsValue=false', () => {

			beforeEach(() => {

				instance = createControl({
					options: defaultOptions,
					tabSelectsValue: false
				});
			});

			it('should not accept when tab is pressed', () => {

				// Search 'h', should only show 'Three'
				typeSearchText('h');
				pressTabToAccept();
				expect(onChange, 'was not called');
			});
		});

		describe('valueRenderer', () => {

			var valueRenderer;

			beforeEach(() => {

				valueRenderer = (option) => {
					return (
						<span id={'TESTOPTION_' + option.value}>{option.label.toUpperCase()}</span>
					);
				};

				valueRenderer = sinon.spy(valueRenderer);

				instance = createControl({
					options: defaultOptions,
					value: 'three',
					valueRenderer: valueRenderer
				});
			});


			it('renders the value using the provided renderer', () => {

				var labelNode = ReactDOM.findDOMNode(instance).querySelector('.Select-value span.Select-value-label span');
				expect(labelNode, 'to have text', 'THREE');
				expect(labelNode, 'to have attributes', {
					id: 'TESTOPTION_three'
				});
			});
		});

		describe('valueRenderer and multi=true', () => {
			var valueRenderer;

			beforeEach(() => {

				valueRenderer = (option) => {
					return (
						<span id={'TESTOPTION_' + option.value} className="custom-render">{option.label.toUpperCase()}</span>
					);
				};

				valueRenderer = sinon.spy(valueRenderer);

				instance = createControl({
					options: defaultOptions,
					value: 'three,two',
					multi: true,
					valueRenderer: valueRenderer
				});
			});

			it('renders the values using the provided renderer', () => {

				var labelNode = ReactDOM.findDOMNode(instance).querySelectorAll('.Select-value-label span.custom-render');
				expect(labelNode[0], 'to have text', 'THREE');
				expect(labelNode[0], 'to have attributes', {
					id: 'TESTOPTION_three'
				});
				expect(labelNode[1], 'to have text', '222');
				expect(labelNode[1], 'to have attributes', {
					id: 'TESTOPTION_two'
				});
			});
		});

		describe('required', () => {

			it('input should have required attribute if value is empty', () => {
				instance = createControl({
					options: defaultOptions,
					value: '',
					required: true
				});

				const inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
				expect(inputNode, 'to have attributes', {
					required: true
				});
			});

			it('input should have required attribute after adding a value', () => {
				instance = createControl({
					options: defaultOptions,
					value: '',
					required: true
				});

				expect(instance.state.required, 'to be true');
				typeSearchText('three');
				pressEnterToAccept();
				expect(instance.state.required, 'to be false');
			});

			it('input should not have required attribute if value is present', () => {
				instance = createControl({
					options: defaultOptions,
					value: 'one',
					required: true
				});

				const inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
				expect(inputNode, 'to have attributes', {
					required: undefined
				});
			});

			it('input should have required attribute after removing the value', () => {
				instance = createControl({
					options: defaultOptions,
					value: 'one',
					required: true
				});

				expect(instance.state.required, 'to be false');
				instance.setValue([]);
				expect(instance.state.required, 'to be true');
			});

			it('input should not have required attribute after updating the component with a value', () => {
				wrapper = createControlWithWrapper({
					options: defaultOptions,
					value: '',
					required: true
				});

				expect(instance.state.required, 'to be true');
				wrapper.setPropsForChild({ value: 'one' });
				expect(instance.state.required, 'to be false');
			});

			it('input should not have required attribute after updating the component with a value and options', () => {
				wrapper = createControlWithWrapper({
					options: defaultOptions,
					value: 'one',
					required: true
				});

				expect(instance.state.required, 'to be false');
				wrapper.setPropsForChild({
					value: 'newValue',
					options: [
						{ value: 'newValue', label: 'New value, new options' }
					]
				});
				expect(instance.state.required, 'to be false');
			});

		});

		describe('required with multi=true', () => {

			it('input should have required attribute if value is empty', () => {

				instance = createControl({
					options: defaultOptions,
					value: '',
					multi: true,
					required: true
				});

				const inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
				expect(inputNode, 'to have attributes', {
					required: true
				});
			});

			it('input should not have required attribute after adding values', () => {
				instance = createControl({
					options: defaultOptions,
					value: '',
					multi: true,
					required: true
				});

				expect(instance.state.required, 'to be true');
				typeSearchText('three');
				pressEnterToAccept();
				expect(instance.state.required, 'to be false');
			});

			it('input should not have required attribute if value is present', () => {

				instance = createControl({
					options: defaultOptions,
					value: 'one,two',
					multi: true,
					required: true
				});

				const inputNode = ReactDOM.findDOMNode(instance).querySelector('input');
				expect(inputNode, 'to have attributes', {
					required: undefined
				});
			});

			it('input should have required attribute after removing values', () => {
				instance = createControl({
					options: defaultOptions,
					value: 'one,two',
					multi: true,
					required: true
				});

				expect(instance.state.required, 'to be false');
				instance.setValue([]);
				expect(instance.state.required, 'to be true');
			});

		});
	});

	describe('outside event', () => {

		beforeEach(() => {
			instance = createControl({
				options: defaultOptions
			});
			TestUtils.Simulate.mouseDown(getSelectControl(instance), { button: 0 });
			expect(ReactDOM.findDOMNode(instance), 'queried for', '.Select-option',
				'to have length', 4);
		});

		it('click closes the menu', () => {
			TestUtils.Simulate.blur(searchInputNode);
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
		});

		it('touch closes the menu', () => {
			const evt = document.createEvent('Event');
			evt.initEvent('touchstart', true, true);
			document.querySelector('body').dispatchEvent(evt);
			expect(ReactDOM.findDOMNode(instance), 'to contain no elements matching', '.Select-option');
		});

	});

	describe('with autosize=false', () => {
		beforeEach(() => {
			instance = createControl({
				autosize: false,
			});
		});

		it('creates a plain input instead of an autosizable input', () => {
			const inputNode = ReactDOM.findDOMNode(instance.input);
			expect(inputNode.tagName, 'to equal', 'INPUT');
		});
	});

	describe('custom menuRenderer option', () => {
		it('should render the custom menu', () => {
			const instance = createControl({
				options: [1,2,3],
				menuRenderer: () => <div className="customMenu">Custom menu</div>
			});
			clickArrowToOpen();
			expect(ReactDOM.findDOMNode(instance), 'to contain elements matching', '.customMenu');
		});

		it('should pass the expected parameters', () => {
			let paramsReceived;
			const instance = createControl({
				options: [1,2,3],
				menuRenderer: (params) => {
					paramsReceived = params;
					return <div>Custom menu</div>;
				}
			});
			clickArrowToOpen();
			const keys = Object.keys(paramsReceived);
			expect(keys, 'to contain', 'focusedOption');
			expect(keys, 'to contain', 'focusOption');
			expect(keys, 'to contain', 'labelKey');
			expect(keys, 'to contain', 'options');
			expect(keys, 'to contain', 'selectValue');
			expect(keys, 'to contain', 'valueArray');
		});
	});

	describe('accessibility', () => {

		describe('with basic searchable control', () => {

			beforeEach(() => {

				instance = createControl({
					options: [
						{ value: 'one', label: 'label one' },
						{ value: 'two', label: 'label two' },
						{ value: 'three', label: 'label three' }
					],
					value: 'two'
				});
			});

			it('renders an input with a combobox role', () => {

				expect(instance, 'to contain', <input role="combobox" />);
			});

			it('renders an input with a combobox role and without popup', () => {

				expect(instance, 'to contain', <input role="combobox" aria-haspopup="false" aria-expanded="false" />);
			});

			it('renders the correct selected value id', () => {
				expect(instance, 'queried for', <input role="combobox" />)
					.then(input => {
						var currentValueId = input.attributes['aria-activedescendant'].value;

						return expect(ReactDOM.findDOMNode(instance),
							'queried for', '#' + currentValueId,
							'to satisfy', [ expect.it('to have text', 'label two') ]);
					});
			});

			it('sets the haspopup and expanded to true when menu is shown', () => {
				expect(instance,
					'with event keyDown', ARROW_DOWN, 'on', <div className="Select-control" />,
					'to contain', <input role="combobox" aria-haspopup="true" aria-expanded="true" />);
			});

			it('sets the active descendant when the next item is highlighted', () => {
				expect(instance,
					'with event', 'keyDown', ARROW_DOWN, 'on', <div className="Select-control" />,
					'with event', 'keyDown', ARROW_DOWN, 'on', <div className="Select-control" />,
					'queried for', <input role="combobox" />)
					.then(input => {
						const currentHighlightId = input.attributes['aria-activedescendant'].value;
						expect(ReactDOM.findDOMNode(instance).querySelector('#' + currentHighlightId),
							'to have text', 'label three');
					});
			});

			it('passes through the aria-labelledby prop', () => {

				instance = createControl({
					options: defaultOptions,
					value: 'one',
					'aria-labelledby': 'test-label-id'
				});

				expect(instance,
					'to contain', <input role="combobox" aria-labelledby="test-label-id" />);
			});

			it('passes through the aria-label prop', () => {

				instance = createControl({
					options: defaultOptions,
					value: 'one',
					'aria-label': 'This is a test label'
				});

				expect(instance,
					'to contain', <input role="combobox" aria-label="This is a test label" />);
			});
		});

		describe('with multiselect', () => {

			beforeEach(() => {

				wrapper = createControlWithWrapper({
					options: [
						{ value: 'one', label: 'label one' },
						{ value: 'two', label: 'label two' },
						{ value: 'three', label: 'label three' },
						{ value: 'four', label: 'label four' },
						{ value: 'five', label: 'label five' }
					],
					value: [ 'three', 'two' ],
					multi: true
				}, {
					wireUpOnChangeToValue: true
				});
			});

			it('shows the `press backspace to remove` message for the last item', () => {
				expect(instance,
					'to contain',
					<span className="Select-aria-only" aria-live="assertive">
						Press backspace to remove label two
					</span>);
			});

			it('hides the `press backspace to remove` message on blur', () => {
				expect(instance,
					'with event blur', 'on', <input role="combobox" />,
					'not to contain',
					<span className="Select-aria-only" aria-live="assertive">
						Press backspace to remove label two
					</span>);
			});

			it('updates the backspace message when the selected values update', () => {

				wrapper.setPropsForChild({ value: [ 'three', 'two', 'one' ] });
				expect(instance,
					'to contain',
					<span className="Select-aria-only" aria-live="assertive">
						Press backspace to remove label one
					</span>);
			});

			it('updates the active descendant after a selection', () => {

				return expect(wrapper,
					'with event keyDown', ARROW_DOWN, 'on', <div className="Select-control" />,
					'with event keyDown', KEY_ENTER, 'on', <div className="Select-control" />,
					'queried for', <input role="combobox" />)
					.then(input => {

						// [ 'three', 'two', 'one' ] is now selected,
						// therefore in-focus should be 'four'

						const activeId = input.attributes['aria-activedescendant'].value;
						expect(ReactDOM.findDOMNode(instance), 'queried for first', '#' + activeId, 'to have text', 'label four');
					});

			});
		});
	});
});
