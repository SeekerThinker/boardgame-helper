// Generic, user-authored secret cards/words. No branded game packs or network storage.
export const MAX_DEAL_PLAYERS = 16;

function lines(value) {
  return String(value ?? '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

export function secureRandomInt(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('Invalid random range');
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random generator unavailable');
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  do { cryptoApi.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

export function createSecretDeal(namesText, cardsText, randomInt = secureRandomInt) {
  const names = lines(namesText);
  const cards = lines(cardsText);
  if (names.length < 2 || names.length > MAX_DEAL_PLAYERS || names.some(name => name.length > 32)) {
    throw new RangeError('players');
  }
  if (cards.length !== names.length || cards.some(card => card.length > 80)) {
    throw new RangeError('cards');
  }
  // Shuffle a private copy; preserve the user's input and do not assign a default game or word list.
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('random');
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return names.map((name, index) => ({ name, secret: shuffled[index] }));
}

export function parsePublicSteps(value) {
  const steps = lines(value);
  if (steps.length > 12 || steps.some(step => step.length > 100)) throw new RangeError('steps');
  return steps;
}
