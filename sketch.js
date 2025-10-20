/*
 * Kinetic Handscape
 * 
 * This project uses hand tracking to create a particle system that responds to your gestures.
 * The camera detects your hand and spawns particles that move based on how you move and the shape of your hand.
 * 
 * There are 3 different modes:
 * - Calm: Open hand creates relaxing pink particles
 * - Focus: Closed fist creates focused blue particles
 * - Chaos: Fast movement creates energetic yellow particles
 * 
 * The particles follow a flow field and drift across the screen before fading away.
 */

// Global variables for hand detection, particles, and rendering
let video;                    // camera video input
let hands;                    // mediapose hands object for detecting hand landmarks
let predictions = [];         // stores the hand position data each frame
let videoAspect = 640 / 480;  // aspect ratio for video input
let previousPalmPos = {};     // tracks last palm position for each hand to calculate speed
let isReady = false;          // flag to check if model is loaded

// Particle system - manages all the particles
let particles = [];           // array of active particles
let particlePool = [];        // reuse particles instead of creating new ones
let maxParticles = 1000;      // limit max particles on screen
let paintingLayer;            // graphics layer for particle trails
let flowField = [];           // array of direction vectors for particles to follow

// Flow field settings - noise field that guides particles
let cols, rows;               // grid dimensions
let scl = 30;                 // scale of each flow field cell
let zoff = 0;                 // z offset for perlin noise

// UI and performance
let frameCap = 60;            // target frame rate
let spawnThrottle = 0;        // throttle particle spawning

// DOM references - grab html elements
let handStatusDot, handText;  // status indicator for hand detection
let instructionsBox, legendBox, uiContainer;  // ui elements

// Particle class - handles individual particle physics and rendering
class Particle {
    constructor() {
        // position, velocity, acceleration vectors
        this.pos = createVector(0, 0);        // where particle is
        this.vel = createVector(0, 0);        // how fast it moves
        this.acc = createVector(0, 0);        // forces acting on it
        this.maxSpeed = 4;                    // max velocity limit

        // particle appearance
        this.life = 0;                        // brightness/transparency (0-255)
        this.size = 2;                        // radius
        this.hue = 260;                       // color hue
        this.saturation = 85;                 // color saturation
        this.brightness = 95;                 // color brightness
        this.alive = false;                   // is it being used
    }

    init(x, y, mode, hue, speed) {
        // reset particle with new starting position and properties
        this.pos.set(x, y);                   // where to spawn
        this.vel.set(random(-1, 1), random(-1, 1));  // random starting direction
        this.acc.set(0, 0);                   // reset forces
        this.hue = hue;                       // set color based on mode
        this.maxSpeed = speed;                // movement speed
        this.size = random(4, 10);            // random size
        this.life = 255;                      // fully visible
        this.alive = true;                    // activate it
        
        // adjust color brightness based on mode for different feel
        if (mode === 'calm') {
            this.saturation = 60;             // less saturated for calm
            this.brightness = 98;             // lighter/more pastel
        } else {
            this.saturation = 85;             // more saturated
            this.brightness = 95;             // more vibrant
        }

        // chaos mode gives particles extra force to spread around
        if (mode === 'chaos') {
            this.applyForce(p5.Vector.random2D().setMag(random(1, 3)));
        }
    }

    applyForce(force) {
        // add force to acceleration (used to push particles around)
        this.acc.add(force);
    }

    follow(flowField) {
        // particle follows the flow field - get grid cell and apply that direction
        let x = floor(this.pos.x / scl);      // which column
        let y = floor(this.pos.y / scl);      // which row
        let index = x + y * cols;              // convert to 1d array index
        if (flowField[index]) this.applyForce(flowField[index]);  // apply direction
    }

    update() {
        // update particle physics each frame
        if (!this.alive) return;               // skip if dead

        // physics: apply forces and update position
        this.vel.add(this.acc);                // add acceleration to velocity
        this.vel.limit(this.maxSpeed);         // cap the max speed
        this.pos.add(this.vel);                // move particle
        this.acc.mult(0);                      // reset acceleration each frame

        // fade out over time (life decreases)
        this.life -= 1.5;                      // slower fade = longer visible

        // wrap around screen edges (toroidal)
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = height;
        if (this.pos.y > height) this.pos.y = 0;

        // kill particle when fully faded
        if (this.life <= 0) this.kill();
    }

    show() {
        // draw particle and add to trail layer
        if (!this.alive) return;

        // draw main particle circle
        noStroke();
        fill(this.hue, this.saturation, this.brightness, map(this.life, 0, 255, 0, 220));  // fade out
        ellipse(this.pos.x, this.pos.y, this.size);

        // draw to painting layer for trail effect
        paintingLayer.noStroke();
        paintingLayer.fill(this.hue, this.saturation, this.brightness - 5, map(this.life, 0, 255, 0, 15));  // darker trail
        paintingLayer.ellipse(this.pos.x, this.pos.y, this.size * 2);  // bigger trail
    }

    kill() {
        // deactivate particle and return to pool for reuse
        this.alive = false;                   // mark as dead
        particlePool.push(this);              // put back in pool
    }
}

// p5.js setup function - runs once at start
function setup() {
    // grab html elements so we can control them
    handStatusDot = document.getElementById('hand-status-dot');  // status dot indicator
    handText = document.getElementById('hand-text');            // status text
    instructionsBox = document.getElementById('instructions-box');  // instructions
    legendBox = document.getElementById('legend');              // legend
    uiContainer = document.getElementById('ui-container');      // ui container

    // setup canvas and drawing settings
    createCanvas(windowWidth, windowHeight);        // full window size
    colorMode(HSB, 360, 100, 100, 255);            // HSB for easier color control
    frameRate(frameCap);                            // target 60 fps

    // initialize flow field grid
    cols = floor(width / scl);                      // number of columns
    rows = floor(height / scl);                     // number of rows

    // create separate graphics layer for particle trails
    paintingLayer = createGraphics(width, height);  // off-screen buffer
    paintingLayer.colorMode(HSB, 360, 100, 100, 255);  // same color mode
    paintingLayer.clear();                          // start transparent

    // pre-create particles to reuse instead of making new ones
    for (let i = 0; i < maxParticles; i++) {
        particlePool.push(new Particle());          // fill the pool
    }

    // initialize MediaPipe Hands for hand detection
    console.log('Initializing MediaPipe Hands...');
    
    async function initializePipeline() {
        try {
            // setup tensorflow backend for computation
            if (typeof tf !== 'undefined') {
                await tf.ready();              // wait for tensorflow to load
                console.log('TensorFlow.js is ready');
                
                try {
                    await tf.setBackend('webgl');  // use gpu if available
                    console.log('TensorFlow.js backend set to: webgl');
                } catch (webglErr) {
                    console.warn('WebGL backend unavailable, using CPU:', webglErr);
                    await tf.setBackend('cpu');    // fallback to cpu
                }
            }
            
            // wait for MediaPipe library to load
            let waits = 0;
            await new Promise((resolve) => {
                const checkMediaPipe = setInterval(() => {
                    waits++;
                    if (typeof window.Hands !== 'undefined') {
                        clearInterval(checkMediaPipe);
                        console.log('MediaPipe Hands global found');
                        resolve();
                    }
                    if (waits > 100) {          // timeout after 5 seconds
                        clearInterval(checkMediaPipe);
                        console.warn('MediaPipe Hands timeout - may still initialize');
                        resolve();
                    }
                }, 50);
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));  // wait a bit more
            
            // create hands detector instance
            const MEDIAPIPE_CDN = `https://unpkg.com/@mediapipe/hands/`;  // cdn url
            
            if (typeof window.Hands !== 'undefined') {
                console.log('Creating Hands instance with WASM support...');
                
                hands = new window.Hands({
                    locateFile: (file) => {
                        // load wasm files from cdn
                        const url = MEDIAPIPE_CDN + file;
                        console.log(`Resolving file: ${file}`);
                        return url;
                    }
                });
                
                console.log('Hands instance created, setting options...');
                
                // configure detection settings
                await hands.setOptions({
                    maxNumHands: 2,                // max hands to detect
                    modelComplexity: 0,            // 0 = lite, 1 = full
                    minDetectionConfidence: 0.7,   // confidence threshold
                    minTrackingConfidence: 0.5     // tracking threshold
                });
                
                console.log('Hands options set');
                
                hands.onResults(onHandsResults);  // callback when hands detected
                
                console.log('MediaPipe Hands configured successfully');
            } else {
                console.error('MediaPipe Hands global not found after 5 second wait');
                throw new Error('MediaPipe Hands failed to load');
            }
            
            startVideoCapture();                  // start camera
            
        } catch (error) {
            console.error('Failed to initialize MediaPipe pipeline:', error);
            handText.innerHTML = 'Initialization Error';  // show error
            handStatusDot.classList.remove('active');
            handStatusDot.classList.add('inactive');
        }
    }
    
    initializePipeline();  // start the initialization
}

// start capturing video from camera
function startVideoCapture() {
    try {
        video = createCapture(VIDEO, () => {
            console.log('Video feed initialized');
            // wait a moment for video to stabilize
            setTimeout(() => {
                handText.innerHTML = 'Model Ready';  // update ui
                handStatusDot.classList.add('active');  // turn dot green
                handStatusDot.classList.remove('inactive');
                isReady = true;                      // mark ready to go
            }, 500);
        });
        
        video.size(640, 480);                   // video resolution
        video.hide();                           // hide the video element (we use it in draw)
        
        // get the raw html video element for debugging
        const videoElement = video.elt ? video.elt : video;
        console.log('Video element created:', videoElement);
        
    } catch (error) {
        console.error('Error initializing video capture:', error);
        handText.innerHTML = 'Camera Error';
        handStatusDot.classList.add('inactive');
    }
}

// callback when mediapipe detects hands
function onHandsResults(results) {
    predictions = [];                       // reset predictions
    
    if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];  // 21 landmarks per hand
            
            // convert normalized coords to pixel coords
            const pixelLandmarks = landmarks.map(lm => [
                lm.x * 640,                 // x in pixels
                lm.y * 480,                 // y in pixels
                lm.z                        // z depth
            ]);
            
            predictions.push({
                landmarks: pixelLandmarks,
                handedness: results.multiHandedness[i].label  // left or right
            });
        }
    }
}

// main animation loop - runs every frame
function draw() {
    if (!isReady) {
        background(0, 0, 5);                // dark screen while loading
        return;
    }

    // send video frame to MediaPipe for hand detection
    if (hands && video && frameCount % 2 === 0 && isReady) {
        try {
            // get the raw video element
            const videoElement = video.elt ? video.elt : video;
            
            // check if video is ready
            if (videoElement && videoElement.readyState === 4) {
                hands.send({image: videoElement});  // send every other frame for performance
            }
        } catch (error) {
            console.error('Error sending frame to MediaPipe:', error);
            isReady = false;
            handText.innerHTML = 'Detection Error';
            handStatusDot.classList.remove('active');
            handStatusDot.classList.add('inactive');
        }
    }

    // fade out particle trails slowly
    paintingLayer.push();
    paintingLayer.fill(0, 0, 10, 5);        // very subtle fade
    paintingLayer.noStroke();
    paintingLayer.rect(0, 0, width, height);  // fade whole layer
    paintingLayer.pop();

    // draw video feed mirrored
    let videoW = width;
    let videoH = width / videoAspect;
    if (videoH > height) {
        videoH = height;
        videoW = height * videoAspect;
    }
    push();
        translate(width, 0);                // move to right edge
        scale(-1, 1);                       // flip horizontally
        image(video, (width - videoW) / 2, (height - videoH) / 2, videoW, videoH);  // draw video
    pop();

    // composite the particle trails on top
    image(paintingLayer, 0, 0);

    // update flow field
    if (frameCount % 1 === 0) {
        updateFlowField();                  // recalculate flow each frame
    }

    // process detected hands
    if (predictions.length > 0) {
        handStatusDot.classList.add('active');  // show hand detected
        handStatusDot.classList.remove('inactive');

        for (let h = 0; h < predictions.length; h++) {
            const landmarks = predictions[h].landmarks;  // 21 points
            const metrics = computeHandMetrics(landmarks, h);  // calculate metrics
            const mode = determineMode(metrics);  // figure out which mode
            spawnFromHand(landmarks, mode);  // create particles
            drawHandAbstract(landmarks, mode);  // draw skeleton
        }
    } else {
        // no hands detected
        handStatusDot.classList.remove('active');
        handStatusDot.classList.add('inactive');
    }

    // update and display particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.follow(flowField);                // particles follow flow field
        p.update();                         // update physics
        p.show();                           // draw particle

        if (!p.alive) {
            particles.splice(i, 1);         // remove dead particles
        }
    }

    spawnThrottle++;                        // increment throttle counter
}

// handle window resize
function windowResized() {
    let oldPainting = paintingLayer.get();  // save current trails

    resizeCanvas(windowWidth, windowHeight);  // resize canvas
    paintingLayer = createGraphics(width, height);  // recreate trail layer
    paintingLayer.colorMode(HSB, 360, 100, 100, 255);
    paintingLayer.image(oldPainting, 0, 0, width, height);  // restore trails

    // recalculate flow field grid
    cols = floor(width / scl);
    rows = floor(height / scl);
}

// calculate hand metrics for mode determination
function computeHandMetrics(landmarks, handIndex) {
    // measure hand span (wrist to middle finger tip)
    const wrist = createVector(landmarks[0][0], landmarks[0][1]);  // landmark 0 = wrist
    const midTip = createVector(landmarks[12][0], landmarks[12][1]);  // landmark 12 = middle tip
    const span = p5.Vector.dist(wrist, midTip);

    // measure hand bounding box area
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let p of landmarks) {
        minX = min(minX, p[0]);
        minY = min(minY, p[1]);
        maxX = max(maxX, p[0]);
        maxY = max(maxY, p[1]);
    }
    const handSpanArea = (maxX - minX) * (maxY - minY);

    // calculate hand velocity (movement speed)
    const palmPos = createVector(
        map(landmarks[0][0], 0, 640, 0, width),   // convert to screen coords
        map(landmarks[0][1], 0, 480, 0, height)
    );

    let vel = previousPalmPos[handIndex]
        ? p5.Vector.dist(palmPos, previousPalmPos[handIndex])  // distance moved
        : 0;

    previousPalmPos[handIndex] = palmPos.copy();  // store for next frame

    return {
        velocity: vel,                      // how fast moving
        handSpan: span,                     // how open hand is
        handArea: handSpanArea              // how big hand bounding box
    };
}

// determine which mode based on hand metrics
function determineMode(metrics) {
    // focus mode: closed fist (small area)
    if (metrics.handArea < 30000) {
        return 'focus';
    }

    // chaos mode: fast movement
    if (metrics.velocity > 20) {
        return 'chaos';
    }

    // calm mode: open hand
    if (metrics.handSpan > 200) {
        return 'calm';
    }

    return 'calm';  // default to calm
}

// get visual properties for each mode
function modeToVisuals(mode) {
    switch (mode) {
        case 'chaos':
            // fast, energetic yellow particles
            return {
                hue: random(50, 70),            // yellow/gold color
                speed: 10,                      // very fast
                sizeBoost: 2                    // big particles
            };

        case 'focus':
            // slow, controlled blue particles
            return {
                hue: random(220, 230),          // blue color
                speed: 2,                       // slow
                sizeBoost: 0.8                  // smaller particles
            };

        default:
            // calm mode: moderate pink particles
            return {
                hue: random(330, 350),          // pink color
                speed: 4,                       // medium speed
                sizeBoost: 1                    // normal size
            };
    }
}

// spawn particles from fingertips
function spawnFromHand(landmarks, mode) {
    // the 5 fingertip landmarks
    const fingertips = [
        4,    // thumb tip
        8,    // index finger tip
        12,   // middle finger tip
        16,   // ring finger tip
        20    // pinky finger tip
    ];

    const { hue, speed } = modeToVisuals(mode);  // get mode colors/speed

    for (let fi of fingertips) {
        const lm = landmarks[fi];

        // convert from video coords to canvas coords and mirror
        let x = map(lm[0], 0, 640, width, 0);   // mirror horizontally
        let y = map(lm[1], 0, 480, 0, height);  // no mirror on y

        // different spawn rates for each mode
        let count;
        if (mode === 'chaos') {
            count = 5;                          // lots of particles
        } else if (mode === 'focus') {
            count = 1;                          // few particles
        } else {
            count = 2;                          // medium
        }

        // spawn particles with random spread
        for (let n = 0; n < count; n++) {
            let p = getParticle();              // get from pool
            if (p) {
                // small random offset around fingertip
                p.init(
                    x + random(-20, 20),
                    y + random(-20, 20),
                    mode,
                    hue,
                    speed
                );
                particles.push(p);              // add to active list
            }
        }
    }
}

// get a particle - reuse from pool if possible
function getParticle() {
    // try to get from pool first (better performance)
    if (particlePool.length) {
        return particlePool.pop();
    }

    // create new if we haven't hit the limit
    if (particles.length + particlePool.length < maxParticles) {
        return new Particle();
    }

    // at max capacity
    return null;
}

// create flow field that guides particles
function updateFlowField() {
    // recalculate grid size
    cols = floor(width / scl);
    rows = floor(height / scl);

    // create new flow field array
    flowField = new Array(cols * rows);

    let yoff = 0;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;

        for (let x = 0; x < cols; x++) {
            // use perlin noise to create smooth directions
            let angle = noise(xoff, yoff, zoff) * TWO_PI * 4;  // random angle

            // create vector pointing in that direction with magnitude
            flowField[x + y * cols] = p5.Vector.fromAngle(angle).setMag(1.2);

            xoff += 0.12;                       // step through perlin noise
        }
        yoff += 0.12;
    }

    // increment z for animation over time
    zoff += 0.012;                              // makes flow field change smoothly
}

// draw hand skeleton overlay
function drawHandAbstract(landmarks, mode) {
    const { hue } = modeToVisuals(mode);  // get color for mode

    // change transparency based on mode
    const modeAlpha = (mode === 'chaos') ? 100 : (mode === 'focus') ? 30 : 50;

    // draw lines between joints
    stroke(hue, 50, 80, modeAlpha);            // mode color
    strokeWeight(1.5);                         // thin lines
    noFill();

    // five fingers - each connects wrist (0) to fingertip
    const fingers = [
        [0, 1, 2, 3, 4],                        // thumb
        [0, 5, 6, 7, 8],                        // Index finger
        [0, 9, 10, 11, 12],                     // Middle finger
        [0, 13, 14, 15, 16],                    // Ring finger
        [0, 17, 18, 19, 20]                     // Pinky finger
    ];

    // Draw each finger as a connected path
    for (let f of fingers) {
        beginShape();
        for (let i of f) {
            // Convert landmark from video space to canvas space (with mirroring)
            vertex(
                map(landmarks[i][0], 0, 640, width, 0),    // Mirror x
                map(landmarks[i][1], 0, 480, 0, height)
            );
        }
        endShape();
    }

    // draw dots at each joint
    fill(hue, 90, 95, modeAlpha + 50);         // bright fill for visibility
    noStroke();
    for (let p of landmarks) {
        ellipse(
            map(p[0], 0, 640, width, 0),        // mirror x
            map(p[1], 0, 480, 0, height),       // map y to canvas
            8                                   // 8px dots
        );
    }
}