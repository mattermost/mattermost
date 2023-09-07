// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Parser, ProcessNodeDefinitions} from 'html-to-react';
import React from 'react';

import AtMention from 'components/at_mention';
import AtPlanMention from 'components/at_plan_mention';
import AtSumOfMembersMention from 'components/at_sum_members_mention';
import CodeBlock from 'components/code_block/code_block';
import LatexBlock from 'components/latex_block';
import LatexInline from 'components/latex_inline';
import LinkTooltip from 'components/link_tooltip/link_tooltip';
import MarkdownImage from 'components/markdown_image';
import PostEmoji from 'components/post_emoji';
import PostEditedIndicator from 'components/post_view/post_edited_indicator';

/*
 * Converts HTML to React components using html-to-react.
 * The following options can be specified:
 * - mentions - If specified, mentions are replaced with the AtMention component. Defaults to true.
 * - mentionHighlight - If specified, mentions for the current user are highlighted. Defaults to true.
 * - disableGroupHighlight - If specified, group mentions are not displayed as blue links. Defaults to false.
 * - emoji - If specified, emoji text is replaced with the PostEmoji component. Defaults to true.
 * - images - If specified, markdown images are replaced with the image component. Defaults to true.
 * - imageProps - If specified, any extra props that should be passed into the image component.
 * - latex - If specified, latex is replaced with the LatexBlock component. Defaults to true.
 * - imagesMetadata - the dimensions of the image as retrieved from post.metadata.images.
 * - hasPluginTooltips - If specified, the LinkTooltip component is placed inside links. Defaults to false.
 * - channelId = If specified, to be passed along to ProfilePopover via AtMention
 */
export function messageHtmlToComponent(html, options = {}) {
    if (!html) {
        return null;
    }

    const parser = new Parser();
    const processNodeDefinitions = new ProcessNodeDefinitions(React);

    function isValidNode() {
        return true;
    }

    const processingInstructions = [

        // Workaround to fix MM-14931
        {
            replaceChildren: false,
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'input' && node.attribs.type === 'checkbox',
            processNode: (node) => {
                const attribs = node.attribs || {};
                node.attribs.checked = Boolean(attribs.checked);

                return React.createElement('input', {...node.attribs});
            },
        },
        {
            replaceChildren: false,
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'span' && node.attribs['data-edited-post-id'] && node.attribs['data-edited-post-id'] === options.postId,
            processNode: () => {
                return options.postId && options.editedAt > 0 ? (
                    <React.Fragment key={`edited-${options.postId}`}>
                        {' '}
                        <PostEditedIndicator
                            postId={options.postId}
                            editedAt={options.editedAt}
                        />
                    </React.Fragment>
                ) : null;
            },
        },
    ];

    if (options.hasPluginTooltips) {
        const hrefAttrib = 'href';
        processingInstructions.push({
            replaceChildren: true,
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'a' && node.attribs[hrefAttrib],
            processNode: (node, children) => {
                return (
                    <LinkTooltip
                        href={node.attribs[hrefAttrib]}
                        attributes={node.attribs}
                    >
                        {children}
                    </LinkTooltip>
                );
            },
        });
    }

    if (!('mentions' in options) || options.mentions) {
        const mentionHighlight = 'mentionHighlight' in options ? options.mentionHighlight : true;
        const disableGroupHighlight = 'disableGroupHighlight' in options ? options.disableGroupHighlight === true : false;
        const mentionAttrib = 'data-mention';
        processingInstructions.push({
            replaceChildren: true,
            shouldProcessNode: (node) => node.attribs && node.attribs[mentionAttrib],
            processNode: (node, children) => {
                const mentionName = node.attribs[mentionAttrib];
                const callAtMention = (
                    <AtMention
                        mentionName={mentionName}
                        hasMention={true}
                        disableHighlight={!mentionHighlight}
                        disableGroupHighlight={disableGroupHighlight}
                        channelId={options.channelId}
                    >
                        {children}
                    </AtMention>
                );
                return callAtMention;
            },
        });
    }

    if (options.atSumOfMembersMentions) {
        const mentionAttrib = 'data-sum-of-members-mention';
        processingInstructions.push({
            replaceChildren: true,
            shouldProcessNode: (node) => node.attribs && node.attribs[mentionAttrib],
            processNode: (node) => {
                const mentionName = node.attribs[mentionAttrib];
                const sumOfMembersMention = (
                    <AtSumOfMembersMention
                        postId={options.postId}
                        userIds={options.userIds}
                        messageMetadata={options.messageMetadata}
                        text={mentionName}
                    />);
                return sumOfMembersMention;
            },
        });
    }

    if (options.atPlanMentions) {
        const mentionAttrib = 'data-plan-mention';
        processingInstructions.push({
            replaceChildren: true,
            shouldProcessNode: (node) => node.attribs && node.attribs[mentionAttrib],
            processNode: (node) => {
                const mentionName = node.attribs[mentionAttrib];
                const sumOfMembersMention = (
                    <AtPlanMention
                        plan={mentionName}
                    />);
                return sumOfMembersMention;
            },
        });
    }

    if (!('emoji' in options) || options.emoji) {
        const emojiAttrib = 'data-emoticon';
        processingInstructions.push({
            replaceChildren: true,
            shouldProcessNode: (node) => node.attribs && node.attribs[emojiAttrib],
            processNode: (node) => {
                const emojiName = node.attribs[emojiAttrib];

                return <PostEmoji name={emojiName}/>;
            },
        });
    }

    if (!('images' in options) || options.images) {
        processingInstructions.push({
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'img',
            processNode: (node) => {
                const {
                    class: className,
                    ...attribs
                } = node.attribs;

                const imageIsLink = (parentNode) => {
                    if (parentNode &&
                        parentNode.type === 'tag' &&
                        parentNode.name === 'a'
                    ) {
                        return true;
                    }
                    return false;
                };

                return (
                    <MarkdownImage
                        className={className}
                        imageMetadata={options.imagesMetadata && options.imagesMetadata[attribs.src]}
                        {...attribs}
                        {...options.imageProps}
                        postId={options.postId}
                        imageIsLink={imageIsLink(node.parentNode)}
                        postType={options.postType}
                    />
                );
            },
        });
    }

    if (!('latex' in options) || options.latex) {
        processingInstructions.push({
            shouldProcessNode: (node) => node.attribs && node.attribs['data-latex'],
            processNode: (node) => {
                return (
                    <LatexBlock
                        key={node.attribs['data-latex']}
                        content={node.attribs['data-latex']}
                    />
                );
            },
        });
    }

    if (!('inlinelatex' in options) || options.inlinelatex) {
        processingInstructions.push({
            shouldProcessNode: (node) => node.attribs && node.attribs['data-inline-latex'],
            processNode: (node) => {
                return (
                    <LatexInline content={node.attribs['data-inline-latex']}/>
                );
            },
        });
    }

    if (!('markdown' in options) || options.markdown) {
        processingInstructions.push({
            shouldProcessNode: (node) => node.attribs && node.attribs['data-codeblock-code'],
            processNode: (node) => {
                return (
                    <CodeBlock
                        key={node.attribs['data-codeblock-code']}
                        code={node.attribs['data-codeblock-code']}
                        language={node.attribs['data-codeblock-language']}
                        searchedContent={node.attribs['data-codeblock-searchedcontent']}
                    />
                );
            },
        });
    }

    processingInstructions.push({
        shouldProcessNode: () => true,
        processNode: processNodeDefinitions.processDefaultNode,
    });

    return parser.parseWithInstructions(html, isValidNode, processingInstructions);
}

export default messageHtmlToComponent;
