// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import QuickInput, {MaxLengthInput} from 'components/quick_input';

const MAX_LDAP_LENGTH = 64;

type Props = {
    initialValue: string;
    fieldType: string;
    onExited: () => void;
    onSave: (value: string) => Promise<void>;
    error: string | null;
    helpText: React.ReactNode;
    modalHeaderText: JSX.Element;
};

const AttributeModal = ({
    initialValue,
    fieldType,
    onExited,
    onSave,
    error,
    helpText,
    modalHeaderText,
}: Props) => {
    const [value, setValue] = useState(initialValue);
    const handleClear = () => setValue('');
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
    const handleCancel = () => onExited();
    const handleConfirm = () => onSave(value);
    const isConfirmDisabled = () => value.length > MAX_LDAP_LENGTH;

    const showTypeWarning = fieldType !== 'text';

    return (
        <GenericModal
            id='attributeModal'
            modalHeaderText={modalHeaderText}
            confirmButtonText={
                <FormattedMessage
                    id='save'
                    defaultMessage='Save'
                />
            }
            compassDesign={true}
            onExited={onExited}
            handleEnterKeyPress={handleConfirm}
            handleConfirm={handleConfirm}
            handleCancel={handleCancel}
            isConfirmDisabled={isConfirmDisabled()}
        >
            <QuickInput
                size='lg'
                inputComponent={MaxLengthInput}
                autoFocus={true}
                className='form-control filter-textbox'
                placeholder={'department'}
                type='text'
                value={value}
                clearable={true}
                onClear={handleClear}
                onChange={handleChange}
            />
            <span className='help-text'>
                {helpText}
            </span>
            {showTypeWarning && (
                <div
                    className='alert alert-warning'
                    style={{marginTop: '12px'}}
                >
                    <FormattedMessage
                        id='admin.customProfileAttribWarning'
                        defaultMessage='(Warning) This attribute will be converted to a TEXT attribute, if the field is set to synchronize.'
                    />
                </div>
            )}
            {error && <div className='error-text'>{error}</div>}
        </GenericModal>
    );
};

export default AttributeModal;
