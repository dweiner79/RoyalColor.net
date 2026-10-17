/* Shared admin sign-in. The password is verified by the Apps Script server; nothing secret lives in this file. */
(function (global) {
    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbz002p5WzAD5id_QnKKpsen1M2iisdCmjwAqXSV_FcmrRuyE30wFAu4R_SHrBkNbk9iiQ/exec';
    var STORE = 'rc_admin_key';

    function call(type, payload, key) {
        var body = Object.assign({}, payload || {}, { type: type, key: key || sessionStorage.getItem(STORE) || '' });
        return fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); }).then(function (data) {
            if (data && data.error === 'unauthorized') sessionStorage.removeItem(STORE);
            return data;
        });
    }

    global.rcAdmin = {
        hasKey: function () { return !!sessionStorage.getItem(STORE); },
        signIn: function (password) {
            return call('adminLogin', {}, password).then(function (data) {
                if (data && data.ok) sessionStorage.setItem(STORE, password);
                return !!(data && data.ok);
            });
        },
        verify: function () { return call('adminLogin').then(function (data) { return !!(data && data.ok); }); },
        signOut: function () { sessionStorage.removeItem(STORE); },
        call: call
    };
})(window);
