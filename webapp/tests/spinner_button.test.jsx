
var jsdom = require('mocha-jsdom');
var assert = require('assert');
import TestUtils from 'react-addons-test-utils';
import SpinnerButton from '../components/spinner_button.jsx';
import React from 'react';

describe('SpinnerButton', function() {
    this.timeout(10000);
    jsdom();

    it('check props', function() {
        const spinner = TestUtils.renderIntoDocument(
            <SpinnerButton spinning={false}/>
        );

        assert.equal(spinner.props.spinning, false, 'should start in the default false state');
    });
});
