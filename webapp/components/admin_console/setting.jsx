import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default function Setting(props) {
    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
                htmlFor={props.inputId}
            >
                {props.label}
            </label>
            <div className='col-sm-8'>
                {props.children}
                <div className='help-text'>
                    {props.helpText}
                </div>
            </div>
        </div>
    );
}
Setting.defaultProps = {
};

Setting.propTypes = {
    inputId: PropTypes.string,
    label: PropTypes.node.isRequired,
    children: PropTypes.node.isRequired,
    helpText: PropTypes.node
};
