/**
 * Tests for SSML cleaning functionality
 * Ensures malformed SSML tags are properly fixed before TTS synthesis
 */

import { cleanSSMLForSynthesis, validateSSMLForSynthesis } from '../ssml';

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
      expect(cleanSSMLForSynthesis(null as string)).toBe(null);
      expect(cleanSSMLForSynthesis(undefined as string)).toBe(undefined);
    });

    it('should fix the specific example from the user logs', () => {
      const userExample = `<speak>Hey Gemini, <break time="0.3s"//> let's lock in for a second. <break time="0.1s"//> The Fool.</speak>`;
      const result = cleanSSMLForSynthesis(userExample);
      
      expect(result).toContain('<break time="0.3s"/>');
      expect(result).toContain('<break time="0.1s"/>');
      expect(result).not.toContain('//');
      expect(result).not.toContain('three S slash slash');
    });

    it('should remove phoneme tags (not supported by multilingual v2)', () => {
      const ssmlWithPhoneme = '<speak>The word <phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme> is pronounced correctly.</speak>';
      const cleaned = cleanSSMLForSynthesis(ssmlWithPhoneme);
      expect(cleaned).toBe('<speak>The word tomato is pronounced correctly.</speak>');
      expect(cleaned).not.toContain('<phoneme');
    });

    it('should convert milliseconds to seconds in break tags', () => {
      const ssmlWithMs = '<speak>Wait <break time="500ms"/> for it.</speak>';
      const cleaned = cleanSSMLForSynthesis(ssmlWithMs);
      expect(cleaned).toContain('<break time="0.5s"/>');
      expect(cleaned).not.toContain('ms');
    });
  });

  describe('validateSSMLForSynthesis', () => {
    it('should validate correct SSML', () => {
      const validSSML = '<speak>Hello <break time="1s"/> world!</speak>';
      const result = validateSSMLForSynthesis(validSSML);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect phoneme tags as warnings', () => {
      const ssmlWithPhoneme = '<speak>The <phoneme alphabet="ipa" ph="test">word</phoneme> here.</speak>';
      const result = validateSSMLForSynthesis(ssmlWithPhoneme);
      expect(result.warnings).toContain('Found 1 phoneme tags - not supported by multilingual v2 model');
    });

    it('should detect malformed break tags as issues', () => {
      const malformedSSML = '<speak>Wait <break time="1s"//> please.</speak>';
      const result = validateSSMLForSynthesis(malformedSSML);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Found 1 malformed break tags with //');
    });

    it('should detect missing speak tags', () => {
      const noSpeakTags = 'Hello world!';
      const result = validateSSMLForSynthesis(noSpeakTags);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Missing <speak> tags');
    });
  });
});
