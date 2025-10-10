# Music Equalizer Animation

A simple, colorful CSS-only music equalizer animation. Each bar animates with a different speed and color, spelling "SAFRAEL" while bouncing to create a lively equalizer effect.

## Features
- Pure HTML + CSS (no JavaScript)
- Responsive-friendly container with overflow clipping
- Seven animated bars with independent keyframes (`m1`–`m7`)
- Smooth, infinite looping with varying durations
- Easy to customize colors, timings, and text

## Demo
Live demo: https://bilisatu.github.io/Music-Equalizer/

Local preview: open `index.html` in your browser.

Optionally, use a lightweight server for auto-reload while editing:
- VS Code extension: Live Server
- Or run any local static server

## Project structure
```
.
├── index.html       # Markup: heading + .music container with 7 bars
├── style.css        # Styles + keyframe animations m1–m7
├── LICENSE          # Project license (MIT)
└── README.md        # This file
```

## How to run
1. Download/clone this folder.
2. Open the folder in VS Code.
3. Open `index.html` in a browser (double-click), or right‑click in VS Code and choose "Open with Live Server" if you have the extension.

## Customize
- Text on bars: Edit the letters inside the `.m1`–`.m7` divs in `index.html`.
- Colors: Tweak the background colors in each `@keyframes` set in `style.css`.
- Speed: Change the `animation: mX ease-in-out <duration>s infinite;` duration per bar.
- Bar size/spacing: Adjust `.music` size and each `.mX` `width`, `height`, `margin-left`, and `margin-top`.
- Radius: Update `.m1, .m2, .m3, .m4, .m5, .m6, .m7 { border-radius: ... }`.

## Notes
- The current layout uses absolute-like spacing with negative `margin-top` to stack bars in a single row. You can switch to CSS Grid or Flexbox if you prefer cleaner horizontal layout.
- The container is fixed width/height in rem; for true responsiveness, consider using relative units and media queries.

## Tech stack
- HTML5
- CSS3 animations and keyframes

## Credits
Created by SAFRAEL.

## Author
SAFRAEL

## License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
