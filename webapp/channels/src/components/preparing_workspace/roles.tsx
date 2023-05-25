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
import {useDispatch, useSelector} from 'react-redux';
import {getWorkTemplateCategories as fetchCategories} from 'mattermost-redux/actions/work_templates';
import {getWorkTemplateCategories} from 'selectors/work_template';
import classNames from 'classnames';
import QuickInput from 'components/quick_input';
import {CategoryOther} from '@mattermost/types/work_templates';

type Props = PreparingWorkspacePageProps & {
    role: Form['role'];
    roleOther: Form['roleOther'];
    setRole: (role: string, roleOther: string) => void;
    className?: string;
    quickNext(role: string): void;
}
const Roles = ({role, next, ...props}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const categories = useSelector(getWorkTemplateCategories);

    let className = 'Roles-body';

    useEffect(() => {
        dispatch(fetchCategories());
    }, []);

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
        if (role !== CategoryOther) {
            props.quickNext(role);
        }
        props.setRole(role, '');
    };

    const roleIsSet = Boolean(role);
    const roleOtherIsSet = Boolean(props.roleOther);
    const canContinue = (roleIsSet && role !== CategoryOther) || (role === CategoryOther && roleOtherIsSet);

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
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    className={classNames('role-button', {active: category.id === role})}
                                    onClick={() => selectRole(category.id)}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                        {role === CategoryOther && (
                            <QuickInput
                                value={props.roleOther || ''}
                                className='Roles__input'
                                onChange={(e) => props.setRole(CategoryOther, e.target.value)}
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

export default Roles;
