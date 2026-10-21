---
name: enrich-us
description: Analyze and enhance Jira user stories with complete, implementation-ready technical detail.
author: LIDR.co
version: 1.0.0
---
# enrich-us Skill

Use it when this workflow is required in the project.

## Instructions

Please analyze and fix the Jira ticket: $ARGUMENTS.

Follow these steps:

1. Use Jira MCP to get the ticket details, whether it is the ticket id/number, keywords referring to the ticket or indicating status, like "the one in progress"
2. You will act as a product expert with technical knowledge
3. Understand the problem described in the ticket
4. Decide whether or not the User Story is completely detailed according to product's best practices: Include a full description of the functionality, a comprehensive list of fields to be updated, the structure and URLs of the necessary endpoints, the files to be modified according to the architecture and best practices, the steps required for the task to be considered complete, how to update any relevant documentation or create unit tests, and non-functional requirements related to security, performance, etc
5. If the user story lacks the technical and specific detail necessary to allow the developer to be fully autonomous when completing it, provide an improved story that is clearer, more specific, and more concise in line with product best practices described in step 4. Use the technical context you will find in 
@documentation. Return it in markdown format.
6. Update ticket in Jira, adding the new content after the old one and marking each section with the h2 tags [original] and [enhanced]. Apply proper formatting to make it readable and visually clear, using appropriate text types (lists, code snippets...).
7. If the ticket status was "To refine", move the task to the "Pending refinement validation" column.
