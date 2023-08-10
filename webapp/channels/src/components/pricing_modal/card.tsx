// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import ExternalLink from 'components/external_link';

import {HostedCustomerLinks} from 'utils/constants';

import BlankCardImage from './blank_card_image.svg';
import BuildingSvg from './building.svg';
import TadaSvg from './tada.svg';

import type {ReactNode} from 'react';

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
    topColor: string;
    planLabel?: JSX.Element;
    plan: string;
    planSummary?: ReactNode;
    price?: string;
    rate?: ReactNode;
    planExtraInformation?: JSX.Element;
    buttonDetails?: ButtonDetails;
    customButtonDetails?: JSX.Element;
    contactSalesCTA?: JSX.Element;
    briefing: PlanBriefing;
    planAddonsInfo?: PlanAddonsInfo;
    planTrialDisclaimer?: JSX.Element;
    isCloud: boolean;
    cloudFreeDeprecated: boolean;
}

type StyledProps = {
    bgColor?: string;
}

const StyledDiv = styled.div<StyledProps>`
background-color: ${(props) => props.bgColor};
`;

export function BlankCard() {
    const {formatMessage} = useIntl();
    const [, contactSalesLink] = useOpenSalesLink();

    return (
        <div className='BlankCard'>
            <div className='image'>
                <BlankCardImage/>
            </div>

            <div className='description'>
                <div className='title'>
                    <span className='questions'>
                        {formatMessage({id: 'pricing_modal.questions', defaultMessage: 'Questions?'})}
                    </span>
                    <span className='contact'>
                        <ExternalLink
                            location='cloud_pricing_modal'
                            href={contactSalesLink}
                        >
                            {formatMessage({id: 'pricing_modal.contact_us', defaultMessage: 'Contact us'})}
                        </ExternalLink>
                    </span>
                </div>
                <div className='content'>
                    {formatMessage({id: 'pricing_modal.reach_out', defaultMessage: 'Reach out to us and we’ll help you decide which plan is right for you and your organization.'})}
                </div>
            </div>
            <hr/>
            <div className='self-hosted-interest'>
                <span className='interested'>
                    {formatMessage({id: 'pricing_modal.interested_self_hosting', defaultMessage: 'Interested in self-hosting?'})}
                </span>
                <span className='learn'>
                    <ExternalLink
                        location='cloud_pricing_modal'
                        href={HostedCustomerLinks.DOWNLOAD}
                    >
                        {formatMessage({id: 'pricing_modal.learn_more', defaultMessage: 'Learn more'})}
                    </ExternalLink>
                </span>
            </div>
        </div>
    );
}

function Card(props: CardProps) {
    const {formatMessage} = useIntl();
    const bottomClassName = classNames('bottom', {
        bottom__round: props.cloudFreeDeprecated && props.isCloud,
    });

    const contactSalesCTAClassName = classNames('contact_sales_cta', {
        contact_sales_cta__reduced: props.cloudFreeDeprecated && props.isCloud,
    });

    const planBriefingContentClassName = classNames('plan_briefing_content', {
        plan_briefing_content__reduced: props.cloudFreeDeprecated,
    });

    const planPriceRateSectionClassName = classNames('plan_price_rate_section', {
        plan_price_rate_section__expanded: props.cloudFreeDeprecated,
    });

    const planLimitsCtaClassName = classNames('plan_limits_cta', {
        plan_limits_cta__expanded: props.cloudFreeDeprecated,
    });

    const buildingImgClassName = classNames('building_img', {
        building_img__expanded: props.cloudFreeDeprecated,
    });

    return (
        <div
            id={props.id}
            className='PlanCard'
        >
            {props.planLabel}
            {(!props.cloudFreeDeprecated || !props.isCloud) && (
                <StyledDiv
                    className='top'
                    bgColor={props.topColor}
                />
            )}

            <div className={bottomClassName}>
                <div className='bottom_container'>
                    <div className={planPriceRateSectionClassName}>
                        <h3>{props.plan}</h3>
                        <p>{props.planSummary}</p>
                        {props.price ? <h1>{props.price}</h1> : <div className={buildingImgClassName}><BuildingSvg/></div>}
                        {props.cloudFreeDeprecated ? (<span className='plan_rate'>{props.rate}</span>) : (<span>{props.rate}</span>)}
                    </div>

                    <div className={planLimitsCtaClassName}>
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

                    <div className={contactSalesCTAClassName}>
                        {props.contactSalesCTA && (
                            <div>
                                <p>{formatMessage({id: 'pricing_modal.or', defaultMessage: 'or'})}</p>
                                {props.contactSalesCTA}
                            </div>)}
                    </div>

                    <div className='plan_briefing'>
                        {!props.cloudFreeDeprecated && <hr/>}
                        {props.planTrialDisclaimer}
                        <div className={planBriefingContentClassName}>
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
