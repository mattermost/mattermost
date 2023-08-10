// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {MobileChannelHeaderDropdown} from 'components/channel_header_dropdown';

import MobileChannelHeaderPlug from 'plugins/mobile_channel_header_plug';

import ChannelInfoButton from './channel_info_button';
import CollapseLhsButton from './collapse_lhs_button';
import CollapseRhsButton from './collapse_rhs_button';
import ShowSearchButton from './show_search_button';
import UnmuteChannelButton from './unmute_channel_button';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    channel?: Channel;

    /**
     * Relative url for the team, used to redirect if a link in the channel header is clicked
     */
    currentRelativeTeamUrl?: string;

    inGlobalThreads?: boolean;
    inDrafts?: boolean;
    isMobileView: boolean;
    isMuted?: boolean;
    isReadOnly?: boolean;
    isRHSOpen?: boolean;
    user: UserProfile;
    actions: {
        closeLhs: () => void;
        closeRhs: () => void;
        closeRhsMenu: () => void;
    };
}

export default class ChannelHeaderMobile extends React.PureComponent<Props> {
    componentDidMount() {
        document.querySelector('.inner-wrap')?.addEventListener('click', this.hideSidebars);
    }

    componentWillUnmount() {
        document.querySelector('.inner-wrap')?.removeEventListener('click', this.hideSidebars);
    }

    hideSidebars = (e: Event) => {
        if (this.props.isMobileView) {
            if (this.props.isRHSOpen) {
                this.props.actions.closeRhs();
            }

            const target = e.target as HTMLElement | undefined;

            if (target && target.className !== 'navbar-toggle' && target.className !== 'icon-bar') {
                this.props.actions.closeLhs();
                this.props.actions.closeRhsMenu();
            }
        }
    };

    render() {
        const {user, channel, isMuted, inGlobalThreads, inDrafts} = this.props;

        let heading;
        if (inGlobalThreads) {
            heading = (
                <FormattedMessage
                    id='globalThreads.heading'
                    defaultMessage='Followed threads'
                />
            );
        } else if (inDrafts) {
            heading = (
                <FormattedMessage
                    id='drafts.heading'
                    defaultMessage='Drafts'
                />
            );
        } else if (channel) {
            heading = (
                <>
                    <MobileChannelHeaderDropdown/>
                    {isMuted && (
                        <UnmuteChannelButton
                            user={user}
                            channel={channel}
                        />
                    )}
                </>
            );
        }

        return (
            <nav
                id='navbar'
                className='navbar navbar-default navbar-fixed-top'
                role='navigation'
            >
                <div className='container-fluid theme'>
                    <div className='navbar-header'>
                        <CollapseLhsButton/>
                        <div className={classNames('navbar-brand', {GlobalThreads___title: inGlobalThreads})}>
                            {heading}
                        </div>
                        <div className='spacer'/>
                        {channel && (
                            <ChannelInfoButton
                                channel={channel}
                            />
                        )}
                        <ShowSearchButton/>
                        {channel && (
                            <MobileChannelHeaderPlug
                                channel={channel}
                                isDropdown={false}
                            />
                        )}
                        <CollapseRhsButton/>
                    </div>
                </div>
            </nav>
        );
    }
}
