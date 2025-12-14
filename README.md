

# Music Equalizer

A modern, feature-rich web audio equalizer and visualizer. Play, tweak, and visualize your music or microphone input with a beautiful, responsive UI.

## Features

- **10-band Equalizer**: Drag sliders or pick from presets (Rock, Pop, Jazz, etc.)
- **Audio Visualizer**: Bars and radial spectrum modes, waveform oscilloscope, and animated particles
- **Playlist Support**: Load multiple audio files, auto-advance, and click to play any track
- **Drag & Drop**: Instantly load audio files by dropping them onto the page
- **Microphone Input**: Route your mic through the EQ and visualizer (toggle with one click)
- **Bass Boost & Reverb**: Enhance your sound with a single button
- **Keyboard Shortcuts**: Space (play/pause), F (fullscreen), arrows (seek/volume), 1–0 (presets)
- **Responsive Design**: Looks great on desktop and mobile

## Usage

1. **Open `index.html` in your browser** (or run a local server for best results)
2. **Load audio**: Click "Choose audio" or drag files onto the page
3. **Tweak**: Adjust EQ, try presets, enable bass/reverb, or switch visualizer modes
4. **Playlist**: Select multiple files to build a playlist, or click tracks to play
5. **Mic**: Click "Mic" to use your microphone as the audio source

## Local Development

To run locally with a static server (recommended for full features):

```
npx http-server -p 5501 -c-1
```
Then open [http://127.0.0.1:5501](http://127.0.0.1:5501) in your browser.

## Project structure
```
.
├── index.html       # Markup
├── style.css        # Styles
├── script.js        # App logic
├── LICENSE          # Project license (MIT)
└── README.md        # This file
```

## Notes
- Browsers require a user gesture to start/resume audio processing; click Play to enable the audio engine.
- If a file won’t play, it’s usually a codec support issue in the browser.


## Author
Created by **Safraeel**

## License
MIT — see [LICENSE](./LICENSE).
