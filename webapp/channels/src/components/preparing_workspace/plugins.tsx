// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import MultiSelectCards from 'components/common/multi_select_cards';
import GithubSVG from 'components/common/svg_images_components/github_svg';
import GitlabSVG from 'components/common/svg_images_components/gitlab_svg';
import JiraSVG from 'components/common/svg_images_components/jira_svg';
import ServiceNowSVG from 'components/common/svg_images_components/servicenow_svg';
import ZoomSVG from 'components/common/svg_images_components/zoom_svg';
import ExternalLink from 'components/external_link';

import Description from './description';
import PageBody from './page_body';
import PageLine from './page_line';
import SingleColumnLayout from './single_column_layout';
import {Animations, mapAnimationReasonToClass} from './steps';
import type {Form, PreparingWorkspacePageProps} from './steps';
import Title from './title';

import './plugins.scss';

type Props = PreparingWorkspacePageProps & {
    options: Form['plugins'];
    setOption: (option: keyof Form['plugins']) => void;
    className?: string;
    isSelfHosted: boolean;
    handleVisitMarketPlaceClick: () => void;
}
const Plugins = (props: Props) => {
    const {formatMessage} = useIntl();
    let className = 'Plugins-body';

    useEffect(() => {
        if (props.show) {
            props.onPageView();
        }
    }, [props.show]);

    if (props.className) {
        className += ' ' + props.className;
    }

    const title = (
        <FormattedMessage
            id={'onboarding_wizard.self_hosted_plugins.title'}
            defaultMessage='What tools do you use?'
        />
    );

    const description = (
        <FormattedMessage
            id={'onboarding_wizard.self_hosted_plugins.description'}
            defaultMessage={'Choose the tools you work with, and we\'ll add them to your workspace. Additional set up may be needed later.'}
        />
    );

    return (
        <CSSTransition
            in={props.show}
            timeout={Animations.PAGE_SLIDE}
            classNames={mapAnimationReasonToClass('Plugins', props.transitionDirection)}
            mountOnEnter={true}
            unmountOnExit={true}
        >
            <div className={className}>
                <SingleColumnLayout>
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
                        {title}
                    </Title>
                    <Description>{description}</Description>
                    <PageBody>
                        <MultiSelectCards
                            size='small'
                            next={props.next}
                            cards={[
                                {
                                    onClick: () => props.setOption('github'),
                                    icon: <GithubSVG/>,
                                    id: 'onboarding_wizard.plugins.github',
                                    buttonText: formatMessage({
                                        id: 'onboarding_wizard.plugins.github',
                                        defaultMessage: 'GitHub',
                                    }),
                                    checked: props.options.github,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.github.tooltip',
                                        defaultMessage: 'Subscribe to repositories, stay up to date with reviews, assignments',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('gitlab'),
                                    icon: <GitlabSVG/>,
                                    id: 'onboarding_wizard.plugins.gitlab',
                                    buttonText: formatMessage({
                                        id: 'onboarding_wizard.plugins.gitlab',
                                        defaultMessage: 'GitLab',
                                    }),
                                    checked: props.options.gitlab,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.gitlab.tooltip',
                                        defaultMessage: 'GitLab tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('jira'),
                                    icon: <JiraSVG/>,
                                    id: 'onboarding_wizard.plugins.jira',
                                    buttonText: formatMessage({
                                        id: 'onboarding_wizard.plugins.jira',
                                        defaultMessage: 'Jira',
                                    }),
                                    checked: props.options.jira,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.jira.tooltip',
                                        defaultMessage: 'Jira tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('zoom'),
                                    icon: <ZoomSVG/>,
                                    id: 'onboarding_wizard.plugins.zoom',
                                    buttonText: formatMessage({
                                        id: 'onboarding_wizard.plugins.zoom',
                                        defaultMessage: 'Zoom',
                                    }),
                                    checked: props.options.zoom,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.zoom.tooltip',
                                        defaultMessage: 'Zoom tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('servicenow'),
                                    icon: <ServiceNowSVG/>,
                                    id: 'onboarding_wizard.plugins.servicenow',
                                    buttonText: formatMessage({
                                        id: 'onboarding_wizard.plugins.servicenow',
                                        defaultMessage: 'ServiceNow',
                                    }),
                                    checked: props.options.servicenow,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.servicenow.tooltip',
                                        defaultMessage: 'ServiceNow tooltip',
                                    }),
                                },
                            ]}
                        />
                        {props.isSelfHosted && (
                            <div className='Plugins__marketplace'>
                                <FormattedMessage
                                    id='onboarding_wizard.plugins.marketplace'
                                    defaultMessage='More tools can be added once your workspace is set up. To see all available integrations, <a>visit the Marketplace.</a>'
                                    values={{
                                        a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                            <strong>
                                                <ExternalLink
                                                    href='https://mattermost.com/marketplace/'
                                                    location='preparing_workspace_plugins'
                                                    onClick={props.handleVisitMarketPlaceClick}
                                                >
                                                    {chunks}
                                                </ExternalLink>
                                            </strong>
                                        ),
                                    }}
                                />
                            </div>
                        )}
                    </PageBody>
                    <div>
                        <button
                            className='primary-button'
                            onClick={props.next}
                        >
                            <FormattedMessage
                                id={'onboarding_wizard.next'}
                                defaultMessage='Continue'
                            />
                        </button>
                        <button
                            className='link-style plugins-skip-btn'
                            onClick={props.skip}
                        >
                            <FormattedMessage
                                id={'onboarding_wizard.skip-button'}
                                defaultMessage='Skip'
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

export default Plugins;
