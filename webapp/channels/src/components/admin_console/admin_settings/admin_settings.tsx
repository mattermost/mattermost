// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable react/require-optimization */

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import WithTooltip from 'components/with_tooltip';

type Props = {
    isDisabled?: boolean;
    renderTitle: () => JSX.Element;
    renderSettings: () => React.ReactNode;
    doSubmit: () => void;
    saving: boolean;
    saveNeeded: boolean;
    serverError?: React.ReactNode;
}

const AdminSettings = ({
    doSubmit,
    renderSettings,
    renderTitle,
    isDisabled,
    saving,
    saveNeeded,
    serverError,
}: Props) => {
    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        doSubmit();
    }, [doSubmit]);

    return (
        <form
            className='form-horizontal'
            role='form'
            onSubmit={handleSubmit}
        >
            <div className='wrapper--fixed'>
                <AdminHeader>
                    {renderTitle()}
                </AdminHeader>
                {renderSettings()}
                <div className='admin-console-save'>
                    <SaveButton
                        saving={saving}
                        disabled={isDisabled || !saveNeeded}
                        onClick={handleSubmit}
                        savingMessage={
                            <FormattedMessage
                                id='admin.saving'
                                defaultMessage='Saving Config...'
                            />
                        }
                    />
                    <WithTooltip
                        title={serverError ?? ''}
                    >
                        <div
                            className='error-message'
                        >
                            <FormError error={serverError}/>
                        </div>
                    </WithTooltip>
                </div>
            </div>
        </form>
    );
};

export default AdminSettings;
