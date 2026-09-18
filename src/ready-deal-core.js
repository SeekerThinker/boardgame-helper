import { MAX_DEAL_PLAYERS, secureRandomInt } from './secret-dealer-core.js';

// These are original, generic distribution examples, NOT game-specific rule packs,
// licensed character decks or copied third-party word lists.
export const READY_DEAL_MODES = Object.freeze(['different-word', 'two-groups', 'one-special']);

const WORD_PAIRS = Object.freeze([
  { zh: ['雨伞', '雨衣'], en: ['umbrella', 'raincoat'] },
  { zh: ['手电筒', '台灯'], en: ['flashlight', 'desk lamp'] },
  { zh: ['河流', '湖泊'], en: ['river', 'lake'] },
  { zh: ['铅笔', '钢笔'], en: ['pencil', 'fountain pen'] },
  { zh: ['自行车', '滑板'], en: ['bicycle', 'skateboard'] }
]);

export function buildReadyDeal(mode, playerCount, locale = 'zh', randomInt = secureRandomInt) {
  if (!READY_DEAL_MODES.includes(mode)) throw new RangeError('mode');
  const count = Number(playerCount);
  if (!Number.isInteger(count) || count < (mode === 'different-word' ? 3 : 2) || count > MAX_DEAL_PLAYERS) {
    throw new RangeError('players');
  }
  const language = String(locale).toLowerCase().startsWith('en') ? 'en' : 'zh';
  const names = Array.from({ length: count }, (_, index) => language === 'en' ? `Player ${index + 1}` : `玩家 ${index + 1}`);
  let cards;
  if (mode === 'different-word') {
    const choice = randomInt(WORD_PAIRS.length);
    if (!Number.isInteger(choice) || choice < 0 || choice >= WORD_PAIRS.length) throw new RangeError('random');
    const [common, different] = WORD_PAIRS[choice][language];
    cards = Array(count - 1).fill(common).concat(different);
  } else if (mode === 'two-groups') {
    const groupA = language === 'en' ? 'Group A' : '甲组';
    const groupB = language === 'en' ? 'Group B' : '乙组';
    cards = Array(Math.ceil(count / 2)).fill(groupA).concat(Array(Math.floor(count / 2)).fill(groupB));
  } else {
    const regular = language === 'en' ? 'Member' : '普通成员';
    const special = language === 'en' ? 'Special member' : '特殊成员';
    cards = Array(count - 1).fill(regular).concat(special);
  }
  const steps = language === 'en'
    ? ['Confirm everyone has viewed their own card', 'Follow your group’s agreed rules', 'Host confirms when the round ends']
    : ['确认每人已查看自己的牌', '按照现场约定的规则进行', '由主持人确认本局结束'];
  return { names: names.join('\n'), cards: cards.join('\n'), steps: steps.join('\n') };
}
