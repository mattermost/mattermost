// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {useIntl} from 'react-intl';

import TadaSvg from './tada.svg';
import Illus from './illus.svg';

export enum ButtonCustomiserClasses {
    grayed = 'grayed',
    active = 'active',
    special = 'special',
    secondary = 'secondary',
    green = 'green',
}

type PlanBriefing = {
    title: string;
    items?: string[];
}

type PlanAddonsInfo = {
    title: string;
    items: PlanBriefing[];
}

type ButtonDetails = {
    action: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    text: ReactNode;
    disabled?: boolean;
    customClass?: ButtonCustomiserClasses;
}

type CardProps = {
    id: string;
    planLabel?: JSX.Element;
    plan: string;
    planSummary?: string;
    price?: string;
    rate?: ReactNode;
    planExtraInformation?: JSX.Element;
    buttonDetails?: ButtonDetails;
    customButtonDetails?: JSX.Element;
    contactSalesCTA?: JSX.Element;
    briefing: PlanBriefing;
    planAddonsInfo?: PlanAddonsInfo;
    planTrialDisclaimer?: JSX.Element;
}

export function BlankCard() {
    const {formatMessage} = useIntl();

    return (
        <div className='BlankCard'>
            <div>
                <Illus/>
            </div>

            <div className='description'>
                <div className='title'>
                    <span className='questions'>
                        {formatMessage({id: 'pricing_modal.questions', defaultMessage: 'Questions?'})}
                    </span>
                    <span className='contact'>
                        <a>
                            {formatMessage({id: 'pricing_modal.contact_us', defaultMessage: 'Contact us'})}
                        </a>
                    </span>
                </div>
                <div className='content'>
                    {formatMessage({id: 'pricing_modal.reach_out', defaultMessage: 'Reach out to us and we’ll help you decide which plan is right for you and your organization.'})}
                </div>
            </div>
            <div className='self-hosted-interest'>
                <span className='interested'>
                    {formatMessage({id: 'pricing_modal.interested_self_hosting', defaultMessage: 'Interested in self-hosting?'})}
                </span>
                <span className='learn'>
                    <a>
                        {formatMessage({id: 'pricing_modal.learn_more', defaultMessage: 'Learn more'})}
                    </a>
                </span>
            </div>
        </div>
    );
}

function Card(props: CardProps) {
    const {formatMessage} = useIntl();
    return (
        <div
            id={props.id}
            className='PlanCard'
        >
            {props.planLabel}
            <div className='bottom'>
                <div className='bottom_container'>
                    <div className='plan_price_rate_section'>
                        <h3>{props.plan}</h3>
                        <p>{props.planSummary}</p>
                        <h1>{props.price}</h1>
                        <span>{props.rate}</span>
                    </div>

                    <div className='plan_limits_cta'>
                        {props.planExtraInformation}
                    </div>

                    <div className='plan_buttons'>
                        {props.customButtonDetails || (
                            <button
                                id={props.id + '_action'}
                                className={`plan_action_btn ${props.buttonDetails?.disabled ? ButtonCustomiserClasses.grayed : props.buttonDetails?.customClass}`}
                                disabled={props.buttonDetails?.disabled}
                                onClick={props.buttonDetails?.action}
                            >
                                {props.buttonDetails?.text}
                            </button>
                        )}
                    </div>

                    <div className='contact_sales_cta'>
                        {props.contactSalesCTA && (
                            <div>
                                <p>{formatMessage({id: 'pricing_modal.or', defaultMessage: 'or'})}</p>
                                {props.contactSalesCTA}
                            </div>)}
                    </div>

                    <div className='plan_briefing'>
                        <hr/>
                        {props.planTrialDisclaimer}
                        <div className='plan_briefing_content'>
                            <span className='title'>{props.briefing.title}</span>
                            {props.briefing.items?.map((i) => {
                                return (
                                    <div
                                        className='item'
                                        key={i}
                                    >
                                        <i className='fa fa-circle bullet'/><p>{i}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {props.planAddonsInfo && (
                    <div className='plan_add_ons'>
                        <div className='illustration'><TadaSvg/></div>
                        <h4 className='title'>{props.planAddonsInfo.title}</h4>
                        {props.planAddonsInfo.items.map((i) => {
                            return (
                                <div
                                    className='item'
                                    key={i.title}
                                >
                                    <div className='item_title'><i className='fa fa-circle bullet fa-xs'/><p>{i.title}</p></div>
                                    {i.items?.map((sub) => {
                                        return (
                                            <div
                                                className='subitem'
                                                key={sub}
                                            >
                                                <div className='subitem_title'><i className='fa fa-circle bullet fa-xs'/><p>{sub}</p></div>
                                            </div>

                                        );
                                    })}
                                </div>
                            );
                        })}

                    </div>
                )}

            </div>
        </div>
    );
}

export default Card;
