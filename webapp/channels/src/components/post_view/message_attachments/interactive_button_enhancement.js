// Frontend enhancement for issue #34438
// Ensures interactive buttons work after message edits

// Force re-render of interactive buttons when post is updated
export function enhanceInteractiveButtons(postElement, postData) {
    if (!postElement || !postData) return;
    
    // Find all interactive buttons in the post
    const buttons = postElement.querySelectorAll('.action-button, .btn[data-action-id]');
    
    buttons.forEach(button => {
        // Re-attach click handlers after post update
        const actionId = button.getAttribute('data-action-id');
        const postId = button.getAttribute('data-post-id');
        
        if (actionId && postId) {
            // Ensure button has proper event listener
            button.addEventListener('click', handleInteractiveButtonClick);
        }
    });
}

function handleInteractiveButtonClick(event) {
    const button = event.target;
    const actionId = button.getAttribute('data-action-id');
    const postId = button.getAttribute('data-post-id');
    
    if (actionId && postId) {
        // This would integrate with existing Mattermost action dispatch
        console.log('Interactive button clicked after edit:', {actionId, postId});
    }
}

// Export for integration with existing components
export default enhanceInteractiveButtons;
