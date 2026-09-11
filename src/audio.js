// ============================================================
// Audio - Web Audio API beeps + Speech Synthesis
// ============================================================

let audioCtx = null;
let soundOn = true;
let girlVoice = null;
let currentLang = 'zh';

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
  return audioCtx;
}

function vibrate(pattern) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch(e) {}
}

function beep(freq, dur, type, vol) {
  if (!soundOn) return;
  try {
    var ctx = getAudio(),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    o.type = type || 'sine';
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (e) {}
}

function sTick() { beep(900, 0.07); vibrate(50); }
function sWarn() { beep(550, 0.18, 'square'); vibrate([100, 50, 100]); }
function sFinish() {
  beep(1300, 0.1);
  setTimeout(function () { beep(1700, 0.15); }, 80);
}
function sElim() { beep(280, 0.35, 'sawtooth'); vibrate([200, 100, 200, 100, 200]); }
function sLifeLost() {
  beep(400, 0.15);
  setTimeout(function () { beep(200, 0.3, 'sawtooth'); }, 150);
  vibrate([300]);
}
function sRoundDone() {
  [600, 800, 1000].forEach(function (f, i) {
    setTimeout(function () { beep(f, 0.15); }, i * 80);
  });
  vibrate([100, 50, 100, 50, 100]);
}
function sOver() {
  [380, 480, 580, 780].forEach(function (f, i) {
    setTimeout(function () { beep(f, 0.2); }, i * 110);
  });
  vibrate([200, 100, 200, 100, 200, 100, 400]);
}

function speakNumber(n) {
  if (!soundOn) return;
  try {
    if (!('speechSynthesis' in window)) return;
    var utt = new SpeechSynthesisUtterance(String(n));
    utt.lang = currentLang === 'en' ? 'en-US' : 'zh-CN';
    utt.volume = 0.9;
    utt.rate = 1.3;
    if (girlVoice) utt.voice = girlVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  } catch (e) {}
}

function initVoice() {
  try {
    if (!('speechSynthesis' in window)) return;
    var voices = speechSynthesis.getVoices();
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if ((v.lang.indexOf('zh') > -1 || v.lang.indexOf('CN') > -1) &&
        (v.name.toLowerCase().indexOf('female') > -1 ||
          v.name.toLowerCase().indexOf('girl') > -1 ||
          v.name.indexOf('女') > -1)) {
        girlVoice = v;
        break;
      }
    }
    if (!girlVoice) {
      for (i = 0; i < voices.length; i++) {
        if (voices[i].lang.indexOf('zh') > -1) { girlVoice = voices[i]; break; }
      }
    }
  } catch (e) {}
}

try { if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = initVoice; } catch (e) {}
initVoice();

function setSoundOn(val) { soundOn = val; }
function isSoundOn() { return soundOn; }
function setAudioLocale(locale) { currentLang = locale === 'en' ? 'en' : 'zh'; }

export {
  soundOn, setSoundOn, isSoundOn, currentLang,
  setAudioLocale,
  sTick, sWarn, sFinish, sElim, sLifeLost, sRoundDone, sOver,
  speakNumber
};
