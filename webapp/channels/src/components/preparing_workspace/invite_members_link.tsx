// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import useCopyText from 'components/common/hooks/useCopyText';
import {trackEvent} from 'actions/telemetry_actions';

import './invite_members_link.scss';

type Props = {
    inviteURL: string;
    inputAndButtonStyle?: boolean;
}

const InviteMembersLink = ({
    inviteURL,
    inputAndButtonStyle = false,
}: Props) => {
    const copyText = useCopyText({
        trackCallback: () => trackEvent('first_admin_setup', 'admin_setup_click_copy_invite_link'),
        text: inviteURL,
    });
    const intl = useIntl();

    return (
        <div className='InviteMembersLink'>
            {inputAndButtonStyle &&
                <input
                    className='InviteMembersLink__input'
                    type='text'
                    readOnly={true}
                    value={inviteURL}
                    aria-label={intl.formatMessage({
                        id: 'onboarding_wizard.invite_members.copy_link_input',
                        defaultMessage: 'team invite link',
                    })}
                    data-testid='shareLinkInput'
                />
            }
            <button
                className={`InviteMembersLink__button${inputAndButtonStyle ? '' : '--single'}`}
                onClick={copyText.onClick}
                data-testid='shareLinkInputButton'
            >
                {copyText.copiedRecently ? (
                    <>
                        <i className='icon icon-check'/>
                        <FormattedMessage
                            id='onboarding_wizard.invite_members.copied_link'
                            defaultMessage='Link Copied'
                        />
                    </>
                ) : (
                    <>
                        {inputAndButtonStyle ? <i className='icon icon-link-variant'/> : <i className='icon icon-content-copy'/>}
                        <FormattedMessage
                            id='onboarding_wizard.invite_members.copy_link'
                            defaultMessage='Copy Link'
                        />
                    </>
                )
                }
            </button>
        </div>
    );
};

export default InviteMembersLink;
