import { describe, expect, it } from 'vitest';
import { allocateDeveloperProfiles, generateDeveloperProfile } from '@/lib/avatar/developer-profile';

const digest = 'a'.repeat(64);

describe('conversation developer profile', () => {
  it('is reproducible and does not change unrelated traits when candidate order changes', () => {
    const first = generateDeveloperProfile(digest, ['꾸준한'], ['타입 수호자']);
    const again = generateDeveloperProfile(digest, ['꾸준한'], ['타입 수호자']);
    const changedClass = generateDeveloperProfile(digest, ['유쾌한'], ['타입 수호자']);
    expect(again).toEqual(first);
    expect(changedClass.item).toBe(first.item);
    expect(changedClass.defaultStatus).toBe(first.defaultStatus);
    expect(changedClass.displayHash).toBe(first.displayHash);
  });

  it('does not invent a class without both evidence-backed candidate kinds', () => {
    expect(generateDeveloperProfile(digest, [], []).className).toBeNull();
    expect(generateDeveloperProfile(digest, ['꾸준한'], []).className).toBeNull();
    expect(generateDeveloperProfile(digest, [], ['타입 수호자']).className).toBeNull();
  });

  it('selects a meaningful item from a dominant technical topic', () => {
    const profile = generateDeveloperProfile(digest, ['꾸준한'], ['브라우저 조련사'], {}, { frontend: 8, backend: 1 });
    expect(profile.item).toBe('ENDLESS BROWSER TABS');
    expect(profile.itemReason).toMatch(/브라우저/);
  });

  it('uses a positive conversation role when technical topics are mixed', () => {
    const profile = generateDeveloperProfile(digest, ['유쾌한'], ['도구 수집가'], { cheer: .9 }, { frontend: 1, backend: 1, tools: 1 });
    expect(profile.item).toBe('LAPTOP');
    expect(profile.itemReason).toMatch(/여러 관심사/);
  });

  it('avoids duplicate class+item combinations and preserves prior final profiles', () => {
    const inputs = ['a', 'b', 'c'].map((letter) => ({
      sourceVersion: 'v1', sourceDigest: letter.repeat(64),
      adjectiveCandidates: ['꾸준한', '유쾌한'], nounCandidates: ['타입 수호자', '버그 사냥꾼'], signals: {},
    }));
    const allocated = allocateDeveloperProfiles(inputs);
    const combinations = [...allocated.values()].map((profile) => `${profile.className}\0${profile.item}`);
    expect(new Set(combinations).size).toBe(combinations.length);
    const original = allocated.get('a'.repeat(64))!;
    const next = allocateDeveloperProfiles([...inputs, {
      sourceVersion: 'v1', sourceDigest: 'd'.repeat(64), adjectiveCandidates: ['꾸준한'], nounCandidates: ['타입 수호자'], signals: {},
    }], new Map([['a'.repeat(64), original]]));
    expect(next.get('a'.repeat(64))).toMatchObject(original);
  });
});
