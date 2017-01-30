// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class Setting extends React.Component {
    render() {
        return (
            <div className='form-group'>
                <label
                    className='control-label col-sm-4'
                    htmlFor={this.props.inputId}
                >
                    {this.props.label}
                </label>
                <div className='col-sm-8'>
                    {this.props.children}
                    <div className='help-text'>
                        {this.props.helpText}
                    </div>
                </div>
            </div>
        );
    }
}
Setting.defaultProps = {
};

Setting.propTypes = {
    inputId: React.PropTypes.string,
    label: React.PropTypes.node.isRequired,
    children: React.PropTypes.node.isRequired,
    helpText: React.PropTypes.node
};
