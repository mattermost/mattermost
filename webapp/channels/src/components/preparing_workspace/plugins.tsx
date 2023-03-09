// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import {t} from 'utils/i18n';
import MultiSelectCards from 'components/common/multi_select_cards';

import GithubSVG from 'components/common/svg_images_components/github_svg';
import GitlabSVG from 'components/common/svg_images_components/gitlab_svg';
import CelebrateSVG from 'components/common/svg_images_components/celebrate_svg';
import JiraSVG from 'components/common/svg_images_components/jira_svg';
import ZoomSVG from 'components/common/svg_images_components/zoom_svg';
import TodoSVG from 'components/common/svg_images_components/todo_svg';
import ExternalLink from 'components/external_link';

import {Animations, mapAnimationReasonToClass, Form, PreparingWorkspacePageProps} from './steps';

import Title from './title';
import Description from './description';
import PageBody from './page_body';

import SingleColumnLayout from './single_column_layout';

import './plugins.scss';

type Props = PreparingWorkspacePageProps & {
    options: Form['plugins'];
    setOption: (option: keyof Form['plugins']) => void;
    className?: string;
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
                    {props.previous}
                    <Title>
                        <FormattedMessage
                            id={'onboarding_wizard.plugins.title'}
                            defaultMessage='Welcome to Mattermost!'
                        />
                        <div className='subtitle'>
                            <CelebrateSVG/>
                            <FormattedMessage
                                id={'onboarding_wizard.plugins.subtitle'}
                                defaultMessage='(almost there!)'
                            />
                        </div>
                    </Title>
                    <Description>
                        <FormattedMessage
                            id={'onboarding_wizard.plugins.description'}
                            defaultMessage={'Mattermost is better when integrated with the tools your team uses for collaboration. Popular tools are below, select the ones your team uses and we\'ll add them to your workspace. Additional set up may be needed later.'}
                        />
                    </Description>
                    <PageBody>
                        <MultiSelectCards
                            size='small'
                            next={props.next}
                            cards={[
                                {
                                    onClick: () => props.setOption('github'),
                                    icon: <GithubSVG/>,
                                    id: t('onboarding_wizard.plugins.github'),
                                    defaultMessage: 'GitHub',
                                    checked: props.options.github,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.github.tooltip',
                                        defaultMessage: 'Subscribe to repositories, stay up to date with reviews, assignments',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('gitlab'),
                                    icon: <GitlabSVG/>,
                                    id: t('onboarding_wizard.plugins.gitlab'),
                                    defaultMessage: 'GitLab',
                                    checked: props.options.gitlab,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.gitlab.tooltip',
                                        defaultMessage: 'GitLab tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('jira'),
                                    icon: <JiraSVG/>,
                                    id: t('onboarding_wizard.plugins.jira'),
                                    defaultMessage: 'Jira',
                                    checked: props.options.jira,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.jira.tooltip',
                                        defaultMessage: 'Jira tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('zoom'),
                                    icon: <ZoomSVG/>,
                                    id: t('onboarding_wizard.plugins.zoom'),
                                    defaultMessage: 'Zoom',
                                    checked: props.options.zoom,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.zoom.tooltip',
                                        defaultMessage: 'Zoom tooltip',
                                    }),
                                },
                                {
                                    onClick: () => props.setOption('todo'),
                                    icon: <TodoSVG/>,
                                    id: t('onboarding_wizard.plugins.todo'),
                                    defaultMessage: 'To do',
                                    checked: props.options.todo,
                                    tooltip: formatMessage({
                                        id: 'onboarding_wizard.plugins.todo.tooltip',
                                        defaultMessage: 'To do tooltip',
                                    }),
                                },
                            ]}
                        />
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
                                            >
                                                {chunks}
                                            </ExternalLink>
                                        </strong>
                                    ),
                                }}
                            />
                        </div>
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
                            className='tertiary-button'
                            onClick={props.skip}
                        >
                            <FormattedMessage
                                id={'onboarding_wizard.skip'}
                                defaultMessage='Skip for now'
                            />
                        </button>
                    </div>
                </SingleColumnLayout>
            </div>
        </CSSTransition>
    );
};

export default Plugins;
