'use strict';
/* global describe, it, beforeEach */
/* eslint react/jsx-boolean-value: 0 */

// Copied from Async-test verbatim; may need to be reevaluated later.
var jsdomHelper = require('../testHelpers/jsdomHelper');
jsdomHelper();
var unexpected = require('unexpected');
var unexpectedDom = require('unexpected-dom');
var unexpectedReact = require('unexpected-react');
var expect = unexpected
	.clone()
	.installPlugin(unexpectedDom)
	.installPlugin(unexpectedReact);

var React = require('react');
var ReactDOM = require('react-dom');
var TestUtils = require('react-addons-test-utils');
var Select = require('../src/Select');

describe('Creatable', () => {
	let creatableInstance, creatableNode, filterInputNode, innserSelectInstance, renderer;

	beforeEach(() => renderer = TestUtils.createRenderer());

	const defaultOptions = [
		{ value: 'one', label: 'One' },
		{ value: 'two', label: '222' },
		{ value: 'three', label: 'Three' },
		{ value: 'four', label: 'AbcDef' }
	];

	function createControl (props = {}) {
		props.options = props.options || defaultOptions;
		creatableInstance = TestUtils.renderIntoDocument(
			<Select.Creatable {...props} />
		);
		creatableNode = ReactDOM.findDOMNode(creatableInstance);
		innserSelectInstance = creatableInstance.select;
		findAndFocusInputControl();
	};

	function findAndFocusInputControl () {
		filterInputNode = creatableNode.querySelector('input');
		if (filterInputNode) {
			TestUtils.Simulate.focus(filterInputNode);
		}
	};

	function typeSearchText (text) {
		TestUtils.Simulate.change(filterInputNode, { target: { value: text } });
	};

	it('should render a decorated Select (with passed through properties)', () => {
		createControl({
			inputProps: {
				className: 'foo'
			}
		});
		expect(creatableNode.querySelector('.Select-input'), 'to have attributes', {
			class: ['foo']
		});
	});

	it('should add a placeholder "create..." prompt when filter text is entered that does not match any existing options', () => {
		createControl();
		typeSearchText('foo');
		expect(creatableNode.querySelector('.Select-create-option-placeholder'), 'to have text', Select.Creatable.promptTextCreator('foo'));
	});

	it('should not show a "create..." prompt if current filter text is an exact match for an existing option', () => {
		createControl({
			isOptionUnique: () => false
		});
		typeSearchText('existing');
		expect(creatableNode.querySelector('.Select-menu-outer').textContent, 'not to equal', Select.Creatable.promptTextCreator('existing'));
	});

	it('should filter the "create..." prompt using both filtered options and currently-selected options', () => {
		let isOptionUniqueParams;
		createControl({
			filterOptions: () => [
				{ value: 'one', label: 'One' }
			],
			isOptionUnique: (params) => {
				isOptionUniqueParams = params;
			},
			multi: true,
			options: [
				{ value: 'one', label: 'One' },
				{ value: 'two', label: 'Two' }
			],
			value: [
				{ value: 'three', label: 'Three' }
			]
		});
		typeSearchText('test');
		const { options } = isOptionUniqueParams;
		const values = options.map(option => option.value);
		expect(values, 'to have length', 2);
		expect(values, 'to contain', 'one');
		expect(values, 'to contain', 'three');
	});

	it('should guard against invalid values returned by filterOptions', () => {
		createControl({
			filterOptions: () => null
		});
		typeSearchText('test');;
	});

	it('should not show a "create..." prompt if current filter text is not a valid option (as determined by :isValidNewOption prop)', () => {
		createControl({
			isValidNewOption: () => false
		});
		typeSearchText('invalid');
		expect(creatableNode.querySelector('.Select-menu-outer').textContent, 'not to equal', Select.Creatable.promptTextCreator('invalid'));
	});

	it('should create (and auto-select) a new option when placeholder option is clicked', () => {
		let selectedOption;
		const options = [];
		createControl({
			onChange: (option) => selectedOption = option,
			options
		});
		typeSearchText('foo');
		TestUtils.Simulate.mouseDown(creatableNode.querySelector('.Select-create-option-placeholder'));
		expect(options, 'to have length', 1);
		expect(options[0].label, 'to equal', 'foo');
		expect(selectedOption, 'to be', options[0]);
	});

	it('should create (and auto-select) a new option when ENTER is pressed while placeholder option is selected', () => {
		let selectedOption;
		const options = [];
		createControl({
			onChange: (option) => selectedOption = option,
			options,
			shouldKeyDownEventCreateNewOption: () => true
		});
		typeSearchText('foo');
		TestUtils.Simulate.keyDown(filterInputNode, { keyCode: 13 });
		expect(options, 'to have length', 1);
		expect(options[0].label, 'to equal', 'foo');
		expect(selectedOption, 'to be', options[0]);
	});

	it('should not create a new option if the placeholder option is not selected but should select the focused option', () => {
		const options = [{ label: 'One', value: 1 }];
		createControl({
			options,
			shouldKeyDownEventCreateNewOption: ({ keyCode }) => keyCode === 13
		});
		typeSearchText('on'); // ['Create option "on"', 'One']
		TestUtils.Simulate.keyDown(filterInputNode, { keyCode: 40, key: 'ArrowDown' }); // Select 'One'
		TestUtils.Simulate.keyDown(filterInputNode, { keyCode: 13 });
		expect(options, 'to have length', 1);
	});

	it('should allow a custom select type to be rendered via the :children property', () => {
		let childProps;
		createControl({
			children: (props) => {
				childProps = props;
				return <div>faux select</div>;
			}
		});
		expect(creatableNode.textContent, 'to equal', 'faux select');
		expect(childProps.allowCreate, 'to equal', true);
	});

	it('default :children function renders a Select component', () => {
		createControl();
		expect(creatableNode.className, 'to contain', 'Select');
	});

	it('default :isOptionUnique function should do a simple equality check for value and label', () => {
		const options = [
			newOption('foo', 1),
			newOption('bar', 2),
			newOption('baz', 3)
		];

		function newOption (label, value) {
			return { label, value };
		};

		function test (option) {
			return Select.Creatable.isOptionUnique({
				labelKey: 'label',
				option,
				options,
				valueKey: 'value'
			});
		};

		expect(test(newOption('foo', 0)), 'to be', false);
		expect(test(newOption('qux', 1)), 'to be', false);
		expect(test(newOption('qux', 4)), 'to be', true);
		expect(test(newOption('Foo', 11)), 'to be', true);
	});

	it('default :isValidNewOption function should just ensure a non-empty string is provided', () => {
		function test (label) {
			return Select.Creatable.isValidNewOption({ label });
		};

		expect(test(''), 'to be', false);
		expect(test('a'), 'to be', true);
		expect(test(' '), 'to be', true);
	});

	it('default :newOptionCreator function should create an option with a :label and :value equal to the label string', () => {
		const option = Select.Creatable.newOptionCreator({
			label: 'foo',
			labelKey: 'label',
			valueKey: 'value'
		});
		expect(option.className, 'to equal', 'Select-create-option-placeholder');
		expect(option.label, 'to equal', 'foo');
		expect(option.value, 'to equal', 'foo');
	});

	it('default :shouldKeyDownEventCreateNewOption function should accept TAB, ENTER, and comma keys', () => {
		function test (keyCode) {
			return Select.Creatable.shouldKeyDownEventCreateNewOption({ keyCode });
		};

		expect(test(9), 'to be', true);
		expect(test(13), 'to be', true);
		expect(test(188), 'to be', true);
		expect(test(1), 'to be', false);
	});
});
