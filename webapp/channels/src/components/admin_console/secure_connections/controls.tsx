// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled, {css} from 'styled-components';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import Timestamp, {RelativeRanges} from 'components/timestamp';
import WithTooltip from 'components/with_tooltip';

import {isConfirmed, isConnected} from './utils';

export const SectionHeading = styled.h3`
    &&& {
        margin-bottom: 8px;
    }
`;

const FormFieldLabel = styled.label`
    width: 100%;

    .DropdownInput.Input_container {
        margin-top: 0;
    }

    & + & {
        margin-top: 30px;
    }
`;

export const SectionHeader = styled.header.attrs({className: 'header'})<{$borderless?: boolean}>`
    &&& {
        padding: 24px 32px;
        ${({$borderless}) => !$borderless && css`
            border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
        `}
    }
`;

export const SectionContent = styled.div.attrs({className: 'content'})<{$compact?: boolean}>`
    &&& {
        padding: ${({$compact}) => ($compact ? '24px 32px' : '48px 32px')};
        border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
    }
`;

export const ModalBody = styled.div`
    padding: 0 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

export const AdminSection = styled.section.attrs({className: 'AdminPanel'})`
    && {
        overflow: visible;
    }
`;

export const PlaceholderHeading = styled.h4`
    && {
        font-size: 20px;
        font-weight: 600;
        line-height: 28px;
        margin-bottom: 4px;
    }
`;

export const PlaceholderParagraph = styled.p`
    && {
        font-size: 14px;
    }
`;

export const ModalParagraph = styled.p`
    && {
        font-size: 12px;
        line-height: 16px;
        font-weight: 400;
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export const PlaceholderContainer = styled.div`
    display: flex;
    place-items: center;
    flex-direction: column;
    gap: 5px;

    svg {
        margin: 30px 30px 20px;
    }

    hgroup {
        text-align: center;
    }
`;

export const AdminWrapper = (props: {children: ReactNode}) => {
    return (
        <div className='admin-console__wrapper'>
            <div className='admin-console__content'>
                {props.children}
            </div>
        </div>
    );
};

const InnerLabel = styled.strong`
    font-size: 14px;
    line-height: 18px;
    display: inline-block;
    margin-bottom: 10px;
`;

const HelpText = styled.small`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    display: block;
    margin-top: 10px;
`;

export const Input = styled.input.attrs({className: 'form-control secure-connections-input'})`
    font-weight: normal;
`;

type FormFieldProps = {
    label?: string;
    children: ReactNode | ReactNode[];
    helpText?: string;
}

export const FormField = ({label, children, helpText}: FormFieldProps) => {
    return (
        <FormFieldLabel>
            {label && <InnerLabel>{label}</InnerLabel>}
            {children}
            {helpText && <HelpText>{helpText}</HelpText>}
        </FormFieldLabel>
    );
};

export const ModalFieldsetWrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;

    .secure-connections-modal-input .form-control {
        border: none !important;
        background: none !important;
        height: 34px !important;
    }

    .Input_container {
        margin-bottom: 10px;
    }

    .DropdownInput.Input_container {
        margin-top: 0;
    }
`;

const ModalLegend = styled.legend`
    font-size: 16px;
    font-weight: 600;
    line-height: 18px;
    border-bottom: none;
`;

export const ModalFieldset = (props: {legend?: string; children: ReactNode | ReactNode[]}) => {
    return (
        <ModalFieldsetWrapper>
            {props.legend && <ModalLegend>{props.legend}</ModalLegend>}
            {props.children}
        </ModalFieldsetWrapper>
    );
};

export const ModalNoticeWrapper = styled.div`
    margin: 15px 0 25px 0;
`;

export const Button = styled.button.attrs({className: 'btn btn-secondary'})`
    margin: -1px -2px;
`;

export const LinkButton = styled.button.attrs({className: 'btn btn-link'})<{$destructive?: boolean}>`
    font-weight: normal;
    ${({$destructive}) => $destructive && css`
        && {
            color: #D24B4E;
        }
    `};
`;

export const ConnectionStatusLabel = ({rc}: {rc: RemoteCluster}) => {
    if (!isConfirmed(rc)) {
        return (
            <FormattedMessage
                tagName={PendingConnectionLabel}
                id='admin.secure_connections.status_pending'
                defaultMessage='Connection Pending'
            />
        );
    }

    const status = isConnected(rc) ? (
        <FormattedMessage
            tagName={ConnectedLabel}
            id='admin.secure_connections.status_connected'
            defaultMessage='Connected'
        />
    ) : (
        <FormattedMessage
            tagName={OfflineConnectionLabel}
            id='admin.secure_connections.status_offline'
            defaultMessage='Offline'
        />
    );

    if (!rc.last_ping_at) {
        return status;
    }

    return (
        <WithTooltip
            title={(
                <>
                    <FormattedMessage
                        id='admin.secure_connections.status_tooltip'
                        defaultMessage='Last ping: {timestamp}'
                        values={{
                            timestamp: (
                                <Timestamp
                                    value={rc.last_ping_at}
                                    ranges={LASTSYNC_TOOLTIP_RANGES}
                                />
                            ),
                        }}
                    />
                    <br/>
                    <UrlWrapper>
                        {rc.site_url}
                    </UrlWrapper>
                </>
            )}
        >
            <div>
                {status}
            </div>
        </WithTooltip>
    );
};

const UrlWrapper = styled.div`
    white-space: break-spaces;
    word-wrap: none;
`;

const LASTSYNC_TOOLTIP_RANGES = [
    RelativeRanges.STANDARD_UNITS.second,
    RelativeRanges.STANDARD_UNITS.minute,
    RelativeRanges.STANDARD_UNITS.hour,
];

const labelStyle = css`
    font-size: 12px;
    color: white;
    border-radius: 4px;
    padding: 2px 4px;
`;

const ConnectedLabel = styled.strong`
    ${labelStyle};
    background-color: #3DB887;
`;

const PendingConnectionLabel = styled.strong`
    ${labelStyle};
    background-color: #F5AB00;
`;

const OfflineConnectionLabel = styled.strong`
    ${labelStyle};
    background-color: #C43133;
`;
