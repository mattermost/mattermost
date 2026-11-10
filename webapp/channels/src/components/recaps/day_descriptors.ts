// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {DaysOfWeek} from '@mattermost/types/recaps';

// Static descriptors are required so the formatjs extractor can collect every day label; runtime-computed
// message IDs are silently dropped from the catalog and never become translatable.
const fullNameMessages = defineMessages({
    sunday: {id: 'recaps.days.sunday', defaultMessage: 'Sunday'},
    monday: {id: 'recaps.days.monday', defaultMessage: 'Monday'},
    tuesday: {id: 'recaps.days.tuesday', defaultMessage: 'Tuesday'},
    wednesday: {id: 'recaps.days.wednesday', defaultMessage: 'Wednesday'},
    thursday: {id: 'recaps.days.thursday', defaultMessage: 'Thursday'},
    friday: {id: 'recaps.days.friday', defaultMessage: 'Friday'},
    saturday: {id: 'recaps.days.saturday', defaultMessage: 'Saturday'},
});

const shortLabelMessages = defineMessages({
    sunday: {id: 'recaps.days.short.sunday', defaultMessage: 'Su'},
    monday: {id: 'recaps.days.short.monday', defaultMessage: 'M'},
    tuesday: {id: 'recaps.days.short.tuesday', defaultMessage: 'T'},
    wednesday: {id: 'recaps.days.short.wednesday', defaultMessage: 'W'},
    thursday: {id: 'recaps.days.short.thursday', defaultMessage: 'Th'},
    friday: {id: 'recaps.days.short.friday', defaultMessage: 'F'},
    saturday: {id: 'recaps.days.short.saturday', defaultMessage: 'Sa'},
});

const abbrevMessages = defineMessages({
    sunday: {id: 'recaps.days.abbrev.sunday', defaultMessage: 'Sun'},
    monday: {id: 'recaps.days.abbrev.monday', defaultMessage: 'Mon'},
    tuesday: {id: 'recaps.days.abbrev.tuesday', defaultMessage: 'Tue'},
    wednesday: {id: 'recaps.days.abbrev.wednesday', defaultMessage: 'Wed'},
    thursday: {id: 'recaps.days.abbrev.thursday', defaultMessage: 'Thu'},
    friday: {id: 'recaps.days.abbrev.friday', defaultMessage: 'Fri'},
    saturday: {id: 'recaps.days.abbrev.saturday', defaultMessage: 'Sat'},
});

export type DayDescriptor = {
    bit: number;
    fullName: MessageDescriptor; // accessible label, e.g. "Monday"
    shortLabel: MessageDescriptor; // toggle button text, e.g. "M"
    abbrev: MessageDescriptor; // schedule summary text, e.g. "Mon"
};

// Ordered by the day-of-week bitmask (Sunday first) so the schedule summary lists days in a stable order.
export const DAY_DESCRIPTORS: DayDescriptor[] = [
    {bit: DaysOfWeek.Sunday, fullName: fullNameMessages.sunday, shortLabel: shortLabelMessages.sunday, abbrev: abbrevMessages.sunday},
    {bit: DaysOfWeek.Monday, fullName: fullNameMessages.monday, shortLabel: shortLabelMessages.monday, abbrev: abbrevMessages.monday},
    {bit: DaysOfWeek.Tuesday, fullName: fullNameMessages.tuesday, shortLabel: shortLabelMessages.tuesday, abbrev: abbrevMessages.tuesday},
    {bit: DaysOfWeek.Wednesday, fullName: fullNameMessages.wednesday, shortLabel: shortLabelMessages.wednesday, abbrev: abbrevMessages.wednesday},
    {bit: DaysOfWeek.Thursday, fullName: fullNameMessages.thursday, shortLabel: shortLabelMessages.thursday, abbrev: abbrevMessages.thursday},
    {bit: DaysOfWeek.Friday, fullName: fullNameMessages.friday, shortLabel: shortLabelMessages.friday, abbrev: abbrevMessages.friday},
    {bit: DaysOfWeek.Saturday, fullName: fullNameMessages.saturday, shortLabel: shortLabelMessages.saturday, abbrev: abbrevMessages.saturday},
];

// Monday-first ordering for the toggle selector, which is more intuitive for work schedules.
export const SELECTOR_DAY_DESCRIPTORS: DayDescriptor[] = [
    ...DAY_DESCRIPTORS.slice(1),
    DAY_DESCRIPTORS[0],
];
