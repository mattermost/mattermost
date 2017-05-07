// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

export default class SettingItemMin extends React.Component {
    render() {
        let editButton = null;
        if (!this.props.disableOpen) {
            editButton = (
                <li className='col-xs-12 col-sm-3 section-edit'>
                    <a
                        id={Utils.createSafeId(this.props.title) + 'Edit'}
                        className='theme'
                        href='#'
                        onClick={this.props.updateSection}
                    >
                        <i className='fa fa-pencil'/>
                        <FormattedMessage
                            id='setting_item_min.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        return (
            <ul
                className='section-min'
                onClick={this.props.updateSection}
            >
                <li className='col-xs-12 col-sm-9 section-title'>{this.props.title}</li>
                {editButton}
                <li
                    id={Utils.createSafeId(this.props.title) + 'Desc'}
                    className='col-xs-12 section-describe'
                >
                    {this.props.describe}
                </li>
            </ul>
        );
    }
}

SettingItemMin.propTypes = {
    title: React.PropTypes.node,
    disableOpen: React.PropTypes.bool,
    updateSection: React.PropTypes.func,
    describe: React.PropTypes.node
};
