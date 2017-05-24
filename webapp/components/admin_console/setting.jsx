// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

export default class Settings extends PureComponent {
    static propTypes = {
        inputId: PropTypes.string,
        label: PropTypes.node.isRequired,
        children: PropTypes.node.isRequired,
        helpText: PropTypes.node
    };

    render() {
        const {children, helpText, inputId, label} = this.props;

        return (
            <div className='form-group'>
                <label
                    className='control-label col-sm-4'
                    htmlFor={inputId}
                >
                    {label}
                </label>
                <div className='col-sm-8'>
                    {children}
                    <div className='help-text'>
                        {helpText}
                    </div>
                </div>
            </div>
        );
    }
}
