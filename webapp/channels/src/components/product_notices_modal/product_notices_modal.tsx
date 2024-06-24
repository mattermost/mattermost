// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {ProductNotices, ProductNotice} from '@mattermost/types/product_notices';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import ExternalLink from 'components/external_link';
import Markdown from 'components/markdown';
import AdminEyeIcon from 'components/widgets/icons/admin_eye_icon';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

import {isDesktopApp, getDesktopVersion} from 'utils/user_agent';

import type {PropsFromRedux} from './index';

import './product_notices_modal.scss';

type Props = PropsFromRedux;

type State = {
    presentNoticeIndex: number;
    noticesData: ProductNotices;
}

export default class ProductNoticesModal extends React.PureComponent<Props, State> {
    clearDataTimer?: number;
    constructor(props: Props) {
        super(props);
        this.state = {
            presentNoticeIndex: 0,
            noticesData: [],
        };
        this.clearDataTimer = undefined;
    }

    public componentDidMount() {
        this.fetchNoticesData();
    }

    public componentDidUpdate(prevProps: Props) {
        const presentSocketState = this.props.socketStatus;
        const prevSocketState = prevProps.socketStatus;
        if (presentSocketState.connected && !prevSocketState.connected && prevSocketState.lastConnectAt) {
            const presentTime = Date.now();
            const previousSocketConnectDate = new Date(prevSocketState.lastConnectAt).getDate();
            const presentDate = new Date(presentTime).getDate();
            if (presentDate !== previousSocketConnectDate && presentTime > prevSocketState.lastConnectAt) {
                this.fetchNoticesData();
            }
        }
        if (!prevProps.currentTeamId) {
            this.fetchNoticesData();
        }
    }

    public componentWillUnmount() {
        clearTimeout(this.clearDataTimer);
    }

    private async fetchNoticesData() {
        const {version, currentTeamId} = this.props;
        if (!currentTeamId) {
            return;
        }
        let client = 'web';
        let clientVersion = version;
        if (isDesktopApp()) {
            client = 'desktop';
            clientVersion = getDesktopVersion();
        }

        const {data} = await this.props.actions.getInProductNotices(currentTeamId, client, clientVersion);
        if (data) {
            this.setState({
                noticesData: data,
            });
            if (data.length) {
                const presentNoticeInfo = this.state.noticesData[this.state.presentNoticeIndex];
                this.props.actions.updateNoticesAsViewed([presentNoticeInfo.id]);
            }
        }
    }

    private confirmButtonText(presentNoticeInfo: ProductNotice) {
        const noOfNotices = this.state.noticesData.length;

        if (noOfNotices === 1 && presentNoticeInfo.actionText) {
            return (
                <span>
                    {presentNoticeInfo.actionText}
                </span>
            );
        } else if (noOfNotices === this.state.presentNoticeIndex + 1) {
            return (
                <FormattedMessage
                    id={'generic.done'}
                    defaultMessage='Done'
                />
            );
        }
        return (
            <>
                <FormattedMessage
                    id={'generic.next'}
                    defaultMessage='Next'
                />
                <NextIcon/>
            </>
        );
    }

    private cancelButtonText() {
        if (this.state.presentNoticeIndex !== 0) {
            return (
                <>
                    <PreviousIcon/>
                    <FormattedMessage
                        id={'generic.previous'}
                        defaultMessage='Previous'
                    />
                </>
            );
        }
        return null;
    }

    private renderCicrleIndicators() {
        const noOfNotices = this.state.noticesData.length;
        if (noOfNotices === 1) {
            return null;
        }

        const indicators = [];
        for (let i = 0; i < noOfNotices; i++) {
            let className = 'circle';
            if (i === this.state.presentNoticeIndex) {
                className += ' active';
            }

            indicators.push(
                <span
                    id={'tutorialIntroCircle' + i}
                    key={'circle' + i}
                    className={className}
                    data-screen={i}
                />,
            );
        }
        return (
            <span className='tutorial__circles'>
                {indicators}
            </span>
        );
    }

    private renderAdminOnlyText() {
        if (this.state.noticesData[this.state.presentNoticeIndex].sysAdminOnly) {
            return (
                <>
                    <AdminEyeIcon/>
                    <FormattedMessage
                        id={'inProduct_notices.adminOnlyMessage'}
                        defaultMessage='Visible to Admins only'
                    />
                </>
            );
        }
        return null;
    }

    private renderImage(image: string | undefined) {
        if (image) {
            return (
                <img
                    className='productNotices__img'
                    src={image}
                />
            );
        }
        return null;
    }

    private trackClickEvent = () => {
        const presentNoticeInfo = this.state.noticesData[this.state.presentNoticeIndex];
        trackEvent('ui', `notice_click_${presentNoticeInfo.id}`);
    };

    private renderActionButton(presentNoticeInfo: ProductNotice) {
        const noOfNotices = this.state.noticesData.length;

        if (noOfNotices !== 1 && presentNoticeInfo.actionText) {
            return (
                <ExternalLink
                    id='actionButton'
                    className='GenericModal__button actionButton'
                    location='product_notices_modal'
                    href={presentNoticeInfo.actionParam || ''}
                    onClick={this.trackClickEvent}
                >
                    {presentNoticeInfo.actionText}
                </ExternalLink>
            );
        }
        return null;
    }

    private handleNextButton = () => {
        const presentNoticeInfo = this.state.noticesData[this.state.presentNoticeIndex];
        const noOfNotices = this.state.noticesData.length;
        if (noOfNotices === 1 && presentNoticeInfo.actionText) {
            this.trackClickEvent();
            window.open(presentNoticeInfo.actionParam, '_blank');
        } else if (this.state.presentNoticeIndex + 1 < noOfNotices) {
            const nextNoticeInfo = this.state.noticesData[this.state.presentNoticeIndex + 1];

            this.props.actions.updateNoticesAsViewed([nextNoticeInfo.id]);

            this.setState({
                presentNoticeIndex: this.state.presentNoticeIndex + 1,
            });
        }
    };

    private handlePreviousButton = () => {
        if (this.state.presentNoticeIndex !== 0) {
            this.setState({
                presentNoticeIndex: this.state.presentNoticeIndex - 1,
            });
        }
    };

    onModalDismiss = () => {
        this.clearDataTimer = window.setTimeout(() => {
            this.setState({
                noticesData: [],
                presentNoticeIndex: 0,
            });
        }, 3000);
    };

    render() {
        if (!this.state.noticesData.length) {
            return null;
        }

        const presentNoticeInfo = this.state.noticesData[this.state.presentNoticeIndex];
        const handlePreviousButton = this.state.presentNoticeIndex === 0 ? undefined : this.handlePreviousButton;
        const autoCloseOnConfirmButton = this.state.presentNoticeIndex === this.state.noticesData.length - 1;

        return (
            <GenericModal
                compassDesign={true}
                onExited={this.onModalDismiss}
                handleConfirm={this.handleNextButton}
                handleEnterKeyPress={this.handleNextButton}
                handleCancel={handlePreviousButton}
                modalHeaderText={(
                    <span>
                        {presentNoticeInfo.title}
                    </span>
                )}
                confirmButtonText={this.confirmButtonText(presentNoticeInfo)}
                cancelButtonText={this.cancelButtonText()}
                className='productNotices'
                autoCloseOnConfirmButton={autoCloseOnConfirmButton}
                autoCloseOnCancelButton={false}
            >
                <span className='productNotices__helpText'>
                    <Markdown
                        message={presentNoticeInfo.description}
                    />
                </span>
                {this.renderActionButton(presentNoticeInfo)}
                <div className='productNotices__imageDiv'>
                    {this.renderImage(presentNoticeInfo.image)}
                </div>
                <div className='productNotices__info'>
                    {this.renderCicrleIndicators()}
                    {this.renderAdminOnlyText()}
                </div>
            </GenericModal>
        );
    }
}
