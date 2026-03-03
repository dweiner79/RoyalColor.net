/* ============================================================================
   ROYAL COLOR - Lightweight Analytics Tracker
   Sends page views & custom events to Google Apps Script → Google Sheets
   ============================================================================ */

(function () {
    'use strict';

    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbz002p5WzAD5id_QnKKpsen1M2iisdCmjwAqXSV_FcmrRuyE30wFAu4R_SHrBkNbk9iiQ/exec';

    // ── Session ID (persists per browser tab) ──
    var SESSION_KEY = 'rc_sid';
    var sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    // ── Visitor ID (persists across visits) ──
    var VISITOR_KEY = 'rc_vid';
    var visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
        visitorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
        localStorage.setItem(VISITOR_KEY, visitorId);
    }

    // ── Utility: send beacon (non-blocking) ──
    function send(payload) {
        payload.sessionId = sessionId;
        payload.visitorId = visitorId;
        payload.timestamp = new Date().toISOString();
        payload.url       = location.pathname;
        payload.referrer  = document.referrer || '';
        payload.screen    = screen.width + 'x' + screen.height;
        payload.type      = 'analytics';                       // tells Apps Script this is analytics, not a booking

        var body = JSON.stringify(payload);

        // Prefer sendBeacon (fires even on page unload)
        if (navigator.sendBeacon) {
            navigator.sendBeacon(ENDPOINT, body);
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', ENDPOINT, true);
            xhr.setRequestHeader('Content-Type', 'text/plain');
            xhr.send(body);
        }
    }

    // ── Track page view ──
    function trackPageView() {
        send({ event: 'pageview', page: document.title });
    }

    // ── Track custom event (called from other scripts) ──
    function trackEvent(name, data) {
        send({ event: name, data: data || '' });
    }

    // ── Expose globally ──
    window.rcAnalytics = { trackEvent: trackEvent };

    // ── Auto-track page view on load ──
    trackPageView();

    // ── Track outbound link clicks ──
    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (href.startsWith('mailto:')) {
            trackEvent('mailto_click', href);
        } else if (href.startsWith('tel:')) {
            trackEvent('tel_click', href);
        } else if (href.startsWith('http') && !href.includes(location.hostname)) {
            trackEvent('outbound_click', href);
        }
    });

    // ── Track scroll depth (25 / 50 / 75 / 100 %) ──
    var depthMarks = {};
    function checkScrollDepth() {
        var scrollTop  = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight  = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        var winHeight  = window.innerHeight;
        var pct        = Math.round((scrollTop / (docHeight - winHeight)) * 100) || 0;

        [25, 50, 75, 100].forEach(function (mark) {
            if (pct >= mark && !depthMarks[mark]) {
                depthMarks[mark] = true;
                trackEvent('scroll_depth', mark + '%');
            }
        });
    }
    var scrollTimer;
    window.addEventListener('scroll', function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(checkScrollDepth, 300);
    });

})();
