
// Local search improvements: video results by default and accessible pagination.
(function () {
    'use strict';
    // search-tags.js is already opening the tagged version of this search.
    if (window.ptTagsRedirect) return;
    var url = new URL(window.location.href);
    var query = url.searchParams.get('q') || url.searchParams.get('search_query') || '';
    function regularQuery(value) {
        return value.trim() && !/(?:youtu\.be\/|youtube\.com\/|\bchannel:)/i.test(value);
    }
    // Preserve explicit filters and pasted YouTube links.
    if (url.pathname === '/search' && regularQuery(query) &&
        !url.searchParams.has('type') && !url.searchParams.has('sp') &&
        !url.searchParams.has('channel')) {
        url.searchParams.set('type', 'video');
        window.location.replace(url.href);
        return;
    }
    document.querySelectorAll('form[action="/search"]').forEach(function (form) {
        if (form.querySelector('[name="type"]')) return;
        form.addEventListener('submit', function () {
            var input = form.querySelector('[name="q"], [name="search_query"]');
            if (!input || !regularQuery(input.value)) return;
            var type = document.createElement('input');
            type.type = 'hidden'; type.name = 'type'; type.value = 'video';
            form.appendChild(type);
        });
    });
    if (url.pathname !== '/search' || !query.trim()) return;
    var hasItems = document.querySelector('.video-card-row');
    if (!hasItems) return;
    var next = new URL(url.href);
    var page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    next.searchParams.set('page', String(page + 1));
    document.querySelectorAll('.page-next-container').forEach(function (container) {
        if (container.querySelector('a')) return;
        var link = document.createElement('a');
        link.href = next.pathname + next.search;
        link.textContent = 'Try next page →';
        link.title = 'A short result page can still have more results.';
        link.className = 'pure-button';
        container.appendChild(link);
    });
}());
