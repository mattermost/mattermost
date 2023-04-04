// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useEffect} from 'react';
import {CSSTransition} from 'react-transition-group';
import {FormattedMessage} from 'react-intl';

import {Animations, mapAnimationReasonToClass, Form, PreparingWorkspacePageProps} from './steps';

import Title from './title';
import Description from './description';
import PageBody from './page_body';
import SingleColumnLayout from './single_column_layout';

import InviteMembersLink from './invite_members_link';
import PageLine from './page_line';
import './invite_members.scss';

type Props = PreparingWorkspacePageProps & {
    disableEdits: boolean;
    className?: string;
    teamInviteId?: string;
    formUrl: Form['url'];
    configSiteUrl?: string;
    browserSiteUrl: string;
}

const InviteMembers = (props: Props) => {
    let className = 'InviteMembers-body';
    if (props.className) {
        className += ' ' + props.className;
    }

    useEffect(props.onPageView, []);

    const inviteURL = useMemo(() => {
        let urlBase = '';
        if (props.configSiteUrl && !props.configSiteUrl.includes('localhost')) {
            urlBase = props.configSiteUrl;
        } else if (props.formUrl && !props.formUrl.includes('localhost')) {
            urlBase = props.formUrl;
        } else {
            urlBase = props.browserSiteUrl;
        }
        return `${urlBase}/signup_user_complete/?id=${props.teamInviteId}`;
    }, [props.teamInviteId, props.configSiteUrl, props.browserSiteUrl, props.formUrl]);

    const inviteInteraction = <InviteMembersLink inviteURL={inviteURL}/>;

    return (
        <CSSTransition
            in={props.show}
            timeout={Animations.PAGE_SLIDE}
            classNames={mapAnimationReasonToClass('InviteMembers', props.transitionDirection)}
            mountOnEnter={true}
            unmountOnExit={true}
        >
            <div className={className}>
                <SingleColumnLayout style={{width: 547}}>
                    <PageLine
                        style={{
                            marginBottom: '50px',
                            marginLeft: '50px',
                            height: 'calc(25vh)',
                        }}
                        noLeft={true}
                    />
                    {props.previous}
                    <Title>
                        <FormattedMessage
                            id={'onboarding_wizard.invite_members.title'}
                            defaultMessage='Invite your team members'
                        />
                    </Title>
                    <Description>
                        <FormattedMessage
                            id={'onboarding_wizard.invite_members.description_link'}
                            defaultMessage='Collaboration is tough by yourself. Invite a few team members using the invitation link below.'
                        />
                    </Description>
                    <PageBody>
                        {inviteInteraction}
                    </PageBody>
                    <div className='InviteMembers__submit'>
                        <button
                            className='primary-button'
                            disabled={props.disableEdits}
                            onClick={props.next}
                        >
                            <FormattedMessage
                                id={'onboarding_wizard.invite_members.next_link'}
                                defaultMessage='Finish setup'
                            />
                        </button>
                    </div>
                    <PageLine
                        style={{
                            marginTop: '50px',
                            marginLeft: '50px',
                            height: 'calc(30vh)',
                        }}
                        noLeft={true}
                    />
                </SingleColumnLayout>
            </div>
        </CSSTransition>
    );
};

export default InviteMembers;
