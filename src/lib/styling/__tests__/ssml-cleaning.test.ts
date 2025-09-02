/**
 * Tests for SSML cleaning functionality
 * Ensures malformed SSML tags are properly fixed before TTS synthesis
 */

import { cleanSSMLForSynthesis } from '../ssml';

describe('SSML Cleaning', () => {
  describe('cleanSSMLForSynthesis', () => {
    it('should fix malformed break tags with double slashes', () => {
      const malformedSSML = '<speak>Hey Gemini, <break time="0.3s"//> let\'s lock in for a second.</speak>';
      const result = cleanSSMLForSynthesis(malformedSSML);
      
      expect(result).toContain('<break time="0.3s"/>');
      expect(result).not.toContain('//');
    });

    it('should fix multiple variations of malformed break tags', () => {
      const malformedSSML = `
        <speak>
          Hello <break time="0.3s"//> world.
          Another <break time="1s" //> pause.
          And <break time="0.5s"// /> more.
        </speak>
      `;
      const result = cleanSSMLForSynthesis(malformedSSML);
      
      expect(result).toContain('<break time="0.3s"/>');
      expect(result).toContain('<break time="1s"/>');
      expect(result).toContain('<break time="0.5s"/>');
      expect(result).not.toContain('//');
    });

    it('should remove any remaining slash-slash text that could be read aloud', () => {
      const malformedSSML = '<speak>Hello // world <break time="0.3s"//> test.</speak>';
      const result = cleanSSMLForSynthesis(malformedSSML);
      
      expect(result).not.toContain('//');
      expect(result).toContain('<break time="0.3s"/>');
    });

    it('should preserve properly formatted SSML', () => {
      const validSSML = '<speak>Hello <break time="0.3s"/> world <prosody rate="slow">slowly</prosody>.</speak>';
      const result = cleanSSMLForSynthesis(validSSML);
      
      expect(result).toBe(validSSML);
    });

    it('should add speak tags if missing', () => {
      const noSpeakTags = 'Hello <break time="0.3s"//> world.';
      const result = cleanSSMLForSynthesis(noSpeakTags);
      
      expect(result).toStartWith('<speak>');
      expect(result).toEndWith('</speak>');
      expect(result).toContain('<break time="0.3s"/>');
    });

    it('should handle empty or null input gracefully', () => {
      expect(cleanSSMLForSynthesis('')).toBe('');
      expect(cleanSSMLForSynthesis(null as any)).toBe(null);
      expect(cleanSSMLForSynthesis(undefined as any)).toBe(undefined);
    });

    it('should fix the specific example from the user logs', () => {
      const userExample = `<speak>Hey Gemini, <break time="0.3s"//> let's lock in for a second. <break time="0.1s"//> The Fool.</speak>`;
      const result = cleanSSMLForSynthesis(userExample);
      
      expect(result).toContain('<break time="0.3s"/>');
      expect(result).toContain('<break time="0.1s"/>');
      expect(result).not.toContain('//');
      expect(result).not.toContain('three S slash slash');
    });
  });
});
