function onHover(element, prefix) {
    element.classList.add('container-hover');
    let unHoverElement = element.querySelector('.' + prefix + ':not(.hidden)');
    let hoverElement = element.querySelector('.' + prefix + '-hover.hidden');
    if (unHoverElement && hoverElement) {
        unHoverElement.classList.add('hidden');
        hoverElement.classList.remove('hidden');
    }
}
function onUnHover(element, prefix) {
    element.classList.remove('container-hover');
    let unHoverElement = element.querySelector('.' + prefix + '.hidden');
    let hoverElement = element.querySelector('.' + prefix + '-hover:not(.hidden)');
    if (unHoverElement && hoverElement) {
        hoverElement.classList.add('hidden');
        unHoverElement.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var hovers = document.querySelectorAll("div[data-mattermost-hover]");
    for (var i = 0; i < hovers.length; i++) {
        var element = hovers[i];
        element.addEventListener("mouseover", function() {
            onHover(element, element.getAttribute("data-mattermost-hover"));
        });
        element.addEventListener("mouseleave", function() {
            onUnHover(element, element.getAttribute("data-mattermost-hover"))
        });
    }
    var clicks = document.querySelectorAll("div[data-mattermost-click]");
    for (var i = 0; i < clicks.length; i++) {
        var element = clicks[i];
        element.addEventListener("click", function() {
            window.location.href = element.getAttribute("data-mattermost-click");
        });
    };
});