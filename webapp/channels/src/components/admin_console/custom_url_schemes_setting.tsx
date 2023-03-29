// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import LocalizedInput from 'components/localized_input/localized_input';

import Setting from './setting';

const arrayToString = (arr: string[]) => {
    return arr.join(',');
};

const stringToArray = (str: string) => {
    return str.split(',').map((s) => s.trim()).filter(Boolean);
};

type Props = {
    id: string;
    value: string[];
    onChange: (id: string, value: string[]) => void;
    disabled?: boolean;
    setByEnv: boolean;
};

const CustomURLSchemesSetting = ({
    id,
    value,
    onChange,
    disabled = false,
    setByEnv,
}: Props) => {
    const [state, setState] = React.useState(arrayToString(value));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valueAsArray = stringToArray(e.target.value);

        onChange(id, valueAsArray);

        setState(e.target.value);
    };

    const label = Utils.localizeMessage('admin.customization.customUrlSchemes', 'Custom URL Schemes:');
    const helpText = Utils.localizeMessage(
        'admin.customization.customUrlSchemesDesc',
        'Allows message text to link if it begins with any of the comma-separated URL schemes listed. By default, the following schemes will create links: "http", "https", "ftp", "tel", and "mailto".',
    );

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
            setByEnv={setByEnv}
        >
            <LocalizedInput
                id={id}
                className='form-control'
                type='text'
                placeholder={{id: t('admin.customization.customUrlSchemesPlaceholder'), defaultMessage: 'E.g.: "git,smtp"'}}
                value={state}
                onChange={handleChange}
                disabled={disabled || setByEnv}
            />
        </Setting>
    );
};

export default CustomURLSchemesSetting;
