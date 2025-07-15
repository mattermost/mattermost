// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import './textbox_overlay_highlight.scss';

interface Props {
    text: string;
    usersByUsername: Record<string, UserProfile>;
    teammateNameDisplay: string;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    className?: string;
}

interface HighlightSpan {
    start: number;
    end: number;
    type: 'mention' | 'text';
    content: string;
}

const TextboxOverlayHighlight: React.FC<Props> = ({
    text,
    usersByUsername,
    teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME,
    textareaRef,
    className = '',
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // テキストエリアのスクロール同期とスタイル同期
    useEffect(() => {
        const textarea = textareaRef.current;
        const overlay = overlayRef.current;
        if (!textarea || !overlay) {
            return undefined;
        }

        const syncStyles = () => {
            const computedStyle = window.getComputedStyle(textarea);
            const overlayContent = overlay.querySelector('.textbox-overlay-content') as HTMLElement;

            if (overlayContent) {
                overlayContent.style.padding = computedStyle.padding;
                overlayContent.style.border = computedStyle.border;
                overlayContent.style.fontSize = computedStyle.fontSize;
                overlayContent.style.lineHeight = computedStyle.lineHeight;
                overlayContent.style.fontFamily = computedStyle.fontFamily;
                overlayContent.style.letterSpacing = computedStyle.letterSpacing;
                overlayContent.style.wordSpacing = computedStyle.wordSpacing;
            }
        };

        const handleScroll = () => {
            setScrollTop(textarea.scrollTop);
            setScrollLeft(textarea.scrollLeft);
        };

        syncStyles();
        textarea.addEventListener('scroll', handleScroll);

        return () => textarea.removeEventListener('scroll', handleScroll);
    }, [textareaRef]);

    // フルネーム形式のメンションを検出してハイライト用のスパンに分割
    const parseTextForHighlight = (inputText: string): HighlightSpan[] => {
        const spans: HighlightSpan[] = [];
        const processedText = inputText;
        const offset = 0;

        // 全ユーザーの表示名を取得してソート（長い名前から先に処理）
        const userDisplayNames = Object.values(usersByUsername).
            map((user) => displayUsername(user, teammateNameDisplay, false)).
            filter((name) => name && name.trim().length > 0).
            sort((a, b) => b.length - a.length);

        // 各ユーザーの表示名に対してメンションを検索
        for (const displayName of userDisplayNames) {
            const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionRegex = new RegExp(`@${escapedName}(?=\\s|$|[^\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'g');

            let match;
            while ((match = mentionRegex.exec(processedText)) !== null) {
                const start = match.index;
                const end = start + match[0].length;

                // 既に処理済みの範囲でないかチェック
                const isAlreadyProcessed = spans.some((span) =>
                    span.type === 'mention' &&
                    start < span.end && end > span.start,
                );

                if (!isAlreadyProcessed) {
                    spans.push({
                        start: start + offset,
                        end: end + offset,
                        type: 'mention',
                        content: match[0],
                    });
                }
            }
        }

        // スパンを位置順にソート
        spans.sort((a, b) => a.start - b.start);

        // 重複を除去し、テキスト部分を埋める
        const finalSpans: HighlightSpan[] = [];
        let lastIndex = 0;

        for (const span of spans) {
            // 前のスパンとの間にテキストがある場合
            if (span.start > lastIndex) {
                finalSpans.push({
                    start: lastIndex,
                    end: span.start,
                    type: 'text',
                    content: inputText.slice(lastIndex, span.start),
                });
            }

            // 重複チェック
            if (span.start >= lastIndex) {
                finalSpans.push(span);
                lastIndex = span.end;
            }
        }

        // 残りのテキストを追加
        if (lastIndex < inputText.length) {
            finalSpans.push({
                start: lastIndex,
                end: inputText.length,
                type: 'text',
                content: inputText.slice(lastIndex),
            });
        }

        return finalSpans;
    };

    // 表示名が有効なユーザーメンションかチェック

    // テキストをHTMLエスケープ
    const escapeHtml = (text: string): string => {
        return text.
            replace(/&/g, '&amp;').
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;').
            replace(/"/g, '&quot;').
            replace(/'/g, '&#39;');
    };

    // 改行とスペースをHTMLに変換
    const formatTextForDisplay = (text: string): string => {
        return escapeHtml(text).
            replace(/\n/g, '<br>').
            replace(/ /g, '&nbsp;');
    };

    const spans = parseTextForHighlight(text);

    return (
        <div
            ref={overlayRef}
            className={`textbox-overlay-highlight ${className}`}
            style={{
                transform: `translate(-${scrollLeft}px, -${scrollTop}px)`,
            }}
        >
            <div className='textbox-overlay-content'>
                {spans.map((span, index) => (
                    <span
                        key={index}
                        className={span.type === 'mention' ? 'mention-highlight' : ''}
                        dangerouslySetInnerHTML={{
                            __html: formatTextForDisplay(span.content),
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default TextboxOverlayHighlight;
