# White Soul Tarot - Developer Quick Start

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- ElevenLabs API account with V2 access
- Vercel account (for deployment)

### Setup
```bash
# Clone and install
git clone <repository>
cd white-soul-tarot
npm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your ElevenLabs credentials

# Start development
npm run dev
```

## 🎯 Key Concepts

### Two-Stage Workflow
1. **Script Generation**: Raw text → Angela V2 SSML processing → Annotated script
2. **Voice Synthesis**: Annotated script → ElevenLabs V2 synthesis → Audio

### ElevenLabs V2 SSML Pipeline
- Uses `eleven_multilingual_v2` model for cloned voice compatibility
- SSML emotional delivery with prosody and emphasis tags
- Request stitching for voice consistency across chunks
- 35-second optimal chunking for seamless audio flow

## 📁 Key Files to Know

### Core Processing
- `src/app/api/prepare/route.ts` - Text processing pipeline
- `src/app/api/synthesize/route.ts` - TTS synthesis
- `src/lib/styling/` - Text processing library
- `src/lib/tts/elevenlabs.ts` - ElevenLabs V2 client

### Configuration
- `rules/angela-voice.yaml` - Voice configuration
- `src/lib/styling/config.ts` - Configuration loader

### Frontend
- `src/app/page.tsx` - Main UI component
- `src/app/globals.css` - Global styles

## 🔧 Common Development Tasks

### Adding New Voice Styles
1. Update `rules/angela-voice.yaml`
2. Add new processing functions in `src/lib/styling/`
3. Update configuration types in `src/lib/styling/config.ts`

### Modifying SSML Patterns
1. Edit `rules/angela-voice.yaml` emotional_patterns
2. Update `src/lib/styling/ssml.ts` conversion logic
3. Test with sample text

### Adding New API Endpoints
1. Create new route in `src/app/api/`
2. Add Zod schema validation
3. Implement error handling
4. Update frontend to use new endpoint

### Debugging Processing Pipeline
```typescript
// Add to any processing function
console.log('🔍 Debug:', {
  input: text.substring(0, 100),
  step: 'current_step_name',
  output: processedText.substring(0, 100)
});
```

## 🎙️ ElevenLabs V2 Integration

### Voice Settings
```typescript
const voiceSettings = {
  stability: 0.65,        // Higher for consistency
  similarity_boost: 0.85, // Maximum voice consistency
  style: 0.22,           // Reduced variation
  speaker_boost: true,   // Enhanced clarity
  speed: 0.94,           // Natural pace
  quality: "enhanced"    // V2 optimization
};
```

### Request Stitching
```typescript
// Track request IDs for voice consistency
const requestIds: string[] = [];

const options: TTSOptions = {
  // ... other options
  previousRequestIds: requestIds.slice(-3), // Last 3 requests
  previousText: previousChunk.slice(-300),
  nextText: nextChunk.slice(0, 300),
};
```

### SSML Patterns
```xml
<!-- Natural pauses -->
<break time="0.8s"/>

<!-- Mystical content -->
<prosody rate="0.95" pitch="-1st">tarot reading</prosody>

<!-- Key insights -->
<emphasis level="moderate">important revelation</emphasis>

<!-- Intimate delivery -->
<prosody volume="soft" rate="0.9">whispered insight</prosody>
```

## 🔄 API Usage

### Prepare Text
```typescript
const response = await fetch('/api/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Your tarot script here...',
    output: 'text',
    preset: 'angela',
    processingMode: 'angela_v2'
  })
});

const { manifestId, chunks, report, processing } = await response.json();
```

### Synthesize Audio
```typescript
const response = await fetch('/api/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    manifestId: 'uuid-from-prepare',
    format: 'mp3_44100_128'
  })
});

const { jobId, url, downloadUrl, metadata } = await response.json();
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/lib/styling/__tests__/ssml.test.ts

# Watch mode
npm test -- --watch
```

### API Testing
```bash
# Test prepare endpoint
curl -X POST http://localhost:3000/api/prepare \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, you guys.","output":"text","preset":"angela"}'

# Test synthesize endpoint
curl -X POST http://localhost:3000/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{"manifestId":"your-manifest-id","format":"mp3_44100_128"}'
```

## 🐛 Common Issues

### ElevenLabs API Errors
- Check API key in environment variables
- Verify voice ID exists in your account
- Ensure model ID is correct (`eleven_multilingual_v2`)
- Check API rate limits

### Processing Errors
- Validate input text length (max 20,000 chars)
- Check YAML configuration syntax
- Verify all required environment variables

### Audio Quality Issues
- Adjust voice settings in `angela-voice.yaml`
- Check chunk size (35s optimal)
- Verify SSML syntax in processed text

## 📊 Performance Optimization

### Text Processing
- Keep chunks under 3,200 characters
- Use 35-second target duration
- Minimize SSML tag complexity

### Audio Synthesis
- Use request stitching for consistency
- Implement progressive delays between chunks
- Monitor API rate limits

### Frontend
- Implement proper loading states
- Use React.memo for expensive components
- Optimize bundle size with dynamic imports

## 🔧 Configuration Reference

### Environment Variables
```env
ELEVENLABS_API_KEY=your_api_key
ELEVEN_VOICE_ID=your_voice_id
ELEVEN_MODEL_ID=eleven_multilingual_v2
NEXT_PUBLIC_APP_NAME="White Soul Tarot"
AUDIO_RETENTION_DAYS=14
MAX_INPUT_CHARS=20000
```

### Voice Configuration Keys
```yaml
voice:
  voice_id: "ELEVEN_VOICE_ID"
  model_id: "eleven_multilingual_v2"
  settings:
    stability: 0.65
    similarity_boost: 0.85
    style: 0.22
    speaker_boost: true
    speed: 0.94
    quality: "enhanced"

chunking:
  target_seconds: 35
  max_chars: 3200
  min_chars: 1500

emphasis:
  use_ssml: true
  use_prosody: true
  use_emphasis_tags: true
```

## 🚀 Deployment

### Vercel Deployment
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Manual Deployment
```bash
npm run build
npm start
```

## 📚 Additional Resources

- [ElevenLabs V2 API Documentation](https://docs.elevenlabs.io/)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [SSML Reference](https://www.w3.org/TR/speech-synthesis/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and JSDoc guidelines
4. Add tests for new functionality
5. Submit a pull request

---

This quick start guide covers the essential information for developers working with White Soul Tarot. For detailed architecture information, see `ARCHITECTURE.md`.
