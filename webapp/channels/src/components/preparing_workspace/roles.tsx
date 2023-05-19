// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import {Animations, mapAnimationReasonToClass, Form, PreparingWorkspacePageProps} from './steps';

import Title from './title';
import Description from './description';
import PageBody from './page_body';
import SingleColumnLayout from './single_column_layout';

import PageLine from './page_line';
import './roles.scss';
import classNames from 'classnames';
import QuickInput from 'components/quick_input';
import {localizeMessage} from 'mattermost-redux/utils/i18n_utils';

const Roles = [
    {
        id: 'product_teams',
        name: localizeMessage('onboarding_wizard.roles.product_teams', 'Product Teams'),
    },
    {
        id: 'devops',
        name: localizeMessage('onboarding_wizard.roles.product_teams', 'Devops'),
    },
    {
        id: 'leadership',
        name: localizeMessage('onboarding_wizard.roles.leadership', 'Leadership'),
    },
    {
        id: 'engineering',
        name: localizeMessage('onboarding_wizard.roles.engineering', 'Engineering'),
    },
    {
        id: 'project_management',
        name: localizeMessage('onboarding_wizard.roles.project_management', 'Project Management'),
    },
    {
        id: 'marketing',
        name: localizeMessage('onboarding_wizard.roles.marketing', 'Marketing'),
    },
    {
        id: 'design',
        name: localizeMessage('onboarding_wizard.roles.design', 'Design'),
    },
    {
        id: 'qa',
        name: localizeMessage('onboarding_wizard.roles.qa', 'QA'),
    },
    {
        id: 'other',
        name: localizeMessage('onboarding_wizard.roles.other', 'Other'),
    },
];

type Props = PreparingWorkspacePageProps & {
    role: Form['role'];
    roleOther: Form['roleOther'];
    setRole: (role: string, roleOther: string) => void;
    className?: string;
    quickNext(role: string): void;
}
const RolesPage = ({role, next, ...props}: Props) => {
    const {formatMessage} = useIntl();
    let className = 'Roles-body';

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
            id={'onboarding_wizard.roles.title'}
            defaultMessage='What is your primary function?'
        />
    );
    const description = (
        <FormattedMessage
            id={'onboarding_wizard.roles.description'}
            defaultMessage={'We’ll use this to suggest templates to help get you started.'}
        />
    );

    const selectRole = (role: string) => {
        if (role !== 'other') {
            props.quickNext(role);
        }
        props.setRole(role, '');
    };

    const roleIsSet = Boolean(role);
    const roleOtherIsSet = Boolean(props.roleOther);
    const canContinue = (roleIsSet && role !== 'other') || (role === 'other' && roleOtherIsSet);

    return (
        <CSSTransition
            in={props.show}
            timeout={Animations.PAGE_SLIDE}
            classNames={mapAnimationReasonToClass('Roles', props.transitionDirection)}
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
                        <div className='Roles-list'>
                            {Roles.map((rle) => (
                                <button
                                    key={rle.id}
                                    className={classNames('role-button', {active: rle.id === role})}
                                    onClick={() => selectRole(rle.id)}
                                >
                                    {rle.name}
                                </button>
                            ))}
                        </div>
                        {role === 'other' && (
                            <QuickInput
                                value={props.roleOther || ''}
                                className='Roles__input'
                                onChange={(e) => props.setRole('other', e.target.value)}
                                placeholder={formatMessage({
                                    id: 'onboarding_wizard.roles.other_input_placeholder',
                                    defaultMessage: 'Please share your primary function',
                                })}
                            />
                        )}
                    </PageBody>
                    <div>
                        <button
                            className='primary-button'
                            onClick={next}
                            disabled={!canContinue}
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

export default RolesPage;
