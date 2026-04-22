import { buildFcmDataPayload, normalizeFcmPushToken } from './push-delivery.utils';

describe('push-delivery utils', () => {
  test('normalizes explicitly tagged fcm tokens', () => {
    expect(normalizeFcmPushToken('fcm:abc123')).toBe('abc123');
  });

  test('ignores expo and apns tokens when checking fcm delivery', () => {
    expect(normalizeFcmPushToken('ExponentPushToken[abc123]')).toBeNull();
    expect(
      normalizeFcmPushToken('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    ).toBeNull();
  });

  test('accepts likely raw fcm tokens', () => {
    expect(
      normalizeFcmPushToken(
        'dGhpcy1sb29rcy1saWtlLWEtcmVnaXN0cmF0aW9uLXRva2VuLXdpdGg6YS1kZWxpbWl0ZXItYW5kLWxvbmcubG9uZ2Vy',
      ),
    ).toBeTruthy();
  });

  test('builds fcm data payload with flattened and mirrored route data', () => {
    expect(
      buildFcmDataPayload('Title', 'Body', {
        category: 'booking_status',
        instructorId: 'inst_42',
        count: 2,
      }),
    ).toEqual({
      title: 'Title',
      body: 'Body',
      category: 'booking_status',
      instructorId: 'inst_42',
      count: '2',
      payload: JSON.stringify({
        category: 'booking_status',
        instructorId: 'inst_42',
        count: '2',
      }),
    });
  });
});
