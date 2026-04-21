// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';
import Setting from 'components/admin_console/setting';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import SectionNotice from 'components/section_notice';

import {
    ColorSwatch,
    GlobalBannerSectionContent,
    GlobalBannerSectionSetting,
    LevelOptionLabel,
    PresetDropdownWrapper,
} from '../classification_markings_styled';
import type {GlobalBanner} from '../utils';
import {classificationPresetDropdownStyles} from '../utils/preset_dropdown_styles';
import type {ClassificationLevel} from '../utils/presets';

import {AdminSection, SectionHeader, SectionHeading} from '../../system_properties/controls';

const msg = defineMessages({
    sectionTitle: {id: 'admin.classification_markings.global_banner.section_title', defaultMessage: 'Global Classification Indicators'},
    sectionDescription: {id: 'admin.classification_markings.global_banner.section_description', defaultMessage: 'Configure the global classification banner'},
    enableTitle: {id: 'admin.classification_markings.global_banner.enable.title', defaultMessage: 'Global Classification Banner'},
    enableDescription: {id: 'admin.classification_markings.global_banner.enable.description', defaultMessage: 'Displays a global banner for the system-wide classification.'},
    placementTitle: {id: 'admin.classification_markings.global_banner.placement.title', defaultMessage: 'Banner visibility'},
    placementTop: {id: 'admin.classification_markings.global_banner.placement.top', defaultMessage: 'Top only'},
    placementTopAndBottom: {id: 'admin.classification_markings.global_banner.placement.top_and_bottom', defaultMessage: 'Top and bottom'},
    levelTitle: {id: 'admin.classification_markings.global_banner.level.title', defaultMessage: 'Global classification level'},
    levelDescription: {id: 'admin.classification_markings.global_banner.level.description', defaultMessage: 'Choose from a variety of pre-defined banner options. To manually set the banner text and color, select "Custom banner".'},
    lockedNotice: {id: 'admin.classification_markings.global_banner.locked_notice', defaultMessage: 'Global classification placement and level are locked once configured. To change them, disable classification markings, save, and re-enable.'},
});

type LevelDropdownOption = ValueType & {color: string};

type GlobalClassificationIndicatorsProps = {
    levels: ClassificationLevel[];
    globalBanner: GlobalBanner;
    locked: boolean;
    disabled?: boolean;
    onChange: (updates: Partial<GlobalBanner>) => void;
};

export default function GlobalClassificationIndicators({levels, globalBanner, locked, disabled, onChange}: GlobalClassificationIndicatorsProps) {
    const {formatMessage} = useIntl();

    const levelOptions = useMemo((): LevelDropdownOption[] => {
        return levels.map((l) => ({value: l.id, label: l.name, color: l.color}));
    }, [levels]);

    const selectedLevelOption = useMemo(() => {
        return levelOptions.find((o) => o.value === globalBanner.level_id);
    }, [levelOptions, globalBanner.level_id]);

    const formatLevelOptionLabel = useCallback((option: ValueType) => {
        const levelOption = option as LevelDropdownOption;
        return (
            <LevelOptionLabel>
                <ColorSwatch style={{backgroundColor: levelOption.color}}/>
                <span>{levelOption.label}</span>
            </LevelOptionLabel>
        );
    }, []);

    const handleLevelChange = useCallback((selected: ValueType | null) => {
        onChange({level_id: selected?.value ?? ''});
    }, [onChange]);

    const handleEnableChange = useCallback((_id: string, value: boolean) => {
        onChange({enabled: value});
    }, [onChange]);

    const handlePlacementChange = useCallback((_id: string, value: boolean) => {
        onChange({placement: value ? 'top' : 'top_and_bottom'});
    }, [onChange]);

    const controlsDisabled = disabled || locked;

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <FormattedMessage
                        tagName={SectionHeading}
                        {...msg.sectionTitle}
                    />
                    <FormattedMessage {...msg.sectionDescription}/>
                </hgroup>
            </SectionHeader>
            <GlobalBannerSectionContent>
                <SectionNotice
                    type='warning'
                    title={<FormattedMessage {...msg.lockedNotice}/>}
                />
                <form
                    className='form-horizontal'
                    onSubmit={(e) => e.preventDefault()}
                >
                    <GlobalBannerSectionSetting>
                        <BooleanSetting
                            id='globalBannerEnabled'
                            label={<FormattedMessage {...msg.enableTitle}/>}
                            value={globalBanner.enabled}
                            onChange={handleEnableChange}
                            disabled={disabled}
                            setByEnv={false}
                            helpText={<FormattedMessage {...msg.enableDescription}/>}
                            trueText={(
                                <FormattedMessage
                                    id='admin.classification_markings.global_banner.enable.true'
                                    defaultMessage='True'
                                />
                            )}
                            falseText={(
                                <FormattedMessage
                                    id='admin.classification_markings.global_banner.enable.false'
                                    defaultMessage='False'
                                />
                            )}
                        />
                    </GlobalBannerSectionSetting>
                    {globalBanner.enabled && (
                        <>
                            <GlobalBannerSectionSetting>
                                <BooleanSetting
                                    id='globalBannerPlacement'
                                    label={<FormattedMessage {...msg.placementTitle}/>}
                                    value={globalBanner.placement === 'top'}
                                    onChange={handlePlacementChange}
                                    disabled={controlsDisabled}
                                    setByEnv={false}
                                    helpText={''}
                                    trueText={<FormattedMessage {...msg.placementTop}/>}
                                    falseText={<FormattedMessage {...msg.placementTopAndBottom}/>}
                                />
                            </GlobalBannerSectionSetting>
                            <GlobalBannerSectionSetting>
                                <Setting
                                    inputId='DropdownInput_globalBannerLevel'
                                    label={<FormattedMessage {...msg.levelTitle}/>}
                                    helpText={<FormattedMessage {...msg.levelDescription}/>}
                                    setByEnv={false}
                                >
                                    <PresetDropdownWrapper>
                                        <DropdownInput
                                            className='classificationPresetDropdownFieldset'
                                            name='globalBannerLevel'
                                            testId='globalBannerLevel'
                                            options={levelOptions}
                                            value={selectedLevelOption}
                                            onChange={handleLevelChange}
                                            isDisabled={controlsDisabled}
                                            isClearable={false}
                                            menuPortalTarget={document.body}
                                            styles={classificationPresetDropdownStyles}
                                            formatOptionLabel={formatLevelOptionLabel}
                                        />
                                    </PresetDropdownWrapper>
                                </Setting>
                            </GlobalBannerSectionSetting>
                        </>
                    )}
                </form>
            </GlobalBannerSectionContent>
        </AdminSection>
    );
}
