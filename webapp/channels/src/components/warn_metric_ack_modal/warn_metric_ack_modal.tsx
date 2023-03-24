// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {GetFilteredUsersStatsOpts, UsersStats, UserProfile} from '@mattermost/types/users';
import {ServerError} from '@mattermost/types/errors';
import {ActionResult} from 'mattermost-redux/types/actions';
import {WarnMetricStatus} from '@mattermost/types/config';

import {getSiteURL} from 'utils/url';
import {t} from 'utils/i18n';
import {ModalIdentifiers, WarnMetricTypes} from 'utils/constants';

import {trackEvent} from 'actions/telemetry_actions';

import * as Utils from 'utils/utils';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import ErrorLink from 'components/error_page/error_link';
import ExternalLink from 'components/external_link';

type Props = {
    user: UserProfile;
    telemetryId?: string;
    show: boolean;
    closeParentComponent?: () => Promise<void>;
    totalUsers?: number;
    warnMetricStatus: WarnMetricStatus;
    actions: {
        closeModal: (modalId: string) => void;
        sendWarnMetricAck: (warnMetricId: string, forceAck: boolean) => Promise<ActionResult>;
        getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{
            data?: UsersStats;
            error?: ServerError;
        }>;
    };
}

type State = {
    serverError: string | null;
    gettingTrial: boolean;
    gettingTrialError: string | null;
    saving: boolean;
}

const containerStyles: CSSProperties = {
    display: 'flex',
    opacity: '0.56',
    flexWrap: 'wrap',
};

export default class WarnMetricAckModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            saving: false,
            serverError: null,
            gettingTrial: false,
            gettingTrialError: null,
        };
    }

    componentDidMount() {
        this.props.actions.getFilteredUsersStats({include_bots: false, include_deleted: false});
    }

    onContactUsClick = async (e: any) => {
        if (this.state.saving) {
            return;
        }

        this.setState({saving: true, serverError: null});

        let forceAck = false;
        if (e && e.target && e.target.dataset && e.target.dataset.forceack) {
            forceAck = true;
            trackEvent('admin', 'click_warn_metric_mailto', {metric: this.props.warnMetricStatus.id});
        } else {
            trackEvent('admin', 'click_warn_metric_contact_us', {metric: this.props.warnMetricStatus.id});
        }

        const {error} = await this.props.actions.sendWarnMetricAck(this.props.warnMetricStatus.id, forceAck);
        if (error) {
            this.setState({serverError: error, saving: false});
        } else {
            this.onHide();
        }
    }

    onHide = () => {
        this.setState({serverError: null, saving: false});

        this.setState({gettingTrialError: null, gettingTrial: false});
        this.props.actions.closeModal(ModalIdentifiers.WARN_METRIC_ACK);
        if (this.props.closeParentComponent) {
            this.props.closeParentComponent();
        }
    }

    renderContactUsError = () => {
        const {serverError} = this.state;
        if (!serverError) {
            return '';
        }

        const mailRecipient = 'support-advisor@mattermost.com';
        const mailSubject = 'Mattermost Contact Us request';
        let mailBody = 'Mattermost Contact Us request.';
        if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500) {
            mailBody = 'Mattermost Contact Us request.\r\nMy team now has 500 users, and I am considering Mattermost Enterprise Edition.';
        } else if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M) {
            mailBody = 'Mattermost Contact Us request.\r\nI am interested in learning more about improving performance with Elasticsearch.';
        }

        mailBody += '\r\n';
        mailBody += 'Contact ' + this.props.user.first_name + ' ' + this.props.user.last_name;
        mailBody += '\r\n';
        mailBody += 'Email ' + this.props.user.email;
        mailBody += '\r\n';

        if (this.props.totalUsers) {
            mailBody += 'Registered Users ' + this.props.totalUsers;
            mailBody += '\r\n';
        }
        mailBody += 'Site URL ' + getSiteURL();
        mailBody += '\r\n';

        mailBody += 'Telemetry Id ' + this.props.telemetryId;
        mailBody += '\r\n';

        mailBody += 'If you have any additional inquiries, please contact support@mattermost.com';

        const mailToLinkText = 'mailto:' + mailRecipient + '?cc=' + this.props.user.email + '&subject=' + encodeURIComponent(mailSubject) + '&body=' + encodeURIComponent(mailBody);

        return (
            <div className='form-group has-error'>
                <br/>
                <label className='control-label'>
                    <FormattedMessage
                        id='warn_metric_ack_modal.mailto.message'
                        defaultMessage='Support could not be reached. Please {link}.'
                        values={{
                            link: (
                                <WarnMetricAckErrorLink
                                    url={mailToLinkText}
                                    messageId={t('warn_metric_ack_modal.mailto.link')}
                                    forceAck={true}
                                    defaultMessage='email us'
                                    onClickHandler={this.onContactUsClick}
                                />
                            ),
                        }}
                    />
                </label>
            </div>
        );
    }

    render() {
        let headerTitle;
        if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500) {
            headerTitle = (
                <FormattedMessage
                    id='warn_metric_ack_modal.number_of_users.header.title'
                    defaultMessage='Scaling with Mattermost'
                />
            );
        } else if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M) {
            headerTitle = (
                <FormattedMessage
                    id='warn_metric_ack_modal.number_of_posts.header.title'
                    defaultMessage='Improve Performance'
                />
            );
        }

        let descriptionText;
        const learnMoreLink = 'https://mattermost.com/pl/default-admin-advisory';

        if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500) {
            descriptionText = (
                <FormattedMessage
                    id='warn_metric_ack_modal.number_of_active_users.description'
                    defaultMessage='Mattermost strongly recommends that deployments of over {limit}} users take advantage of features such as user management, server clustering, and performance monitoring. Contact us to learn more and let us know how we can help.'
                    values={{
                        limit: this.props.warnMetricStatus.limit,
                    }}
                />
            );
        } else if (this.props.warnMetricStatus.id === WarnMetricTypes.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M) {
            descriptionText = (
                <FormattedMessage
                    id='warn_metric_ack_modal.number_of_posts.description'
                    defaultMessage='Your Mattermost system has a large number of messages. The default Mattermost database search starts to show performance degradation at around 2.5 million posts. With over 5 million posts, Elasticsearch can help avoid significant performance issues, such as timeouts, with search and at-mentions. Contact us to learn more and let us know how we can help.'
                    values={{
                        limit: this.props.warnMetricStatus.limit,
                    }}
                />
            );
        }

        const subText = (
            <div
                style={containerStyles}
                className='help__format-text'
            >
                <FormattedMessage
                    id='warn_metric_ack_modal.subtext'
                    defaultMessage='By clicking Acknowledge, you will be sharing your information with Mattermost Inc. {link}'
                    values={{
                        link: (
                            <ErrorLink
                                url={learnMoreLink}
                                messageId={t('warn_metric_ack_modal.learn_more.link')}
                                defaultMessage='Learn more'
                            />
                        ),
                    }}
                />
            </div>
        );

        const error = this.renderContactUsError();
        const footer = (
            <Modal.Footer>
                <button
                    className='btn btn-primary save-button'
                    data-dismiss='modal'
                    disabled={this.state.saving}
                    autoFocus={true}
                    onClick={this.onContactUsClick}
                >
                    <LoadingWrapper
                        loading={this.state.saving}
                        text={Utils.localizeMessage('admin.warn_metric.sending-email', 'Sending email')}
                    >
                        <FormattedMessage
                            id='warn_metric_ack_modal.contact_support'
                            defaultMessage='Acknowledge'
                        />
                    </LoadingWrapper>
                </button>
            </Modal.Footer>
        );

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.props.show}
                keyboard={false}
                onHide={this.onHide}
                onExited={this.onHide}
                role='dialog'
                aria-labelledby='warnMetricAckHeaderModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='warnMetricAckHeaderModalLabel'
                    >
                        {headerTitle}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>
                        {descriptionText}
                        <br/>
                        {error}
                        <br/>
                        {subText}
                    </div>
                </Modal.Body>
                {footer}
            </Modal>
        );
    }
}

type ErrorLinkProps = {
    defaultMessage: string;
    messageId: string;
    onClickHandler: (e: React.MouseEvent) => Promise<void>;
    url: string;
    forceAck: boolean;
};

const WarnMetricAckErrorLink: React.FC<ErrorLinkProps> = ({defaultMessage, messageId, onClickHandler, url, forceAck}: ErrorLinkProps) => {
    return (
        <ExternalLink
            href={url}
            data-forceAck={forceAck}
            onClick={onClickHandler}
            location='warn_metric_ack_modal'
        >
            <FormattedMessage
                id={messageId}
                defaultMessage={defaultMessage}
            />
        </ExternalLink>
    );
};
