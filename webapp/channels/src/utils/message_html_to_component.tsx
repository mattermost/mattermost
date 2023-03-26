// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactChild, ReactFragment, ReactPortal, ReactElement} from 'react';
import {Parser, ProcessNodeDefinitions} from 'html-to-react';

import AtMention from 'components/at_mention';
import AtSumOfMembersMention from 'components/at_sum_members_mention';
import LatexBlock from 'components/latex_block';
import LatexInline from 'components/latex_inline';
import LinkTooltip from 'components/link_tooltip/link_tooltip';
import MarkdownImage from 'components/markdown_image';
import PostEmoji from 'components/post_emoji';
import PostEditedIndicator from 'components/post_view/post_edited_indicator';
import CodeBlock from 'components/code_block/code_block';
import AtPlanMention from 'components/at_plan_mention';
import {PostImage, PostType} from '@mattermost/types/posts';

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

type ShouldProcessNode = {type: string; name: string; attribs: {type: string; 'data-edited-post-id': string; href: string; 'data-sum-of-members-mention': string; 'data-mention': string; 'data-plan-mention': Record<string, string>; 'data-emoticon': string; 'data-latex': string; 'data-inline-latex': string; 'data-codeblock-code': string}}
type ProcessNode = {attribs: {checked: string ; href: string; 'data-sum-of-members-mention': string; 'data-mention': string; 'data-plan-mention': string; [x: string]: string; src: string}; parentNode: {
    type: string;
    name: string;
};}

type ProcessingInstructions = {
    replaceChildren?: boolean;
    shouldProcessNode: (node: ShouldProcessNode) => boolean | string | Record<string, string>;
    processNode: (node: ProcessNode, children?: boolean | ReactChild | ReactFragment | ReactPortal | null | undefined) => ReactElement<{
        checked?: string | boolean;
    }> | null;
}

export function messageHtmlToComponent(html: string, options: {postId?: string; editedAt?: number; hasPluginTooltips?: boolean; channelId?: string; atSumOfMembersMentions?: boolean; userIds?: string[]; messageMetadata?: Record<string, string>; atPlanMentions?: boolean; imagesMetadata?: Record<string, PostImage>; imageProps?: object; postType?: PostType; mentions?: boolean; mentionHighlight?: boolean; disableGroupHighlight?: boolean; emoji?: string; images?: string; latex?: string; inlinelatex?: string; markdown?: boolean}, isRHS?: boolean) {
    if (!html) {
        return null;
    }

    const parser = new Parser();
    const processNodeDefinitions = new ProcessNodeDefinitions(React);

    function isValidNode() {
        return true;
    }

    const processingInstructions: ProcessingInstructions[] = [

        // Workaround to fix MM-14931
        {
            replaceChildren: false,
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'input' && node.attribs.type === 'checkbox',
            processNode: (node) => {
                let newAttribs = JSON.parse(JSON.stringify(node.attribs));
                newAttribs = Boolean(node.attribs.checked);
                return React.createElement('input', {...newAttribs});
            },
        },
        {
            replaceChildren: false,
            shouldProcessNode: (node) => node.type === 'tag' && node.name === 'span' && node.attribs['data-edited-post-id'] && node.attribs['data-edited-post-id'] === options.postId,
            processNode: () => {
                return options.postId && options?.editedAt && options.editedAt > 0 ? (
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
    if (options) {
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
                    if (typeof node.attribs === 'object') {
                        const mentionName = node.attribs[mentionAttrib];
                        return (
                            <AtMention
                                mentionName={mentionName}
                                isRHS={isRHS}
                                hasMention={true}
                                disableHighlight={!mentionHighlight}
                                disableGroupHighlight={disableGroupHighlight}
                                channelId={options.channelId}
                            >
                                {children}
                            </AtMention>
                        );
                    }
                    return null;
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
                    if (options?.postId && options?.userIds && options?.messageMetadata) {
                        return (
                            <AtSumOfMembersMention
                                postId={options.postId}
                                userIds={options.userIds}
                                messageMetadata={options.messageMetadata}
                                text={mentionName}
                            />
                        );
                    }
                    return null;
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

                    const imageIsLink = (parentNode: {type: string; name: string}) => {
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
    }
    processingInstructions.push({
        shouldProcessNode: () => true,
        processNode: processNodeDefinitions.processDefaultNode,
    });

    return parser.parseWithInstructions(html, isValidNode, processingInstructions);
}

export default messageHtmlToComponent;
