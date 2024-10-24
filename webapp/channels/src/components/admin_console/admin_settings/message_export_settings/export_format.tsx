// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import DropdownSetting from 'components/admin_console/dropdown_setting';

import {exportFormats} from 'utils/constants';

import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.exportFormat_title}/>;
const helpText = (
    <>
        <p>
            <FormattedMessage
                {...messages.exportFormat_description_intro}
            />
        </p>
        <p>
            <FormattedMessage
                {...messages.exportFormat_description_details}
                values={{
                    a: (chunks: string) => (
                        <Link to='/admin_console/environment/file_storage'>
                            {chunks}
                        </Link>
                    ),
                }}
            />
        </p>
    </>
);

type Props = {
    value: ComponentProps<typeof DropdownSetting>['value'];
    onChange: ComponentProps<typeof DropdownSetting>['onChange'];
    isDisabled?: boolean;
}

const ExportFormat = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const intl = useIntl();
    const exportFormatOptions = useMemo(() => [
        {value: exportFormats.EXPORT_FORMAT_ACTIANCE, text: intl.formatMessage({id: 'admin.complianceExport.exportFormat.actiance', defaultMessage: 'Actiance XML'})},
        {value: exportFormats.EXPORT_FORMAT_CSV, text: intl.formatMessage({id: 'admin.complianceExport.exportFormat.csv', defaultMessage: 'CSV'})},
        {value: exportFormats.EXPORT_FORMAT_GLOBALRELAY, text: intl.formatMessage({id: 'admin.complianceExport.exportFormat.globalrelay', defaultMessage: 'GlobalRelay EML'})},
    ], [intl]);

    const setByEnv = useIsSetByEnv('DataRetentionSettings.ExportFormat');

    return (
        <DropdownSetting
            id='exportFormat'
            values={exportFormatOptions}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default ExportFormat;
