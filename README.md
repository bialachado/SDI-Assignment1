# Kinetic Handscape

**Student**: Beatriz Lachado Pereira  
**Student ID**: up202207380

---

An interactive gesture-driven particle visualization system that responds to real-time hand detection and movement.

## Overview

Kinetic Handscape uses computer vision and machine learning to detect your hand and transform your gestures into dynamic particle animations. The system recognizes different hand shapes and movements to trigger three distinct visual modes: **Calm**, **Focus**, and **Chaos**.

## Features

### Hand Tracking
- Real-time hand detection using MediaPipe Hands
- Detects up to 2 hands simultaneously
- Tracks 21 landmark points per hand for precise gesture recognition
- GPU-accelerated inference with TensorFlow.js

### Three Interaction Modes

**Calm Mode** (Open Hand)
- Spawns relaxing pastel pink particles
- Slower, more controlled particle motion
- Triggered when hand is open with fingers extended
- Moderate particle emission rate

**Focus Mode** (Closed Fist)
- Generates focused blue particles
- Controlled, deliberate movement
- Triggered by closed fist gesture
- Sparse particle emission
- Visual representation of concentration

**Chaos Mode** (Rapid Movement)
- Creates energetic yellow particles
- Fast, aggressive particle motion
- Triggered by rapid hand movement
- High particle emission rate
- Represents dynamic energy

### Visual Effects

- **Flow Field**: Particles follow a Perlin noise-based vector field that animates smoothly
- **Particle Trails**: Graphics layer captures persistent trails showing particle paths
- **Skeletal Overlay**: Abstract hand skeleton visualization that changes color by mode
- **Mirrored Video Feed**: Horizontal mirror of camera input for natural interaction

### Real-time UI Feedback

- Status indicator shows hand detection state (green = detected, red = not detected)
- Mode indicator displays current gesture mode color
- Interaction guide explains all three gesture modes
- Color legend for quick reference

## Technical Stack

- **p5.js v1.7.0**: Canvas rendering, video capture, physics simulation
- **MediaPipe Hands**: Real-time hand landmark detection
- **TensorFlow.js v4**: Neural network computation with WebGL GPU acceleration
- **HTML5 Canvas**: Graphics rendering
- **CSS3**: UI styling with glass-morphism effects

## Getting Started

### Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Webcam/camera access
- JavaScript enabled

### Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Allow camera access when prompted
4. Wait for "Model Ready" status

### Usage

1. Position yourself in front of the camera
2. Try different hand gestures:
   - Open your hand → **Calm mode** (pink particles)
   - Make a fist → **Focus mode** (blue particles)
   - Move your hand quickly → **Chaos mode** (yellow particles)
3. Watch particles spawn from your fingertips and follow the flow field
4. Experiment with different movements and speeds

## How It Works

### Gesture Detection

The system analyzes three metrics from detected hand landmarks:

- **Hand Span**: Distance from wrist to middle finger tip (measures openness)
- **Hand Area**: Bounding box of all hand landmarks (measures hand size)
- **Velocity**: Speed of hand movement (measures motion intensity)

These metrics are mapped to three modes using threshold-based logic.

### Particle System

- **Object Pool Pattern**: Pre-allocated particles are recycled to avoid garbage collection stalls
- **Physics**: Each particle follows Newton's laws with forces from the flow field
- **Toroidal Wrapping**: Particles wrap around screen edges seamlessly
- **Fade Out**: Particles gradually fade and are recycled after ~170 frames

### Flow Field

- Generated using 3D Perlin noise
- Creates smooth, organic particle movement patterns
- Animates smoothly over time for continuous visual interest
- Grid-based for efficient computation

## File Structure

```
Assignment1/
├── index.html          # HTML structure and library loading
├── sketch.js           # Main application logic
├── style.css           # UI styling and animations
└── README.md           # This file
```

## Browser Compatibility

- Chrome/Chromium: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 13+)
- Edge: ✅ Full support

## Performance Notes

- Frames sent to MediaPipe every 2 frames for performance optimization
- Flow field updated every frame
- Particle pool prevents memory leaks
- WebGL backend for GPU acceleration

## Tips for Best Results

1. **Lighting**: Well-lit environment helps with hand detection
2. **Distance**: Keep hand 0.5-1.5 meters from camera
3. **Speed**: Use smooth, deliberate movements for better tracking
4. **Multiple Hands**: Try using both hands for complex particle patterns

## Credits

- Hand detection: [MediaPipe Hands](https://github.com/google/mediapipe)
- Machine learning: [TensorFlow.js](https://www.tensorflow.org/js)
- Graphics: [p5.js](https://p5js.org/)

## License

This project is for educational purposes.

## Troubleshooting

**"Initializing..." stays on screen**
- Check browser console for errors (F12 → Console)
- Ensure camera access is granted
- Try refreshing the page
- Check internet connection for library loading

**No hand detected (red indicator)**
- Ensure adequate lighting
- Check camera is working (test in other apps)
- Position hand clearly in frame
- Make sure hand is open enough or closed enough for detection

**Particles not appearing**
- Check that hand is detected (green indicator)
- Try making a fist (Focus mode) which has less strict requirements
- Ensure JavaScript is enabled
- Check browser compatibility
