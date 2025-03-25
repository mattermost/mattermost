// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';

import './channel_settings_configuration_tab.scss';
import type {Channel} from '@mattermost/types/channels';

import type TextboxClass from 'components/textbox/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import {useDispatch, useSelector} from "react-redux";
import {
    showPreviewOnChannelSettingsChannelBannerTextModal,
    showPreviewOnChannelSettingsPurposeModal
} from "selectors/views/textbox";
import {
    setShowPreviewOnChannelSettingsChannelBannerTextModal,
    setShowPreviewOnChannelSettingsPurposeModal
} from "actions/views/textbox";

const CHANNEL_BANNER_CHARACTER_LIMIT = 1024;

type Props = {
    channel: Channel;
}

function ChannelSettingsConfigurationTab({channel}: Props) {
    const [channelBannerEnabled, setChannelBannerEnabled] = React.useState(false);

    const intl = useIntl();
    const dispatch = useDispatch();

    const shouldShowBannerTextPreview = useSelector(showPreviewOnChannelSettingsChannelBannerTextModal);



    const toggleBannerTextPreview = useCallback(() => {
        dispatch(setShowPreviewOnChannelSettingsChannelBannerTextModal(!shouldShowBannerTextPreview));
    }, [dispatch, shouldShowBannerTextPreview]);

    const heading = intl.formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const subHeading = intl.formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});

    const bannerTextSettingTitle = intl.formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'});
    const bannerColorSettingTitle = intl.formatMessage({id: 'channel_banner.banner_color.label', defaultMessage: 'Banner color'});

    // TODO: Replace with actual placeholder
    const bannerTextPlaceholder = intl.formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Banner text placeholder'});

    const lol = `## Blockquotes
> > > ...or with spaces between arrows.`;

    const bannerTextboxRef = useRef<TextboxClass>(null);

    return (
        <div className='ChannelSettingsModal__configurationTab'>
            <div className='channel_banner_header'>
                <div className='channel_banner_header__text'>
                    <span
                        className='heading'
                        aria-label={heading}
                    >
                        {heading}
                    </span>
                    <span
                        className='subheading'
                        aria-label={subHeading}
                    >
                        {subHeading}
                    </span>
                </div>

                <div className='channel_banner_header__toggle'>
                    <Toggle
                        id='channelBannerToggle'
                        ariaLabel={heading}
                        size='btn-md'
                        disabled={false}
                        onToggle={() => setChannelBannerEnabled((x) => !x)}
                        toggled={channelBannerEnabled}
                        tabIndex={-1}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>

            <div className='setting_section'>
                <span
                    className='setting_title'
                    aria-label={bannerTextSettingTitle}
                >
                    {bannerTextSettingTitle}
                </span>

                <AdvancedTextbox
                    id='channel_banner_banner_text_textbox'
                    value={lol}
                    channelId={channel.id}
                    onChange={() => {}}
                    createMessage={bannerTextPlaceholder}
                    characterLimit={CHANNEL_BANNER_CHARACTER_LIMIT}
                    preview={shouldShowBannerTextPreview}
                    togglePreview={toggleBannerTextPreview}
                    textboxRef={bannerTextboxRef}
                    useChannelMentions={false}
                    onKeypress={() => {}}
                    hasError={false}
                    showCharacterCount={false}
                />
            </div>
        </div>
    );
}

export default ChannelSettingsConfigurationTab;
