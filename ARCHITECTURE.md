# White Soul Tarot - Technical Architecture

## 🏗️ System Overview

White Soul Tarot is a sophisticated text-to-speech application built with Next.js 15, React 19, and TypeScript. It transforms tarot scripts into natural, engaging audio using ElevenLabs TTS with a specialized Angela voice styling pipeline.

### Core Technology Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Backend**: Next.js API Routes + Node.js
- **TTS Engine**: ElevenLabs V2 Multilingual API
- **Storage**: Vercel Blob for audio files
- **Styling**: Tailwind CSS v4
- **Configuration**: YAML-based voice configuration

## 🎯 Application Architecture

### High-Level Architecture

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

### Data Flow

1. **Text Input** → Frontend validation
2. **Text Processing** → `/api/prepare` → Angela V2 SSML pipeline
3. **Audio Synthesis** → `/api/synthesize` → ElevenLabs V2 API
4. **Storage** → Vercel Blob → Audio file URLs
5. **Playback** → Frontend audio player

## 📁 Project Structure

```
white-soul-tarot/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── prepare/route.ts      # Text processing pipeline
│   │   │   ├── synthesize/route.ts   # TTS synthesis
│   │   │   └── download/[jobId]/     # Audio serving
│   │   ├── page.tsx                  # Main UI component
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Global styles
│   ├── lib/                          # Core libraries
│   │   ├── styling/                  # Text processing
│   │   │   ├── config.ts            # YAML config loader
│   │   │   ├── normalizer.ts        # Text normalization
│   │   │   ├── conversational.ts    # Angela's style
│   │   │   ├── macros.ts            # Pause/emphasis macros
│   │   │   ├── ssml.ts              # SSML conversion
│   │   │   ├── chunker.ts           # Text segmentation
│   │   │   ├── linter.ts            # Style validation
│   │   │   ├── wst2-rules.ts        # Studio speech rules
│   │   │   ├── sanitizer.ts         # TTS sanitization
│   │   │   ├── audio-tags.ts        # Legacy V3 audio tags
│   │   │   └── natural-processor.ts # Natural TTS processing
│   │   ├── tts/                      # TTS integration
│   │   │   ├── elevenlabs.ts        # ElevenLabs V2 client
│   │   │   ├── model-selection.ts   # Model selection logic
│   │   │   ├── model-caps.ts        # Model capabilities
│   │   │   ├── pronunciation.ts     # Pronunciation handling
│   │   │   ├── sound-effects.ts     # Sound effects (future)
│   │   │   └── websocket.ts         # Streaming (future)
│   │   └── store/                    # Storage utilities
│   │       ├── manifest.ts          # Processing manifest
│   │       ├── blob.ts              # Vercel Blob integration
│   │       └── index.ts             # Storage exports
│   └── types/                        # TypeScript types
├── rules/                            # Configuration files
│   ├── angela-voice.yaml            # Voice configuration
│   └── banned-phrases.txt           # Prohibited phrases
├── public/                           # Static assets
├── docs/                             # Documentation
└── package.json                      # Dependencies
```

## 🔧 Core Components

### 1. Text Processing Pipeline (`src/lib/styling/`)

#### Configuration System (`config.ts`)
```typescript
interface VoiceConfig {
  voice: {
    voice_id: string;
    model_id: string;
    settings: VoiceSettings;
    seed: number;
  };
  pacing: PacingConfig;
  tone: ToneConfig;
  chunking: ChunkingConfig;
  emphasis: EmphasisConfig;
  // ... other configurations
}
```

**Key Features:**
- YAML-based configuration loading
- Environment variable substitution
- Configuration validation and caching
- Type-safe configuration access

#### Text Normalization (`normalizer.ts`)
```typescript
export function normalize(text: string): string {
  // Remove extra whitespace
  // Normalize punctuation
  // Handle special characters
  // Validate text length
}
```

#### Conversational Style (`conversational.ts`)
```typescript
export function applyConversationalRealism(text: string, config: VoiceConfig): string {
  // Apply Angela's speaking patterns
  // Insert natural hesitations
  // Add group address ("you guys/you all")
  // Handle run-on sentences
}
```

#### SSML Conversion (`ssml.ts`)
```typescript
export function toSSML(text: string, config: VoiceConfig): string {
  // Convert macros to SSML tags
  // Apply emotional delivery patterns
  // Add prosody and emphasis tags
  // Wrap in <speak> tags
}
```

#### Text Chunking (`chunker.ts`)
```typescript
export interface TextChunk {
  id: number;
  body: string;
  charCount: number;
  estSeconds: number;
}

export function chunk(text: string, config: VoiceConfig): TextChunk[] {
  // Split into 35-second optimal chunks
  // Respect sentence boundaries
  // Add boundary pauses
  // Calculate duration estimates
}
```

### 2. TTS Integration (`src/lib/tts/`)

#### ElevenLabs V2 Client (`elevenlabs.ts`)
```typescript
export interface TTSOptions {
  text: string;
  voiceId: string;
  modelId: string;
  format: 'mp3_44100_128' | 'mp3_44100_192' | 'wav';
  voiceSettings?: VoiceSettings;
  // ... other options
}

export async function ttsChunk(options: TTSOptions): Promise<TTSResponse> {
  // Sanitize text for V2 model
  // Apply voice settings
  // Make API request with context
  // Handle response and errors
}
```

**Key Features:**
- Request stitching for voice consistency
- Context parameters for better continuity
- Progressive delays between requests
- Comprehensive error handling

#### Model Selection (`model-selection.ts`)
```typescript
export function selectOptimalModel(
  useCase: UseCase,
  config: VoiceConfig,
  requiredFeatures: string[] = []
): string {
  // Analyze content characteristics
  // Select model based on requirements
  // Validate feature support
  // Return optimal model ID
}
```

### 3. Storage System (`src/lib/store/`)

#### Manifest Storage (`manifest.ts`)
```typescript
export interface ProcessingManifest {
  id: string;
  chunks: TextChunk[];
  metadata: {
    totalDuration: number;
    report: LintReport;
    configVersion: string;
    originalText: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

export async function saveManifest(chunks: TextChunk[], metadata: ManifestMetadata): Promise<string> {
  // Generate unique ID
  // Store manifest in memory/Redis
  // Set expiration
  // Return manifest ID
}
```

#### Vercel Blob Integration (`blob.ts`)
```typescript
export async function putAudio(
  filename: string,
  buffer: Buffer,
  options: BlobOptions
): Promise<BlobResult> {
  // Upload to Vercel Blob
  // Set access permissions
  // Return URLs
}
```

## 🎙️ ElevenLabs V2 SSML Pipeline

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

### SSML Emotional Delivery

The V2 pipeline uses sophisticated SSML patterns for emotional expression:

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

### Voice Consistency Features

#### Request Stitching
```typescript
// Track request IDs across chunks
const requestIds: string[] = [];

// Pass previous request IDs for consistency
const options: TTSOptions = {
  // ... other options
  previousRequestIds: requestIds.slice(-3), // Last 3 requests
};
```

#### Context Parameters
```typescript
// Provide surrounding text context
const options: TTSOptions = {
  // ... other options
  previousText: previousChunk.slice(-300),
  nextText: nextChunk.slice(0, 300),
};
```

#### Progressive Delays
```typescript
// Enhanced delays for voice consistency
const baseDelay = 300;
const progressiveDelay = i < 3 ? baseDelay + (i * 100) : baseDelay;
await new Promise(resolve => setTimeout(resolve, progressiveDelay));
```

## 🔄 API Endpoints

### POST /api/prepare

**Purpose**: Process raw text through Angela V2 SSML pipeline

**Request Schema**:
```typescript
interface PrepareRequest {
  text: string;                    // Raw text to process
  output: 'ssml' | 'text';         // Output format preference
  preset: string;                  // Voice preset (default: 'angela')
  processingMode: 'angela_v2';     // Processing mode (default: 'angela_v2')
}
```

**Response Schema**:
```typescript
interface PrepareResponse {
  manifestId: string;              // Unique manifest identifier
  chunks: TextChunk[];             // Processed text chunks
  report: LintReport;              // Processing report
  processing?: ProcessingDetails;  // Pipeline details
}
```

**Processing Pipeline**:
1. Load voice configuration from YAML
2. Apply conversational realism
3. Insert pause and emphasis macros
4. Convert to SSML for V2 emotional delivery
5. Chunk text into optimal segments
6. Generate and store manifest
7. Return processing results

### POST /api/synthesize

**Purpose**: Synthesize processed text chunks into audio

**Request Schema**:
```typescript
interface SynthesizeRequest {
  manifestId: string;              // Manifest ID from prepare
  voiceId?: string;                // Optional voice override
  modelId?: string;                // Optional model override
  format: 'mp3_44100_128' | 'mp3_44100_192' | 'wav';
}
```

**Response Schema**:
```typescript
interface SynthesizeResponse {
  jobId: string;                   // Job identifier
  url: string;                     // Public audio URL
  downloadUrl?: string;            // Download URL
  metadata: AudioMetadata;         // Audio file metadata
}
```

**Synthesis Process**:
1. Validate ElevenLabs configuration
2. Retrieve processing manifest
3. Analyze content for model selection
4. Apply model-optimized voice settings
5. Synthesize chunks with request stitching
6. Concatenate audio buffers
7. Store in Vercel Blob
8. Return audio URLs and metadata

### GET /api/download/[jobId]

**Purpose**: Serve audio files for download

**Features**:
- Audio file streaming
- Proper content-type headers
- Download filename generation
- Error handling for missing files

## 🎨 Frontend Architecture

### Main Component (`src/app/page.tsx`)

**State Management**:
```typescript
interface ProcessingState {
  status: 'idle' | 'preparing' | 'proofing' | 'synthesizing' | 'ready' | 'error';
  manifestId?: string;
  report?: LintReport;
  audioUrl?: string;
  downloadUrl?: string;
  error?: string;
  progress?: string;
  processing?: ProcessingDetails;
}

interface WorkflowState {
  scriptStatus: 'idle' | 'generating' | 'ready' | 'error';
  voiceStatus: 'idle' | 'generating' | 'ready' | 'error';
  scriptError?: string;
  voiceError?: string;
}
```

**Key Features**:
- Two-step workflow (script generation → voice synthesis)
- Real-time processing feedback
- Inline SSML tag editing
- Audio playback with download
- Voice version tracking
- Copy-to-clipboard SSML tags

### UI Components

#### Text Input
- Large textarea with file upload support
- Character count and limits
- Real-time validation

#### Processing Status
- Progress indicators with loading states
- Error display with detailed messages
- Success confirmation

#### Lint Reports
- Style warnings and suggestions
- Banned phrase detection
- Processing statistics
- Collapsible detailed view

#### Script Editing
- Inline SSML tag editing
- Copy-to-clipboard functionality
- SSML tag library with examples
- Processing pipeline visualization

#### Audio Playback
- Integrated HTML5 audio player
- Download functionality
- Voice version management
- Metadata display

## 🔧 Configuration System

### Voice Configuration (`rules/angela-voice.yaml`)

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
  seed: 123456

pacing:
  wpm: 142
  pauses:
    micro: 300
    beat: 600
    pause: 1000
    shift: 1600
    boundary: 1200

tone:
  allow: ["kinda", "literally", "ugh", "you know", "I mean"]
  ban: ["nervous system", "somatic", "inner child"]

chunking:
  target_seconds: 35
  max_chars: 3200
  min_chars: 1500
  guardrails:
    start_with_micro_pause: true
    end_with_natural_pause: true
    force_sentence_completion: true
    add_boundary_breath: true

emphasis:
  use_ssml: true
  use_prosody: true
  use_emphasis_tags: true
  emotional_patterns:
    breaths:
      ssml: '<break time="0.8s"/>'
      triggers: ["pause", "breath", "think", "reflect"]
    mystery:
      ssml: '<prosody rate="0.95" pitch="-1st">{text}</prosody>'
      triggers: ["tarot", "divine", "mystic", "sacred"]
```

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

## 🚀 Performance Characteristics

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

## 🔒 Security Considerations

### API Security
- Input validation with Zod schemas
- Rate limiting (implemented via Vercel)
- Error handling without sensitive data exposure
- CORS configuration for API routes

### Data Privacy
- No persistent storage of user text
- Audio files with configurable retention
- Environment variable protection
- Secure API key handling

### File Upload
- File type validation
- Size limits enforcement
- Content sanitization
- Error handling for malformed files

## 🧪 Testing Strategy

### Unit Testing
- Text processing functions
- SSML conversion logic
- Configuration loading
- Model selection algorithms

### Integration Testing
- API endpoint functionality
- ElevenLabs API integration
- Vercel Blob storage
- End-to-end workflow

### Performance Testing
- Text processing benchmarks
- Audio synthesis timing
- Memory usage monitoring
- Concurrent request handling

## 🔮 Future Enhancements

### Planned Features
- **WebSocket Streaming**: Real-time audio streaming
- **Sound Effects**: Background audio generation
- **Voice Cloning**: Custom voice training
- **Batch Processing**: Multiple script processing
- **Analytics**: Usage tracking and insights

### Technical Improvements
- **Caching**: Redis for manifest storage
- **CDN**: Global audio file distribution
- **Monitoring**: Application performance monitoring
- **Logging**: Structured logging with correlation IDs

## 📚 Development Guidelines

### Code Style
- **TypeScript First**: All code must be strongly typed
- **JSDoc Required**: Document all functions, classes, and components
- **Error Handling**: Comprehensive try/catch for async operations
- **Modular Design**: Keep files under 200 lines when possible

### Git Workflow
- **Conventional Commits**: Follow conventional commit specification
- **Feature Branches**: Create feature branches for new development
- **Pull Requests**: Code review required for all changes
- **Testing**: Ensure all tests pass before merging

### Deployment
- **Vercel**: Automatic deployment from main branch
- **Environment Variables**: Configure in Vercel dashboard
- **Monitoring**: Use Vercel analytics and logs
- **Rollback**: Easy rollback through Vercel dashboard

---

This architecture document provides a comprehensive overview of the White Soul Tarot application for full stack developers. For specific implementation details, refer to the individual source files and API documentation.
