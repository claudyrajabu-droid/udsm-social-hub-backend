// ============================================================
//  AI UTILS — Claude (Anthropic) integration
//  Inahitaji ANTHROPIC_API_KEY kwenye .env / Render
// ============================================================
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./logger');

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MODEL = 'claude-sonnet-4-5';

function checkAvailable() {
  if (!anthropic) {
    const err = new Error('AI haijawekwa. Ongeza ANTHROPIC_API_KEY kwenye Environment Variables.');
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Chatbot ya kusaidia wanafunzi wa UDSM
 */
async function chat(message, history = []) {
  checkAvailable();
  const messages = [
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `Wewe ni "UDSM AI", msaidizi wa kirafiki wa wanafunzi wa Chuo Kikuu cha Dar es Salaam (UDSM)
kwenye app ya UDSM Social Hub. Jibu kwa Kiswahili fasaha isipokuwa mtumiaji akiuliza kwa Kiingereza.
Saidia na maswali kuhusu masomo, maisha ya chuo, taratibu za UDSM, ushauri wa kitaaluma, na mambo
ya kijamii ya wanafunzi. Kuwa mfupi, wa kirafiki, na wa kusaidia. Kama swali si la UDSM/masomo,
bado jibu kwa ukarimu lakini mfupi.`,
    messages,
  });

  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

/**
 * Boresha rasimu ya post - ifanye ivutie zaidi bila kubadilisha maana
 */
async function improvePost(draft) {
  checkAvailable();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: `Wewe ni msaidizi wa kuandika posts za mtandao wa kijamii wa wanafunzi wa UDSM.
Boresha rasimu ya mtumiaji ili iwe wazi, ya kuvutia, na yenye lugha nzuri ya Kiswahili (au
Kiingereza kama ndivyo mtumiaji alivyoandika), bila kubadilisha maana au kuongeza taarifa
za uongo. Usiongeze hashtags isipokuwa zilikuwepo tayari. Rudisha MAANDISHI YA POST TU,
bila maelezo, bila alama za nukuu, bila utangulizi.`,
    messages: [{ role: 'user', content: draft }],
  });

  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

/**
 * Angalia kama maudhui ni hatari/yasiyofaa kabla ya kuchapishwa
 * Inarudisha { flagged: boolean, reason: string|null }
 */
async function moderateContent(text) {
  if (!anthropic || !text || text.trim().length < 3) return { flagged: false, reason: null };

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: `Wewe ni mfumo wa moderation wa mtandao wa kijamii wa chuo. Angalia maandishi
yafuatayo yakiwa na: matusi mazito, uchochezi wa vurugu, unyanyasaji wa kijinsia, ubaguzi wa
wazi, au vitisho vya moja kwa moja kwa watu. USITEGEShe posts za kawaida, malalamiko ya kawaida,
mizaha, au maoni tofauti ya kisiasa - hizo ni SALAMA. Jibu KWA JSON TU, muundo huu hasa:
{"flagged": true/false, "reason": "sababu fupi kwa Kiswahili au null"}`,
      messages: [{ role: 'user', content: text }],
    });
    const raw = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { flagged: !!parsed.flagged, reason: parsed.reason || null };
  } catch (err) {
    logger.error('AI moderation error:', err.message);
    return { flagged: false, reason: null }; // usizuie post kama AI moderation imeshindwa
  }
}

module.exports = { chat, improvePost, moderateContent };
