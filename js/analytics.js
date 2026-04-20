/* ============================================================================
   ROYAL COLOR - Lightweight Analytics Tracker
   Sends page views & custom events to Google Apps Script → Google Sheets
   Tracks: geo (IP/city/region), device, browser, OS, UTM params, time on page
   ============================================================================ */

(function () {
    'use strict';

    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbz002p5WzAD5id_QnKKpsen1M2iisdCmjwAqXSV_FcmrRuyE30wFAu4R_SHrBkNbk9iiQ/exec';

    // ── Session / Visitor IDs ─────────────────────────────────────────────
    var SESSION_KEY = 'rc_sid';
    var sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    var VISITOR_KEY = 'rc_vid';
    var visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
        visitorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
        localStorage.setItem(VISITOR_KEY, visitorId);
    }

    // ── UTM Parameters ────────────────────────────────────────────────────
    function getUTM() {
        try {
            var params = new URLSearchParams(location.search);
            return {
                utmSource:   params.get('utm_source')   || '',
                utmMedium:   params.get('utm_medium')   || '',
                utmCampaign: params.get('utm_campaign') || ''
            };
        } catch(e) { return { utmSource:'', utmMedium:'', utmCampaign:'' }; }
    }

    // ── Device / Browser / OS detection ──────────────────────────────────
    function getDeviceInfo() {
        var ua = navigator.userAgent;
        var device = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ? 'mobile'
                   : /iPad|Tablet|PlayBook/i.test(ua) ? 'tablet' : 'desktop';
        var browser = /Edg\//i.test(ua)     ? 'Edge'
                    : /OPR\//i.test(ua)     ? 'Opera'
                    : /Chrome\//i.test(ua)  ? 'Chrome'
                    : /Safari\//i.test(ua)  ? 'Safari'
                    : /Firefox\//i.test(ua) ? 'Firefox' : 'Other';
        var os = /Windows NT/i.test(ua)         ? 'Windows'
               : /Mac OS X/i.test(ua)           ? 'macOS'
               : /Android/i.test(ua)            ? 'Android'
               : /iPhone|iPad|iPod/i.test(ua)   ? 'iOS'
               : /Linux/i.test(ua)              ? 'Linux' : 'Other';
        return { device: device, browser: browser, os: os };
    }

    // ── Geo (IP-based) — one fetch per session, result cached ────────────
    var geoData = null;
    var geoQueue = [];
    var geoFetched = false;

    function withGeo(cb) {
        if (geoData !== null) { cb(geoData); return; }
        geoQueue.push(cb);
        if (geoFetched) return;
        geoFetched = true;
        var cached = sessionStorage.getItem('rc_geo');
        if (cached) {
            try {
                geoData = JSON.parse(cached);
                var q = geoQueue.slice(); geoQueue = [];
                q.forEach(function(fn) { fn(geoData); });
                return;
            } catch(e) {}
        }
        if (typeof fetch === 'undefined') {
            geoData = { ip:'', city:'', region:'', country:'' };
            var q2 = geoQueue.slice(); geoQueue = [];
            q2.forEach(function(fn) { fn(geoData); });
            return;
        }
        function flushGeoQueue() {
            var q3 = geoQueue.slice(); geoQueue = [];
            q3.forEach(function(fn) { fn(geoData); });
        }
        function tryFallbackGeo() {
            fetch('https://ipapi.co/json/')
                .then(function(r) { return r.json(); })
                .then(function(j) {
                    geoData = { ip: j.ip||'', city: j.city||'', region: j.region||'', country: j.country_name||'' };
                    sessionStorage.setItem('rc_geo', JSON.stringify(geoData));
                })
                .catch(function() { geoData = { ip:'', city:'', region:'', country:'' }; })
                .then(flushGeoQueue);
        }
        fetch('https://ipwho.is/')
            .then(function(r) { return r.json(); })
            .then(function(j) {
                if (j.success === false || !j.city) {
                    // Primary geo API returned no city — try fallback
                    tryFallbackGeo();
                    return;
                }
                geoData = { ip: j.ip||'', city: j.city||'', region: j.region||'', country: j.country||'' };
                sessionStorage.setItem('rc_geo', JSON.stringify(geoData));
                flushGeoQueue();
            })
            .catch(function() { tryFallbackGeo(); });
    }

    var utm = getUTM();
    var deviceInfo = getDeviceInfo();
    var pageStartTime = Date.now();

    // ── Build & send payload ──────────────────────────────────────────────
    function buildPayload(extra, geo) {
        var p = {
            type:        'analytics',
            sessionId:   sessionId,
            visitorId:   visitorId,
            timestamp:   new Date().toISOString(),
            url:         location.pathname,
            referrer:    document.referrer || '',
            screen:      screen.width + 'x' + screen.height,
            device:      deviceInfo.device,
            browser:     deviceInfo.browser,
            os:          deviceInfo.os,
            utmSource:   utm.utmSource,
            utmMedium:   utm.utmMedium,
            utmCampaign: utm.utmCampaign
        };
        if (geo) { p.ip = geo.ip; p.city = geo.city; p.region = geo.region; p.country = geo.country; }
        for (var k in extra) p[k] = extra[k];
        return p;
    }

    function send(payload) {
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
            navigator.sendBeacon(ENDPOINT, body);
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', ENDPOINT, true);
            xhr.setRequestHeader('Content-Type', 'text/plain');
            xhr.send(body);
        }
    }

    // ── Track page view ───────────────────────────────────────────────────
    function trackPageView() {
        withGeo(function(geo) {
            send(buildPayload({ event: 'pageview', page: document.title }, geo));
        });
    }

    // ── Track custom event ────────────────────────────────────────────────
    function trackEvent(name, data) {
        withGeo(function(geo) {
            send(buildPayload({ event: name, data: data || '' }, geo));
        });
    }

    // ── Time on page (fires on unload) ────────────────────────────────────
    window.addEventListener('beforeunload', function() {
        var seconds = Math.round((Date.now() - pageStartTime) / 1000);
        if (seconds < 2 || !navigator.sendBeacon) return;
        send(buildPayload({ event: 'time_on_page', data: seconds.toString() }));
    });

    // ── Expose globally ───────────────────────────────────────────────────
    window.rcAnalytics = { trackEvent: trackEvent };

    // ── Auto-track page view ──────────────────────────────────────────────
    trackPageView();

    // ── Track link clicks ─────────────────────────────────────────────────
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (href.startsWith('mailto:'))   trackEvent('mailto_click', href);
        else if (href.startsWith('tel:')) trackEvent('tel_click', href);
        else if (href.startsWith('http') && !href.includes(location.hostname))
            trackEvent('outbound_click', href);
    });

    // ── Track scroll depth ────────────────────────────────────────────────
    var depthMarks = {};
    function checkScrollDepth() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        var winHeight = window.innerHeight;
        var pct = Math.round((scrollTop / (docHeight - winHeight)) * 100) || 0;
        [25, 50, 75, 100].forEach(function(mark) {
            if (pct >= mark && !depthMarks[mark]) {
                depthMarks[mark] = true;
                trackEvent('scroll_depth', mark + '%');
            }
        });
    }
    var scrollTimer;
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(checkScrollDepth, 300);
    });

})();
