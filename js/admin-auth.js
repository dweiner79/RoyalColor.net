/* Shared admin sign-in with Google. The Apps Script server verifies the Google ID token and checks the allowed-email list. */
(function (global) {
    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbz002p5WzAD5id_QnKKpsen1M2iisdCmjwAqXSV_FcmrRuyE30wFAu4R_SHrBkNbk9iiQ/exec';
    var CLIENT_ID = '931863395642-jasf82fmnis5phd9rfa0ljfv687qpkqm.apps.googleusercontent.com';
    var STORE = 'rc_admin_token';

    function call(type, payload, token) {
        var body = Object.assign({}, payload || {}, { type: type, idToken: token || sessionStorage.getItem(STORE) || '' });
        return fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); }).then(function (data) {
            if (data && data.error === 'unauthorized') sessionStorage.removeItem(STORE);
            return data;
        });
    }

    function loadGoogle(done) {
        if (global.google && global.google.accounts && global.google.accounts.id) { done(); return; }
        var tag = document.createElement('script');
        tag.src = 'https://accounts.google.com/gsi/client';
        tag.async = true;
        tag.onload = done;
        document.head.appendChild(tag);
    }

    function showButton(options) {
        loadGoogle(function () {
            global.google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: function (response) {
                    call('adminLogin', {}, response.credential).then(function (data) {
                        if (data && data.ok) {
                            sessionStorage.setItem(STORE, response.credential);
                            options.onSignedIn();
                        } else {
                            options.onDenied();
                        }
                    }).catch(options.onDenied);
                }
            });
            global.google.accounts.id.renderButton(document.getElementById(options.container), {
                theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill'
            });
        });
    }

    global.rcAdmin = {
        call: call,
        hasToken: function () { return !!sessionStorage.getItem(STORE); },
        signOut: function () {
            sessionStorage.removeItem(STORE);
            if (global.google && global.google.accounts && global.google.accounts.id) global.google.accounts.id.disableAutoSelect();
        },
        /* Shows the Google button, or goes straight in when a still-valid sign-in exists. */
        start: function (options) {
            if (!sessionStorage.getItem(STORE)) { showButton(options); return; }
            call('adminLogin').then(function (data) {
                if (data && data.ok) { options.onSignedIn(); } else { showButton(options); }
            }).catch(function () { showButton(options); });
        }
    };
})(window);
