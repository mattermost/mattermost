// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {getMentionRanges} from 'utils/mention_utils';

import MentionOverlay from './mention_overlay';

jest.mock('components/at_mention', () => {
    return function MockAtMention({mentionName}: {mentionName: string}) {
        return <span data-testid={`mention-${mentionName}`}>@{mentionName}</span>;
    };
});

jest.mock('utils/mention_utils', () => ({
    getMentionRanges: jest.fn(),
}));

const mockGetMentionRanges = getMentionRanges as jest.MockedFunction<typeof getMentionRanges>;

describe('MentionOverlay', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render null when value is empty', () => {
        const {container} = render(<MentionOverlay value="" />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when value is not provided', () => {
        const {container} = render(<MentionOverlay value={null as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render plain text when no mentions are found', () => {
        const text = 'Hello world';
        mockGetMentionRanges.mockReturnValue([]);

        render(<MentionOverlay value={text} />);
        
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(getMentionRanges).toHaveBeenCalledWith(text);
    });

    it('should render mentions as AtMention components', () => {
        const text = 'Hello @john and @jane';
        mockGetMentionRanges.mockReturnValue([
            {start: 6, end: 11, text: '@john'},
            {start: 16, end: 21, text: '@jane'},
        ]);

        const {container} = render(<MentionOverlay value={text} />);
        
        expect(container.textContent).toContain('Hello');
        expect(container.textContent).toContain('and');
        expect(screen.getByTestId('mention-john')).toBeInTheDocument();
        expect(screen.getByTestId('mention-jane')).toBeInTheDocument();
        expect(getMentionRanges).toHaveBeenCalledWith(text);
    });

    it('should handle mention at the beginning of text', () => {
        const text = '@john hello';
        mockGetMentionRanges.mockReturnValue([
            {start: 0, end: 5, text: '@john'},
        ]);

        const {container} = render(<MentionOverlay value={text} />);
        
        expect(screen.getByTestId('mention-john')).toBeInTheDocument();
        expect(container.textContent).toContain('hello');
    });

    it('should handle mention at the end of text', () => {
        const text = 'Hello @john';
        mockGetMentionRanges.mockReturnValue([
            {start: 6, end: 11, text: '@john'},
        ]);

        const {container} = render(<MentionOverlay value={text} />);
        
        expect(container.textContent).toContain('Hello');
        expect(screen.getByTestId('mention-john')).toBeInTheDocument();
    });

    it('should handle multiple consecutive mentions', () => {
        const text = '@john @jane @bob';
        mockGetMentionRanges.mockReturnValue([
            {start: 0, end: 5, text: '@john'},
            {start: 6, end: 11, text: '@jane'},
            {start: 12, end: 16, text: '@bob'},
        ]);

        const {container} = render(<MentionOverlay value={text} />);
        
        expect(screen.getByTestId('mention-john')).toBeInTheDocument();
        expect(screen.getByTestId('mention-jane')).toBeInTheDocument();
        expect(screen.getByTestId('mention-bob')).toBeInTheDocument();
        expect(container.textContent).toMatch(/@john\s+@jane\s+@bob/);
    });

    it('should apply custom className', () => {
        const text = 'Hello world';
        mockGetMentionRanges.mockReturnValue([]);

        const {container} = render(<MentionOverlay value={text} className="custom-class" />);
        
        expect(container.firstChild).toHaveClass('suggestion-box-mention-overlay');
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should handle empty className gracefully', () => {
        const text = 'Hello world';
        mockGetMentionRanges.mockReturnValue([]);

        const {container} = render(<MentionOverlay value={text} />);
        
        expect(container.firstChild).toHaveClass('suggestion-box-mention-overlay');
        expect(container.firstChild).not.toHaveClass('undefined');
    });

    it('should generate correct keys for mention components', () => {
        const text = 'Hello @john';
        mockGetMentionRanges.mockReturnValue([
            {start: 6, end: 11, text: '@john'},
        ]);

        render(<MentionOverlay value={text} />);
        
        const mentionElement = screen.getByTestId('mention-john');
        expect(mentionElement).toBeInTheDocument();
    });

    it('should handle non-string values gracefully', () => {
        mockGetMentionRanges.mockReturnValue([]);

        const {container} = render(<MentionOverlay value={123 as any} />);
        
        expect(container.firstChild).toHaveClass('suggestion-box-mention-overlay');
        expect(container.firstChild).toHaveTextContent('123');
        expect(getMentionRanges).not.toHaveBeenCalled();
    });
});
