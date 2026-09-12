import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTableOsState, addParticipant, setRole,
  addCampaignFlag, toggleCampaignFlag, applyAssistantTemplate
} from '../../src/tabletop-core.js';

test('template application preserves persistent campaign memory', () => {
  const state = createDefaultTableOsState();
  const player = addParticipant(state, 'A');
  applyAssistantTemplate(state, 'campaign');
  state.campaign.name = 'Friday Campaign';
  state.campaign.chapter = 'Chapter 3';
  state.campaign.sessionNumber = 7;
  state.campaign.notes = 'Do not lose this note';
  const flag = addCampaignFlag(state, 'Unlocked north gate');
  toggleCampaignFlag(state, flag.id);
  setRole(state, player.id, { role: 'Scout', note: 'session-only secret', secret: true });

  applyAssistantTemplate(state, 'engine-score');

  assert.equal(state.appliedTemplateId, 'engine-score');
  assert.equal(state.roles.length, 0, 'template still resets live role setup');
  assert.equal(state.campaign.enabled, true, 'a non-campaign template must not silently disable an active campaign');
  assert.equal(state.campaign.name, 'Friday Campaign');
  assert.equal(state.campaign.chapter, 'Chapter 3');
  assert.equal(state.campaign.sessionNumber, 7);
  assert.equal(state.campaign.notes, 'Do not lose this note');
  assert.deepEqual(state.campaign.flags.map(item => ({ name: item.name, checked: item.checked })), [
    { name: 'Unlocked north gate', checked: true }
  ]);
});
