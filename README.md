# White Soul Tarot - Script to Styled Voice

A sophisticated text-to-speech application that transforms tarot scripts into natural, engaging audio using ElevenLabs TTS with Angela voice styling. Built with Next.js, TypeScript, and Vercel.

## Features

- **Angela Voice Styling**: Specialized voice configuration optimized for tarot readings
- **Intelligent Text Processing**: Normalization, linting, and macro application
- **Smart Chunking**: Optimal text segmentation for natural speech flow
- **Real-time Feedback**: Lint reports with style warnings and suggestions
- **Audio Generation**: High-quality TTS synthesis with ElevenLabs
- **File Storage**: Seamless audio storage with Vercel Blob
- **Modern UI**: Beautiful, responsive interface with dark mode support

## Quick Start

### Prerequisites

- Node.js 18+ 
- ElevenLabs API account
- Vercel account (for deployment)

### Environment Variables

Create a `.env.local` file with:

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

## API Endpoints

### POST /api/prepare

Processes raw text through the Angela voice styling pipeline.

**Request:**
```json
{
  "text": "Your tarot script here...",
  "output": "ssml",
  "preset": "angela"
}
```

**Response:**
```json
{
  "manifestId": "uuid",
  "chunks": [
    {
      "id": 0,
      "body": "<speak>Processed text...</speak>",
      "estSeconds": 15.3
    }
  ],
  "report": {
    "warnings": [],
    "bans": [],
    "stats": {
      "words": 45,
      "sentences": 3,
      "groupAddressRatio": 0.33,
      "consecutiveGroupAddress": 1
    }
  }
}
```

### POST /api/synthesize

Synthesizes processed text chunks into audio using ElevenLabs.

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

### GET /api/download/[jobId]

Downloads or streams the generated audio file.

## Angela Voice Configuration

The voice styling is configured in `rules/angela-voice.yaml`:

- **Pacing**: 145 WPM with strategic pause insertion
- **Tone**: Casual, authoritative style with banned therapy clichés
- **Group Address**: 30-50% ratio of "you guys/you all" usage
- **Emphasis**: Controlled ALL CAPS and markdown emphasis
- **Chunking**: 25-second target chunks with sentence boundaries

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── prepare/route.ts      # Text processing pipeline
│   │   ├── synthesize/route.ts   # TTS synthesis
│   │   └── download/[jobId]/route.ts # Audio serving
│   └── page.tsx                  # Main UI component
├── lib/
│   ├── styling/                  # Text processing library
│   │   ├── config.ts            # Configuration loader
│   │   ├── normalizer.ts        # Text normalization
│   │   ├── linter.ts            # Style checking
│   │   ├── macros.ts            # Pause/emphasis insertion
│   │   ├── ssml.ts              # SSML conversion
│   │   └── chunker.ts           # Text segmentation
│   ├── tts/                     # TTS integration
│   │   └── elevenlabs.ts        # ElevenLabs client
│   └── store/                   # Storage utilities
│       ├── manifest.ts          # Manifest storage
│       └── blob.ts              # Vercel Blob integration
└── rules/
    ├── angela-voice.yaml        # Voice configuration
    └── banned-phrases.txt       # Prohibited phrases
```

## Deployment

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

## Development Guidelines

### Code Style

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

## Voice Styling Guidelines

### Angela Persona
- Confirming, lived-through authority
- Restrained power, not therapist/narrator
- Flat by default with strategic emphasis
- Silence carries meaning

### Text Guidelines
- **Allow**: "kinda", "literally", "ugh", "you know", "I mean"
- **Ban**: "nervous system", "somatic", "inner child", therapy clichés
- **Group Address**: Target 30-50% usage of "you guys/you all"
- **Pauses**: Micro (120ms), Short (250ms), Med (400ms), Long (900ms)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding guidelines
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the [documentation](docs/)
- Open an issue on GitHub
- Review the API endpoint documentation at `/api/prepare` and `/api/synthesize`

---

Built with ❤️ for the tarot community using Next.js, ElevenLabs, and Vercel.