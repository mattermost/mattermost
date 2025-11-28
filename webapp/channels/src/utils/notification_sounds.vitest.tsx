// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SelectOption} from 'components/widgets/modals/components/react_select_item';

import {
    optionsOfMessageNotificationSoundsSelect,
    optionsOfIncomingCallSoundsSelect,
    getValueOfNotificationSoundsSelect,
    getValueOfIncomingCallSoundsSelect,
    DesktopNotificationSounds,
} from './notification_sounds';

describe('notification sounds accessibility', () => {
    describe('optionsOfMessageNotificationSoundsSelect', () => {
        test('should have proper structure for all sound options', () => {
            expect(optionsOfMessageNotificationSoundsSelect).toHaveLength(6);

            optionsOfMessageNotificationSoundsSelect.forEach((option: SelectOption) => {
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('label');
                expect(typeof option.value).toBe('string');

                // Label should be MessageDescriptor or string, not React element
                if (typeof option.label === 'object') {
                    expect(option.label).toHaveProperty('id');
                    expect(option.label).toHaveProperty('defaultMessage');
                    expect(typeof option.label.id).toBe('string');
                    expect(typeof option.label.defaultMessage).toBe('string');
                } else {
                    expect(typeof option.label).toBe('string');
                }
            });
        });

        test('should have correct MessageDescriptor for each sound type', () => {
            const bingOption = optionsOfMessageNotificationSoundsSelect.find((o) => o.value === DesktopNotificationSounds.BING);
            expect(bingOption).toBeDefined();
            if (bingOption && typeof bingOption.label === 'object') {
                expect(bingOption.label.id).toBe('user.settings.notifications.desktopNotificationSound.soundBing');
                expect(bingOption.label.defaultMessage).toBe('Bing');
            }

            const crackleOption = optionsOfMessageNotificationSoundsSelect.find((o) => o.value === DesktopNotificationSounds.CRACKLE);
            expect(crackleOption).toBeDefined();
            if (crackleOption && typeof crackleOption.label === 'object') {
                expect(crackleOption.label.id).toBe('user.settings.notifications.desktopNotificationSound.soundCrackle');
                expect(crackleOption.label.defaultMessage).toBe('Crackle');
            }
        });

        test('should not contain React elements that would cause [object,object]', () => {
            optionsOfMessageNotificationSoundsSelect.forEach((option: SelectOption) => {
                // Ensure label is not a React element
                expect(option.label).not.toHaveProperty('$$typeof');
                expect(option.label).not.toHaveProperty('type');
                expect(option.label).not.toHaveProperty('props');
            });
        });
    });

    describe('optionsOfIncomingCallSoundsSelect', () => {
        test('should have proper structure for all call sound options', () => {
            expect(optionsOfIncomingCallSoundsSelect).toHaveLength(4);

            optionsOfIncomingCallSoundsSelect.forEach((option: SelectOption) => {
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('label');
                expect(typeof option.value).toBe('string');

                // Label should be MessageDescriptor or string, not React element
                if (typeof option.label === 'object') {
                    expect(option.label).toHaveProperty('id');
                    expect(option.label).toHaveProperty('defaultMessage');
                    expect(typeof option.label.id).toBe('string');
                    expect(typeof option.label.defaultMessage).toBe('string');
                } else {
                    expect(typeof option.label).toBe('string');
                }
            });
        });

        test('should have correct MessageDescriptor for each call sound type', () => {
            const dynamicOption = optionsOfIncomingCallSoundsSelect.find((o) => o.value === 'Dynamic');
            expect(dynamicOption).toBeDefined();
            if (dynamicOption && typeof dynamicOption.label === 'object') {
                expect(dynamicOption.label.id).toBe('user.settings.notifications.desktopNotificationSound.soundDynamic');
                expect(dynamicOption.label.defaultMessage).toBe('Dynamic');
            }

            const calmOption = optionsOfIncomingCallSoundsSelect.find((o) => o.value === 'Calm');
            expect(calmOption).toBeDefined();
            if (calmOption && typeof calmOption.label === 'object') {
                expect(calmOption.label.id).toBe('user.settings.notifications.desktopNotificationSound.soundCalm');
                expect(calmOption.label.defaultMessage).toBe('Calm');
            }
        });

        test('should not contain React elements that would cause [object,object]', () => {
            optionsOfIncomingCallSoundsSelect.forEach((option: SelectOption) => {
                // Ensure label is not a React element
                expect(option.label).not.toHaveProperty('$$typeof');
                expect(option.label).not.toHaveProperty('type');
                expect(option.label).not.toHaveProperty('props');
            });
        });
    });

    describe('getValueOfNotificationSoundsSelect', () => {
        test('should return valid option for known sound names', () => {
            const result = getValueOfNotificationSoundsSelect(DesktopNotificationSounds.BING);
            expect(result).toBeDefined();
            expect(result?.value).toBe(DesktopNotificationSounds.BING);

            // Ensure the returned option has proper label structure
            if (result && typeof result.label === 'object') {
                expect(result.label).toHaveProperty('id');
                expect(result.label).toHaveProperty('defaultMessage');
            }
        });

        test('should return undefined for unknown sound names', () => {
            const result = getValueOfNotificationSoundsSelect('UnknownSound');
            expect(result).toBeUndefined();
        });

        test('should return undefined for undefined input', () => {
            const result = getValueOfNotificationSoundsSelect(undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('getValueOfIncomingCallSoundsSelect', () => {
        test('should return valid option for known call sound names', () => {
            const result = getValueOfIncomingCallSoundsSelect('Dynamic');
            expect(result).toBeDefined();
            expect(result?.value).toBe('Dynamic');

            // Ensure the returned option has proper label structure
            if (result && typeof result.label === 'object') {
                expect(result.label).toHaveProperty('id');
                expect(result.label).toHaveProperty('defaultMessage');
            }
        });

        test('should return undefined for unknown call sound names', () => {
            const result = getValueOfIncomingCallSoundsSelect('UnknownCallSound');
            expect(result).toBeUndefined();
        });

        test('should return undefined for undefined input', () => {
            const result = getValueOfIncomingCallSoundsSelect(undefined);
            expect(result).toBeUndefined();
        });
    });
});
