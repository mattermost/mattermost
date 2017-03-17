'use strict';
/* eslint react/jsx-boolean-value: 0 */

// Emulating the DOM here, only so that if this test file gets
// included first, then React thinks there's a DOM, so the other tests
// (e.g. Select-test.js) that do require a DOM work correctly

var jsdomHelper = require('../testHelpers/jsdomHelper');
jsdomHelper();
var unexpected = require('unexpected');
var unexpectedReact = require('unexpected-react');
var unexpectedSinon = require('unexpected-sinon');
var expect = unexpected
	.clone()
	.installPlugin(unexpectedReact)
	.installPlugin(unexpectedSinon);

var React = require('react');
var ReactDOM = require('react-dom');
var TestUtils = require('react-addons-test-utils');
var sinon = require('sinon');

var Select = require('../src/Select');

describe('Async', () => {
	let asyncInstance, asyncNode, filterInputNode, loadOptions;

	function createControl (props = {}) {
		loadOptions = props.loadOptions || sinon.stub();
		asyncInstance = TestUtils.renderIntoDocument(
			<Select.Async
				autoload={false}
				openOnFocus
				{...props}
				loadOptions={loadOptions}
			/>
		);
		asyncNode = ReactDOM.findDOMNode(asyncInstance);
		findAndFocusInputControl();
	};

	function createOptionsResponse (options) {
		return {
			options: options.map((option) => ({
				label: option,
				value: option
			}))
	  };
	}

	function findAndFocusInputControl () {
		filterInputNode = asyncNode.querySelector('input');
		if (filterInputNode) {
			TestUtils.Simulate.focus(filterInputNode);
		}
	};

	function typeSearchText (text) {
		TestUtils.Simulate.change(filterInputNode, { target: { value: text } });
	};

	describe('autoload', () => {
		it('false does not call loadOptions on-mount', () => {
			createControl({
				autoload: false
			});
			expect(loadOptions, 'was not called');
		});

		it('true calls loadOptions on-mount', () => {
			createControl({
				autoload: true
			});
			expect(loadOptions, 'was called');
		});
	});

	describe('cache', () => {
		it('should be used instead of loadOptions if input has been previously loaded', () => {
			createControl();
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 1);
			typeSearchText('b');
			return expect(loadOptions, 'was called times', 2);
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 2);
			typeSearchText('b');
			return expect(loadOptions, 'was called times', 2);
			typeSearchText('c');
			return expect(loadOptions, 'was called times', 3);
		});

		it('can be disabled by passing null/false', () => {
			createControl({
				cache: false
			});
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 1);
			typeSearchText('b');
			return expect(loadOptions, 'was called times', 2);
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 3);
			typeSearchText('b');
			return expect(loadOptions, 'was called times', 4);
		});

		it('can be customized', () => {
			createControl({
				cache: {
					a: []
				}
			});
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 0);
			typeSearchText('b');
			return expect(loadOptions, 'was called times', 1);
			typeSearchText('a');
			return expect(loadOptions, 'was called times', 1);
		});
	});

	describe('loadOptions', () => {
		it('calls the loadOptions when search input text changes', () => {
			createControl();
			typeSearchText('te');
			typeSearchText('tes');
			typeSearchText('te');
			return expect(loadOptions, 'was called times', 3);
		});

		it('shows the loadingPlaceholder text while options are being fetched', () => {
			function loadOptions (input, callback) {}
			createControl({
				loadOptions,
				loadingPlaceholder: 'Loading'
			});
			typeSearchText('te');
			return expect(asyncNode.textContent, 'to contain', 'Loading');
		});

		describe('with callbacks', () => {
			it('should display the loaded options', () => {
				function loadOptions (input, resolve) {
					resolve(null, createOptionsResponse(['foo']));
				}
				createControl({
					cache: false,
					loadOptions
				});
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0);
				typeSearchText('foo');
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1);
				expect(asyncNode.querySelector('[role=option]').textContent, 'to equal', 'foo');
			});

			it('should display the most recently-requested loaded options (if results are returned out of order)', () => {
				const callbacks = [];
				function loadOptions (input, callback) {
				  callbacks.push(callback);
				}
				createControl({
					cache: false,
					loadOptions
				});
				typeSearchText('foo');
				typeSearchText('bar');
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0);
				callbacks[1](null, createOptionsResponse(['bar']));
				callbacks[0](null, createOptionsResponse(['foo']));
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1);
				expect(asyncNode.querySelector('[role=option]').textContent, 'to equal', 'bar');
			});

			it('should handle an error by setting options to an empty array', () => {
				function loadOptions (input, resolve) {
					resolve(new Error('error'));
				}
				createControl({
					cache: false,
					loadOptions,
					options: createOptionsResponse(['foo']).options
				});
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1);
				typeSearchText('bar');
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0);
			});
		});

		describe('with promises', () => {
			it('should display the loaded options', () => {
				let promise;
				function loadOptions (input) {
					promise = expect.promise((resolve, reject) => {
						resolve(createOptionsResponse(['foo']));
					});
					return promise;
				}
				createControl({
					autoload: false,
					cache: false,
					loadOptions
				});
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0);
				typeSearchText('foo');
				return expect.promise.all([promise])
					.then(() => expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1))
					.then(() => expect(asyncNode.querySelector('[role=option]').textContent, 'to equal', 'foo'));
			});

			it('should display the most recently-requested loaded options (if results are returned out of order)', () => {
				createControl({
					autoload: false,
					cache: false
				});
				let resolveFoo, resolveBar;
				const promiseFoo = expect.promise((resolve, reject) => {
					resolveFoo = resolve;
				});
				const promiseBar = expect.promise((resolve, reject) => {
					resolveBar = resolve;
				});
				loadOptions.withArgs('foo').returns(promiseFoo);
				loadOptions.withArgs('bar').returns(promiseBar);
				typeSearchText('foo');
				typeSearchText('bar');
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0);
				resolveBar(createOptionsResponse(['bar']));
				resolveFoo(createOptionsResponse(['foo']));
				return expect.promise.all([promiseFoo, promiseBar])
					.then(() => expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1))
					.then(() => expect(asyncNode.querySelector('[role=option]').textContent, 'to equal', 'bar'));
			});

			it('should handle an error by setting options to an empty array', () => {
				let promise, rejectPromise;
				function loadOptions (input, resolve) {
					promise = expect.promise((resolve, reject) => {
						rejectPromise = reject;
					});
					return promise;
				}
				createControl({
					autoload: false,
					cache: false,
					loadOptions,
					options: createOptionsResponse(['foo']).options
				});
				expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 1);
				typeSearchText('bar');
				rejectPromise(new Error('error'));
				return expect.promise.all([promise])
					.catch(() => expect(asyncNode.querySelectorAll('[role=option]').length, 'to equal', 0));
			});
		});
	});

	describe('with ignoreAccents', () => {
		it('calls loadOptions with unchanged text', () => {
			createControl({
				ignoreAccents: true,
				ignoreCase: false
			});
			typeSearchText('TeSt');
			expect(loadOptions, 'was called with', 'TeSt');
		});

		it('strips accents before calling loadOptions when enabled', () => {
			createControl({
				ignoreAccents: true,
				ignoreCase: false
			});
			typeSearchText('Gedünstmaßig');
			// This should really be Gedunstmassig: ß -> ss
			expect(loadOptions, 'was called with', 'Gedunstmasig');
		});

		it('does not strip accents before calling loadOptions when diabled', () => {
			createControl({
				ignoreAccents: false,
				ignoreCase: false
			});
			typeSearchText('Gedünstmaßig');
			expect(loadOptions, 'was called with', 'Gedünstmaßig');
		});
	});

	describe('with ignore case', () => {
		it('converts everything to lowercase when enabled', () => {
			createControl({
				ignoreAccents: false,
				ignoreCase: true
			});
			typeSearchText('TeSt');
			expect(loadOptions, 'was called with', 'test');
		});

		it('converts accents to lowercase when enabled', () => {
			createControl({
				ignoreAccents: false,
				ignoreCase: true
			});
			typeSearchText('WÄRE');
			expect(loadOptions, 'was called with', 'wäre');
		});

		it('does not convert text to lowercase when disabled', () => {
			createControl({
				ignoreAccents: false,
				ignoreCase: false
			});
			typeSearchText('WÄRE');
			expect(loadOptions, 'was called with', 'WÄRE');
		});
	});

	describe('with ignore case and ignore accents', () => {
		it('converts everything to lowercase', () => {
			createControl({
				ignoreAccents: true,
				ignoreCase: true
			});
			typeSearchText('TeSt');
			expect(loadOptions, 'was called with', 'test');
		});

		it('removes accents and converts to lowercase', () => {
			createControl({
				ignoreAccents: true,
				ignoreCase: true
			});
			typeSearchText('WÄRE');
			expect(loadOptions, 'was called with', 'ware');
		});
	});

	describe('children function', () => {
		it('should allow a custom select type to be rendered', () => {
			let childProps;
			createControl({
				autoload: true,
				children: (props) => {
					childProps = props;
					return (
						<div>faux select</div>
					);
				}
			});
			expect(asyncNode.textContent, 'to equal', 'faux select');
			expect(childProps.isLoading, 'to equal', true);
		});

		it('should render a Select component by default', () => {
			createControl();
			expect(asyncNode.className, 'to contain', 'Select');
		});
	});
});
