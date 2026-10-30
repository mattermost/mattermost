// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

const messages = defineMessages({
    label: {id: 'admin.logs.logFormatTitle', defaultMessage: 'Log format'},
    structured: {id: 'admin.logs.logFormatStructured', defaultMessage: 'Structured'},
    plain: {id: 'admin.logs.logFormatPlain', defaultMessage: 'Plain text'},
});

type Props = {
    isPlainLogs: boolean;
    onChange: (isPlainLogs: boolean) => void;
};

export default function LogFormatMenu({isPlainLogs, onChange}: Props) {
    const {formatMessage} = useIntl();

    return (
        <Menu.Container
            menuButton={{
                id: 'serverLogsFormatMenuButton',
                class: 'inputWithMenu',
                'aria-label': formatMessage({id: 'admin.logs.logFormat.menuButtonAriaLabel', defaultMessage: 'Open menu to select the log format'}),
                as: 'div',
                children: (
                    <Input
                        label={formatMessage(messages.label)}
                        name='serverLogsFormat'
                        value={formatMessage(isPlainLogs ? messages.plain : messages.structured)}
                        readOnly={true}
                        inputSuffix={<i className='icon icon-chevron-down'/>}
                    />
                ),
            }}
            menu={{
                id: 'serverLogsFormatMenu',
                'aria-label': formatMessage({id: 'admin.logs.logFormat.dropdownAriaLabel', defaultMessage: 'Log format menu'}),
            }}
        >
            <Menu.Item
                id='serverLogsFormatStructured'
                role='menuitemradio'
                aria-checked={!isPlainLogs}
                forceCloseOnSelect={true}
                labels={<FormattedMessage {...messages.structured}/>}
                trailingElements={!isPlainLogs && <i className='icon icon-check'/>}
                onClick={() => onChange(false)}
            />
            <Menu.Item
                id='serverLogsFormatPlain'
                role='menuitemradio'
                aria-checked={isPlainLogs}
                forceCloseOnSelect={true}
                labels={<FormattedMessage {...messages.plain}/>}
                trailingElements={isPlainLogs && <i className='icon icon-check'/>}
                onClick={() => onChange(true)}
            />
        </Menu.Container>
    );
}
