# White Soul Tarot - Comprehensive Overview

## 🎯 Executive Summary

White Soul Tarot is an AI-native engine for mapping resonance, emotional rhythm, and symbolic logic. It transforms tarot scripts into natural, engaging audio using ElevenLabs TTS with a specialized Angela voice styling pipeline. The application reconstructs readings from pattern and powers them through intuition.

### Key Value Propositions
- **🎙️ Professional Voice Quality**: ElevenLabs V2 SSML pipeline with cloned voice compatibility
- **🗣️ Authentic Angela Voice**: Specialized conversational characteristics for tarot readings
- **💫 Emotional Delivery**: Nuanced SSML prosody and emphasis for engaging audio
- **⚡ Streamlined Workflow**: Two-step process from script to high-quality audio
- **🔧 Developer-Friendly**: Modern tech stack with comprehensive documentation

## 🏗️ Technical Architecture

### Technology Stack
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Next.js API Routes + Node.js
- **TTS Engine**: ElevenLabs V2 Multilingual API
- **Storage**: Vercel Blob for audio files
- **Configuration**: YAML-based voice configuration
- **Deployment**: Vercel (automatic from GitHub)

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
├─ Text Input          ├─ /api/prepare        ├─ ElevenLabs API
├─ Processing Status   ├─ /api/synthesize     ├─ Vercel Blob
├─ Audio Playback      ├─ /api/download       └─ File Storage
└─ Script Editing      └─ Error Handling
```

## 🎙️ ElevenLabs V2 SSML Pipeline

### Processing Flow
1. **Text Input**: Raw tarot script text (max 20,000 characters)
2. **Conversational Style**: Apply Angela's speaking patterns and vocabulary
3. **Macro Application**: Insert pause and emphasis markers
4. **SSML Conversion**: Convert to SSML for V2 emotional delivery
5. **Chunking**: Split into 35-second optimal chunks
6. **Synthesis**: ElevenLabs V2 with request stitching for voice consistency
7. **Storage**: Vercel Blob with 14-day retention

### Voice Consistency Features
- **Request Stitching**: Maintains voice consistency across chunks
- **Context Parameters**: Provides surrounding text context for better continuity
- **Progressive Delays**: Optimized timing between requests for stability
- **Enhanced Voice Settings**: Optimized for cloned voice compatibility

### SSML Emotional Delivery
```xml
<speak>
  <!-- Natural pauses and breathing -->
  <break time="0.8s"/>
  
  <!-- Mystical content with subtle prosody -->
  <prosody rate="0.95" pitch="-1st">tarot reading</prosody>
  
  <!-- Key insights with emphasis -->
  <emphasis level="moderate">important revelation</emphasis>
  
  <!-- Intimate delivery -->
  <prosody volume="soft" rate="0.9">whispered insight</prosody>
  
  <!-- Energetic content -->
  <prosody rate="1.05" pitch="+0.5st">powerful transformation</prosody>
</speak>
```

## 🎯 Angela Voice Styling

### Voice Persona
- **Tone**: Confirming, lived-through authority with restrained power
- **Style**: Flat by default with strategic emphasis, silence carries meaning
- **Vocabulary**: Allows casual terms like "kinda", "literally", "ugh", "you know"
- **Banned Phrases**: Avoids therapy clichés like "nervous system", "somatic", "inner child"

### Text Processing Rules
- **Group Address**: Target 30-50% usage of "you guys/you all"
- **Pacing**: 142 WPM with strategic pause insertion
- **Chunking**: 35-second target chunks with sentence boundaries
- **Emphasis**: Controlled ALL CAPS and SSML emphasis tags

### Voice Configuration
```yaml
voice:
  voice_id: "ELEVEN_VOICE_ID"
  model_id: "eleven_multilingual_v2"
  settings:
    stability: 0.65         # Higher for consistency
    similarity_boost: 0.85  # Maximum voice consistency
    style: 0.22            # Reduced variation
    speaker_boost: true     # Enhanced clarity
    speed: 0.94            # Natural pace
    quality: "enhanced"     # V2 optimization
```

## 🔄 User Workflow

### Two-Step Generation Process

#### Step 1: Generate Annotated Script
1. User inputs raw tarot script text
2. System processes through Angela V2 SSML pipeline
3. Returns annotated script with SSML emotional delivery tags
4. User can edit and fine-tune the script

#### Step 2: Generate Angela's Voice
1. User triggers voice synthesis from annotated script
2. System synthesizes using ElevenLabs V2 with request stitching
3. Returns high-quality audio with download link
4. User can generate multiple versions for comparison

### Key Features
- **Real-time Processing**: Live feedback with progress indicators
- **Script Editing**: Inline SSML tag editing with copy functionality
- **Voice Versions**: Track multiple voice generations with timestamps
- **Audio Playback**: Integrated player with download options
- **Lint Reports**: Style warnings and banned phrase detection

## 📊 Performance Characteristics

### Text Processing
- **Input Limit**: 20,000 characters maximum
- **Processing Speed**: ~2-5 seconds for typical scripts
- **Memory Usage**: Minimal, text-based processing
- **Chunk Optimization**: 35-second chunks for seamless audio flow

### Audio Synthesis
- **Model**: ElevenLabs V2 Multilingual for cloned voice compatibility
- **Quality**: Enhanced quality with optimized voice settings
- **Format**: MP3 44.1kHz 128kbps (configurable)
- **Consistency**: Request stitching for voice continuity across chunks
- **Latency**: ~10-30 seconds for typical scripts

### Storage
- **Audio Files**: Vercel Blob with 14-day retention
- **Manifests**: In-memory storage with expiration
- **Configuration**: YAML files with caching

## 🔧 API Endpoints

### POST /api/prepare
Processes raw text through the Angela V2 SSML pipeline.

**Request**:
```json
{
  "text": "Your tarot script here...",
  "output": "text",
  "preset": "angela",
  "processingMode": "angela_v2"
}
```

**Response**:
```json
{
  "manifestId": "uuid",
  "chunks": [...],
  "report": {...},
  "processing": {
    "originalText": "Raw input...",
    "conversational": "Applied Angela's style...",
    "withMacros": "Added pause/emphasis macros...",
    "finalOutput": "<speak>Final SSML...</speak>",
    "pipeline": [...]
  }
}
```

### POST /api/synthesize
Synthesizes processed text chunks into audio using ElevenLabs V2.

**Request**:
```json
{
  "manifestId": "uuid-from-prepare",
  "format": "mp3_44100_128"
}
```

**Response**:
```json
{
  "jobId": "uuid",
  "url": "https://blob.vercel-storage.com/audio.mp3",
  "downloadUrl": "https://blob.vercel-storage.com/audio.mp3?download=1",
  "metadata": {...}
}
```

## 🎨 User Interface

### Main Features
- **Text Input**: Large textarea with file upload support
- **Processing Status**: Real-time feedback with progress indicators
- **Lint Reports**: Style warnings and banned phrase detection
- **Script Editing**: Inline SSML tag editing with copy functionality
- **Audio Playback**: Integrated player with download options

### Advanced Features
- **SSML Tag Library**: Click-to-copy SSML tags for emotional delivery
- **Voice Versions**: Track multiple voice generations with timestamps
- **Processing Pipeline**: Visual representation of text transformation steps

## 🔒 Security & Privacy

### Security Measures
- Input validation with Zod schemas
- Rate limiting via Vercel
- Error handling without sensitive data exposure
- CORS configuration for API routes

### Data Privacy
- No persistent storage of user text
- Audio files with configurable retention (14 days)
- Environment variable protection
- Secure API key handling

### File Upload Security
- File type validation
- Size limits enforcement
- Content sanitization
- Error handling for malformed files

## 🚀 Deployment & Infrastructure

### Vercel Deployment
- **Automatic Deployment**: From GitHub main branch
- **Environment Variables**: Configured in Vercel dashboard
- **Monitoring**: Vercel analytics and logs
- **Rollback**: Easy rollback through Vercel dashboard

### Infrastructure Requirements
- **ElevenLabs API**: V2 access with sufficient credits
- **Vercel Account**: For hosting and blob storage
- **GitHub Repository**: For version control and deployment

## 📈 Scalability & Performance

### Current Capacity
- **Concurrent Users**: Limited by ElevenLabs API rate limits
- **Audio Storage**: Vercel Blob with automatic cleanup
- **Processing Speed**: ~2-5 seconds per script
- **Audio Quality**: Professional-grade with V2 model

### Optimization Strategies
- **Request Stitching**: Voice consistency across chunks
- **Progressive Delays**: Optimized timing between requests
- **Chunk Optimization**: 35-second chunks for seamless flow
- **Caching**: Configuration and manifest caching

## 🔮 Future Roadmap

### Planned Features
- **WebSocket Streaming**: Real-time audio streaming
- **Sound Effects**: Background audio generation
- **Voice Cloning**: Custom voice training integration
- **Batch Processing**: Multiple script processing
- **Analytics**: Usage tracking and insights

### Technical Improvements
- **Caching**: Redis for manifest storage
- **CDN**: Global audio file distribution
- **Monitoring**: Application performance monitoring
- **Logging**: Structured logging with correlation IDs

## 📚 Documentation Structure

### For Developers
- **ARCHITECTURE.md**: Comprehensive technical architecture
- **DEVELOPER_QUICKSTART.md**: Quick start guide for developers
- **MIGRATION_V2.md**: Migration guide from legacy V3 pipeline

### For Users
- **README.md**: Main documentation with setup and usage
- **API Documentation**: Available at `/api/prepare` and `/api/synthesize`

### For Stakeholders
- **OVERVIEW.md**: This document - comprehensive overview
- **Performance Metrics**: Available in Vercel dashboard

## 🤝 Contributing & Support

### Development Guidelines
- **TypeScript First**: All code must be strongly typed
- **JSDoc Required**: Document all functions, classes, and components
- **Error Handling**: Comprehensive try/catch for async operations
- **Modular Design**: Keep files under 200 lines when possible

### Support Channels
- **Documentation**: Comprehensive guides and examples
- **GitHub Issues**: Bug reports and feature requests
- **API Documentation**: Self-documenting API endpoints

## 📊 Success Metrics

### Technical Metrics
- **Processing Speed**: <5 seconds for typical scripts
- **Audio Quality**: Professional-grade output
- **Voice Consistency**: Seamless chunk transitions
- **Uptime**: 99.9% via Vercel infrastructure

### User Experience Metrics
- **Ease of Use**: Two-step workflow
- **Audio Quality**: Enhanced V2 model output
- **Editing Capabilities**: Inline SSML tag editing
- **Download Options**: Multiple format support

---

This comprehensive overview provides a complete picture of the White Soul Tarot application for stakeholders, developers, and users. The application represents a sophisticated integration of modern web technologies with advanced TTS capabilities, delivering a unique and powerful tool for tarot script transformation.
