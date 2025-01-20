// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useMemo} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {SendIcon} from '@mattermost/compass-icons/components';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';

import {isSendOnCtrlEnter} from 'selectors/preferences';

import {SendPostOptions} from 'components/advanced_text_editor/send_button/send_post_options';
import WithTooltip from 'components/with_tooltip';
import type {ShortcutDefinition} from 'components/with_tooltip/tooltip_shortcut';
import {ShortcutKeys} from 'components/with_tooltip/tooltip_shortcut';

import './send_button.scss';

type SendButtonProps = {
    handleSubmit: (schedulingInfo?: SchedulingInfo) => void;
    disabled: boolean;
    channelId: string;
}

const SendButton = ({disabled, handleSubmit, channelId}: SendButtonProps) => {
    const {formatMessage} = useIntl();
    const isScheduledPostEnabled = useSelector(isScheduledPostsEnabled);

    const sendMessage = useCallback((e: React.FormEvent, schedulingInfo?: SchedulingInfo) => {
        e?.stopPropagation();
        e?.preventDefault();
        handleSubmit(schedulingInfo);
    }, [handleSubmit]);

    const sendOnCtrlEnter = useSelector(isSendOnCtrlEnter);

    const sendNowKeyboardShortcutDescriptor = useMemo<ShortcutDefinition>(() => {
        const shortcutDefinition: ShortcutDefinition = {
            default: [
                defineMessage({
                    id: 'shortcuts.generic.enter',
                    defaultMessage: 'Enter',
                }),
            ],
            mac: [
                defineMessage({
                    id: 'shortcuts.generic.enter',
                    defaultMessage: 'Enter',
                }),
            ],
        };

        if (sendOnCtrlEnter) {
            shortcutDefinition.default.unshift(ShortcutKeys.ctrl);
            shortcutDefinition.mac?.unshift(ShortcutKeys.cmd);
        }

        return shortcutDefinition;
    }, [sendOnCtrlEnter]);

    return (
        <div className={classNames('splitSendButton', {disabled, scheduledPost: isScheduledPostEnabled})}>
            <WithTooltip
                title={formatMessage({id: 'create_post_button.option.send_now', defaultMessage: 'Send Now'})}
                shortcut={sendNowKeyboardShortcutDescriptor}
                disabled={disabled}
            >
                <button
                    className={classNames('SendMessageButton', {disabled}, {singleAction: !isScheduledPostEnabled})}
                    data-testid='SendMessageButton'
                    tabIndex={0}
                    aria-label={formatMessage({
                        id: 'create_post_button.option.send_now',
                        defaultMessage: 'Send Now',
                    })}
                    disabled={disabled}
                    onClick={sendMessage}
                >
                    <SendIcon
                        size={18}
                        color='currentColor'
                    />
                </button>
            </WithTooltip>

            {
                isScheduledPostEnabled &&
                <SendPostOptions
                    disabled={disabled}
                    onSelect={handleSubmit}
                    channelId={channelId}
                />
            }
        </div>
    );
};

export default memo(SendButton);
