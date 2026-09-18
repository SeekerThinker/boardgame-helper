// Published entries are a deliberately narrow projection of fully reviewed records.
// Do not add a fallback that publishes a draft or an incompletely reviewed game.
export const GAME_MATERIALS = Object.freeze(['none', 'everyday', 'diy', 'printable']);
export const GAME_TOOLS = Object.freeze(['timer', 'score', 'random', 'secret-dealer', 'table-os']);
const LOCALES = ['zh', 'en'];
const MATERIAL_SET = new Set(GAME_MATERIALS);
const TOOL_SET = new Set(GAME_TOOLS);
const RIGHTS_BASES = new Set(['original', 'licensed', 'documented-public-domain']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_ID = /^[a-z][a-z0-9-]{2,47}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => typeof value === 'string' && value.trim().length > 0;
const date = value => typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const translated = (record, fields) => LOCALES.every(lang => isObject(record?.[lang]) && fields.every(key => present(record[lang][key])));
const lines = (record, key) => LOCALES.every(lang => Array.isArray(record?.[lang]?.[key]) && record[lang][key].length > 0 && record[lang][key].length <= 12 && record[lang][key].every(present));

function rightsValid(rights) {
  if (!isObject(rights) || !present(rights.jurisdiction) || !Array.isArray(rights.concerns) || rights.concerns.length) return false;
  // Each content category is reviewed separately; an unused visual is explicitly declared.
  return ['name', 'teaching', 'example', 'visuals'].every(part => {
    const item = rights[part];
    if (!isObject(item)) return false;
    if (part === 'visuals' && item.basis === 'not-used') return item.used === false && present(item.evidence);
    return RIGHTS_BASES.has(item.basis) && present(item.owner) && present(item.evidence)
      && item.commercialUse === true && item.redistribution === true && item.adaptation === true;
  });
}

export function isPublishableGame(entry) {
  if (!isObject(entry) || !ENTRY_ID.test(entry.id || '') || !MATERIAL_SET.has(entry.material)) return false;
  if (!isObject(entry.players) || !Number.isInteger(entry.players.min) || !Number.isInteger(entry.players.max)
    || entry.players.min < 1 || entry.players.max > 32 || entry.players.min > entry.players.max) return false;
  if (!isObject(entry.duration) || !Number.isInteger(entry.duration.min) || !Number.isInteger(entry.duration.max)
    || entry.duration.min < 1 || entry.duration.max > 480 || entry.duration.min > entry.duration.max
    || !['editorial-estimate', 'playtest-observation'].includes(entry.duration.basis)) return false;
  if (!isObject(entry.age) || !Number.isInteger(entry.age.min) || entry.age.min < 0 || entry.age.min > 18
    || !translated(entry.copy, ['title', 'summary', 'goal', 'finish', 'example', 'ageBasis', 'space', 'accessibility', 'materials'])) return false;
  if (!lines(entry.copy, 'setup') || !lines(entry.copy, 'turns')) return false;
  if (!Array.isArray(entry.tools) || !entry.tools.every(tool => TOOL_SET.has(tool)) || new Set(entry.tools).size !== entry.tools.length) return false;
  const review = entry.review;
  if (!isObject(review) || review.status !== 'ready' || review.approved !== true || !present(review.author)
    || !present(review.reviewer) || review.author.trim() === review.reviewer.trim() || !date(review.date)
    || !isObject(review.playtest) || review.playtest.completed !== true || !present(review.playtest.by)
    || !date(review.playtest.date) || !present(review.playtest.evidence)) return false;
  if (!isObject(entry.provenance) || !present(entry.provenance.description)
    || !Array.isArray(entry.provenance.sources) || !entry.provenance.sources.every(source =>
      isObject(source) && /^https:\/\//.test(source.url || '') && date(source.accessed) && present(source.purpose))) return false;
  return rightsValid(entry.rights);
}

export function publishedGames(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records.filter(entry => {
    if (!isPublishableGame(entry) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).map(entry => ({
    id: entry.id, material: entry.material, players: { ...entry.players },
    duration: { ...entry.duration }, age: { ...entry.age }, tools: [...entry.tools],
    copy: Object.fromEntries(LOCALES.map(lang => [lang, {
      ...entry.copy[lang], setup: [...entry.copy[lang].setup], turns: [...entry.copy[lang].turns]
    }]))
  }));
}

export function filterPublishedGames(games, { query = '', material = 'all', players = '' } = {}, lang = 'zh') {
  const needle = String(query).trim().toLocaleLowerCase();
  const count = players === '' ? null : Number(players);
  return games.filter(game => {
    if (material !== 'all' && game.material !== material) return false;
    if (count !== null && (!Number.isInteger(count) || count < game.players.min || count > game.players.max)) return false;
    if (!needle) return true;
    const copy = game.copy[lang === 'en' ? 'en' : 'zh'];
    return [copy.title, copy.summary, copy.goal, ...copy.setup, ...copy.turns]
      .some(text => text.toLocaleLowerCase().includes(needle));
  });
}
