import { describe, expect, it } from 'vitest';
import { candidateAvatarManifest, resolveCandidateComposition } from '@/lib/avatar/assets/manifest';

describe('avatar review pilot manifest', () => {
  it('contains exactly four stable, risk-diverse pilot cases', () => {
    const cases = candidateAvatarManifest.pilotCases;
    expect(cases).toHaveLength(4);
    expect(new Set(cases.map(({ id }) => id))).toHaveLength(4);
    expect(new Set(cases.map(({ traits }) => traits.body))).toEqual(new Set(['light', 'warm', 'deep']));
    expect(new Set(cases.map(({ traits }) => traits.outfit))).toHaveLength(4);
    expect(new Set(cases.map(({ traits }) => traits.accent))).toHaveLength(4);
    expect(new Set(cases.flatMap(({ riskCoverage }) => riskCoverage))).toEqual(expect.objectContaining(new Set([
      'short-hair', 'long-hair', 'tall-hair', 'small-item', 'wide-item', 'tiny-item', 'large-item', 'mobile',
    ])));
  });

  it('resolves each conversation item to the declared canonical pilot item', () => {
    for (const pilot of candidateAvatarManifest.pilotCases) {
      const composition = resolveCandidateComposition(pilot.traits, pilot.developerItem);
      expect(composition.itemId).toBe(pilot.expectedItemId);
      expect(composition.combinationId).toBe([
        pilot.traits.body, pilot.traits.hair, pilot.traits.outfit, pilot.expectedItemId, pilot.traits.accent,
      ].join(':'));
    }
  });

  it('keeps candidate rendering behind both human approval fields', () => {
    expect(candidateAvatarManifest.phase).toBe('pilot');
    expect(candidateAvatarManifest.review).toMatchObject({ status: 'pending', reviewedAt: null });
  });
});
