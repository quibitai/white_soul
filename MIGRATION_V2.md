# White Soul Tarot - V2 SSML Pipeline Migration Guide

## 🎯 Migration Overview

White Soul Tarot has been refactored to use a unified **ElevenLabs V2 SSML pipeline** optimized for cloned voice compatibility and emotional delivery. This migration consolidates all processing into a single, streamlined workflow.

## 🔄 What Changed

### Before (Legacy V3 Pipeline)
- Multiple processing modes (V3 audio tags, natural processing, etc.)
- Complex audio tag system with emotional delivery
- Separate pipelines for different use cases
- ElevenLabs V3 model with audio tags

### After (V2 SSML Pipeline)
- **Single unified pipeline**: `angela_v2` processing mode only
- **SSML-based emotional delivery**: Standard SSML tags for prosody and emphasis
- **ElevenLabs V2 model**: `eleven_multilingual_v2` for cloned voice compatibility
- **Request stitching**: Voice consistency across chunks
- **Simplified configuration**: Streamlined YAML configuration

## 🎙️ Key Technical Changes

### 1. Model Migration
```yaml
# Before (Legacy)
voice:
  model_id: "eleven_v3"  # Audio tags model

# After (V2)
voice:
  model_id: "eleven_multilingual_v2"  # SSML model
```

### 2. Emotional Delivery
```xml
<!-- Before: V3 Audio Tags -->
[whisper]mystical insight[/whisper]

<!-- After: V2 SSML -->
<prosody volume="soft" rate="0.9">mystical insight</prosody>
```

### 3. Processing Pipeline
```typescript
// Before: Multiple processing modes
const modes = ['v3_audio_tags', 'natural_processing', 'legacy_ssml'];

// After: Single unified mode
const mode = 'angela_v2'; // Only supported mode
```

## 📋 Migration Checklist

### ✅ Completed Changes

1. **API Endpoints Updated**
   - `/api/prepare` now uses `angela_v2` processing mode only
   - `/api/synthesize` optimized for V2 model
   - Removed legacy processing modes

2. **Configuration Simplified**
   - `rules/angela-voice.yaml` updated for V2
   - Removed complex audio tag configurations
   - Streamlined emotional patterns

3. **Frontend Updated**
   - Two-step workflow (script → voice)
   - SSML tag library with copy functionality
   - Voice version tracking

4. **Documentation Updated**
   - README.md reflects V2 pipeline
   - ARCHITECTURE.md provides technical details
   - DEVELOPER_QUICKSTART.md for developers

### 🔄 Legacy Code Status

The following components are **legacy** and no longer used in the main pipeline:

#### Legacy Files (Kept for Reference)
- `src/lib/styling/audio-tags.ts` - V3 audio tag processing
- `src/lib/styling/natural-processor.ts` - Natural TTS processing
- `src/lib/tts/sound-effects.ts` - Sound effects generation

#### Legacy Configuration (Deprecated)
```yaml
# These sections are no longer used in the main pipeline
audio_tags:
  enable_emotional_tags: false  # Deprecated
  tag_strategy: "contextual"    # Deprecated

websocket:
  enable_ssml_parsing: true     # Future use only
```

## 🎯 New V2 SSML Pipeline

### Processing Flow
```
Raw Text
    ↓
Conversational Style Application
    ↓
Macro Insertion (pauses, emphasis)
    ↓
SSML Conversion
    ↓
Text Chunking (35s chunks)
    ↓
ElevenLabs V2 Synthesis
    ↓
Audio Concatenation
    ↓
Vercel Blob Storage
```

### SSML Emotional Patterns
```yaml
emphasis:
  emotional_patterns:
    breaths:
      ssml: '<break time="0.8s"/>'
      triggers: ["pause", "breath", "think", "reflect"]
    mystery:
      ssml: '<prosody rate="0.95" pitch="-1st">{text}</prosody>'
      triggers: ["tarot", "divine", "mystic", "sacred"]
    whispers:
      ssml: '<prosody volume="soft" rate="0.9">{text}</prosody>'
      triggers: ["secret", "intimate", "whisper"]
    emphasis:
      ssml: '<emphasis level="moderate">{text}</emphasis>'
      triggers: ["important", "key", "essential", "remember"]
    excitement:
      ssml: '<prosody rate="1.05" pitch="+0.5st">{text}</prosody>'
      triggers: ["powerful", "transformation", "breakthrough"]
```

## 🔧 Configuration Updates

### Required Environment Variables
```env
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVEN_VOICE_ID=your_angela_voice_id
ELEVEN_MODEL_ID=eleven_multilingual_v2  # Must be V2 model

# App Configuration
NEXT_PUBLIC_APP_NAME="White Soul Tarot - Script to Styled Voice"
AUDIO_RETENTION_DAYS=14
MAX_INPUT_CHARS=20000
```

### Voice Configuration Updates
```yaml
voice:
  voice_id: "ELEVEN_VOICE_ID"
  model_id: "eleven_multilingual_v2"  # V2 model required
  settings:
    stability: 0.65         # Higher for consistency
    similarity_boost: 0.85  # Maximum voice consistency
    style: 0.22            # Reduced variation
    speaker_boost: true     # Enhanced clarity
    speed: 0.94            # Natural pace
    quality: "enhanced"     # V2 optimization

# Remove legacy audio_tags section
# Remove complex websocket configurations
```

## 🚀 Benefits of V2 Pipeline

### 1. **Cloned Voice Compatibility**
- V2 model supports cloned voices with emotional delivery
- Better voice consistency across chunks
- Professional quality output

### 2. **Simplified Processing**
- Single processing mode reduces complexity
- Standard SSML tags are more reliable
- Easier to debug and maintain

### 3. **Better Performance**
- Request stitching for voice consistency
- Optimized chunking (35s chunks)
- Progressive delays for stability

### 4. **Future-Proof**
- V2 model is actively maintained by ElevenLabs
- SSML is a standard format
- Easier to extend with new features

## 🐛 Common Migration Issues

### Issue: "Model not found" errors
**Solution**: Ensure `ELEVEN_MODEL_ID=eleven_multilingual_v2` in environment variables

### Issue: Audio quality degradation
**Solution**: Check voice settings in `angela-voice.yaml` and adjust stability/similarity_boost

### Issue: SSML parsing errors
**Solution**: Verify SSML syntax in processed text, check for malformed tags

### Issue: Voice inconsistency across chunks
**Solution**: Ensure request stitching is enabled and progressive delays are configured

## 🔮 Future Enhancements

### Planned V2 Features
- **WebSocket Streaming**: Real-time audio streaming with V2 model
- **Enhanced SSML Patterns**: More sophisticated emotional delivery
- **Voice Cloning Integration**: Direct support for custom voices
- **Batch Processing**: Multiple script processing with V2 pipeline

### Legacy Code Cleanup
- Remove unused audio-tags processing
- Clean up natural-processor functions
- Simplify configuration schema
- Update test suites for V2-only testing

## 📚 Migration Resources

### Documentation
- `README.md` - Updated for V2 pipeline
- `ARCHITECTURE.md` - Technical architecture details
- `DEVELOPER_QUICKSTART.md` - Developer guide

### Code Examples
- `src/app/api/prepare/route.ts` - V2 processing implementation
- `src/app/api/synthesize/route.ts` - V2 synthesis implementation
- `rules/angela-voice.yaml` - V2 configuration example

### Testing
- Test V2 pipeline with sample scripts
- Verify SSML output quality
- Check voice consistency across chunks
- Validate audio file generation

## 🤝 Support

For migration issues:
1. Check this migration guide
2. Review updated documentation
3. Test with sample scripts
4. Open an issue on GitHub

---

This migration guide covers the transition from the legacy V3 pipeline to the current V2 SSML pipeline. The V2 pipeline provides better performance, compatibility, and maintainability while simplifying the overall architecture.
