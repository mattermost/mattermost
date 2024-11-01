// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

import {FIELD_IDS} from './constants';

type Props = {
    value: boolean;
    onChange: (id: string, value: boolean) => void;
    isDisabled?: boolean;
    isMHPNS: boolean;
}

function renderLinkTerms(msg: string) {
    return (
        <ExternalLink
            href='https://mattermost.com/hpns-terms/'
            location='push_settings'
        >
            {msg}
        </ExternalLink>
    );
}

function renderLinkPrivacy(msg: string) {
    return (
        <ExternalLink
            href='https://mattermost.com/data-processing-addendum/'
            location='push_settings'
        >
            {msg}
        </ExternalLink>
    );
}

const TOSCheckbox = ({
    isMHPNS,
    onChange,
    value,
    isDisabled,
}: Props) => {
    const handleChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(FIELD_IDS.AGREE, e.target.checked);
    }, [onChange]);

    if (!isMHPNS) {
        return null;
    }

    return (
        <div className='form-group'>
            <div className='col-sm-4'/>
            <div className='col-sm-8'>
                <input
                    type='checkbox'
                    checked={value}
                    onChange={handleChanged}
                    disabled={isDisabled}
                />
                <FormattedMessage
                    id='admin.email.agreeHPNS'
                    defaultMessage=' I understand and accept the Mattermost Hosted Push Notification Service <linkTerms>Terms of Service</linkTerms> and <linkPrivacy>Privacy Policy</linkPrivacy>.'
                    values={{
                        linkTerms: renderLinkTerms,
                        linkPrivacy: renderLinkPrivacy,
                    }}
                />
            </div>
        </div>
    );
};

export default TOSCheckbox;
