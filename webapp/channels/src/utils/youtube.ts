// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ytRegex = /(?:http|https):\/\/(?:www\.|m\.)?(?:(?:youtube\.com\/(?:(?:v\/)|(?:(?:watch|embed\/watch)(?:\/|.*v=))|(?:embed\/)|(?:user\/[^/]+\/u\/[0-9]\/)))|(?:youtu\.be\/))([^#&?]*)/;

export function handleYoutubeTime(link: string) {
    const timeRegex = /[\\?&](t|time|start|time_continue)=([0-9]+h)?([0-9]+m)?([0-9]+s?)/;

    const time = link.match(timeRegex);
    if (!time?.[0]) {
        return '';
    }

    const hours = time[2]?.match(/([0-9]+)h/) ?? null;
    const minutes = time[3]?.match(/([0-9]+)m/) ?? null;
    const seconds = time[4]?.match(/([0-9]+)s?/) ?? null;

    let startSeconds = 0;

    if (hours?.[1]) {
        startSeconds += parseInt(hours[1], 10) * 3600;
    }

    if (minutes?.[1]) {
        startSeconds += parseInt(minutes[1], 10) * 60;
    }

    if (seconds?.[1]) {
        startSeconds += parseInt(seconds[1], 10);
    }

    return `&start=${startSeconds}`;
}

export function getVideoId(link: string) {
    const match = link.trim().match(ytRegex);
    if (!match || match[1].length !== 11) {
        return null;
    }

    return match[1];
}
