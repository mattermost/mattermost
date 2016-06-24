// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';

export default class SettingItemMax extends React.Component {
    constructor(props) {
        super(props);

        this.onKeyDown = this.onKeyDown.bind(this);
    }

    onKeyDown(e) {
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.props.submit(e);
        }
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
    }

    render() {
        var clientError = null;
        if (this.props.client_error) {
            clientError = (<div className='form-group'><label className='col-sm-12 has-error'>{this.props.client_error}</label></div>);
        }

        var serverError = null;
        if (this.props.server_error) {
            serverError = (<div className='form-group'><label className='col-sm-12 has-error'>{this.props.server_error}</label></div>);
        }

        var extraInfo = null;
        if (this.props.extraInfo) {
            extraInfo = (<div className='setting-list__hint'>{this.props.extraInfo}</div>);
        }

        var submit = '';
        if (this.props.submit) {
            submit = (
                <input
                    type='submit'
                    className='btn btn-sm btn-primary'
                    href='#'
                    onClick={this.props.submit}
                    value={Utils.localizeMessage('setting_item_max.save', 'Save')}
                >
                </input>
            );
        }

        var inputs = this.props.inputs;
        var widthClass;
        if (this.props.width === 'full') {
            widthClass = 'col-sm-12';
        } else if (this.props.width === 'medium') {
            widthClass = 'col-sm-10 col-sm-offset-2';
        } else {
            widthClass = 'col-sm-9 col-sm-offset-3';
        }

        let title;
        if (this.props.title) {
            title = <li className='col-sm-12 section-title'>{this.props.title}</li>;
        }

        return (
            <ul className='section-max form-horizontal'>
                {title}
                <li className={widthClass}>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {inputs}
                            {extraInfo}
                        </li>
                        <li className='setting-list-item'>
                            <hr/>
                            {this.props.submitExtra}
                            {serverError}
                            {clientError}
                            {submit}
                            <a
                                className='btn btn-sm theme'
                                href='#'
                                onClick={this.props.updateSection}
                            >
                                <FormattedMessage
                                    id='setting_item_max.cancel'
                                    defaultMessage='Cancel'
                                />
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

SettingItemMax.propTypes = {
    inputs: React.PropTypes.array,
    client_error: React.PropTypes.string,
    server_error: React.PropTypes.string,
    extraInfo: React.PropTypes.element,
    updateSection: React.PropTypes.func,
    submit: React.PropTypes.func,
    title: React.PropTypes.node,
    width: React.PropTypes.string,
    submitExtra: React.PropTypes.node
};
