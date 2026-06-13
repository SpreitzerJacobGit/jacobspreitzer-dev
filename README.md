# Jacob Spreitzer — Resume Site

A personal resume/portfolio site for Jacob Spreitzer, Application Developer & ERP Engineer.

## Live preview

Open `index.html` in a browser, or serve the directory with any static file server:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Project structure

```
.
├── index.html          # Page markup
├── css/
│   └── style.css       # All site styles
├── js/
│   ├── fade-in.js       # Scroll-triggered fade-in animations
│   ├── background.js    # Three.js wireframe background scenes
│   └── name-animation.js # Canvas particle animation for the hero name
└── assets/              # Static assets (images, icons, etc.)
```

## Tech

- Plain HTML/CSS/JS, no build step required
- [Three.js](https://threejs.org/) (via CDN) for the wireframe background animations
- Google Fonts: Lora, DM Sans, DM Mono
