// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import LocalizedInput from 'components/localized_input/localized_input';

import Setting from './setting';

export default class CustomURLSchemesSetting extends React.PureComponent {
    static get propTypes() {
        return {
            id: PropTypes.string.isRequired,
            value: PropTypes.array.isRequired,
            onChange: PropTypes.func.isRequired,
            disabled: PropTypes.bool,
            setByEnv: PropTypes.bool.isRequired,
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            value: this.arrayToString(props.value),
        };
    }

    stringToArray = (str) => {
        return str.split(',').map((s) => s.trim()).filter(Boolean);
    };

    arrayToString = (arr) => {
        return arr.join(',');
    };

    handleChange = (e) => {
        const valueAsArray = this.stringToArray(e.target.value);

        this.props.onChange(this.props.id, valueAsArray);

        this.setState({
            value: e.target.value,
        });
    };

    render() {
        const label = Utils.localizeMessage('admin.customization.customUrlSchemes', 'Custom URL Schemes:');
        const helpText = Utils.localizeMessage(
            'admin.customization.customUrlSchemesDesc',
            'Allows message text to link if it begins with any of the comma-separated URL schemes listed. By default, the following schemes will create links: "http", "https", "ftp", "tel", and "mailto".',
        );

        return (
            <Setting
                label={label}
                helpText={helpText}
                inputId={this.props.id}
                setByEnv={this.props.setByEnv}
            >
                <LocalizedInput
                    id={this.props.id}
                    className='form-control'
                    type='text'
                    placeholder={{id: t('admin.customization.customUrlSchemesPlaceholder'), defaultMessage: 'E.g.: "git,smtp"'}}
                    value={this.state.value}
                    onChange={this.handleChange}
                    disabled={this.props.disabled || this.props.setByEnv}
                />
            </Setting>
        );
    }
}
