import { describe, expect, it } from 'vitest';
import { mapTweetResult, parseTweetsFromInstructions } from '../src/lib/twitter-client-utils.js';

type TweetInput = Parameters<typeof mapTweetResult>[0];
type Instructions = Parameters<typeof parseTweetsFromInstructions>[0];

const tweet = (id: string, text: string, username: string, legacyExtra: Record<string, unknown> = {}) => ({
  rest_id: id,
  legacy: { full_text: text, created_at: '2024-01-01T00:00:00Z', conversation_id_str: id, ...legacyExtra },
  core: { user_results: { result: { rest_id: `u${id}`, legacy: { screen_name: username, name: username } } } },
});

describe('mapTweetResult retweets', () => {
  it('uses the retweeted post full text instead of the truncated legacy text', () => {
    const original = tweet('2', 'x'.repeat(300), 'solana');
    const rt = tweet('1', `RT @solana: ${'x'.repeat(120)}…`, 'sunrise', {
      retweeted_status_result: { result: original },
    });
    const mapped = mapTweetResult(rt as TweetInput, 1);
    expect(mapped?.text).toBe(`RT @solana: ${'x'.repeat(300)}`);
    expect(mapped?.author.username).toBe('sunrise');
    expect(mapped?.id).toBe('1');
  });

  it('unwraps TweetWithVisibilityResults around the retweeted post', () => {
    const original = tweet('2', 'full original text', 'solana');
    const rt = tweet('1', 'RT @solana: full orig…', 'sunrise', {
      retweeted_status_result: { result: { __typename: 'TweetWithVisibilityResults', tweet: original } },
    });
    expect(mapTweetResult(rt as TweetInput, 0)?.text).toBe('RT @solana: full original text');
  });

  it('leaves non-retweets unchanged', () => {
    expect(mapTweetResult(tweet('3', 'plain post', 'alice') as TweetInput, 0)?.text).toBe('plain post');
  });
});

describe('parseTweetsFromInstructions promoted entries', () => {
  it('drops entries marked by promoted entryId or promotedMetadata', () => {
    const instructions = [
      {
        entries: [
          {
            entryId: 'tweet-1',
            content: { itemContent: { tweet_results: { result: tweet('1', 'organic', 'alice') } } },
          },
          {
            entryId: 'promoted-tweet-2-abc',
            content: { itemContent: { tweet_results: { result: tweet('2', 'ad', 'xbusiness') } } },
          },
          {
            entryId: 'tweet-3',
            content: {
              itemContent: {
                promotedMetadata: { advertiser: 'x' },
                tweet_results: { result: tweet('3', 'ad', 'brand') },
              },
            },
          },
        ],
      },
    ];
    expect(parseTweetsFromInstructions(instructions as Instructions, 0).map((t) => t.id)).toEqual(['1']);
  });
});
