import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default class PostEditSetting extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleTimeLimitChange = this.handleTimeLimitChange.bind(this);
    }

    handleChange(e) {
        this.props.onChange(this.props.id, e.target.value);
    }

    handleTimeLimitChange(e) {
        this.props.onChange(this.props.timeLimitId, e.target.value);
    }

    render() {
        return (
            <Setting
                label={this.props.label}
                inputId={this.props.id}
                helpText={this.props.helpText}
            >
                <div className='radio'>
                    <label>
                        <input
                            type='radio'
                            value={Constants.ALLOW_EDIT_POST_ALWAYS}
                            name={this.props.id}
                            checked={this.props.value === Constants.ALLOW_EDIT_POST_ALWAYS}
                            onChange={this.handleChange}
                            disabled={this.props.disabled}
                        />
                        {Utils.localizeMessage('admin.general.policy.allowEditPostAlways', 'Any time')}
                    </label>
                </div>
                <div className='radio'>
                    <label>
                        <input
                            type='radio'
                            value={Constants.ALLOW_EDIT_POST_NEVER}
                            name={this.props.id}
                            checked={this.props.value === Constants.ALLOW_EDIT_POST_NEVER}
                            onChange={this.handleChange}
                            disabled={this.props.disabled}
                        />
                        {Utils.localizeMessage('admin.general.policy.allowEditPostNever', 'Never')}
                    </label>
                </div>
                <div className='radio form-inline'>
                    <label>
                        <input
                            type='radio'
                            value={Constants.ALLOW_EDIT_POST_TIME_LIMIT}
                            name={this.props.id}
                            checked={this.props.value === Constants.ALLOW_EDIT_POST_TIME_LIMIT}
                            onChange={this.handleChange}
                            disabled={this.props.disabled}
                        />
                        <input
                            type='text'
                            value={this.props.timeLimitValue}
                            className='form-control'
                            name={this.props.timeLimitId}
                            onChange={this.handleTimeLimitChange}
                            disabled={this.props.disabled || this.props.value !== Constants.ALLOW_EDIT_POST_TIME_LIMIT}
                        />
                        <span> {Utils.localizeMessage('admin.general.policy.allowEditPostTimeLimit', 'seconds after posting')}</span>
                    </label>
                </div>
            </Setting>
        );
    }
}

PostEditSetting.defaultProps = {
    isDisabled: false
};

PostEditSetting.propTypes = {
    id: PropTypes.string.isRequired,
    timeLimitId: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    value: PropTypes.string.isRequired,
    timeLimitValue: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    helpText: PropTypes.node
};
