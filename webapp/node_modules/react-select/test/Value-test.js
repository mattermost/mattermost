'use strict';
/* global describe, it, beforeEach */

var helper = require('../testHelpers/jsdomHelper');
helper();

var unexpected = require('unexpected');
var unexpectedDom = require('unexpected-dom');
var unexpectedSinon = require('unexpected-sinon');
var sinon = require('sinon');

var expect = unexpected
	.clone()
	.installPlugin(unexpectedSinon)
	.installPlugin(unexpectedDom);

var React = require('react');
var ReactDOM = require('react-dom');
var TestUtils = require('react-addons-test-utils');

var OPTION = { label: 'TEST-LABEL', value: 'TEST-VALUE' };

var Value = require('../src/Value');

describe('Value component', function() {

	var props;
	var value;

	beforeEach(function() {
		props = {
			value: OPTION,
			onRemove: sinon.spy()
		};
		value = TestUtils.renderIntoDocument(<Value {...props}>{OPTION.label}</Value>);
	});

	it('requests its own removal when the remove icon is clicked', function() {
		var selectItemIcon = TestUtils.findRenderedDOMComponentWithClass(value, 'Select-value-icon');
		TestUtils.Simulate.mouseDown(selectItemIcon);
		expect(props.onRemove, 'was called');
	});

	it('requests its own removal when the remove icon is touched', function() {
		var selectItemIcon = TestUtils.findRenderedDOMComponentWithClass(value, 'Select-value-icon');
		TestUtils.Simulate.touchStart(selectItemIcon);
		TestUtils.Simulate.touchEnd(selectItemIcon);
		expect(props.onRemove, 'was called');
	});

	it('ignores its own removal when the remove icon is touched and dragged', function() {
		var selectItemIcon = TestUtils.findRenderedDOMComponentWithClass(value, 'Select-value-icon');
		TestUtils.Simulate.touchStart(selectItemIcon);
		TestUtils.Simulate.touchMove(selectItemIcon);
		TestUtils.Simulate.touchEnd(selectItemIcon);
		expect(props.onRemove, 'was not called');
	});

	describe('without a custom click handler', function() {

		it('presents the given label', function() {
			var selectItemLabel = TestUtils.findRenderedDOMComponentWithClass(value, 'Select-value-label');
			expect(ReactDOM.findDOMNode(selectItemLabel), 'to have text', OPTION.label);
		});

	});

	describe('with a custom click handler', function() {
		var valueLabel;

		beforeEach(function() {
			props = {
				value: OPTION,
				onRemove: sinon.spy(),
				onClick: sinon.spy(),
			};
			value = TestUtils.renderIntoDocument(<Value {...props}>{OPTION.label}</Value>);
			valueLabel = TestUtils.findRenderedDOMComponentWithClass(value, 'Select-value-label');
		});

		it('presents the given label', function() {
			expect(ReactDOM.findDOMNode(valueLabel), 'to have text', OPTION.label);
		});

		it('calls a custom callback when the anchor is clicked', function() {
			TestUtils.Simulate.mouseDown(valueLabel, { button: 0 });
			expect(props.onClick, 'was called');
		});

		it('calls a custom callback when the anchor is touched', function() {
			TestUtils.Simulate.touchEnd(valueLabel);
			expect(props.onClick, 'was called');
		});

	});

});
