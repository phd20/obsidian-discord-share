import { isValidUrl } from "../util";

describe('isValidU', () => {
    test('returns false for invalid url', () => {
      expect(isValidUrl('invalid-url.com')).toBe(false);
    });
    test('returns true for valid url', () => {
        expect(isValidUrl('https://www.invalid-url.com')).toBe(true);
      });
  });