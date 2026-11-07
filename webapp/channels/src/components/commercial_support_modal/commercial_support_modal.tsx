// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {extractFilenameFromContentDisposition} from '@mattermost/client';
import {ChevronDownIcon, ChevronRightIcon, DownloadOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {SupportPacketContent} from '@mattermost/types/admin';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AlertBanner from 'components/alert_banner';
import ExternalLink from 'components/external_link';

import './commercial_support_modal.scss';

const BASIC_CONTENTS_ID = 'basic.contents';
const SERVER_LOGS_ID = 'basic.server.logs';
const BASIC_CONTENTS_INCLUDED_LIST_ID = 'commercialSupportModalBasicContentsIncluded';

const messages = defineMessages({
    basicContentsLabel: {
        id: 'commercial_support_modal.basic_contents.label',
        defaultMessage: 'Basic contents',
    },
    serverLogsLabel: {
        id: 'commercial_support_modal.server_logs.label',
        defaultMessage: 'Server logs',
    },
    required: {
        id: 'commercial_support_modal.required',
        defaultMessage: '(required)',
    },
    basicContentsDescription: {
        id: 'commercial_support_modal.basic_contents.description',
        defaultMessage: 'Server version, license details, system diagnostics, sanitized configuration, usage counts, job status, permissions, plugin list, database schema, performance profiles, and diagnostic data from installed plugins. Data collected by the server itself does not include message content.',
    },
    whatsIncluded: {
        id: 'commercial_support_modal.basic_contents.whats_included',
        defaultMessage: 'What\'s included',
    },
    serverLogsDescription: {
        id: 'commercial_support_modal.server_logs.description',
        defaultMessage: 'Recent server log files, including any advanced and audit log files. May contain usernames, email addresses, IP addresses, and error details.',
    },
});

const basicContentsIncludedItems = defineMessages({
    serverInfo: {
        id: 'commercial_support_modal.basic_contents.included.server_info',
        defaultMessage: 'Server version, license, and server ID',
    },
    diagnostics: {
        id: 'commercial_support_modal.basic_contents.included.diagnostics',
        defaultMessage: 'System diagnostics: OS, CPU, memory, database, file storage, and connectivity checks',
    },
    config: {
        id: 'commercial_support_modal.basic_contents.included.config',
        defaultMessage: 'Configuration with credentials removed',
    },
    usage: {
        id: 'commercial_support_modal.basic_contents.included.usage',
        defaultMessage: 'Usage counts: users, posts, channels, teams',
    },
    jobs: {
        id: 'commercial_support_modal.basic_contents.included.jobs',
        defaultMessage: 'Background job status',
    },
    permissions: {
        id: 'commercial_support_modal.basic_contents.included.permissions',
        defaultMessage: 'Permission schemes and roles',
    },
    plugins: {
        id: 'commercial_support_modal.basic_contents.included.plugins',
        defaultMessage: 'Installed plugins and their versions',
    },
    pluginData: {
        id: 'commercial_support_modal.basic_contents.included.plugin_data',
        defaultMessage: 'Diagnostic data from installed plugins (contents vary by plugin)',
    },
    databaseSchema: {
        id: 'commercial_support_modal.basic_contents.included.database_schema',
        defaultMessage: 'Database table structure (no data)',
    },
    profiles: {
        id: 'commercial_support_modal.basic_contents.included.profiles',
        defaultMessage: 'Performance profiles (CPU, memory, goroutines)',
    },
});

type Props = {

    /**
     * Function called after the modal has been hidden
     */
    onExited: () => void;

    showBannerWarning: boolean;

    isCloud: boolean;

    currentUser: UserProfile;

    packetContents: SupportPacketContent[];
};

type State = {
    show: boolean;
    showBannerWarning: boolean;
    packetContents: SupportPacketContent[];
    loading: boolean;
    error?: string;
    showBasicContentsIncluded: boolean;
};

export default class CommercialSupportModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
            showBannerWarning: props.showBannerWarning,
            packetContents: props.packetContents,
            loading: false,
            showBasicContentsIncluded: false,
        };
    }

    componentDidUpdate = (prevProps: Props) => {
        if (this.props.showBannerWarning !== prevProps.showBannerWarning) {
            this.updateBannerWarning(this.props.showBannerWarning);
        }
    };

    doHide = () => {
        this.setState({show: false});
    };

    updateBannerWarning = (showBannerWarning: boolean) => {
        this.setState({showBannerWarning});
    };

    hideBannerWarning = () => {
        this.updateBannerWarning(false);
    };

    updateCheckStatus = (index: number) => {
        this.setState({
            packetContents: this.state.packetContents.map((content, currentIndex) => (
                (currentIndex === index && !content.mandatory) ? {...content, selected: !content.selected} : content
            )),
        });
    };

    toggleBasicContentsIncluded = () => {
        this.setState({showBasicContentsIncluded: !this.state.showBasicContentsIncluded});
    };

    renderOptionLabel = (item: SupportPacketContent) => {
        if (item.id === BASIC_CONTENTS_ID) {
            return <FormattedMessage {...messages.basicContentsLabel}/>;
        }

        if (item.id === SERVER_LOGS_ID) {
            return <FormattedMessage {...messages.serverLogsLabel}/>;
        }

        return item.label;
    };

    renderOptionDescription = (id: string) => {
        if (id === BASIC_CONTENTS_ID) {
            const {showBasicContentsIncluded} = this.state;
            return (
                <div className='CommercialSupportModal__option_details'>
                    <p
                        id={`${id}-description`}
                        className='CommercialSupportModal__option_description'
                    >
                        <FormattedMessage {...messages.basicContentsDescription}/>
                    </p>
                    <Button
                        emphasis='link'
                        size='small'
                        className='CommercialSupportModal__whats_included_toggle'
                        aria-expanded={showBasicContentsIncluded}
                        aria-controls={BASIC_CONTENTS_INCLUDED_LIST_ID}
                        onClick={this.toggleBasicContentsIncluded}
                        leadingIcon={<Icon glyph={showBasicContentsIncluded ? <ChevronDownIcon/> : <ChevronRightIcon/>}/>}
                    >
                        <FormattedMessage {...messages.whatsIncluded}/>
                    </Button>
                    {showBasicContentsIncluded && (
                        <ul
                            id={BASIC_CONTENTS_INCLUDED_LIST_ID}
                            className='CommercialSupportModal__whats_included_list'
                        >
                            {Object.entries(basicContentsIncludedItems).map(([key, message]) => (
                                <li key={key}>
                                    <FormattedMessage {...message}/>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            );
        }

        if (id === SERVER_LOGS_ID) {
            return (
                <div className='CommercialSupportModal__option_details'>
                    <p
                        id={`${id}-description`}
                        className='CommercialSupportModal__option_description'
                    >
                        <FormattedMessage {...messages.serverLogsDescription}/>
                    </p>
                </div>
            );
        }

        return null;
    };

    genereateDownloadURLWithParams = (): string => {
        const url = new URL(Client4.getSystemRoute() + '/support_packet');
        this.state.packetContents.forEach((content) => {
            if (content.id === SERVER_LOGS_ID) {
                url.searchParams.set('basic_server_logs', String(content.selected));
            } else if (!content.mandatory && content.selected) {
                url.searchParams.append('plugin_packets', content.id);
            }
        });
        return url.toString();
    };

    extractFilename = (input: string | null): string => {
        // construct the expected filename in case of an error in the header
        const formattedDate = (moment(new Date())).format('YYYY-MM-DDTHH-mm');
        const presumedFileName = `mm_support_packet_${formattedDate}.zip`;

        return extractFilenameFromContentDisposition(input, presumedFileName);
    };

    downloadSupportPacket = async () => {
        this.setState({loading: true, error: undefined});
        const res = await fetch(this.genereateDownloadURLWithParams(), {
            method: 'GET',
            headers: {'Content-Type': 'application/zip'},
        });
        if (!res.ok) {
            const data = await res.json();
            const error = data.message + ': ' + data.detailed_error;
            this.setState({loading: false, error});
            return;
        }

        const blob = await res.blob();
        this.setState({loading: false});

        const href = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', this.extractFilename(res.headers.get('content-disposition')));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    render() {
        const {showBannerWarning} = this.state;
        const {isCloud, currentUser} = this.props;

        const supportLink = isCloud ? `https://customers.mattermost.com/cloud/contact-us?name=${currentUser.first_name} ${currentUser.last_name}&email=${currentUser.email}&inquiry=technical` : 'https://support.mattermost.com/hc/en-us/requests/new';
        return (
            <Modal
                id='commercialSupportModal'
                dialogClassName='a11y__modal more-modal more-direct-channels'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='commercial_support.title'
                            defaultMessage='Commercial Support'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='CommercialSupportModal'>
                        <FormattedMessage
                            id='commercial_support_modal.description'
                            defaultMessage={'If you\'re experiencing issues, <supportLink>submit a support ticket</supportLink>. To help with troubleshooting, it\'s recommended to download the Support Packet below that includes more details about your Mattermost environment.'}
                            values={{
                                supportLink: (chunks) => (
                                    <ExternalLink
                                        href={supportLink}
                                        location='commercialSupportModal'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                        {showBannerWarning &&
                            <AlertBanner
                                mode='info'
                                message={
                                    <FormattedMessage
                                        id='commercial_support_modal.warning.banner'
                                        defaultMessage='Before downloading the Support Packet, set <strong>Output Logs to File</strong> to <strong>true</strong> and set <strong>File Log Level</strong> to <strong>DEBUG</strong> <debugLink>here</debugLink>.'
                                        values={{
                                            strong: (chunks) => <strong>{chunks}</strong>,
                                            debugLink: (chunks) => <Link to='/admin_console/environment/logging'>{chunks}</Link>,
                                        }}
                                    />
                                }
                                onDismiss={this.hideBannerWarning}
                            />
                        }
                        <div className='CommercialSupportModal__packet_contents_download'>
                            <strong>
                                <FormattedMessage
                                    id='commercial_support_modal.download_contents'
                                    defaultMessage={'Select your Support Packet contents to download'}
                                />
                            </strong>
                        </div>
                        <div className='CommercialSupportModal__options'>
                            {this.state.packetContents.map((item, index) => {
                                const description = this.renderOptionDescription(item.id);
                                const describedBy = [
                                    item.mandatory && `${item.id}-required`,
                                    description && `${item.id}-description`,
                                ].filter(Boolean).join(' ');
                                return (
                                    <div
                                        className='CommercialSupportModal__option'
                                        key={item.id}
                                    >
                                        <div className='CommercialSupportModal__option_header'>
                                            <Checkbox
                                                className='CommercialSupportModal__option_checkbox'
                                                id={item.id}
                                                name={item.id}
                                                checked={item.selected}
                                                disabled={item.mandatory}
                                                onChange={() => this.updateCheckStatus(index)}
                                                aria-describedby={describedBy || undefined}
                                            >
                                                {this.renderOptionLabel(item)}
                                            </Checkbox>
                                            {item.mandatory && (
                                                <span
                                                    id={`${item.id}-required`}
                                                    className='CommercialSupportModal__option_required'
                                                >
                                                    <FormattedMessage {...messages.required}/>
                                                </span>
                                            )}
                                        </div>
                                        {description}
                                    </div>
                                );
                            })}
                        </div>
                        <div className='CommercialSupportModal__download'>
                            {this.state.error && (
                                <div className='CommercialSupportModal__error'>
                                    <span className='error-text'>{this.state.error}</span>
                                </div>
                            )}
                            <Button
                                emphasis='primary'
                                className='DownloadSupportPacket'
                                onClick={this.downloadSupportPacket}
                                loading={this.state.loading}
                                leadingIcon={<Icon glyph={<DownloadOutlineIcon/>}/>}
                            >
                                <FormattedMessage
                                    id='commercial_support.download_support_packet'
                                    defaultMessage='Download Support Packet'
                                />
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
