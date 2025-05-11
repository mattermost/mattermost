// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import Markdown from 'components/markdown';

import './cel_help_modal.scss';

type Props = {
    onExited: () => void;
    onHide?: () => void;
};

const CELHelpModal: React.FC<Props> = ({onExited, onHide}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <GenericModal
            id='CELHelpModal'
            className='cel-help-modal--centered'
            aria-labelledby='CELHelpModalLabel'
            onExited={onExited}
            onHide={onHide}
            modalHeaderText={(
                <FormattedMessage
                    id='admin.access_control.cel_help_modal.title'
                    defaultMessage='Common Expression Language (CEL)'
                />
            )}
            modalSubheaderText={(
                <FormattedMessage
                    id='admin.access_control.cel_help_modal.subheader'
                    defaultMessage='With CEL you can define conditions to filter user attributes and control resource access.'
                />
            )}
            compassDesign={true}
            bodyPadding={false}
            modalLocation='top'
        >
            <div className='cel-help-modal__content-container'>
                <div className='cel-help-modal__content'>
                    <Markdown
                        message={formatMessage({
                            id: 'admin.access_control.cel_help_modal.content',
                            defaultMessage: '### Basic Syntax\nCEL expressions evaluate to boolean values (`true`/`false`) to determine if access should be granted.\n### Common Examples\n- To match a specific program:\n&ensp;`user.attributes.Program == "Dragon Spacecraft"`\n- To match any of multiple teams:\n&ensp;`user.attributes.Team in ["Sales", "Engineering"]`\n- To match an email domain:\n&ensp;`user.attributes.Email.endsWith("example.com")`\n- To combine conditions (for this example with `OR` operator, altertanitvely use `&&` for `AND` operation):\n&ensp;`user.attrs.Program == "Alpha" || user.attrs.Team == "Operations"`\n### Supported Operators and functions\n- `==`, `!=`, `&&`, `||`, `in`, `contains()`, `startsWith()`, `endsWith()`',
                        },
                        )}
                    />
                </div>
                <div className='cel-help-additional-info-modal__content'>
                    <div className='cel-help-additional-info-modal__header'>
                        <i className='icon icon-information-outline'/>
                        <span className='cel-help-additional-info-modal__title'>
                            <FormattedMessage
                                id='admin.access_control.cel_help_modal.important_notes_title'
                                defaultMessage='Important Notes'
                            />
                        </span>
                    </div>
                    <div className='cel-help-additional-info-modal__text'>
                        <Markdown
                            message={formatMessage({
                                id: 'admin.access_control.cel_help_modal.additional_info',
                                defaultMessage: '- Operators like `<` or `>` are forbidden due to incorrect string comparison.\n- Only `user.attributes` are supported; any other variables are not supported yet.\n-For more information, visit the [CEL documentation](https://cel.dev/).',
                            })}
                            options={{
                                markdown: true,
                                mentionHighlight: false,
                                atMentions: false,
                            }}
                        />
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};

export default CELHelpModal;

