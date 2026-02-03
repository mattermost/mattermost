// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    text: ReactNode;
    closeModal: () => void;
    collapseModal: () => void;
}
const SettingMobileHeader = ({
    text,
    closeModal,
    collapseModal,
}: Props) => {
    const intl = useIntl();

    return (
        <div className='modal-header'>
            <button
                id='closeButton'
                type='button'
                className='close'
                data-dismiss='modal'
                onClick={closeModal}
            >
                <span aria-hidden='true'>{'×'}</span>
            </button>
            <h4 className='modal-title'>
                <div className='modal-back'>
                    <i
                        className='fa fa-angle-left'
                        aria-label={
                            intl.formatMessage({
                                id: 'generic_icons.collapse',
                                defaultMessage: 'Collapse Icon',
                            })
                        }
                        onClick={collapseModal}
                    />
                </div>
                {text}
            </h4>
        </div>
    );
};

export default SettingMobileHeader;
