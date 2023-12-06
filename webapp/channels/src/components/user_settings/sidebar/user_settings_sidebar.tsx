// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import LimitVisibleGMsDMs from './limit_visible_gms_dms';
import ShowUnreadsCategory from './show_unreads_category';

export interface Props {
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
}

export default function UserSettingsSidebar(props: Props): JSX.Element {
    const {formatMessage} = useIntl();

    return (
        <div>
            <div className='modal-header'>
                <button
                    id='closeButton'
                    type='button'
                    className='close'
                    data-dismiss='modal'
                    aria-label='Close'
                    onClick={props.closeModal}
                >
                    <span aria-hidden='true'>{'×'}</span>
                </button>
                <h4 className='modal-title'>
                    <div
                        className='modal-back'
                        onClick={props.collapseModal}
                    >
                        <i
                            className='fa fa-angle-left'
                            title={formatMessage({id: 'generic_icons.collapse', defaultMessage: 'Collapse Icon'})}
                        />
                    </div>
                    <FormattedMessage
                        id='user.settings.sidebar.title'
                        defaultMessage='Sidebar Settings'
                    />
                </h4>
            </div>
            <div
                id='sidebarTitle'
                className='user-settings'
            >
                <h3 className='tab-header'>
                    <FormattedMessage
                        id='user.settings.sidebar.title'
                        defaultMessage='Sidebar Settings'
                    />
                </h3>
                <div className='divider-dark first'/>
                <ShowUnreadsCategory
                    active={props.activeSection === 'showUnreadsCategory'}
                    updateSection={props.updateSection}
                    areAllSectionsInactive={props.activeSection === ''}
                />
                <div className='divider-dark'/>
                <LimitVisibleGMsDMs
                    active={props.activeSection === 'limitVisibleGMsDMs'}
                    updateSection={props.updateSection}
                    areAllSectionsInactive={props.activeSection === ''}
                />
                <div className='divider-dark'/>
            </div>
        </div>
    );
}
