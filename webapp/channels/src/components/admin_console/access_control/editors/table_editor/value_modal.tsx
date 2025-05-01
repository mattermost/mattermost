// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import './value_modal.scss';

interface ValueModalProps {
    onClose: () => void;
    onAdd: (value: string) => void;
    newValue: string;
    setNewValue: (value: string) => void;
}

/**
 * A modal component for adding values to attributes in the table editor
 */
const ValueModal: React.FC<ValueModalProps> = ({
    onClose,
    onAdd,
    newValue,
    setNewValue,
}) => {
    // Handle input changes
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setNewValue(e.target.value);
    }, [setNewValue]);

    // Handle add button click
    const handleAddClick = useCallback(() => {
        if (newValue.trim()) {
            onAdd(newValue);
        }
    }, [newValue, onAdd]);

    return (
        <div className='value-modal-backdrop'>
            <div className='value-modal'>
                {/* Modal Header */}
                <div className='value-modal-header'>
                    <FormattedMessage
                        id='admin.access_control.table_editor.add_value'
                        defaultMessage='Add value'
                    />
                    <button
                        className='value-modal-close'
                        onClick={onClose}
                        aria-label='Close'
                    >
                        <i className='icon icon-close'/>
                    </button>
                </div>

                {/* Modal Content */}
                <div className='value-modal-content'>
                    <input
                        type='text'
                        value={newValue}
                        onChange={handleChange}
                        placeholder='Type attribute value here'
                        autoFocus={true}
                        aria-label='Value'
                    />

                    {/* Modal Actions */}
                    <div className='value-modal-actions'>
                        <button
                            className='value-modal-cancel'
                            onClick={onClose}
                        >
                            <FormattedMessage
                                id='admin.access_control.table_editor.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            className='value-modal-add'
                            onClick={handleAddClick}
                            disabled={!newValue.trim()}
                        >
                            <FormattedMessage
                                id='admin.access_control.table_editor.add'
                                defaultMessage='Add'
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValueModal;
