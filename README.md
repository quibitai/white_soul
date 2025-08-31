# White Soul Tarot - Script to Styled Voice

A sophisticated text-to-speech application that transforms tarot scripts into natural, engaging audio using ElevenLabs TTS with Angela voice styling. Built with Next.js, TypeScript, and Vercel.

## 🎯 Application Overview

White Soul Tarot is an AI-native engine for mapping resonance, emotional rhythm, and symbolic logic. It reconstructs tarot readings from pattern and powers them through intuition, using a unified ElevenLabs V2 SSML pipeline optimized for cloned voice compatibility and emotional delivery.

### Core Architecture

The application follows a **two-stage workflow**:

1. **Script Generation**: Raw text → Angela V2 SSML processing → Annotated script with emotional delivery tags
2. **Voice Synthesis**: Annotated script → ElevenLabs V2 synthesis → High-quality audio with cloned voice compatibility

## 🚀 Features

- **🎙️ ElevenLabs V2 SSML Pipeline**: Unified processing using `eleven_multilingual_v2` for cloned voice compatibility
- **🗣️ Angela Voice Styling**: Specialized conversational characteristics optimized for tarot readings
- **💫 Emotional Delivery**: SSML prosody and emphasis tags for nuanced emotional expression
- **✂️ Smart Chunking**: Optimal text segmentation (35s chunks) for seamless audio flow
- **🔧 Real-time Processing**: Live lint reports with style warnings and suggestions
- **📦 File Storage**: Seamless audio storage with Vercel Blob
- **🎨 Modern UI**: Beautiful, responsive interface with intuitive workflow

## 🏗️ Technical Architecture

### Frontend (Next.js 15 + React 19)
- **Main Interface**: Single-page application with two-step workflow
- **Real-time Feedback**: Live processing status and error handling
- **Audio Playback**: Integrated audio player with download functionality
- **Script Editing**: Inline SSML tag editing with copy-to-clipboard functionality

### Backend API (Next.js API Routes)
- **`/api/prepare`**: Text processing pipeline with Angela V2 SSML conversion
- **`/api/synthesize`**: ElevenLabs V2 synthesis with request stitching for voice consistency
- **`/api/download/[jobId]`**: Audio file serving and download

### Core Libraries

#### Text Processing (`src/lib/styling/`)
- **`config.ts`**: YAML configuration loader for voice settings
- **`normalizer.ts`**: Text normalization and validation
- **`conversational.ts`**: Angela's conversational style application
- **`macros.ts`**: Pause and emphasis macro insertion
- **`ssml.ts`**: SSML conversion for V2 emotional delivery
- **`chunker.ts`**: Optimal text segmentation (35s chunks)
- **`linter.ts`**: Style checking and validation

#### TTS Integration (`src/lib/tts/`)
- **`elevenlabs.ts`**: ElevenLabs V2 API client with request stitching
- **`model-selection.ts`**: Intelligent model selection based on content
- **`model-caps.ts`**: Model capabilities and optimization settings

#### Storage (`src/lib/store/`)
- **`manifest.ts`**: Processing manifest storage
- **`blob.ts`**: Vercel Blob integration for audio storage

## 🔧 Configuration

### Environment Variables

```env
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVEN_VOICE_ID=your_angela_voice_id
ELEVEN_MODEL_ID=eleven_multilingual_v2

# App Configuration
NEXT_PUBLIC_APP_NAME="White Soul Tarot - Script to Styled Voice"
AUDIO_RETENTION_DAYS=14
MAX_INPUT_CHARS=20000
```

### Voice Configuration (`rules/angela-voice.yaml`)

```yaml
voice:
  voice_id: "ELEVEN_VOICE_ID"
  model_id: "eleven_multilingual_v2"  # V2 for cloned voice compatibility
  settings:
    stability: 0.65         # Higher stability for seamless chunk consistency
    similarity_boost: 0.85  # Maximum voice consistency for chunk stitching
    style: 0.22            # Reduced variation to prevent chunk-to-chunk differences
    speaker_boost: true     # Enhances clarity and presence
    speed: 0.94            # Optimal natural pace
    quality: "enhanced"     # V2 optimization for professional output
```

## 📡 API Endpoints

### POST /api/prepare

Processes raw text through the Angela V2 SSML pipeline.

**Request:**
```json
{
  "text": "Your tarot script here...",
  "output": "text",
  "preset": "angela",
  "processingMode": "angela_v2"
}
```

**Response:**
```json
{
  "manifestId": "uuid",
  "chunks": [
    {
      "id": 0,
      "body": "<speak>Processed text with SSML...</speak>",
      "estSeconds": 15.3
    }
  ],
  "report": {
    "warnings": [],
    "bans": [],
    "stats": {
      "words": 45,
      "sentences": 3,
      "chunks": 2,
      "ssmlTags": 8
    }
  },
  "processing": {
    "originalText": "Raw input...",
    "conversational": "Applied Angela's style...",
    "withMacros": "Added pause/emphasis macros...",
    "finalOutput": "<speak>Final SSML...</speak>",
    "pipeline": [
      {"step": "conversational", "description": "Applied Angela's conversational style"},
      {"step": "macros", "description": "Added pause and emphasis macros"},
      {"step": "ssml", "description": "Converted to SSML for v2 emotional delivery"},
      {"step": "chunking", "description": "Split into synthesis chunks"}
    ]
  }
}
```

### POST /api/synthesize

Synthesizes processed text chunks into audio using ElevenLabs V2.

**Request:**
```json
{
  "manifestId": "uuid-from-prepare",
  "format": "mp3_44100_128"
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "url": "https://blob.vercel-storage.com/audio.mp3",
  "downloadUrl": "https://blob.vercel-storage.com/audio.mp3?download=1",
  "metadata": {
    "format": "mp3",
    "sizeBytes": 245760,
    "duration": 15.3,
    "chunks": 2
  }
}
```

## 🎙️ ElevenLabs V2 SSML Pipeline

### Processing Flow

1. **Text Input**: Raw tarot script text
2. **Conversational Style**: Apply Angela's speaking patterns and vocabulary
3. **Macro Application**: Insert pause and emphasis markers
4. **SSML Conversion**: Convert to SSML for V2 emotional delivery
5. **Chunking**: Split into 35-second optimal chunks
6. **Synthesis**: ElevenLabs V2 with request stitching for voice consistency

### SSML Emotional Delivery

The V2 pipeline uses SSML tags for nuanced emotional expression:

```xml
<speak>
  <prosody rate="0.95" pitch="-1st">mystical content</prosody>
  <break time="0.8s"/>
  <emphasis level="moderate">key insight</emphasis>
  <prosody volume="soft" rate="0.9">intimate delivery</prosody>
</speak>
```

### Voice Consistency Features

- **Request Stitching**: Maintains voice consistency across chunks
- **Context Parameters**: Provides surrounding text context for better continuity
- **Progressive Delays**: Optimized timing between requests for stability

## 🎯 Voice Styling Guidelines

### Angela Persona
- **Tone**: Confirming, lived-through authority with restrained power
- **Style**: Flat by default with strategic emphasis, silence carries meaning
- **Vocabulary**: Allows casual terms like "kinda", "literally", "ugh", "you know"
- **Banned Phrases**: Avoids therapy clichés like "nervous system", "somatic", "inner child"

### Text Processing Rules
- **Group Address**: Target 30-50% usage of "you guys/you all"
- **Pacing**: 142 WPM with strategic pause insertion
- **Chunking**: 35-second target chunks with sentence boundaries
- **Emphasis**: Controlled ALL CAPS and SSML emphasis tags

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- ElevenLabs API account with V2 access
- Vercel account (for deployment)

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit `http://localhost:3000` to access the application.

## 🔄 Development Workflow

### Two-Step Generation Process

1. **Generate Annotated Script**: Process raw text through Angela V2 pipeline
2. **Generate Angela's Voice**: Synthesize annotated script into audio

### Code Style Guidelines

- **TypeScript First**: All code must be strongly typed
- **JSDoc Required**: Document all functions, classes, and components
- **Error Handling**: Comprehensive try/catch for async operations
- **Modular Design**: Keep files under 200 lines when possible

### Testing

```bash
# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

## 🎨 UI/UX Features

### Main Interface
- **Text Input**: Large textarea with file upload support
- **Processing Status**: Real-time feedback with progress indicators
- **Lint Reports**: Style warnings and banned phrase detection
- **Script Editing**: Inline SSML tag editing with copy functionality
- **Audio Playback**: Integrated player with download options

### Advanced Features
- **SSML Tag Library**: Click-to-copy SSML tags for emotional delivery
- **Voice Versions**: Track multiple voice generations with timestamps
- **Processing Pipeline**: Visual representation of text transformation steps

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Deploy to your hosting platform
npm start
```

## 📊 Performance Characteristics

### Text Processing
- **Input Limit**: 20,000 characters maximum
- **Processing Speed**: ~2-5 seconds for typical scripts
- **Chunk Optimization**: 35-second chunks for seamless audio flow

### Audio Synthesis
- **Model**: ElevenLabs V2 Multilingual for cloned voice compatibility
- **Quality**: Enhanced quality with optimized voice settings
- **Format**: MP3 44.1kHz 128kbps (configurable)
- **Consistency**: Request stitching for voice continuity across chunks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding guidelines
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
- Check the [documentation](docs/)
- Open an issue on GitHub
- Review the API endpoint documentation at `/api/prepare` and `/api/synthesize`

---

Built with ❤️ for the tarot community using Next.js, ElevenLabs V2, and Vercel.