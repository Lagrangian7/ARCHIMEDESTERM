import type { Express } from "express";
import express from "express";
import path from "path";
import { createServer, type Server } from "http";
import https from "https";
import { promisify } from "util";
import { exec } from "child_process";
import { storage } from "./storage";
import { messageSchema, type Message, insertUserPreferencesSchema, insertDocumentSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { weatherService } from "./weather-service";
import { knowledgeService } from "./knowledge-service";
import { gutendxService } from "./gutendx-service";
import { marketstackService } from "./marketstack-service";
import { scholarService } from "./scholar-service";
import multer from "multer";
import { z } from "zod";
import compression from "compression";
import { spawn } from "child_process";
import * as dns from 'dns';
import { URL } from 'url';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint - MUST be first, before any middleware
  // This allows deployment health checks to succeed quickly
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Enable gzip compression
  app.use(compression());

  // Serve attached assets (for soundtrack and other user files)
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  // SPACEWAR game endpoint (must be BEFORE Vite middleware to avoid processing)
  app.get('/spacewar.html', (req, res) => {
    // Add cache-busting headers to force reload
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const gameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPACEWAR - Retro Terminal Game</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: black;
      overflow: hidden;
      cursor: crosshair;
    }
    canvas {
      display: block;
      cursor: crosshair;
    }
  </style>
</head>
<body>
<script>
let invaders = [];
let particles = [];
let stars = [];
let backgroundInvaders = [];
let ufo = null;
let ufoLasers = [];
let invaderLasers = [];
let playerLasers = [];
let nyanCat = null;
let rainbowTrails = [];
let nyanCatBombs = [];
let cityBlocks = [];
let planetAngle = 0;
let glowPulseAngle = 0;
let level = 1;
let pattern = 'wheel';
let score = 0;
let gameEnded = false;
let audioContext;
let ufoOscillator = null;
let ufoAudio = null;
let backgroundMusic = null;
let pixelFont;
let limbAnimationSpeed;
let gamePaused = false;
let limbAnimationAmplitude = 2;
const baseNumInvaders = 5;
const numStars = 100;
const baseWheelRadius = 300;
const baseRectWidth = 600;
const baseRectHeight = 400;
const baseFigure8Width = 400;
const baseFigure8Height = 300;
const combinedScale = 0.3;
const baseSpeed = 0.02;
const jitterAmplitude = 20;
const avoidanceRadius = 150;
const avoidanceStrength = 0.1;
const maxAvoidanceSpeed = 2;
const planetRadius = 50;
const planetRotationSpeed = 0.01;
const planetZ = 800;
const glowRadius = 60;
const glowPulseSpeed = 0.05;
const ufoSpawnInterval = 8 * 60;
const ufoSpeed = 5;
const ufoPoints = 50;
const ufoLaserSpeed = 5;
const ufoFireProbability = 1.0;
const invaderFireProbability = 0.01;
const nyanCatSpawnInterval = 12 * 60;
const nyanCatSpeed = 6;
const nyanCatBombProbability = 0.1;
const pointsPerHit = 10;
const blinkInterval = 30;
const ufoHaloSize = 60;
const cityBlockWidth = 25;
const cityBlockHeight = 20;
const skylineLevel = -80; // Y level where skyline starts (relative to center)

function preload() {
  // Load the custom pixel font for the SPACEWAR title
  pixelFont = loadFont('/attached_assets/Px437_EagleSpCGA_Alt2-2y_1758652577435.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  limbAnimationSpeed = TWO_PI / 20;
  spawnInvaders();
  initializeCitySkyline();

  // Initialize Web Audio API
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Start background music
  startBackgroundMusic();
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: random(-width, width),
      y: random(-height, height),
      z: random(100, 1000)
    });
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      backgroundInvaders.push({
        x: (col - 2) * 100,
        y: (row - 1) * 100,
        z: 1000,
        type: floor(random(3)),
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  }
}

function getBuildingColor(buildingType) {
  switch (buildingType) {
    case 'honeycomb':
      return { fill: [80, 60, 40], stroke: [120, 90, 60] }; // Brown/amber
    case 'neon':
      return { fill: [20, 80, 120], stroke: [40, 160, 240] }; // Bright blue
    case 'industrial':
      return { fill: [70, 50, 50], stroke: [100, 80, 80] }; // Rusty red
    case 'glass':
      return { fill: [40, 80, 80], stroke: [80, 160, 160] }; // Teal glass
    default: // normal
      return { fill: [60, 60, 60], stroke: [80, 80, 80] }; // Original grey
  }
}

function initializeCitySkyline() {
  cityBlocks = [];

  // Calculate number of blocks to fill entire screen width
  let numCityBlocks = Math.floor(width / cityBlockWidth);
  let totalWidth = numCityBlocks * cityBlockWidth;
  let startX = -totalWidth / 2;
  let groundY = height / 2 - 80; // Position skyline above bottom of screen

  for (let i = 0; i < numCityBlocks; i++) {
    let buildingHeight = random(5, 12); // Random building heights for upper city - increased for more gameplay layers

    // Randomly select building type for this column
    let buildingType = random(['normal', 'honeycomb', 'neon', 'industrial', 'glass']);
    let buildingColor = getBuildingColor(buildingType);

    // Create the upper city buildings (destructible)
    for (let k = 0; k < buildingHeight; k++) {
      cityBlocks.push({
        x: startX + i * cityBlockWidth,
        y: groundY - k * cityBlockHeight,
        width: cityBlockWidth,
        height: cityBlockHeight,
        destroyed: false,
        health: 10, // Takes 10 hits to destroy
        maxHealth: 10, // For health display
        buildingId: i, // Track which building this belongs to
        flashTimer: 0, // Flash timer for hit effect
        isFoundation: false, // This is a building, not foundation
        buildingType: buildingType, // Type of building design
        buildingColor: buildingColor // Color scheme for this building
      });
    }

    // Create foundation blocks extending to bottom of screen (indestructible)
    let foundationBlocks = Math.floor((height / 2 + 80) / cityBlockHeight);
    for (let k = 0; k < foundationBlocks; k++) {
      cityBlocks.push({
        x: startX + i * cityBlockWidth,
        y: groundY + k * cityBlockHeight,
        width: cityBlockWidth,
        height: cityBlockHeight,
        destroyed: false,
        buildingId: i,
        flashTimer: 0,
        isFoundation: true, // This is foundation, indestructible
        buildingType: 'foundation',
        buildingColor: { fill: [40, 40, 40], stroke: [60, 60, 60] }
      });
    }
  }
}

function getRandomHighlightColor() {
  let highlightColors = [
    color(255, 0, 0),      // Red
    color(0, 255, 0),      // Green
    color(0, 0, 255),      // Blue
    color(255, 255, 0),    // Yellow
    color(255, 0, 255),    // Magenta
    color(0, 255, 255)     // Cyan
  ];
  return highlightColors[floor(random(highlightColors.length))];
}

function getIndividualPattern() {
  if (random() < 0.5) {
    return 'random';
  } else {
    let patterns = ['individual-circle', 'individual-square', 'individual-hexagon', 'individual-octagon', 'individual-figure8'];
    return patterns[floor(random(patterns.length))];
  }
}

function spawnInvaders() {
  invaders = [];
  const { spread } = getLevelModifiers();
  const wheelRadius = baseWheelRadius * spread;
  const rectWidth = baseRectWidth * spread;
  const rectHeight = baseRectHeight * spread;
  const figure8Width = baseFigure8Width * spread;
  const figure8Height = baseFigure8Height * spread;
  const numInvaders = Math.ceil(baseNumInvaders * Math.pow(1.05, level - 1));

  // Level 20+: Individual movement patterns
  if (level >= 20) {
    for (let i = 0; i < numInvaders; i++) {
      let individualPattern = getIndividualPattern();
      invaders.push({
        t: random(1),
        angle: random(TWO_PI),
        color: color(255, 255, 0),  // Yellow for advanced levels
        highlightColor: getRandomHighlightColor(),
        type: i % 3,
        pattern: individualPattern,
        individualX: random(-width/3, width/3),
        individualY: random(-height/3, height/3),
        individualRadius: random(40, 80),
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  } else if (pattern === 'wheel') {
    for (let i = 0; i < numInvaders; i++) {
      let angle = (TWO_PI / numInvaders) * i;
      invaders.push({
        angle: angle,
        color: color(255, 0, 0),  // Red for wheel pattern
        highlightColor: getRandomHighlightColor(),
        type: i % 3,
        pattern: 'wheel',
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  } else if (pattern === 'rectangle') {
    for (let i = 0; i < numInvaders; i++) {
      let t = (1 / numInvaders) * i;
      invaders.push({
        t: t,
        color: color(0, 255, 0),  // Green for rectangle pattern
        highlightColor: getRandomHighlightColor(),
        type: i % 3,
        pattern: 'rectangle',
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  } else if (pattern === 'figure8') {
    for (let i = 0; i < numInvaders; i++) {
      let t = (1 / numInvaders) * i;
      invaders.push({
        t: t,
        color: color(0, 0, 255),  // Blue for figure8 pattern
        highlightColor: getRandomHighlightColor(),
        type: i % 3,
        pattern: 'figure8',
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  } else {
    for (let i = 0; i < numInvaders; i++) {
      let t = (1 / numInvaders) * i;
      invaders.push({
        t: t,
        color: color(255, 255, 0),  // Yellow for combined pattern
        highlightColor: getRandomHighlightColor(),
        type: i % 3,
        pattern: 'combined',
        noiseSeedX: random(10000),
        noiseSeedY: random(10000),
        noiseT: 0
      });
    }
  }
}

function spawnUfo() {
  let startLeft = random() > 0.5;
  let y = random(-height / 4, height / 4);
  ufo = {
    x: startLeft ? -width / 2 : width / 2,
    y: y,
    speed: startLeft ? ufoSpeed : -ufoSpeed,
    active: true
  };

  // Start UFO humming sound
  startUfoHum();

  // Start UFO sound effect (new WAV file)
  startUfoSound();
}

function spawnNyanCat() {
  let startLeft = random() > 0.5;
  let y = random(-height / 4, height / 4);
  nyanCat = {
    x: startLeft ? -width / 2 : width / 2,
    y: y,
    speed: startLeft ? nyanCatSpeed : -nyanCatSpeed,
    active: true
  };

  // Play Nyan Cat sound
  playNyanCatSound();
}

function getLevelModifiers() {
  if (level <= 4) return { speed: baseSpeed, spread: 1 };
  else if (level <= 8) return { speed: baseSpeed * 1.2, spread: 1.2 };
  else if (level <= 12) return { speed: baseSpeed * 1.44, spread: 1.44 };
  else return { speed: baseSpeed * 1.728, spread: 1.728 };
}

function getWheelPosition(t, spread) {
  let radius = (baseWheelRadius * spread) + (width * 0.15); // Use screen width for scaling
  let x = cos(t * TWO_PI) * radius;
  let y = sin(t * TWO_PI) * radius;
  // Add screen-wide offset based on level
  let offsetX = sin(level * 0.5) * (width * 0.2);
  let offsetY = cos(level * 0.3) * (height * 0.15);
  return { x: x + offsetX, y: y + offsetY };
}

function getRectangularPosition(t, spread) {
  let rectWidth = (baseRectWidth * spread) + (width * 0.2); // Scale with screen
  let rectHeight = (baseRectHeight * spread) + (height * 0.15);
  let perimeter = 2 * (rectWidth + rectHeight);
  let dist = t * perimeter;
  let x, y;

  if (dist < rectWidth) {
    x = -rectWidth / 2 + dist;
    y = -rectHeight / 2;
  } else if (dist < (rectWidth + rectHeight)) {
    x = rectWidth / 2;
    y = -rectHeight / 2 + (dist - rectWidth);
  } else if (dist < 2 * rectWidth + rectHeight) {
    x = rectWidth / 2 - (dist - (rectWidth + rectHeight));
    y = rectHeight / 2;
  } else {
    x = -rectWidth / 2;
    y = rectHeight / 2 - (dist - (2 * rectWidth + rectHeight));
  }
  // Add screen-wide wandering based on level
  let offsetX = cos(level * 0.7) * (width * 0.25);
  let offsetY = sin(level * 0.4) * (height * 0.2);
  return { x: x + offsetX, y: y + offsetY };
}

function getFigure8Position(t, spread) {
  let angle = t * TWO_PI;
  let figWidth = (baseFigure8Width * spread) + (width * 0.25); // Scale with screen
  let figHeight = (baseFigure8Height * spread) + (height * 0.2);
  let x = (figWidth * cos(angle)) / (1 + pow(sin(angle), 2));
  let y = (figHeight * sin(angle) * cos(angle)) / (1 + pow(sin(angle), 2));
  // Add level-based screen wandering
  let offsetX = sin(level * 0.9) * (width * 0.3);
  let offsetY = cos(level * 0.6) * (height * 0.25);
  return { x: x + offsetX, y: y + offsetY };
}

function getCombinedPosition(t, spread) {
  let wheelPos = getWheelPosition(t, spread);
  let rectPos = getRectangularPosition(t, spread);
  let fig8Pos = getFigure8Position(t, spread);
  let x = (wheelPos.x + rectPos.x + fig8Pos.x) * combinedScale;
  let y = (wheelPos.y + rectPos.y + fig8Pos.y) * combinedScale;
  // Add extra screen-wide movement for combined pattern
  let globalOffsetX = sin(level * 1.2 + frameCount * 0.01) * (width * 0.35);
  let globalOffsetY = cos(level * 0.8 + frameCount * 0.008) * (height * 0.3);
  return { x: x + globalOffsetX, y: y + globalOffsetY };
}

function draw() {
  background(0);

  // If game has ended, stop all game logic
  if (gameEnded) {
    return;
  }

  // Draw title at the top in big bold letters using custom pixel font
  fill(0, 255, 0); // Terminal green
  textAlign(CENTER, TOP);
  if (pixelFont) textFont(pixelFont); // Use the loaded CGA font
  textSize(48); // Big title
  text('SP4CEW4RZ', width / 2, 20);

  // Draw credit line
  textSize(16); // Small font for credit
  fill(0, 200, 0); // Slightly dimmer green
  text('by B.Hutchy', width / 2, 75);

  // Show pause message and return early if game is paused
  if (gamePaused) {
    fill(255, 255, 0); // Yellow pause text
    textAlign(CENTER, CENTER);
    textSize(36);
    text('PAUSED', width / 2, height / 2);
    textSize(18);
    text('Press SPACEBAR or ENTER to resume', width / 2, height / 2 + 50);
    return;
  }

  if (frameCount % ufoSpawnInterval === 0) {
    spawnUfo();
  }

  if (frameCount % nyanCatSpawnInterval === 0) {
    spawnNyanCat();
  }

  translate(width / 2, height / 2);

  for (let star of stars) {
    star.z -= 5;
    if (star.z <= 0) {
      star.x = random(-width, width);
      star.y = random(-height, height);
      star.z = 1000;
    }
    let sx = (star.x / star.z) * 200;
    let sy = (star.y / star.z) * 200;
    let size = map(star.z, 1000, 0, 1, 4);
    fill(255, 255, 255, 100);
    noStroke();
    rect(sx, sy, size, size);
  }

  const limbOffsetBg = sin(frameCount * limbAnimationSpeed) * 1;
  for (let invader of backgroundInvaders) {
    invader.z -= 1;
    if (invader.z < 600) {
      invader.z = 1200;
      invader.x = (floor(random(-2, 3))) * 100;
      invader.y = (floor(random(-1, 2))) * 100;
      invader.noiseSeedX = random(10000);
      invader.noiseSeedY = random(10000);
      invader.noiseT = 0;
    }
    invader.noiseT += 0.005;
    let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude - jitterAmplitude / 2;
    let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude - jitterAmplitude / 2;
    let sx = ((invader.x + jitterX) / invader.z) * 200;
    let sy = ((invader.y + jitterY) / invader.z) * 200;
    let scaleFactor = 200 / invader.z;
    push();
    translate(sx, sy);
    scale(scaleFactor);
    let glowAlpha = map(sin(glowPulseAngle), -1, 1, 50, 100);
    fill(0, 255, 0, glowAlpha);
    noStroke();
    let glowSize = invader.type === 0 ? 15 : invader.type === 1 ? 18.75 : 15;
    ellipse(0, 0, glowSize);
    fill(0, 150, 0);
    noStroke();
    if (invader.type === 0) {
      rectMode(CENTER);
      rect(0, 0, 10, 7.5);
      rect(-5, -5 + limbOffsetBg, 2.5, 2.5);
      rect(5, -5 + limbOffsetBg, 2.5, 2.5);
      rect(-2.5, 5 + limbOffsetBg, 2.5, 2.5);
      rect(2.5, 5 + limbOffsetBg, 2.5, 2.5);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(-2.5, -1, 1.5, 1.5);
        rect(2.5, -1, 1.5, 1.5);
      }
    } else if (invader.type === 1) {
      rectMode(CENTER);
      rect(0, 0, 12.5, 7.5);
      rect(-7.5 + limbOffsetBg, 0, 2.5, 2.5);
      rect(7.5 - limbOffsetBg, 0, 2.5, 2.5);
      rect(-5, 5 + limbOffsetBg, 2.5, 2.5);
      rect(5, 5 + limbOffsetBg, 2.5, 2.5);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(-2.5, 0, 1.5, 1.5);
        rect(2.5, 0, 1.5, 1.5);
      }
    } else {
      rectMode(CENTER);
      rect(0, 0, 10, 10);
      rect(-5, 5 + limbOffsetBg, 2.5, 2.5);
      rect(5, 5 + limbOffsetBg, 2.5, 2.5);
      fill(0);
      rect(-2.5, -1, 2, 2);
      rect(2.5, -1, 2, 2);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(0, 2.5, 1.5, 1.5);
      }
    }
    pop();
  }

  push();
  let planetX = width / 4;
  let planetY = -height / 4;
  let planetScreenX = (planetX / planetZ) * 200;
  let planetScreenY = (planetY / planetZ) * 200;
  let planetScreenRadius = (planetRadius / planetZ) * 200;
  let glowScreenRadius = (glowRadius / planetZ) * 200;
  translate(planetScreenX, planetScreenY);
  rotate(planetAngle);
  let glowAlpha = map(sin(glowPulseAngle), -1, 1, 50, 100);
  fill(0, 255, 0, glowAlpha);
  noStroke();
  ellipse(0, 0, glowScreenRadius * 2);
  fill(0, 100, 0, 150);
  ellipse(0, 0, planetScreenRadius * 2);
  fill(0, 50, 0, 150);
  ellipse(-planetScreenRadius * 0.5, -planetScreenRadius * 0.3, planetScreenRadius * 0.4);
  ellipse(planetScreenRadius * 0.3, planetScreenRadius * 0.4, planetScreenRadius * 0.3);
  ellipse(0, -planetScreenRadius * 0.6, planetScreenRadius * 0.2);
  pop();
  planetAngle += planetRotationSpeed;
  glowPulseAngle += glowPulseSpeed;

  for (let i = rainbowTrails.length - 1; i >= 0; i--) {
    let trail = rainbowTrails[i];
    trail.lifetime -= 1;
    let trailAlpha = map(trail.lifetime, 30, 0, 255, 0);
    fill(trail.color.levels[0], trail.color.levels[1], trail.color.levels[2], trailAlpha);
    noStroke();
    rect(trail.x, trail.y, 5, 5);
    if (trail.lifetime <= 0) {
      rainbowTrails.splice(i, 1);
    }
  }

  if (nyanCat && nyanCat.active) {
    nyanCat.x += nyanCat.speed;
    if (nyanCat.x < -width / 2 - 50 || nyanCat.x > width / 2 + 50) {
      nyanCat = null;
    } else {
      rainbowTrails.push({
        x: nyanCat.x - 30,
        y: nyanCat.y,
        color: color(255, 0, 0),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 35,
        y: nyanCat.y - 5,
        color: color(255, 165, 0),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 40,
        y: nyanCat.y - 10,
        color: color(255, 255, 0),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 45,
        y: nyanCat.y - 5,
        color: color(0, 255, 0),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 50,
        y: nyanCat.y,
        color: color(0, 0, 255),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 55,
        y: nyanCat.y + 5,
        color: color(75, 0, 130),
        lifetime: 30
      });
      rainbowTrails.push({
        x: nyanCat.x - 60,
        y: nyanCat.y + 10,
        color: color(148, 0, 211),
        lifetime: 30
      });

      if (random() < nyanCatBombProbability) {
        nyanCatBombs.push({
          x: nyanCat.x,
          y: nyanCat.y + 10,
          vy: random(3, 7),
          color: color(random(100, 255), random(100, 255), random(100, 255))
        });
      }

      push();
      translate(nyanCat.x, nyanCat.y);
      fill(255, 255, 255);
      noStroke();
      rect(-15, -10, 30, 20);
      fill(255, 192, 203);
      rect(-12, -7, 8, 14);
      rect(4, -7, 8, 14);
      rect(-4, -10, 8, 8);
      fill(255, 0, 255);
      rect(-4, -2, 8, 4);
      fill(0);
      rect(-8, -6, 2, 2);
      rect(6, -6, 2, 2);
      fill(255, 0, 0);
      rect(-1, -4, 2, 2);
      fill(255, 192, 203);
      rect(-14, 10, 4, 8);
      rect(-6, 10, 4, 8);
      rect(2, 10, 4, 8);
      rect(10, 10, 4, 8);
      fill(0);
      rect(-13, 12, 2, 4);
      rect(-5, 12, 2, 4);
      rect(3, 12, 2, 4);
      rect(11, 12, 2, 4);
      fill(0);
      rect(-10, -15, 4, 5);
      rect(6, -15, 4, 5);
      pop();
    }
  }

  for (let i = nyanCatBombs.length - 1; i >= 0; i--) {
    let bomb = nyanCatBombs[i];
    bomb.y += bomb.vy;
    if (bomb.y > height / 2 + 50) {
      nyanCatBombs.splice(i, 1);
      continue;
    }
    fill(bomb.color);
    noStroke();
    rect(bomb.x, bomb.y, 8, 8);
    const { spread } = getLevelModifiers();
    for (let j = invaders.length - 1; j >= 0; j--) {
      let invader = invaders[j];
      let x, y;
      if (invader.pattern === 'wheel') {
        let baseX = cos(invader.angle) * (baseWheelRadius * spread);
        let baseY = sin(invader.angle) * (baseWheelRadius * spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = baseX + jitterX;
        y = baseY + jitterY;
      } else if (invader.pattern === 'rectangle') {
        let pos = getRectangularPosition(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      } else if (invader.pattern === 'figure8') {
        let pos = getFigure8Position(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      } else {
        let pos = getCombinedPosition(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      }
      let mouseXWorld = mouseX - width / 2;
      let mouseYWorld = mouseY - height / 2;
      let dx = x - mouseXWorld;
      let dy = y - mouseYWorld;
      let distance = sqrt(dx * dx + dy * dy);
      if (distance < avoidanceRadius && distance > 0) {
        let avoidX = (dx / distance) * avoidanceStrength;
        let avoidY = (dy / distance) * avoidanceStrength;
        let avoidMag = sqrt(avoidX * avoidX + avoidY * avoidY);
        if (avoidMag > maxAvoidanceSpeed) {
          avoidX = (avoidX / avoidMag) * maxAvoidanceSpeed;
          avoidY = (avoidY / avoidMag) * maxAvoidanceSpeed;
        }
        x += avoidX;
        y += avoidY;
      }
      if (bomb.x > x - 15 && bomb.x < x + 15 && bomb.y > y - 15 && bomb.y < y + 15) {
        for (let k = 0; k < 20; k++) {
          particles.push({
            x: x,
            y: y,
            vx: random(-2, 2),
            vy: random(-2, 2),
            lifetime: 25
          });
        }

        // Play explosion sound
        playExplosionSound();

        invaders.splice(j, 1);
        nyanCatBombs.splice(i, 1);
        score += pointsPerHit;
        break;
      }
    }
  }

  if (ufo && ufo.active) {
    ufo.x += ufo.speed;
    if (ufo.x < -width / 2 - 50 || ufo.x > width / 2 + 50) {
      stopUfoHum();
      stopUfoSound();
      ufo = null;
    } else {
      if (random() < ufoFireProbability) {
        let angle = random(TWO_PI);
        ufoLasers.push({
          x: ufo.x,
          y: ufo.y + 10,
          vx: cos(angle) * ufoLaserSpeed,
          vy: sin(angle) * ufoLaserSpeed
        });
        playUfoLaserSound();
      }
      push();
      translate(ufo.x, ufo.y);
      fill(255, 0, 0, glowAlpha);
      noStroke();
      ellipse(0, 0, ufoHaloSize);
      fill(0, 150, 0);
      ellipse(0, 0, 40, 15);
      fill(0, 100, 0);
      arc(0, 0, 20, 20, PI, TWO_PI);
      fill(0, 255, 0);
      ellipse(-15, 5, 5, 5);
      ellipse(0, 5, 5, 5);
      ellipse(15, 5, 5, 5);
      pop();
    }
  }

  for (let i = ufoLasers.length - 1; i >= 0; i--) {
    let laser = ufoLasers[i];
    laser.x += laser.vx;
    laser.y += laser.vy;
    if (laser.x < -width / 2 - 50 || laser.x > width / 2 + 50 ||
        laser.y < -height / 2 - 50 || laser.y > height / 2 + 50) {
      ufoLasers.splice(i, 1);
      continue;
    }
    // Subtle UFO laser: thin, semi-transparent cyan beam
    stroke(0, 200, 200, 150); // Cyan with transparency
    strokeWeight(1.5); // Thin laser beam
    noFill();

    // Draw a thin laser line with slight glow
    line(laser.x - 3, laser.y, laser.x + 3, laser.y);

    // Add subtle center core
    stroke(100, 255, 255, 100); // Brighter cyan core, very subtle
    strokeWeight(0.5);
    point(laser.x, laser.y);
  }

  const { speed, spread } = getLevelModifiers();
  const limbOffset = sin(frameCount * limbAnimationSpeed) * limbAnimationAmplitude;
  for (let i = invaders.length - 1; i >= 0; i--) {
    let invader = invaders[i];
    let x, y;

    if (invader.pattern === 'random') {
      // Random movement pattern
      invader.individualX += invader.randomVx;
      invader.individualY += invader.randomVy;

      // Bounce off boundaries
      if (invader.individualX > width/3 || invader.individualX < -width/3) {
        invader.randomVx *= -1;
      }
      if (invader.individualY > height/3 || invader.individualY < -height/3) {
        invader.randomVy *= -1;
      }

      x = invader.individualX;
      y = invader.individualY;
    } else if (invader.pattern === 'individual-circle') {
      // Individual circular pattern
      x = invader.individualX + cos(invader.angle) * invader.individualRadius;
      y = invader.individualY + sin(invader.angle) * invader.individualRadius;
      invader.angle += speed * 0.02;
    } else if (invader.pattern === 'individual-square') {
      // Individual square pattern
      let t = invader.t;
      let side = floor(t * 4);
      let progress = (t * 4) % 1;
      let size = invader.individualRadius;

      if (side === 0) {
        x = invader.individualX - size + progress * size * 2;
        y = invader.individualY - size;
      } else if (side === 1) {
        x = invader.individualX + size;
        y = invader.individualY - size + progress * size * 2;
      } else if (side === 2) {
        x = invader.individualX + size - progress * size * 2;
        y = invader.individualY + size;
      } else {
        x = invader.individualX - size;
        y = invader.individualY + size - progress * size * 2;
      }
      invader.t = (invader.t + speed * 0.01) % 1;
    } else if (invader.pattern === 'individual-hexagon') {
      // Individual hexagon pattern
      let angle = invader.t * TWO_PI;
      let side = floor(invader.t * 6);
      let nextAngle = ((side + 1) / 6) * TWO_PI;
      let progress = (invader.t * 6) % 1;

      let x1 = cos(side * TWO_PI / 6) * invader.individualRadius;
      let y1 = sin(side * TWO_PI / 6) * invader.individualRadius;
      let x2 = cos(nextAngle) * invader.individualRadius;
      let y2 = sin(nextAngle) * invader.individualRadius;

      x = invader.individualX + x1 + (x2 - x1) * progress;
      y = invader.individualY + y1 + (y2 - y1) * progress;
      invader.t = (invader.t + speed * 0.01) % 1;
    } else if (invader.pattern === 'individual-octagon') {
      // Individual octagon pattern
      let side = floor(invader.t * 8);
      let nextAngle = ((side + 1) / 8) * TWO_PI;
      let progress = (invader.t * 8) % 1;

      let x1 = cos(side * TWO_PI / 8) * invader.individualRadius;
      let y1 = sin(side * TWO_PI / 8) * invader.individualRadius;
      let x2 = cos(nextAngle) * invader.individualRadius;
      let y2 = sin(nextAngle) * invader.individualRadius;

      x = invader.individualX + x1 + (x2 - x1) * progress;
      y = invader.individualY + y1 + (y2 - y1) * progress;
      invader.t = (invader.t + speed * 0.01) % 1;
    } else if (invader.pattern === 'individual-figure8') {
      // Individual figure-8 pattern
      let angle = invader.t * TWO_PI;
      x = invader.individualX + sin(angle) * invader.individualRadius;
      y = invader.individualY + sin(angle * 2) * invader.individualRadius * 0.5;
      invader.t = (invader.t + speed * 0.01) % 1;
    } else if (invader.pattern === 'wheel') {
      x = cos(invader.angle) * (baseWheelRadius * spread);
      y = sin(invader.angle) * (baseWheelRadius * spread);
      invader.angle += speed;
    } else if (invader.pattern === 'rectangle') {
      let pos = getRectangularPosition(invader.t, spread);
      x = pos.x;
      y = pos.y;
      invader.t = (invader.t + speed / 10) % 1;
    } else if (invader.pattern === 'figure8') {
      let pos = getFigure8Position(invader.t, spread);
      x = pos.x;
      y = pos.y;
      invader.t = (invader.t + speed / 10) % 1;
    } else {
      let pos = getCombinedPosition(invader.t, spread);
      x = pos.x;
      y = pos.y;
      invader.t = (invader.t + speed / 10) % 1;
    }

    invader.noiseT += 0.01;
    let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
    let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
    x += jitterX;
    y += jitterY;

    let mouseXWorld = mouseX - width / 2;
    let mouseYWorld = mouseY - height / 2;
    let dx = x - mouseXWorld;
    let dy = y - mouseYWorld;
    let distance = sqrt(dx * dx + dy * dy);
    if (distance < avoidanceRadius && distance > 0) {
      let avoidX = (dx / distance) * avoidanceStrength;
      let avoidY = (dy / distance) * avoidanceStrength;
      let avoidMag = sqrt(avoidX * avoidX + avoidY * avoidY);
      if (avoidMag > maxAvoidanceSpeed) {
        avoidX = (avoidX / avoidMag) * maxAvoidanceSpeed;
        avoidY = (avoidY / avoidMag) * maxAvoidanceSpeed;
      }
      x += avoidX;
      y += avoidY;
    }

    if (random() < invaderFireProbability) {
      invaderLasers.push({
        x: x,
        y: y + 10,
        vy: 3
      });
      playEnemyLaserSound();
    }

    push();
    translate(x, y);
    // Use invader's pattern color for glow with transparency
    let glowColor = invader.color;
    fill(glowColor.levels[0], glowColor.levels[1], glowColor.levels[2], glowAlpha);
    noStroke();
    let glowSize = invader.type === 0 ? 30 : invader.type === 1 ? 37.5 : 30;
    ellipse(0, 0, glowSize);
    fill(invader.color);
    noStroke();
    if (invader.type === 0) {
      rectMode(CENTER);
      rect(0, 0, 20, 15);
      rect(-10, -10 + limbOffset, 5, 5);
      rect(10, -10 + limbOffset, 5, 5);
      rect(-5, 10 + limbOffset, 5, 5);
      rect(5, 10 + limbOffset, 5, 5);
      // Random colored highlights - larger and more visible
      fill(invader.highlightColor);
      rect(0, -3, 8, 3);
      rect(-10, -10 + limbOffset, 4, 4);
      rect(10, -10 + limbOffset, 4, 4);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(-5, -2, 3, 3);
        rect(5, -2, 3, 3);
      }
    } else if (invader.type === 1) {
      rectMode(CENTER);
      rect(0, 0, 25, 15);
      rect(-15 + limbOffset, 0, 5, 5);
      rect(15 - limbOffset, 0, 5, 5);
      rect(-10, 10 + limbOffset, 5, 5);
      rect(10, 10 + limbOffset, 5, 5);
      // Random colored highlights - larger and more visible
      fill(invader.highlightColor);
      rect(0, -2, 10, 3);
      rect(-15 + limbOffset, 0, 4, 4);
      rect(15 - limbOffset, 0, 4, 4);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(-5, 0, 3, 3);
        rect(5, 0, 3, 3);
      }
    } else {
      rectMode(CENTER);
      rect(0, 0, 20, 20);
      rect(-10, 10 + limbOffset, 5, 5);
      rect(10, 10 + limbOffset, 5, 5);
      // Random colored highlights - larger and more visible
      fill(invader.highlightColor);
      rect(0, -4, 10, 3);
      rect(-10, 10 + limbOffset, 4, 4);
      rect(10, 10 + limbOffset, 4, 4);
      fill(0);
      rect(-5, -2, 4, 4);
      rect(5, -2, 4, 4);
      if (frameCount % (2 * blinkInterval) < blinkInterval) {
        fill(0, 255, 0);
        rect(0, 5, 3, 3);
      }
    }
    pop();
  }

  for (let i = invaderLasers.length - 1; i >= 0; i--) {
    let laser = invaderLasers[i];
    laser.y += laser.vy;
    if (laser.y > height / 2 + 50) {
      invaderLasers.splice(i, 1);
      continue;
    }
    fill(255, 0, 0);
    noStroke();
    rect(laser.x, laser.y, 3, 8);
  }

  // Update and render player lasers
  for (let i = playerLasers.length - 1; i >= 0; i--) {
    let laser = playerLasers[i];
    laser.x += laser.vx;
    laser.y += laser.vy;

    // Remove lasers that go off screen
    if (laser.x < -width / 2 - 50 || laser.x > width / 2 + 50 ||
        laser.y < -height / 2 - 50 || laser.y > height / 2 + 50) {
      playerLasers.splice(i, 1);
      continue;
    }

    // Add position to trail
    laser.trail.push({x: laser.x, y: laser.y});
    if (laser.trail.length > 8) {
      laser.trail.shift(); // Keep trail length manageable
    }

    // Draw high-visibility laser trail
    for (let t = 0; t < laser.trail.length; t++) {
      let alpha = map(t, 0, laser.trail.length - 1, 50, 255);
      let size = map(t, 0, laser.trail.length - 1, 2, 8);
      fill(red(laser.color), green(laser.color), blue(laser.color), alpha);
      noStroke();
      ellipse(laser.trail[t].x, laser.trail[t].y, size, size);
    }

    // Draw bright main laser bolt with glow effect
    // Outer glow
    fill(red(laser.color), green(laser.color), blue(laser.color), 100);
    ellipse(laser.x, laser.y, 12, 12);
    // Main bolt
    fill(laser.color);
    ellipse(laser.x, laser.y, 6, 12);
    // Inner bright core
    fill(255, 255, 255, 200);
    ellipse(laser.x, laser.y, 3, 8);

    // Check collision with invaders
    const { spread } = getLevelModifiers();
    for (let j = invaders.length - 1; j >= 0; j--) {
      let invader = invaders[j];
      let x, y;

      if (invader.pattern === 'wheel') {
        let baseX = cos(invader.angle) * (baseWheelRadius * spread);
        let baseY = sin(invader.angle) * (baseWheelRadius * spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = baseX + jitterX;
        y = baseY + jitterY;
      } else if (invader.pattern === 'rectangle') {
        let pos = getRectangularPosition(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      } else if (invader.pattern === 'figure8') {
        let pos = getFigure8Position(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      } else {
        let pos = getCombinedPosition(invader.t, spread);
        let jitterX = noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        let jitterY = noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
        x = pos.x + jitterX;
        y = pos.y + jitterY;
      }

      // Apply mouse avoidance to get final position
      let mouseXWorld = mouseX - width / 2;
      let mouseYWorld = mouseY - height / 2;
      let dx = x - mouseXWorld;
      let dy = y - mouseYWorld;
      let distance = sqrt(dx * dx + dy * dy);
      if (distance < avoidanceRadius && distance > 0) {
        let avoidX = (dx / distance) * avoidanceStrength;
        let avoidY = (dy / distance) * avoidanceStrength;
        let avoidMag = sqrt(avoidX * avoidX + avoidY * avoidY);
        if (avoidMag > maxAvoidanceSpeed) {
          avoidX = (avoidX / avoidMag) * maxAvoidanceSpeed;
          avoidY = (avoidY / avoidMag) * maxAvoidanceSpeed;
        }
        x += avoidX;
        y += avoidY;
      }

      // Prevent invaders from flying below turret tops
      let turretTopY = height / 2 - 80 - 180 - 20; // Ground - turret height - clearance
      if (y > turretTopY) {
        y = turretTopY;
      }

      // Check collision
      if (laser.x > x - 15 && laser.x < x + 15 && laser.y > y - 15 && laser.y < y + 15) {
        // Create explosion particles
        for (let k = 0; k < 25; k++) {
          particles.push({
            x: x,
            y: y,
            vx: random(-3, 3),
            vy: random(-3, 3),
            lifetime: 30
          });
        }

        // Play explosion sound
        playExplosionSound();

        // Remove invader and laser
        invaders.splice(j, 1);
        playerLasers.splice(i, 1);
        score += pointsPerHit;
        break;
      }
    }

    // Check collision with UFO
    if (ufo && ufo.active) {
      if (laser.x > ufo.x - 25 && laser.x < ufo.x + 25 && laser.y > ufo.y - 15 && laser.y < ufo.y + 15) {
        // Create bigger explosion for UFO
        for (let k = 0; k < 35; k++) {
          particles.push({
            x: ufo.x,
            y: ufo.y,
            vx: random(-5, 5),
            vy: random(-5, 5),
            lifetime: 40
          });
        }

        // Play explosion sound
        playExplosionSound();

        // Stop UFO humming sound
        stopUfoHum();

        // Stop UFO sound effect
        stopUfoSound();

        // Remove UFO and laser, award bonus points
        ufo = null;
        playerLasers.splice(i, 1);
        score += ufoPoints; // Bonus points for hitting UFO
        break;
      }
    }

    // Check collision with Nyan Cat
    if (nyanCat && nyanCat.active) {
      if (laser.x > nyanCat.x - 20 && laser.x < nyanCat.x + 20 && laser.y > nyanCat.y - 15 && laser.y < nyanCat.y + 15) {
        // Create colorful explosion for Nyan Cat
        for (let k = 0; k < 30; k++) {
          let colors = [color(255, 0, 0), color(255, 165, 0), color(255, 255, 0), color(0, 255, 0), color(0, 0, 255), color(75, 0, 130), color(148, 0, 211)];
          particles.push({
            x: nyanCat.x,
            y: nyanCat.y,
            vx: random(-4, 4),
            vy: random(-4, 4),
            lifetime: 35,
            color: colors[floor(random(colors.length))],
            size: random(4, 8)
          });
        }

        // Play explosion sound
        playExplosionSound();

        // Remove Nyan Cat and laser, award mega bonus points
        nyanCat = null;
        playerLasers.splice(i, 1);
        score += 100; // Mega bonus for hitting Nyan Cat
        break;
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.lifetime--;

    if (p.color && p.size) {
      // Muzzle blast particles with custom colors and sizes
      fill(red(p.color), green(p.color), blue(p.color), p.lifetime * 15);
      noStroke();
      ellipse(p.x, p.y, p.size, p.size);
    } else {
      // Regular explosion particles
      fill(0, 255, 0, p.lifetime * 10);
      noStroke();
      rect(p.x, p.y, 3, 3);
    }

    if (p.lifetime <= 0) {
      particles.splice(i, 1);
    }
  }

  // Draw crosshair at mouse position
  let crosshairX = mouseX - width / 2;
  let crosshairY = mouseY - height / 2;
  stroke(0, 255, 255);
  strokeWeight(2);
  line(crosshairX - 10, crosshairY, crosshairX + 10, crosshairY);
  line(crosshairX, crosshairY - 10, crosshairX, crosshairY + 10);
  noStroke();

  // Game stats at top corners
  fill(0, 255, 0);
  textSize(20);

  // Top left - Score and Invaders
  textAlign(LEFT, TOP);
  text("Score: " + score, -width / 2 + 20, -height / 2 + 20);
  text("Invaders: " + invaders.length, -width / 2 + 20, -height / 2 + 50);

  // Top right - Level
  textAlign(RIGHT, TOP);
  text("Level: " + level, width / 2 - 20, -height / 2 + 20);

  // Render city skyline
  renderCitySkyline();

  // Check collision between enemy projectiles and skyline
  checkSkylineCollisions();

  // Check if skyline is completely destroyed
  if (isSkylineDestroyed()) {
    gameOver();
    return;
  }

  fill(0, 255, 255);
  textSize(16);
  text("Click to shoot!", -width / 2 + 20, height / 2 - 20);

  if (invaders.length === 0) {
    level++;
    if (level <= 4) {
      pattern = 'wheel';
    } else if (level <= 8) {
      pattern = 'rectangle';
    } else if (level <= 12) {
      pattern = 'figure8';
    } else {
      pattern = 'combined';
    }
    spawnInvaders();
  }
}

function drawHoneycombPattern(x, y, w, h, cellSize) {
  // Draw hexagonal honeycomb pattern
  let rows = Math.floor(h / (cellSize * 0.75));
  let cols = Math.floor(w / cellSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let hexX = x + col * cellSize + (row % 2) * (cellSize / 2);
      let hexY = y + row * cellSize * 0.75;

      if (hexX + cellSize <= x + w && hexY + cellSize <= y + h) {
        drawHexagon(hexX + cellSize/2, hexY + cellSize/2, cellSize/3);
      }
    }
  }
}

function drawHexagon(centerX, centerY, radius) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i;
    let x = centerX + cos(angle) * radius;
    let y = centerY + sin(angle) * radius;
    vertex(x, y);
  }
  endShape(CLOSE);
}

function renderBuildingBlock(block) {
  if (block.destroyed) return;

  // Handle flashing effect
  if (block.flashTimer > 0 && !block.isFoundation) {
    fill(255, 255, 255); // Bright white flash
    stroke(255, 255, 255);
    block.flashTimer--; // Decrement flash timer

    // Destroy block when flash is done (only non-foundation blocks)
    if (block.flashTimer <= 0) {
      block.destroyed = true;
    }
  } else {
    // Set colors based on building type
    fill(block.buildingColor.fill[0], block.buildingColor.fill[1], block.buildingColor.fill[2]);
    stroke(block.buildingColor.stroke[0], block.buildingColor.stroke[1], block.buildingColor.stroke[2]);
  }

  strokeWeight(1);

  // Render based on building type
  switch (block.buildingType) {
    case 'honeycomb':
      // Draw base rectangle first
      rect(block.x, block.y, block.width, block.height);
      // Add honeycomb pattern on top
      stroke(block.buildingColor.stroke[0] + 40, block.buildingColor.stroke[1] + 40, block.buildingColor.stroke[2] + 40);
      strokeWeight(0.5);
      drawHoneycombPattern(block.x + 2, block.y + 2, block.width - 4, block.height - 4, 8);
      break;

    case 'neon':
      // Draw with glowing effect
      rect(block.x, block.y, block.width, block.height);
      // Add inner glow lines
      stroke(block.buildingColor.stroke[0] + 80, block.buildingColor.stroke[1] + 80, block.buildingColor.stroke[2] + 80);
      strokeWeight(0.5);
      line(block.x + 3, block.y + 3, block.x + block.width - 3, block.y + 3);
      line(block.x + 3, block.y + block.height - 3, block.x + block.width - 3, block.y + block.height - 3);
      break;

    case 'industrial':
      // Draw with rivets/bolts pattern
      rect(block.x, block.y, block.width, block.height);
      fill(block.buildingColor.stroke[0], block.buildingColor.stroke[1], block.buildingColor.stroke[2]);
      noStroke();
      // Add rivet dots
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ellipse(block.x + 4 + i * 6, block.y + 4 + j * 8, 2, 2);
        }
      }
      break;

    case 'glass':
      // Draw with reflective pattern
      rect(block.x, block.y, block.width, block.height);
      // Add window grid
      stroke(block.buildingColor.stroke[0] + 60, block.buildingColor.stroke[1] + 60, block.buildingColor.stroke[2] + 60);
      strokeWeight(0.5);
      // Vertical lines
      line(block.x + block.width/3, block.y, block.x + block.width/3, block.y + block.height);
      line(block.x + 2*block.width/3, block.y, block.x + 2*block.width/3, block.y + block.height);
      // Horizontal line
      line(block.x, block.y + block.height/2, block.x + block.width, block.y + block.height/2);
      break;

    default: // normal and foundation
      rect(block.x, block.y, block.width, block.height);
      break;
  }
}

function renderCitySkyline() {
  for (let block of cityBlocks) {
    renderBuildingBlock(block);
  }

  // Render turrets on the sides
  renderTurrets();
}

function renderTurrets() {
  let groundY = height / 2 - 80;
  let leftTurretX = -width / 2 + 30;
  let rightTurretX = width / 2 - 70;
  let turretHeight = 180; // Make turrets much taller than skyline

  // Convert mouse position to world coordinates
  let mouseWorldX = mouseX - width / 2;
  let mouseWorldY = mouseY - height / 2;

  // Left turret
  fill(80, 80, 120);
  stroke(120, 120, 180);
  strokeWeight(2);
  rect(leftTurretX, groundY - turretHeight, 40, turretHeight); // Tall base
  fill(60, 60, 100);
  rect(leftTurretX + 5, groundY - turretHeight - 20, 30, 25); // Top section
  rect(leftTurretX + 10, groundY - turretHeight - 35, 20, 20); // Cannon mount

  // Left cannon barrel pointing at mouse
  let leftCannonBaseX = leftTurretX + 20;
  let leftCannonBaseY = groundY - turretHeight - 25;
  let leftDx = mouseWorldX - leftCannonBaseX;
  let leftDy = mouseWorldY - leftCannonBaseY;
  let leftAngle = atan2(leftDy, leftDx);
  let cannonLength = 30;
  let leftCannonEndX = leftCannonBaseX + cos(leftAngle) * cannonLength;
  let leftCannonEndY = leftCannonBaseY + sin(leftAngle) * cannonLength;

  stroke(255, 100, 100);
  strokeWeight(6);
  line(leftCannonBaseX, leftCannonBaseY, leftCannonEndX, leftCannonEndY);

  // Right turret
  fill(80, 80, 120);
  stroke(120, 120, 180);
  strokeWeight(2);
  rect(rightTurretX, groundY - turretHeight, 40, turretHeight); // Tall base
  fill(60, 60, 100);
  rect(rightTurretX + 5, groundY - turretHeight - 20, 30, 25); // Top section
  rect(rightTurretX + 10, groundY - turretHeight - 35, 20, 20); // Cannon mount

  // Right cannon barrel pointing at mouse
  let rightCannonBaseX = rightTurretX + 20;
  let rightCannonBaseY = groundY - turretHeight - 25;
  let rightDx = mouseWorldX - rightCannonBaseX;
  let rightDy = mouseWorldY - rightCannonBaseY;
  let rightAngle = atan2(rightDy, rightDx);
  let rightCannonEndX = rightCannonBaseX + cos(rightAngle) * cannonLength;
  let rightCannonEndY = rightCannonBaseY + sin(rightAngle) * cannonLength;

  stroke(255, 100, 100);
  strokeWeight(6);
  line(rightCannonBaseX, rightCannonBaseY, rightCannonEndX, rightCannonEndY);

  noStroke();
}

function playLaserSound() {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Laser sound: high-pitched zap that drops in frequency
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

  oscillator.type = 'sawtooth';
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.15);
}

function startUfoHum() {
  if (!audioContext || ufoOscillator) return;

  ufoOscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  ufoOscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // UFO hum: low-frequency oscillating drone
  ufoOscillator.frequency.setValueAtTime(60, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);

  ufoOscillator.type = 'sine';
  ufoOscillator.start(audioContext.currentTime);

  // Modulate the frequency for that classic UFO wobble
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.connect(lfoGain);
  lfoGain.connect(ufoOscillator.frequency);
  lfo.frequency.value = 3; // 3Hz wobble
  lfoGain.gain.value = 10; // Frequency modulation depth
  lfo.start();
}

function startUfoSound() {
  if (ufoAudio) {
    ufoAudio.pause();
    ufoAudio = null;
  }

  try {
    ufoAudio = new Audio('/attached_assets/ufo_4_1758648473127.wav');
    ufoAudio.volume = 0.3; // Set volume to 30%
    ufoAudio.loop = true; // Loop continuously while UFO is active

    // Try to play immediately
    const playPromise = ufoAudio.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('UFO sound failed to play:', error);
      });
    }
  } catch (error) {
    console.log('Failed to load UFO sound:', error);
  }
}

function stopUfoSound() {
  if (ufoAudio) {
    ufoAudio.pause();
    ufoAudio.currentTime = 0;
    ufoAudio = null;
  }
}

function stopUfoHum() {
  if (ufoOscillator) {
    ufoOscillator.stop();
    ufoOscillator = null;
  }
}

function playNyanCatSound() {
  if (!audioContext) return;

  // Play a cute cat-like meow sound
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Cat meow: starts high, dips down, then back up
  oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
  oscillator.frequency.exponentialRampToValueAtTime(350, audioContext.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  oscillator.type = 'triangle';
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
}

function playUfoLaserSound() {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // UFO laser: extremely subtle, whisper-quiet alien sound
  oscillator.frequency.setValueAtTime(380, audioContext.currentTime); // Lower starting frequency
  oscillator.frequency.linearRampToValueAtTime(240, audioContext.currentTime + 0.06); // Gentler frequency change

  // Ultra-quiet volume with soft attack and decay
  gainNode.gain.setValueAtTime(0.0, audioContext.currentTime); // Start silent
  gainNode.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.01); // Soft attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06); // Soft decay

  oscillator.type = 'sine'; // Smoothest wave type
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.06); // Very brief duration
}

function playEnemyLaserSound() {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Enemy laser: deeper, more menacing sound, but quieter
  oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.2);

  gainNode.gain.setValueAtTime(0.12, audioContext.currentTime); // Reduced from 0.25 to 0.12
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

  oscillator.type = 'square';
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}

function playExplosionSound() {
  if (!audioContext) return;

  // Create white noise for explosion base
  const bufferSize = audioContext.sampleRate * 0.4; // 0.4 seconds
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = buffer;

  // Create filter for shaping the explosion
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, audioContext.currentTime);
  filter.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.4);

  // Create gain envelope for explosion
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

  // Connect the nodes
  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Add low-frequency rumble
  const rumbleOsc = audioContext.createOscillator();
  const rumbleGain = audioContext.createGain();

  rumbleOsc.frequency.setValueAtTime(60, audioContext.currentTime);
  rumbleOsc.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.3);
  rumbleGain.gain.setValueAtTime(0.3, audioContext.currentTime);
  rumbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(audioContext.destination);

  // Start the explosion
  noiseSource.start(audioContext.currentTime);
  noiseSource.stop(audioContext.currentTime + 0.4);
  rumbleOsc.start(audioContext.currentTime);
  rumbleOsc.stop(audioContext.currentTime + 0.3);
}

// Soundtrack playlist for the game
let soundtrackPlaylist = [
  '/attached_assets/mode_1759293195149.mp3',
  '/attached_assets/serpent_1759431415420.mp3',
  '/attached_assets/fortress_1759293202674.mp3',
  '/attached_assets/mode_1759293195149.mp3'
];
let currentTrackIndex = 0;

function playNextTrack() {
  // Add some randomization - 70% chance to cycle to next track, 30% chance to pick random
  if (Math.random() < 0.7) {
    // Cycle to next track in playlist
    currentTrackIndex = (currentTrackIndex + 1) % soundtrackPlaylist.length;
  } else {
    // Pick a random track (but different from current)
    let newIndex = currentTrackIndex;
    while (newIndex === currentTrackIndex && soundtrackPlaylist.length > 1) {
      newIndex = Math.floor(Math.random() * soundtrackPlaylist.length);
    }
    currentTrackIndex = newIndex;
  }

  console.log('Playing next track:', soundtrackPlaylist[currentTrackIndex]);

  // Load and play the next track
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic = null;
  }

  startBackgroundMusic();
}

function startBackgroundMusic() {
  if (backgroundMusic) {
    // If music already exists but is paused, restart it
    if (backgroundMusic.paused) {
      backgroundMusic.currentTime = 0;
      backgroundMusic.play().catch(error => {
        console.log('Background music failed to restart:', error);
      });
    }
    return; // Already playing
  }

  try {
    // Load current track from playlist
    backgroundMusic = new Audio(soundtrackPlaylist[currentTrackIndex]);
    backgroundMusic.volume = 0.4; // Set volume to 40%
    backgroundMusic.loop = false; // Don't loop individual tracks

    // Set up event listener to play next track when current one ends
    backgroundMusic.addEventListener('ended', playNextTrack);

    // Try to play immediately, but handle autoplay restrictions
    const playPromise = backgroundMusic.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Background music failed to play (autoplay restriction):', error);
        // Store music object so it can play on first user interaction
      });
    }
  } catch (error) {
    console.log('Failed to load background music:', error);
  }
}

function stopBackgroundMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    backgroundMusic.removeEventListener('ended', playNextTrack);
    backgroundMusic = null;
  }
}

function createMuzzleBlast(x, y) {
  // Create bright muzzle flash particles
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x + random(-5, 5),
      y: y + random(-5, 5),
      vx: random(-2, 2),
      vy: random(-2, 2),
      lifetime: 15,
      color: color(255, 255, 100), // Bright yellow flash
      size: random(3, 8)
    });
  }

  // Create bright blast ring
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: random(-4, 4),
      vy: random(-4, 4),
      lifetime: 10,
      color: color(255, 150, 0), // Orange blast
      size: random(2, 5)
    });
  }
}

function checkSkylineCollisions() {
  // Check UFO lasers hitting skyline
  for (let i = ufoLasers.length - 1; i >= 0; i--) {
    let laser = ufoLasers[i];
    for (let j = cityBlocks.length - 1; j >= 0; j--) {
      let block = cityBlocks[j];
      if (!block.destroyed &&
          laser.x > block.x && laser.x < block.x + block.width &&
          laser.y > block.y && laser.y < block.y + block.height) {
        // Only destroy non-foundation blocks
        if (!block.isFoundation) {
          destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
        }
        ufoLasers.splice(i, 1);
        break;
      }
    }
  }

  // Check invader lasers hitting skyline
  for (let i = invaderLasers.length - 1; i >= 0; i--) {
    let laser = invaderLasers[i];
    for (let j = cityBlocks.length - 1; j >= 0; j--) {
      let block = cityBlocks[j];
      if (!block.destroyed &&
          laser.x > block.x && laser.x < block.x + block.width &&
          laser.y > block.y && laser.y < block.y + block.height) {
        // Only destroy non-foundation blocks
        if (!block.isFoundation) {
          destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
        }
        invaderLasers.splice(i, 1);
        break;
      }
    }
  }

  // Check nyan cat bombs hitting skyline
  for (let i = nyanCatBombs.length - 1; i >= 0; i--) {
    let bomb = nyanCatBombs[i];
    for (let j = cityBlocks.length - 1; j >= 0; j--) {
      let block = cityBlocks[j];
      if (!block.destroyed &&
          bomb.x > block.x && bomb.x < block.x + block.width &&
          bomb.y > block.y && bomb.y < block.y + block.height) {
        // Only destroy non-foundation blocks
        if (!block.isFoundation) {
          destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
        }
        nyanCatBombs.splice(i, 1);
        break;
      }
    }
  }
}

function keyPressed() {
  // Don't allow pausing if game has ended
  if (gameEnded) return;

  // Handle spacebar (32) and Enter key (13) for pause/unpause
  if (keyCode === 32 || keyCode === 13) {
    gamePaused = !gamePaused;

    // Also pause/unpause background music
    if (gamePaused) {
      if (backgroundMusic && !backgroundMusic.paused) {
        backgroundMusic.pause();
      }
    } else {
      if (backgroundMusic && backgroundMusic.paused) {
        backgroundMusic.play().catch(error => {
          console.log('Background music failed to resume:', error);
        });
      }
    }
  }
}

function destroySkylineBlock(blockIndex, explosionX, explosionY) {
  let block = cityBlocks[blockIndex];

  // Decrement health instead of immediate destruction
  if (block.health !== undefined) {
    block.health--;
  }

  // Set flash timer for hit effect
  block.flashTimer = 15; // Flash for 15 frames

  // Only mark as destroyed when health reaches 0
  if (block.health <= 0) {
    block.destroyed = true;

    // Create explosion particles only on final destruction
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: explosionX,
        y: explosionY,
        vx: random(-4, 4),
        vy: random(-4, 4),
        lifetime: 40
      });
    }

    // Play explosion sound
    playExplosionSound();
  } else {
    // Just play a hit sound for damage
    playLaserSound();
  }
}

function isSkylineDestroyed() {
  // Only check non-foundation blocks for game over condition
  return cityBlocks.filter(block => !block.isFoundation).every(block => block.destroyed);
}

function gameOver() {
  // Only execute once
  if (gameEnded) return;

  gameEnded = true;

  // Stop background music
  stopBackgroundMusic();

  // Stop UFO sounds if active
  stopUfoHum();
  stopUfoSound();

  // Stop the draw loop
  noLoop();

  fill(255, 0, 0);
  textSize(32);
  textAlign(CENTER);
  text("CITY DESTROYED!", 0, -50);
  text("GAME OVER", 0, 0);
  text("Restarting...", 0, 50);

  // Reset game after 3 seconds
  setTimeout(() => {
    level = 1;
    score = 0;
    pattern = 'wheel';
    invaders = [];
    particles = [];
    ufoLasers = [];
    invaderLasers = [];
    playerLasers = [];
    nyanCatBombs = [];
    ufo = null;
    nyanCat = null;
    rainbowTrails = [];
    gameEnded = false;
    initializeCitySkyline();
    spawnInvaders();

    // Occasionally start with a different track on game restart (30% chance)
    if (Math.random() < 0.3) {
      currentTrackIndex = Math.floor(Math.random() * soundtrackPlaylist.length);
      console.log('Game restart: Starting with track', currentTrackIndex);
    }

    // Restart background music and resume game loop
    startBackgroundMusic();
    loop();
  }, 3000);
}

function mousePressed() {
  // Start background music on first user interaction (for autoplay policy)
  if (backgroundMusic && backgroundMusic.paused) {
    startBackgroundMusic();
  }

  // Don't allow shooting if game has ended
  if (gameEnded) return;

  // Convert screen coordinates to world coordinates
  let worldX = mouseX - width / 2;
  let worldY = mouseY - height / 2;

  // Fire from exact turret positions
  let groundY = height / 2 - 80;
  let turretHeight = 180;
  let leftTurretX = -width / 2 + 50; // Center of left turret
  let rightTurretX = width / 2 - 50; // Center of right turret
  let cannonY = groundY - turretHeight - 25; // From cannon barrels

  // Calculate direction vectors for both cannons to converge at mouse position
  let leftDx = worldX - leftTurretX;
  let leftDy = worldY - cannonY;
  let leftDistance = sqrt(leftDx * leftDx + leftDy * leftDy);

  let rightDx = worldX - rightTurretX;
  let rightDy = worldY - cannonY;
  let rightDistance = sqrt(rightDx * rightDx + rightDy * rightDy);

  // Normalize and set speed
  let speed = 15;
  let leftVx = (leftDx / leftDistance) * speed;
  let leftVy = (leftDy / leftDistance) * speed;
  let rightVx = (rightDx / rightDistance) * speed;
  let rightVy = (rightDy / rightDistance) * speed;

  // Create muzzle blast effects at turret positions
  createMuzzleBlast(leftTurretX, cannonY);
  createMuzzleBlast(rightTurretX, cannonY);

  // Play laser firing sound
  playLaserSound();

  // Create two high-visibility lasers from turret cannons
  playerLasers.push({
    x: leftTurretX,
    y: cannonY,
    vx: leftVx,
    vy: leftVy,
    color: color(0, 255, 255), // Bright cyan
    trail: []
  });

  playerLasers.push({
    x: rightTurretX,
    y: cannonY,
    vx: rightVx,
    vy: rightVy,
    color: color(0, 255, 255), // Bright cyan
    trail: []
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(gameHtml);
  });

  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup authentication BEFORE returning (must complete before Vite middleware)
  // This ensures auth routes are registered before the Vite catch-all route
  try {
    await setupAuth(app);
  } catch (error) {
    console.error('Failed to setup authentication:', error);
    console.warn('Server will continue running without authentication');
  }

  // Auth routes
  app.get('/api/auth/user', async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated?.() || !req.user?.claims?.sub) {
        return res.json({
          user: null,
          preferences: null
        });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const preferences = await storage.getUserPreferences(userId);

      res.json({
        user: user || null,
        preferences: preferences || null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      // Return null instead of error to prevent auth loops
      res.json({
        user: null,
        preferences: null
      });
    }
  });

  // User preferences routes
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);

      if (!preferences) {
        // Create default preferences if they don't exist
        const defaultPrefs = await storage.createUserPreferences({
          userId,
          defaultMode: "natural",
          voiceEnabled: false,
          selectedVoice: "default",
          voiceRate: "1",
          terminalTheme: "classic"
        });
        return res.json(defaultPrefs);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body
      const validationResult = insertUserPreferencesSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid preferences data",
          details: validationResult.error.errors
        });
      }

      const updatedPreferences = await storage.updateUserPreferences(userId, validationResult.data);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User conversation history routes
  app.get("/api/user/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get user conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chat endpoint (enhanced with user support)
  app.post("/api/chat", async (req, res) => {
    try {
      // Check authentication
      if (!req.isAuthenticated?.() || !req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = { id: req.user.claims.sub, name: req.user.claims.name || 'User', claims: req.user.claims };

      const { message, mode, language } = req.body; // language is now extracted

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validModes = ["natural", "technical", "freestyle"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }

      const currentSessionId = req.body.sessionId || randomUUID();

      // Add user message to conversation
      const userMessage: Message = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode || "natural",
        language: language || "english", // Store language preference
      };

      await storage.addMessageToConversation(currentSessionId, userMessage);

      // Get conversation history for context
      const conversation = await storage.getConversation(currentSessionId);
      const conversationHistory = Array.isArray(conversation?.messages) ? conversation.messages as Message[] : [];

      // Check if this is a new session (no history yet)
      const isNewSession = conversationHistory.length === 0;

      // Generate AI response using LLM with knowledge base integration
      const response = await llmService.generateResponse(
        message,
        mode || 'natural',
        conversationHistory,
        user.id,
        language || 'english', // Pass language to LLM service
        isNewSession // Pass new session flag
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
        mode: mode || "natural",
        language: language || "english",
      };

      await storage.addMessageToConversation(currentSessionId, assistantMessage);

      res.json({
        response: response,
        sessionId: currentSessionId,
        mode,
        language
      });

    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Code completion endpoint for monacopilot (Mistral-powered)
  app.post("/api/code-completion", async (req, res) => {
    try {
      const { code, language = 'python', filename } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Code is required" });
      }

      // Generate code completion using Mistral
      const completion = await llmService.generateCodeCompletion(code, language, filename);

      res.json({ completion });
    } catch (error) {
      console.error("Code completion error:", error);
      res.status(500).json({ error: "Internal server error", completion: '' });
    }
  });

  // Get conversation history
  app.get("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const conversation = await storage.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Configure multer for file uploads (in-memory storage)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
    },
    fileFilter: (req, file, cb) => {
      // Allow text and audio files
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'text/html',
        'text/xml',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/m4a',
      ];

      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|json|csv|html|xml|mp3|wav|ogg|m4a)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only text and audio files are allowed'));
      }
    }
  });

  // Multer error handling middleware
  const handleMulterError = (req: any, res: any, next: any) => {
    upload.array('files', 10)(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "One or more files exceed the 5MB size limit" });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: "Too many files. Maximum 10 files allowed" });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: "Unexpected file field" });
        } else {
          return res.status(400).json({ error: err.message || "File upload error" });
        }
      }
      next();
    });
  };

  // Document upload endpoint
  app.post("/api/documents/upload", isAuthenticated, handleMulterError, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const results: any[] = [];
      const errors: any[] = [];

      // Process files in parallel for better performance
      const fileProcessingPromises = req.files.map(async (file: any) => {
        try {
          console.log(`📤 Processing file: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`);

          // Determine if the file is an audio file (based on mimetype or extension)
          const isAudioFile = file.mimetype.startsWith('audio/') ||
                              file.originalname.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/);

          // If it's an audio file, create metadata record with proper mimeType
          if (isAudioFile) {
            // Determine proper MIME type
            let mimeType = file.mimetype;
            if (!mimeType || mimeType === 'application/octet-stream') {
              // Fallback to extension-based detection
              const ext = file.originalname.toLowerCase().split('.').pop();
              if (ext === 'mp3') mimeType = 'audio/mpeg';
              else if (ext === 'wav') mimeType = 'audio/wav';
              else if (ext === 'ogg') mimeType = 'audio/ogg';
              else if (ext === 'm4a') mimeType = 'audio/mp4';
              else mimeType = 'audio/mpeg'; // default
            }

            console.log(`🎵 Creating audio document: ${file.originalname} with mimeType: ${mimeType}`);

            // Create document with metadata - mimeType is crucial for Webamp detection
            const document = await knowledgeService.processDocument(null, {
              userId,
              fileName: `${randomUUID()}-${file.originalname}`,
              originalName: file.originalname,
              fileSize: file.size.toString(),
              mimeType: mimeType,
              objectPath: null // Will be set by separate PUT request
            });

            console.log(`✅ Audio document created - ID: ${document.id}, name: ${document.originalName}, mimeType: ${document.mimeType}`);

            return {
              type: 'success',
              document: {
                id: document.id,
                originalName: document.originalName,
                fileSize: document.fileSize,
                mimeType: document.mimeType,
                objectPath: document.objectPath,
                summary: document.summary,
                keywords: document.keywords,
                uploadedAt: document.uploadedAt,
              }
            };
          } else {
            // For non-audio files, process as before
            const content = file.buffer.toString('utf8');

            if (content.length === 0) {
              return { type: 'error', file: file.originalname, error: "File is empty" };
            }

            if (content.length > 5000000) {
              return { type: 'error', file: file.originalname, error: "File content is too large (max 5MB)" };
            }

            console.log(`📄 Creating text document: ${file.originalname}`);

            const document = await knowledgeService.processDocument(content, {
              userId,
              fileName: `${randomUUID()}-${file.originalname}`,
              originalName: file.originalname,
              fileSize: file.size.toString(),
              mimeType: file.mimetype,
            });

            console.log(`✅ Text document created - ID: ${document.id}, name: ${document.originalName}`);

            return {
              type: 'success',
              document: {
                id: document.id,
                originalName: document.originalName,
                fileSize: document.fileSize,
                summary: document.summary,
                keywords: document.keywords,
                uploadedAt: document.uploadedAt,
              }
            };
          }
        } catch (fileError) {
          console.error(`❌ Error processing file ${file.originalname}:`, fileError);
          return { type: 'error', file: file.originalname, error: "Failed to process file" };
        }
      });

      const processingResults = await Promise.allSettled(fileProcessingPromises);

      processingResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'success') {
            results.push(result.value.document);
          } else {
            errors.push({ file: result.value.file, error: result.value.error });
          }
        } else {
          // Handle unexpected errors during Promise.allSettled
          console.error("Unexpected error in Promise.allSettled:", result);
          errors.push({ file: 'Unknown', error: "Processing failed due to an unexpected error" });
        }
      });

      res.json({
        message: `Successfully processed ${results.length} of ${req.files.length} files`,
        documents: results,
        errors: errors,
        totalUploaded: results.length,
        totalErrors: errors.length
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Save text content as document
  app.post("/api/documents/save-text", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, filename } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: "Filename is required" });
      }

      if (content.length === 0) {
        return res.status(400).json({ error: "Content cannot be empty" });
      }

      if (content.length > 5000000) {
        return res.status(400).json({ error: "Content is too large (max 5MB)" });
      }

      // Ensure filename ends with .txt if not already provided
      let finalFilename = filename;
      if (!finalFilename.toLowerCase().endsWith('.txt')) {
        finalFilename += '.txt';
      }

      // Process the document
      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName: `${randomUUID()}-${finalFilename}`,
        originalName: finalFilename,
        fileSize: Buffer.byteLength(content, 'utf8').toString(),
        mimeType: 'text/plain',
      });

      res.json({
        success: true,
        document: {
          id: document.id,
          originalName: document.originalName,
          fileSize: document.fileSize,
          summary: document.summary,
          keywords: document.keywords,
          uploadedAt: document.uploadedAt,
        }
      });
    } catch (error) {
      console.error("Save text error:", error);
      res.status(500).json({ error: "Failed to save text to knowledge base" });
    }
  });

  // Migrate documents endpoint
  app.post("/api/documents/migrate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`🔄 Migration requested by user: ${userId}`);

      const { migrateDocumentsToUser } = await import('./migrate-documents');
      const result = await migrateDocumentsToUser(userId);

      res.json({
        success: true,
        message: `Successfully migrated ${result.migrated} documents`,
        ...result
      });
    } catch (error) {
      console.error("Document migration error:", error);
      res.status(500).json({ error: "Failed to migrate documents" });
    }
  });

  // Diagnostic endpoint to check all documents in database
  app.get('/api/documents/diagnostic', isAuthenticated, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.claims.sub;
      const { db } = await import('./db');
      const { documents } = await import('@shared/schema');

      // Get ALL documents regardless of userId
      const allDocs = await db.select().from(documents);

      // Group by userId with details and show actual userId values
      const byUserId: Record<string, { count: number, documents: string[], actualUserId: string | null }> = {};
      allDocs.forEach(doc => {
        const uid = doc.userId || 'null';
        if (!byUserId[uid]) {
          byUserId[uid] = { count: 0, documents: [], actualUserId: doc.userId };
        }
        byUserId[uid].count++;
        byUserId[uid].documents.push(doc.originalName);
      });

      console.log(`📊 Total documents in database: ${allDocs.length}`);
      console.log(`📊 Your userId: ${userId}`);
      console.log(`📊 Documents by userId:`, Object.fromEntries(
        Object.entries(byUserId).map(([uid, data]) => [uid, data.count])
      ));

      // Show all unique userIds found
      const uniqueUserIds = Array.from(new Set(allDocs.map(d => d.userId || 'null')));
      console.log(`📊 Unique userIds in database:`, uniqueUserIds);

      // Compare to expected count (140 from published version)
      const expectedCount = 140;
      const currentCount = allDocs.length;
      const yourCount = allDocs.filter(d => d.userId === userId).length;

      res.json({
        environment: process.env.NODE_ENV || 'development',
        comparison: {
          publishedCount: expectedCount,
          currentCount: currentCount,
          yourDocuments: yourCount,
          difference: currentCount - expectedCount,
          missing: expectedCount - currentCount,
          status: currentCount === expectedCount ? 'MATCH' : currentCount > expectedCount ? 'EXTRA_DOCS' : 'MISSING_DOCS'
        },
        totalDocuments: allDocs.length,
        yourDocuments: yourCount,
        yourUserId: userId,
        uniqueUserIds: uniqueUserIds,
        documentsByUserId: Object.fromEntries(
          Object.entries(byUserId).map(([uid, data]) => [uid, { count: data.count, actualUserId: data.actualUserId }])
        ),
        documentDetails: byUserId,
        sampleDocuments: allDocs.slice(0, 10).map(d => ({
          id: d.id,
          name: d.originalName,
          userId: d.userId,
          uploadedAt: d.uploadedAt
        }))
      });
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(500).json({ error: "Failed to run diagnostic" });
    }
  });


  // Get user documents
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`📚 Fetching documents for user: ${userId}`);
      const documents = await storage.getUserDocuments(userId);
      console.log(`📚 Found ${documents.length} documents for user ${userId}`);

      // Return all necessary fields including mimeType and objectPath for audio files
      const documentsInfo = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        summary: doc.summary,
        keywords: doc.keywords,
        uploadedAt: doc.uploadedAt,
        lastAccessedAt: doc.lastAccessedAt,
        mimeType: doc.mimeType || null,
        objectPath: doc.objectPath || null,
      }));

      res.json(documentsInfo);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document with full content
  app.get("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Rename a specific document
  app.patch("/api/documents/:documentId/rename", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { newName } = req.body;

      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: "Valid document name is required" });
      }

      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found or unauthorized" });
      }

      const updatedDocument = await storage.updateDocument(documentId, {
        originalName: newName.trim()
      });

      res.json({ success: true, document: updatedDocument });
    } catch (error) {
      console.error("Rename document error:", error);
      res.status(500).json({ error: "Failed to rename document" });
    }
  });


  // Delete a specific document
  app.delete("/api/documents/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;

      const success = await knowledgeService.deleteDocument(documentId, userId);

      if (!success) {
        return res.status(404).json({ error: "Document not found or unauthorized" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Get document by filename for read command
  app.get("/api/documents/read/:filename", isAuthenticated, async (req: any, res) => {
    try {
      const filename = req.params.filename;
      const userId = req.user.claims.sub;

      const document = await storage.getDocumentByFilename(userId, filename);
      if (!document) {
        return res.status(404).json({
          error: `Document '${filename}' not found`,
          formatted: `❌ Document '${filename}' not found in knowledge base.\n\nUse 'docs' command to list available documents.`
        });
      }

      res.json({
        document,
        formatted: `📖 Reading: ${document.originalName}\n\n${document.content}\n\n📊 Summary: ${document.summary || 'No summary available'}\n🏷️  Keywords: ${document.keywords?.join(', ') || 'None'}`
      });
    } catch (error) {
      console.error("Read document error:", error);
      res.status(500).json({
        error: "Failed to read document",
        formatted: "❌ Failed to read document. Please try again."
      });
    }
  });

  // Search documents and knowledge
  app.get("/api/knowledge/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const results = await knowledgeService.searchKnowledge(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Knowledge search error:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // Get user document statistics
  app.get("/api/knowledge/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await knowledgeService.getUserDocumentStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Knowledge stats error:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base statistics" });
    }
  });

  // Save a note
  app.post("/api/notes", isAuthenticated, async (req: any, res) => {
    try {
      // Ensure user is authenticated
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.claims.sub;
      const { title, content } = req.body;

      console.log('📝 Saving note:', { userId, titleLength: title?.length, contentLength: content?.length });

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: "Valid title is required" });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Valid content is required" });
      }

      const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName,
        originalName: title,
        fileSize: Buffer.byteLength(content, 'utf8').toString(),
        mimeType: 'text/plain',
      });

      // Mark as note
      await storage.updateDocument(document.id, { isNote: true });

      console.log('✅ Note saved successfully:', document.id);

      res.json({
        success: true,
        document: { ...document, isNote: true },
        message: "Note saved to knowledge base"
      });
    } catch (error) {
      console.error("❌ Save note error:", error);
      res.status(500).json({
        error: "Failed to save note",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a note
  app.put("/api/notes/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { title, content } = req.body;

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId || !document.isNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      const fileName = title ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt` : document.fileName;

      await storage.updateDocument(documentId, {
        originalName: title || document.originalName,
        fileName,
        content: content || document.content,
        fileSize: (content?.length || document.content.length).toString(),
      });

      res.json({ success: true, message: "Note updated" });
    } catch (error) {
      console.error("Update note error:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  // Download a specific document (for audio files)
  app.get("/api/knowledge/documents/:documentId/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;

      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found" });
      }

      // If it's an audio file with object storage path, stream it
      if (document.objectPath && document.mimeType && document.mimeType.startsWith('audio/')) {
        const objectStorageService = new ObjectStorageService();

        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
          await objectStorageService.downloadObject(objectFile, res, 86400); // Cache for 24 hours
        } catch (error) {
          console.error("Error accessing object storage:", error);
          res.status(404).json({ error: "Audio file not found in storage" });
        }
      } else {
        res.status(400).json({ error: "Document is not downloadable or not an audio file" });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // Object Storage endpoints for knowledge base files
  // Reference: blueprint:javascript_object_storage

  // Get upload URL for object storage
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Serve private objects with ACL checks
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        return res.sendStatus(401);
      }

      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Update document with object storage path and ACL
  app.put("/api/documents/:id/object", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      const { objectURL } = req.body;

      if (!objectURL) {
        return res.status(400).json({ error: "objectURL is required" });
      }

      const objectStorageService = new ObjectStorageService();

      // Set ACL policy for the uploaded file
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectURL,
        {
          owner: userId,
          visibility: "private",
        }
      );

      // Update document with object storage path
      await storage.updateDocument(documentId, { objectPath });

      res.status(200).json({
        objectPath: objectPath,
        message: "Document object storage updated successfully",
      });
    } catch (error) {
      console.error("Error updating document object:", error);
      res.status(500).json({ error: "Failed to update document object storage" });
    }
  });

  // Weather API endpoint
  app.get("/api/weather", async (req, res) => {
    try {
      const location = req.query.location as string;
      let weather;

      if (req.query.lat && req.query.lon) {
        const lat = parseFloat(req.query.lat as string);
        const lon = parseFloat(req.query.lon as string);

        if (isNaN(lat) || isNaN(lon)) {
          return res.status(400).json({ error: "Invalid latitude or longitude" });
        }

        weather = await weatherService.getWeatherByCoordinates(lat, lon);
      } else {
        weather = await weatherService.getCurrentWeather(location);
      }

      const formattedWeather = weatherService.formatCurrentWeather(weather);

      res.json({
        weather,
        formatted: formattedWeather
      });
    } catch (error) {
      console.error("Weather error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch weather data";
      res.status(500).json({ error: message });
    }
  });

  // Research API endpoint using Brave Search
  app.get("/api/research", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const braveApiKey = process.env.BRAVE_API_KEY;
      if (!braveApiKey) {
        return res.status(500).json({ error: "Brave API key not configured" });
      }

      // Call Brave Search API with minimal parameters to avoid 422 error
      const searchParams = new URLSearchParams({
        q: query.trim(),
        count: '10'
      });

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey,
          'User-Agent': 'Archimedes/1.0'
        }
      });

      if (!response.ok) {
        // Capture the actual error response from Brave API
        const errorText = await response.text();
        console.error(`Brave API detailed error: ${response.status} ${response.statusText} | ${errorText}`);

        // Return 400 for client errors (422) instead of 500
        const statusCode = response.status === 422 ? 400 : 500;
        return res.status(statusCode).json({
          error: `Brave API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }

      const data = await response.json();

      // Format results for terminal display
      const formattedResults = {
        query: query.trim(),
        total_results: data.web?.results?.length || 0,
        results: data.web?.results?.slice(0, 10).map((result: any, index: number) => ({
          rank: index + 1,
          title: result.title || 'No title',
          url: result.url || '',
          description: result.description || 'No description available',
          age: result.age || null,
          published: result.published || null
        })) || [],
        search_time: new Date().toISOString()
      };

      res.json(formattedResults);
    } catch (error) {
      console.error("Research API error:", error);
      const message = error instanceof Error ? error.message : "Failed to perform web search";
      res.status(500).json({ error: message });
    }
  });

  // Gutendx (Project Gutenberg) API endpoints
  app.get("/api/books/search", async (req, res) => {
    try {
      const {
        search,
        languages,
        author_year_start,
        author_year_end,
        copyright,
        topic,
        sort,
        page
      } = req.query;

      const params: any = {};

      if (search) params.search = search as string;
      if (languages) {
        // Handle comma-separated languages
        params.languages = (languages as string).split(',').map(l => l.trim());
      }
      if (author_year_start) params.author_year_start = parseInt(author_year_start as string);
      if (author_year_end) params.author_year_end = parseInt(author_year_end as string);
      if (copyright !== undefined) params.copyright = copyright === 'true';
      if (topic) params.topic = topic as string;
      if (sort) params.sort = sort as 'popular' | 'ascending' | 'descending';
      if (page) params.page = parseInt(page as string);

      const response = await gutendxService.searchBooks(params);
      const formatted = gutendxService.formatSearchResults(response, search as string);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Book search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const response = await gutendxService.getPopularBooks(limit);
      const formatted = gutendxService.formatSearchResults(response);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Popular books error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch popular books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);

      if (isNaN(bookId)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }

      const book = await gutendxService.getBook(bookId);
      const formatted = gutendxService.formatBookForTerminal(book);

      res.json({
        book,
        formatted
      });
    } catch (error) {
      console.error("Get book error:", error);
      const message = error instanceof Error ? error.message : "Failed to get book details";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/author/:name", async (req, res) => {
    try {
      const authorName = req.params.name;
      const response = await gutendxService.getBooksByAuthor(authorName);
      const formatted = gutendxService.formatSearchResults(response, `author: ${authorName}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by author error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by author";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/topic/:topic", async (req, res) => {
    try {
      const topic = req.params.topic;
      const response = await gutendxService.getBooksByTopic(topic);
      const formatted = gutendxService.formatSearchResults(response, `topic: ${topic}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by topic error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by topic";
      res.status(500).json({ error: message });
    }
  });

  // Marketstack (Stock Market Data) API endpoints
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const quote = await marketstackService.getLatestQuote(symbol);

      if (!quote) {
        return res.status(404).json({ error: `No data found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatQuoteForTerminal(quote);

      res.json({
        quote,
        formatted
      });
    } catch (error) {
      console.error("Stock quote error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quote";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/stocks/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;

      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: "Symbols array is required" });
      }

      if (symbols.length > 10) {
        return res.status(400).json({ error: "Maximum 10 symbols allowed per request" });
      }

      const quotes = await marketstackService.getMultipleQuotes(symbols);
      const formatted = marketstackService.formatMultipleQuotesForTerminal(quotes);

      res.json({
        quotes,
        formatted
      });
    } catch (error) {
      console.error("Multiple stock quotes error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quotes";
      res.status(500).json({ error: message });
    }
  });

  // Python code execution endpoint
  app.post('/api/execute/python', async (req, res) => {
    try {
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Code is required and must be a string'
        });
      }

      // Check if code uses GUI libraries
      const hasGuiLibraries = /import\s+(tkinter|matplotlib|pygame|turtle|PyQt|PySide)/i.test(code);

      // Wrap GUI code to capture output as HTML/image
      const wrappedCode = hasGuiLibraries ? `
import sys
import io
import base64

# Capture GUI output
_gui_output = None

${code}

# For matplotlib, capture plot as base64 image
try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
        plt.close('all')
except ImportError:
    pass
except Exception as e:
    print(f'GUI rendering error: {e}', file=sys.stderr)

# For tkinter, we can't render in headless but we'll note it
try:
    import tkinter as tk
    if tk._default_root:
        print('__GUI_OUTPUT__:<div style="padding:20px; background:#f0f0f0; border-radius:8px;"><strong>🖼️ Tkinter GUI Application</strong><br/>GUI window was created but cannot be displayed in headless mode.<br/>Run this code locally to see the interface.</div>')
except:
    pass
` : code;

      const startTime = Date.now();
      const timeout = 30000; // 30 second timeout

      const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', wrappedCode]);
        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          pythonProcess.kill();
          reject(new Error('Execution timeout (30 seconds) - Code took too long to execute'));
        }, timeout);

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          clearTimeout(timer);
          if (!killed) {
            resolve({ stdout, stderr, code: code || 0 });
          }
        });

        pythonProcess.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // Extract GUI output if present
      let guiOutput = null;
      let textOutput = result.stdout;
      const guiMatch = result.stdout.match(/__GUI_OUTPUT__:(.*)/);
      if (guiMatch) {
        guiOutput = guiMatch[1];
        textOutput = result.stdout.replace(/__GUI_OUTPUT__:.*/, '').trim();
      }

      if (result.code !== 0) {
        return res.json({
          success: false,
          error: result.stderr,
          output: textOutput,
          guiOutput,
          executionTime
        });
      }

      res.json({
        success: true,
        output: textOutput,
        guiOutput,
        executionTime
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      });
    }
  });

  app.get("/api/stocks/info/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const info = await marketstackService.getTickerInfo(symbol);

      if (!info) {
        return res.status(404).json({ error: `No company information found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatTickerInfoForTerminal(info);

      res.json({
        info,
        formatted
      });
    } catch (error) {
      console.error("Stock info error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock information";
      res.status(500).json({ error: message });
    }
  });


  app.get("/api/stocks/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const limit = parseInt(req.query.limit as string) || 10;

      const tickers = await marketstackService.searchTickers(query, limit);

      if (tickers.length === 0) {
        return res.json({
          tickers: [],
          formatted: `No stocks found matching "${query}". Try different keywords or check the symbol.`
        });
      }

      const formatted = `Stock Search Results for "${query}":\n\n` +
        tickers.map((ticker, index) =>
          `${index + 1}. ${ticker.symbol} - ${ticker.name}\n   Exchange: ${ticker.stock_exchange.name} (${ticker.country})`
        ).join('\n\n') +
        `\n\nUse 'stock quote <symbol>' to get current prices.`;

      res.json({
        tickers,
        formatted
      });
    } catch (error) {
      console.error("Stock search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search stocks";
      res.status(500).json({ error: message });
    }
  });

  // Semantic Scholar API endpoints
  app.get("/api/scholar/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const results = await scholarService.searchPapers(query, limit, offset);
      const formatted = scholarService.formatSearchResultsForTerminal(results, query);

      res.json({
        results,
        formatted
      });
    } catch (error) {
      console.error("Scholar search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search academic papers";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/scholar/paper/:paperId", async (req, res) => {
    try {
      const paperId = req.params.paperId;
      const paper = await scholarService.getPaperDetails(paperId);
      const formatted = scholarService.formatPaperDetailsForTerminal(paper);

      res.json({
        paper,
        formatted
      });
    } catch (error) {
      console.error("Scholar paper details error:", error);
      const message = error instanceof Error ? error.message : "Failed to get paper details";
      res.status(500).json({ error: message });
    }
  });

  // OSINT API routes
  app.get('/api/osint/whois/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain) || domain.length > 253) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 WHOIS lookup for: ${domain}`);
      }

      // Try RDAP first (more reliable and standardized)
      try {
        const rdapResponse = await fetch(`https://rdap.org/domain/${domain}`, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
        });

        if (rdapResponse.ok) {
          const rdapData = await rdapResponse.json();

          let formatted = `╭─ WHOIS Information for ${domain}\n`;
          formatted += `├─ Domain: ${domain}\n`;

          // Extract registrar from entities
          const registrar = rdapData.entities?.find((entity: any) =>
            entity.roles?.includes('registrar'))?.vcardArray?.[1]?.find((item: any) =>
              item[0] === 'fn')?.[3];
          if (registrar) {
            formatted += `├─ Registrar: ${registrar}\n`;
          }

          // Extract dates from events
          if (rdapData.events) {
            const registration = rdapData.events.find((event: any) => event.eventAction === 'registration');
            const expiration = rdapData.events.find((event: any) => event.eventAction === 'expiration');
            const lastChanged = rdapData.events.find((event: any) => event.eventAction === 'last changed');

            if (registration?.eventDate) {
              formatted += `├─ Creation Date: ${registration.eventDate.split('T')[0]}\n`;
            }
            if (expiration?.eventDate) {
              formatted += `├─ Expiration Date: ${expiration.eventDate.split('T')[0]}\n`;
            }
            if (lastChanged?.eventDate) {
              formatted += `├─ Updated Date: ${lastChanged.eventDate.split('T')[0]}\n`;
            }
          }

          // Extract status
          if (rdapData.status) {
            formatted += `├─ Domain Status: ${rdapData.status.join(', ')}\n`;
          }

          // Extract nameservers
          if (rdapData.nameservers) {
            const nameServers = rdapData.nameservers.map((ns: any) => ns.ldhName).slice(0, 4);
            if (nameServers.length > 0) {
              formatted += `├─ Name Servers: ${nameServers.join(', ')}\n`;
            }
          }

          formatted += `╰─ Query completed using RDAP`;
          res.json({ formatted });
          return;
        }
      } catch (rdapError) {
        console.log('RDAP failed, trying WHOIS API fallback');
      }

      // Fallback to whois.vu API
      try {
        const whoisResponse = await fetch(`https://api.whois.vu/?q=${domain}`, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
        });

        if (whoisResponse.ok) {
          const whoisData = await whoisResponse.json();

          let formatted = `╭─ WHOIS Information for ${domain}\n`;
          formatted += `├─ Domain: ${domain}\n`;

          if (whoisData.registrar) {
            formatted += `├─ Registrar: ${whoisData.registrar}\n`;
          }
          if (whoisData.registered) {
            formatted += `├─ Creation Date: ${whoisData.registered}\n`;
          }
          if (whoisData.expires) {
            formatted += `├─ Expiration Date: ${whoisData.expires}\n`;
          }
          if (whoisData.updated) {
            formatted += `├─ Updated Date: ${whoisData.updated}\n`;
          }
          if (whoisData.nameservers && whoisData.nameservers.length > 0) {
            formatted += `├─ Name Servers: ${whoisData.nameservers.slice(0, 4).join(', ')}\n`;
          }
          if (whoisData.status) {
            const status = Array.isArray(whoisData.status) ? whoisData.status.join(', ') : whoisData.status;
            formatted += `├─ Domain Status: ${status}\n`;
          }

          formatted += `╰─ Query completed using WHOIS API`;
          res.json({ formatted });
          return;
        }
      } catch (whoisApiError) {
        console.log('WHOIS API failed, falling back to DNS-only lookup');
      }

      // Final fallback: Enhanced DNS-only information
      try {
        let formatted = `╭─ Domain Information for ${domain}\n`;
        let hasData = false;

        // Get A records
        try {
          const addresses = await dns.resolve4(domain);
          formatted += `├─ IPv4 Addresses: ${addresses.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        // Get AAAA records
        try {
          const ipv6Addresses = await dns.resolve6(domain);
          formatted += `├─ IPv6 Addresses: ${ipv6Addresses.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        // Get MX records
        try {
          const mxRecords = await dns.resolveMx(domain);
          const mxList = mxRecords.map(mx => `${mx.exchange} (${mx.priority})`).join(', ');
          formatted += `├─ Mail Servers: ${mxList}\n`;
          hasData = true;
        } catch (e) {}

        // Get NS records
        try {
          const nsRecords = await dns.resolveNs(domain);
          formatted += `├─ Name Servers: ${nsRecords.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        if (hasData) {
          formatted += `╰─ DNS resolution complete (WHOIS services unavailable)`;
          res.json({ formatted });
        } else {
          res.json({
            formatted: `╭─ Domain lookup for ${domain}\n╰─ Domain does not resolve or is not accessible`
          });
        }
      } catch (finalError) {
        res.json({
          formatted: `╭─ Domain lookup for ${domain}\n╰─ All lookup methods failed - domain may not exist`
        });
      }
    } catch (error) {
      console.error('WHOIS error:', error);
      res.status(500).json({ error: 'WHOIS lookup failed' });
    }
  });

  app.get("/api/osint/dns/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      // DNS module imported at top of file

      const results: {
        A: string[];
        AAAA: string[];
        MX: Array<{exchange: string, priority: number}>;
        TXT: string[][];
        NS: string[];
        CNAME: string[] | null;
      } = {
        A: [],
        AAAA: [],
        MX: [],
        TXT: [],
        NS: [],
        CNAME: null
      };

      try {
        // Get A records
        try {
          results.A = await dns.resolve4(domain);
        } catch (e) {}

        // Get AAAA records
        try {
          results.AAAA = await dns.resolve6(domain);
        } catch (e) {}

        // Get MX records
        try {
          results.MX = await dns.resolveMx(domain);
        } catch (e) {}

        // Get TXT records
        try {
          results.TXT = await dns.resolveTxt(domain);
        } catch (e) {}

        // Get NS records
        try {
          results.NS = await dns.resolveNs(domain);
        } catch (e) {}

        // Get CNAME
        try {
          results.CNAME = await dns.resolveCname(domain);
        } catch (e) {}

        let formatted = `╭─ DNS Records for ${domain}\n`;

        if (results.A.length) {
          formatted += `├─ A Records: ${results.A.join(', ')}\n`;
        }

        if (results.AAAA.length) {
          formatted += `├─ AAAA Records: ${results.AAAA.join(', ')}\n`;
        }

        if (results.MX.length) {
          formatted += `├─ MX Records: ${results.MX.map(mx => `${mx.exchange} (${mx.priority})`).join(', ')}\n`;
        }

        if (results.NS.length) {
          formatted += `├─ NS Records: ${results.NS.join(', ')}\n`;
        }

        if (results.TXT.length) {
          formatted += `├─ TXT Records: ${results.TXT.map(txt => txt.join(' ')).join(', ')}\n`;
        }

        if (results.CNAME) {
          formatted += `├─ CNAME: ${results.CNAME.join(', ')}\n`;
        }

        formatted += `╰─ DNS lookup complete`;

        res.json({ formatted });

      } catch (error) {
        res.json({ formatted: `╭─ DNS lookup for ${domain}\n╰─ No DNS records found or domain does not exist` });
      }
    } catch (error) {
      console.error('DNS error:', error);
      res.status(500).json({ error: 'DNS lookup failed' });
    }
  });

  app.get("/api/osint/geoip/:ip", async (req, res) => {
    try {
      const { ip } = req.params;

      // Basic IP validation
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      try {
        // Use ip-api.com free service
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
        const data = await response.json();

        if (data.status === 'success') {
          const formatted = `
╭─ IP Geolocation for ${ip}
├─ Country: ${data.country} (${data.countryCode})
├─ Region: ${data.regionName} (${data.region})
├─ City: ${data.city}
├─ Postal Code: ${data.zip || 'N/A'}
├─ Coordinates: ${data.lat}, ${data.lon}
├─ Timezone: ${data.timezone}
├─ ISP: ${data.isp}
├─ Organization: ${data.org}
╰─ AS: ${data.as}`;

          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation data not available for this IP` });
        }
      } catch (apiError) {
        res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation service temporarily unavailable` });
      }
    } catch (error) {
      console.error('GeoIP error:', error);
      res.status(500).json({ error: 'IP geolocation failed' });
    }
  });

  app.get('/api/osint/headers', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      // Basic URL validation
      let targetUrl: URL;
      try {
        targetUrl = new URL(url);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'ARCHIMEDES-OSINT/1.0'
          }
        });

        let formatted = `╭─ HTTP Headers for ${url}\n`;
        formatted += `├─ Status: ${response.status} ${response.statusText}\n`;

        response.headers.forEach((value, key) => {
          formatted += `├─ ${key}: ${value}\n`;
        });

        formatted += `╰─ Header analysis complete`;

        res.json({ formatted });

      } catch (fetchError) {
        res.json({ formatted: `╭─ HTTP Headers for ${url}\n╰─ Unable to fetch headers - site may be unreachable` });
      }
    } catch (error) {
      console.error('Headers error:', error);
      res.status(500).json({ error: 'Header analysis failed' });
    }
  });

  app.get('/api/osint/wayback', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      try {
        // Use Wayback Machine CDX API
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=10&sort=timestamp`;
        const response = await fetch(cdxUrl);
        const data = await response.json();

        if (data && data.length > 1) {
          let formatted = `╭─ Wayback Machine snapshots for ${url}\n`;

          // Skip first row which contains headers
          const snapshots = data.slice(1, 6); // Show max 5 snapshots

          snapshots.forEach((snapshot: any, index: number) => {
            const timestamp = snapshot[1];
            const date = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)} ${timestamp.slice(8,10)}:${timestamp.slice(10,12)}`;
            const statusCode = snapshot[4];
            const archiveUrl = `https://web.archive.org/web/${timestamp}/${url}`;

            formatted += `├─ ${index + 1}. ${date} (Status: ${statusCode})\n`;
            formatted += `│   ${archiveUrl}\n`;
          });

          formatted += `╰─ Found ${data.length - 1} total snapshots`;

          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ No archived snapshots found` });
        }

      } catch (apiError) {
        res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ Archive service temporarily unavailable` });
      }
    } catch (error) {
      console.error('Wayback error:', error);
      res.status(500).json({ error: 'Wayback lookup failed' });
    }
  });

  app.get('/api/osint/username/:username', async (req, res) => {
    try {
      const { username } = req.params;

      // Basic username validation
      const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
      if (!usernameRegex.test(username) || username.length < 1 || username.length > 30) {
        return res.status(400).json({ error: 'Invalid username format' });
      }

      // List of platforms to check
      const platforms = [
        { name: 'GitHub', url: `https://github.com/${username}`, checkType: 'status' },
        { name: 'Twitter', url: `https://twitter.com/${username}`, checkType: 'status' },
        { name: 'Instagram', url: `https://instagram.com/${username}`, checkType: 'status' },
        { name: 'Reddit', url: `https://reddit.com/user/${username}`, checkType: 'status' },
        { name: 'YouTube', url: `https://youtube.com/@${username}`, checkType: 'status' },
        { name: 'Medium', url: `https://medium.com/@${username}`, checkType: 'status' },
        { name: 'LinkedIn', url: `https://linkedin.com/in/${username}`, checkType: 'status' }
      ];

      let formatted = `╭─ Username availability check: ${username}\n`;

      const checks = await Promise.allSettled(
        platforms.map(async (platform) => {
          try {
            const response = await fetch(platform.url, {
              method: 'HEAD',
              redirect: 'follow',
              headers: {
                'User-Agent': 'ARCHIMEDES-OSINT/1.0'
              }
            });

            const exists = response.status === 200;
            return { platform: platform.name, exists, status: response.status };
          } catch (error) {
            return { platform: platform.name, exists: false, status: 'error' };
          }
        })
      );

      checks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { platform, exists, status } = result.value;
          const indicator = exists ? '❌' : '✅';
          const statusText = exists ? 'Taken' : 'Available';
          formatted += `├─ ${indicator} ${platform}: ${statusText}\n`;
        } else {
          formatted += `├─ ⚠️  ${platforms[index].name}: Check failed\n`;
        }
      });

      formatted += `╰─ Username check complete`;

      res.json({ formatted });

    } catch (error) {
      console.error('Username check error:', error);
      res.status(500).json({ error: 'Username check failed' });
    }
  });

  // Simple test endpoint
  app.get('/api/osint/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
  });

  // Traceroute OSINT endpoint
  app.get('/api/osint/traceroute/:target', async (req, res) => {
    const { target } = req.params;

    // Simple validation
    if (!target || target.length === 0) {
      return res.status(400).json({ error: 'Target required' });
    }

    try {
      // Try DNS resolution first
      const addresses = await dns.resolve4(target);

      let formatted = `╭─ Network Analysis for ${target}\n`;
      formatted += `├─ DNS Resolution: SUCCESS\n`;
      formatted += `├─ Resolved to: ${addresses[0]}\n`;
      if (addresses.length > 1) {
        formatted += `├─ Additional IPs: ${addresses.slice(1).join(', ')}\n`;
      }
      formatted += `├─ Status: System traceroute not available\n`;
      formatted += `├─ Note: Basic network connectivity confirmed via DNS\n`;
      formatted += `╰─ Analysis complete`;

      res.json({ formatted });

    } catch (error: any) {
      let formatted = `╭─ Network Analysis for ${target}\n`;
      formatted += `├─ DNS Resolution: FAILED\n`;
      formatted += `├─ Error: Target unreachable or invalid\n`;
      formatted += `╰─ Analysis complete`;

      res.json({ formatted });
    }
  });

  // Subdomain enumeration OSINT endpoint
  app.get('/api/osint/subdomains/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ Subdomain Enumeration for ${domain}\n`;

      // Common subdomain wordlist
      const commonSubdomains = [
        'www', 'mail', 'email', 'webmail', 'admin', 'administrator', 'login',
        'api', 'app', 'apps', 'dev', 'development', 'test', 'testing', 'stage', 'staging',
        'prod', 'production', 'blog', 'forum', 'shop', 'store', 'cdn', 'static',
        'assets', 'media', 'images', 'img', 'js', 'css', 'files', 'downloads',
        'ftp', 'sftp', 'ssh', 'vpn', 'remote', 'secure', 'ssl', 'tls',
        'db', 'database', 'mysql', 'postgres', 'redis', 'mongo', 'elasticsearch',
        'search', 'help', 'support', 'docs', 'documentation', 'wiki',
        'mobile', 'm', 'beta', 'alpha', 'demo', 'preview', 'portal'
      ];

      const foundSubdomains: string[] = [];
      const maxConcurrent = 5;

      // Process subdomains in batches to avoid overwhelming DNS
      for (let i = 0; i < commonSubdomains.length; i += maxConcurrent) {
        const batch = commonSubdomains.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async (subdomain) => {
          const fullDomain = `${subdomain}.${domain}`;
          try {
            const addresses = await dns.resolve4(fullDomain);
            if (addresses && addresses.length > 0) {
              return { subdomain: fullDomain, ip: addresses[0] };
            }
          } catch (error) {
            // Subdomain doesn't exist, ignore
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result) {
            foundSubdomains.push(`${result.subdomain} → ${result.ip}`);
          }
        });

        // Small delay between batches to be respectful
        if (i + maxConcurrent < commonSubdomains.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (foundSubdomains.length > 0) {
        formatted += `├─ Found ${foundSubdomains.length} active subdomains:\n`;
        foundSubdomains.forEach((subdomain, index) => {
          const prefix = index === foundSubdomains.length - 1 ? '╰─' : '├─';
          formatted += `${prefix} ${subdomain}\n`;
        });
      } else {
        formatted += `├─ No common subdomains discovered\n`;
        formatted += `╰─ Try advanced enumeration tools for comprehensive scanning`;
      }

      if (foundSubdomains.length > 0 && foundSubdomains.length < commonSubdomains.length) {
        formatted += `╰─ Scanned ${commonSubdomains.length} common patterns`;
      }

      res.json({ formatted });

    } catch (error) {
      console.error('Subdomain enumeration error:', error);
      res.status(500).json({ error: 'Subdomain enumeration failed' });
    }
  });

  // SSL/TLS Certificate Analysis endpoint
  app.get('/api/osint/ssl/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ SSL/TLS Certificate Analysis for ${domain}\n`;

      try {
        // Get certificate information via HTTPS connection
        const https = require('https');
        const { URL } = require('url');

        const checkSSL = new Promise((resolve, reject) => {
          const options = {
            hostname: domain,
            port: 443,
            method: 'HEAD',
            timeout: 10000,
            rejectUnauthorized: false // Allow self-signed certs for analysis
          };

          const req = https.request(options, (res: any) => {
            const cert = res.connection.getPeerCertificate(true);
            resolve(cert);
          });

          req.on('error', (error: any) => {
            reject(error);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('SSL connection timeout'));
          });

          req.end();
        });

        const cert: any = await checkSSL;

        if (cert && cert.subject) {
          formatted += `├─ Certificate Found: ✅\n`;
          formatted += `├─ Subject: ${cert.subject.CN || 'N/A'}\n`;
          formatted += `├─ Issuer: ${cert.issuer.CN || cert.issuer.O || 'Unknown'}\n`;
          formatted += `├─ Valid From: ${new Date(cert.valid_from).toISOString().split('T')[0]}\n`;
          formatted += `├─ Valid To: ${new Date(cert.valid_to).toISOString().split('T')[0]}\n`;

          // Check if certificate is expired
          const now = new Date();
          const validTo = new Date(cert.valid_to);
          const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            formatted += `├─ Status: ❌ EXPIRED (${Math.abs(daysUntilExpiry)} days ago)\n`;
          } else if (daysUntilExpiry < 30) {
            formatted += `├─ Status: ⚠️ EXPIRING SOON (${daysUntilExpiry} days)\n`;
          } else {
            formatted += `├─ Status: ✅ VALID (${daysUntilExpiry} days remaining)\n`;
          }

          // Alternative names (SAN)
          if (cert.subjectaltname) {
            const altNames = cert.subjectaltname
              .split(', ')
              .map((name: string) => name.replace('DNS:', ''))
              .slice(0, 5); // Limit to first 5 for readability
            formatted += `├─ Alt Names: ${altNames.join(', ')}\n`;
            if (cert.subjectaltname.split(', ').length > 5) {
              formatted += `├─ ... and ${cert.subjectaltname.split(', ').length - 5} more\n`;
            }
          }

          // Serial number and fingerprint
          if (cert.serialNumber) {
            formatted += `├─ Serial: ${cert.serialNumber.substring(0, 20)}...\n`;
          }

        } else {
          formatted += `├─ Certificate: ❌ Not found or invalid\n`;
        }

      } catch (sslError: any) {
        formatted += `├─ Certificate: ❌ Unable to retrieve\n`;
        formatted += `├─ Error: ${sslError.message}\n`;

        // Try to determine if SSL is available at all
        try {
          const response = await fetch(`https://${domain}`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          formatted += `├─ HTTPS Available: ✅ (Status: ${response.status})\n`;
        } catch (httpsError) {
          formatted += `├─ HTTPS Available: ❌\n`;
        }
      }

      formatted += `╰─ SSL analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('SSL analysis error:', error);
      res.status(500).json({ error: 'SSL analysis failed' });
    }
  });

  // Reverse IP Lookup endpoint
  app.get('/api/osint/reverse-ip/:ip', async (req, res) => {
    try {
      const { ip } = req.params;

      // Validate IP format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      let formatted = `╭─ Reverse IP Lookup for ${ip}\n`;

      try {
        // Perform reverse DNS lookup to get hostnames
        const hostnames = await dns.reverse(ip);

        if (hostnames && hostnames.length > 0) {
          formatted += `├─ Found ${hostnames.length} hostname(s):\n`;

          const uniqueHostnames = Array.from(new Set(hostnames));
          uniqueHostnames.forEach((hostname, index) => {
            const prefix = index === uniqueHostnames.length - 1 ? '╰─' : '├─';
            formatted += `${prefix} ${hostname}\n`;
          });

          // Try to extract domain patterns to find related domains
          const domains = uniqueHostnames
            .map(hostname => {
              const parts = hostname.split('.');
              if (parts.length >= 2) {
                return parts.slice(-2).join('.');
              }
              return hostname;
            })
            .filter((domain, index, arr) => arr.indexOf(domain) === index);

          if (domains.length > 1) {
            formatted += `├─ Related domains detected: ${domains.slice(0, 5).join(', ')}`;
            if (domains.length > 5) {
              formatted += ` and ${domains.length - 5} more`;
            }
            formatted += '\n';
          }

        } else {
          formatted += `├─ No hostnames found for this IP\n`;
          formatted += `├─ IP may not have reverse DNS configured\n`;
        }
      } catch (reverseError) {
        formatted += `├─ Reverse DNS lookup failed\n`;
        formatted += `├─ IP may not have PTR records configured\n`;
      }

      formatted += `╰─ Reverse IP analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Reverse IP lookup error:', error);
      res.status(500).json({ error: 'Reverse IP lookup failed' });
    }
  });

  // Port Scanning endpoint
  app.get('/api/osint/portscan/:target', async (req, res) => {
    try {
      const { target } = req.params;

      // Validate target format (IP or domain)
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!ipRegex.test(target) && !domainRegex.test(target)) {
        return res.status(400).json({ error: 'Invalid IP address or domain format' });
      }

      let formatted = `╭─ Port Scan for ${target}\n`;

      // Common ports to scan
      const commonPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 993, 995, 1723, 3389, 5432, 3306];
      const net = require('net');
      const openPorts: number[] = [];

      formatted += `├─ Scanning ${commonPorts.length} common ports...\n`;

      // Scan ports concurrently but with limited concurrency
      const maxConcurrent = 10;
      for (let i = 0; i < commonPorts.length; i += maxConcurrent) {
        const batch = commonPorts.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(port => {
          return new Promise<number | null>((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
              socket.destroy();
              resolve(null);
            }, 2000); // 2 second timeout per port

            socket.on('connect', () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(port);
            });

            socket.on('error', () => {
              clearTimeout(timeout);
              resolve(null);
            });

            try {
              socket.connect(port, target);
            } catch (error) {
              clearTimeout(timeout);
              resolve(null);
            }
          });
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(port => {
          if (port !== null) {
            openPorts.push(port);
          }
        });

        // Small delay between batches to be respectful
        if (i + maxConcurrent < commonPorts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (openPorts.length > 0) {
        formatted += `├─ Found ${openPorts.length} open ports:\n`;

        const portServices: { [key: number]: string } = {
          21: 'FTP',
          22: 'SSH',
          23: 'Telnet',
          25: 'SMTP',
          53: 'DNS',
          80: 'HTTP',
          110: 'POP3',
          135: 'RPC',
          139: 'NetBIOS',
          143: 'IMAP',
          443: 'HTTPS',
          993: 'IMAPS',
          995: 'POP3S',
          1723: 'PPTP',
          3389: 'RDP',
          5432: 'PostgreSQL',
          3306: 'MySQL'
        };

        openPorts.forEach((port, index) => {
          const service = portServices[port] || 'Unknown';
          const prefix = index === openPorts.length - 1 ? '╰─' : '├─';
          formatted += `${prefix} Port ${port}/tcp (${service})\n`;
        });
      } else {
        formatted += `├─ No open ports found in common port range\n`;
        formatted += `├─ Target may have firewall protection or be offline\n`;
      }

      formatted += `╰─ Port scan complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Port scan error:', error);
      res.status(500).json({ error: 'Port scan failed' });
    }
  });

  // Technology Stack Detection endpoint
  app.get('/api/osint/tech/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ Technology Stack Analysis for ${domain}\n`;

      try {
        const url = `https://${domain}`;
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'ARCHIMEDES-TechScan/1.0'
          }
        });

        const headers = response.headers;
        const html = await response.text();

        const technologies: string[] = [];

        // Analyze HTTP headers
        const server = headers.get('server');
        if (server) {
          technologies.push(`Server: ${server}`);
        }

        const poweredBy = headers.get('x-powered-by');
        if (poweredBy) {
          technologies.push(`Powered By: ${poweredBy}`);
        }

        // Analyze HTML content for common technologies
        const htmlLower = html.toLowerCase();

        // Frameworks and Libraries
        if (htmlLower.includes('react') || html.includes('_jsx') || html.includes('React.')) {
          technologies.push('Frontend: React');
        }
        if (htmlLower.includes('vue.js') || htmlLower.includes('vue/dist')) {
          technologies.push('Frontend: Vue.js');
        }
        if (htmlLower.includes('angular') || htmlLower.includes('ng-')) {
          technologies.push('Frontend: Angular');
        }
        if (htmlLower.includes('jquery')) {
          technologies.push('Library: jQuery');
        }
        if (htmlLower.includes('bootstrap')) {
          technologies.push('CSS Framework: Bootstrap');
        }
        if (htmlLower.includes('tailwind')) {
          technologies.push('CSS Framework: Tailwind');
        }

        // CMS Detection
        if (htmlLower.includes('wp-content') || htmlLower.includes('wordpress')) {
          technologies.push('CMS: WordPress');
        }
        if (htmlLower.includes('drupal')) {
          technologies.push('CMS: Drupal');
        }
        if (htmlLower.includes('/ghost/')) {
          technologies.push('CMS: Ghost');
        }

        // E-commerce
        if (htmlLower.includes('shopify')) {
          technologies.push('E-commerce: Shopify');
        }
        if (htmlLower.includes('woocommerce')) {
          technologies.push('E-commerce: WooCommerce');
        }

        // Analytics and Tracking
        if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag')) {
          technologies.push('Analytics: Google Analytics');
        }
        if (htmlLower.includes('gtm.js') || htmlLower.includes('googletagmanager')) {
          technologies.push('Tag Manager: Google Tag Manager');
        }

        // CDN Detection
        if (headers.get('cf-ray') || headers.get('cf-cache-status')) {
          technologies.push('CDN: Cloudflare');
        }
        if (headers.get('x-amz-cf-id')) {
          technologies.push('CDN: AWS CloudFront');
        }

        formatted += `├─ Response Status: ${response.status} ${response.statusText}\n`;

        if (technologies.length > 0) {
          formatted += `├─ Detected Technologies:\n`;
          technologies.forEach((tech, index) => {
            const prefix = index === technologies.length - 1 ? '│  ╰─' : '│  ├─';
            formatted += `${prefix} ${tech}\n`;
          });
        } else {
          formatted += `├─ No obvious technologies detected\n`;
        }

        // Check for common security headers
        const securityHeaders = [
          'strict-transport-security',
          'x-frame-options',
          'x-content-type-options',
          'content-security-policy'
        ];

        const presentHeaders = securityHeaders.filter(header => headers.get(header));
        if (presentHeaders.length > 0) {
          formatted += `├─ Security Headers: ${presentHeaders.length}/${securityHeaders.length} present\n`;
        }

      } catch (techError: any) {
        formatted += `├─ Unable to analyze: ${techError.message}\n`;
      }

      formatted += `╰─ Technology analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Technology analysis error:', error);
      res.status(500).json({ error: 'Technology analysis failed' });
    }
  });

  // Comprehensive OSINT Report endpoint
  app.get('/api/osint/report/:target', async (req, res) => {
    try {
      const { target } = req.params;

      // Determine if target is IP or domain
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const isIP = ipRegex.test(target);

      let formatted = `╭─ Comprehensive OSINT Report for ${target}\n`;
      formatted += `├─ Target Type: ${isIP ? 'IP Address' : 'Domain'}\n`;
      formatted += `├─ Report Generated: ${new Date().toISOString()}\n`;
      formatted += `├─ Gathering intelligence from multiple sources...\n`;
      formatted += `│\n`;

      const results: { [key: string]: any } = {};

      // For domains, gather comprehensive intelligence
      if (!isIP) {
        // WHOIS Lookup
        try {
          const whoisRes = await fetch(`http://localhost:5000/api/osint/whois/${target}`);
          const whoisData = await whoisRes.json();
          results.whois = whoisData;
        } catch (e) {
          results.whois = { error: 'WHOIS lookup failed' };
        }

        // DNS Records
        try {
          const dnsRes = await fetch(`http://localhost:5000/api/osint/dns/${target}`);
          const dnsData = await dnsRes.json();
          results.dns = dnsData;
        } catch (e) {
          results.dns = { error: 'DNS lookup failed' };
        }

        // SSL Certificate
        try {
          const sslRes = await fetch(`http://localhost:5000/api/osint/ssl/${target}`);
          const sslData = await sslRes.json();
          results.ssl = sslData;
        } catch (e) {
          results.ssl = { error: 'SSL analysis failed' };
        }

        // Technology Stack
        try {
          const techRes = await fetch(`http://localhost:5000/api/osint/tech/${target}`);
          const techData = await techRes.json();
          results.tech = techData;
        } catch (e) {
          results.tech = { error: 'Technology analysis failed' };
        }

        // Subdomain Enumeration (limited for report)
        try {
          const subdomainsRes = await fetch(`http://localhost:5000/api/osint/subdomains/${target}`);
          const subdomainsData = await subdomainsRes.json();
          results.subdomains = subdomainsData;
        } catch (e) {
          results.subdomains = { error: 'Subdomain enumeration failed' };
        }
      }

      // For both IPs and domains, resolve to IP if needed
      let resolvedIP = target;
      if (!isIP) {
        try {
          const addresses = await dns.resolve4(target);
          resolvedIP = addresses[0];
          results.resolvedIP = resolvedIP;
        } catch (e) {
          results.resolvedIP = null;
        }
      }

      // GeoIP for the resolved IP
      if (resolvedIP) {
        try {
          const geoipRes = await fetch(`http://localhost:5000/api/osint/geoip/${resolvedIP}`);
          const geoipData = await geoipRes.json();
          results.geoip = geoipData;
        } catch (e) {
          results.geoip = { error: 'GeoIP lookup failed' };
        }

        // Reverse IP if we have an IP
        try {
          const reverseRes = await fetch(`http://localhost:5000/api/osint/reverse-ip/${resolvedIP}`);
          const reverseData = await reverseRes.json();
          results.reverse = reverseData;
        } catch (e) {
          results.reverse = { error: 'Reverse IP lookup failed' };
        }
      }

      // Format comprehensive report
      formatted += `├─ DOMAIN INTELLIGENCE:\n`;
      if (results.whois && !results.whois.error) {
        const whoisLines = results.whois.formatted.split('\n').slice(1, 4);
        whoisLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      if (results.dns && !results.dns.error) {
        formatted += `│  DNS: Multiple record types detected\n`;
      }

      if (results.ssl && !results.ssl.error) {
        const sslLines = results.ssl.formatted.split('\n').slice(1, 3);
        sslLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      formatted += `│\n`;
      formatted += `├─ INFRASTRUCTURE ANALYSIS:\n`;

      if (results.geoip && !results.geoip.error) {
        const geoLines = results.geoip.formatted.split('\n').slice(1, 4);
        geoLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      if (results.reverse && !results.reverse.error) {
        formatted += `│  Multiple domains may share this infrastructure\n`;
      }

      formatted += `│\n`;
      formatted += `├─ TECHNOLOGY STACK:\n`;
      if (results.tech && !results.tech.error) {
        const techLines = results.tech.formatted.split('\n').slice(2, 6);
        techLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      } else {
        formatted += `│  Technology analysis unavailable\n`;
      }

      formatted += `│\n`;
      formatted += `├─ ATTACK SURFACE:\n`;
      if (results.subdomains && !results.subdomains.error) {
        const subdomainCount = (results.subdomains.formatted.match(/Found (\d+) active/)?.[1]) || 'Unknown';
        formatted += `│  Subdomains discovered: ${subdomainCount}\n`;
      }
      formatted += `│  Recommend: Port scan, directory enumeration\n`;

      formatted += `│\n`;
      formatted += `├─ RECOMMENDATIONS:\n`;
      formatted += `│  • Run detailed port scan: portscan ${resolvedIP || target}\n`;
      formatted += `│  • Check HTTP headers: headers https://${target}\n`;
      formatted += `│  • Search historical data: wayback https://${target}\n`;
      formatted += `│  • Verify username patterns: username ${target.split('.')[0]}\n`;
      formatted += `│\n`;
      formatted += `╰─ Comprehensive OSINT report complete`;

      res.json({ formatted, data: results });

    } catch (error) {
      console.error('OSINT report error:', error);
      res.status(500).json({ error: 'OSINT report generation failed' });
    }
  });

  // MISP Galaxy Threat Actors endpoint
  app.get('/api/osint/threat-actors', async (req, res) => {
    try {
      console.log('🎯 Fetching MISP Galaxy threat actors...');

      const response = await fetch('https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json', {
        signal: AbortSignal.timeout(10000),        headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
      });

      if (!response.ok) {
        throw new Error(`GitHub fetch failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.values || !Array.isArray(data.values)) {
        throw new Error('Invalid MISP Galaxy data format');
      }

      // Format the threat actor data for terminal display
      let formatted = `╭─ MISP Galaxy Threat Actors Intelligence\n`;
      formatted += `├─ Source: ${data.source || 'MISP Project'}\n`;
      formatted += `├─ Type: ${data.type}\n`;
      formatted += `├─ Total Actors: ${data.values.length}\n`;
      formatted += `├─ Last Updated: ${new Date().toISOString().split('T')[0]}\n`;
      formatted += `├─\n`;
      formatted += `├─ Top 20 Current Threat Actors:\n`;
      formatted += `├─\n`;

      // Sort by attribution confidence and take top 20
      const sortedActors = data.values
        .filter((actor: any) => actor.value && actor.description)
        .sort((a: any, b: any) => {
          const aConfidence = parseInt(a.meta?.['attribution-confidence'] || '0');
          const bConfidence = parseInt(b.meta?.['attribution-confidence'] || '0');
          return bConfidence - aConfidence;
        })
        .slice(0, 20);

      sortedActors.forEach((actor: any, index: number) => {
        const confidence = actor.meta?.['attribution-confidence'] || 'Unknown';
        const country = actor.meta?.country || 'Unknown';
        const synonyms = actor.meta?.synonyms?.slice(0, 3)?.join(', ') || 'None';
        const description = actor.description.length > 100
          ? actor.description.substring(0, 97) + '...'
          : actor.description;

        formatted += `├─ ${index + 1}. ${actor.value}\n`;
        formatted += `│  ├─ Country: ${country}\n`;
        formatted += `│  ├─ Confidence: ${confidence}%\n`;
        formatted += `│  ├─ Aliases: ${synonyms}\n`;
        formatted += `│  ├─ Description: ${description}\n`;
        if (actor.meta?.refs && actor.meta.refs.length > 0) {
          formatted += `│  └─ References: ${actor.meta.refs.slice(0, 2).join(', ')}\n`;
        }
        formatted += `├─\n`;
      });

      formatted += `└─ Use 'threat-actors <name>' for detailed actor information\n`;

      res.json({
        formatted,
        count: data.values.length,
        source: 'MISP Galaxy',
        type: 'threat-actors'
      });

    } catch (error) {
      console.error('❌ Threat actors fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch threat actor intelligence',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // MISP Galaxy specific threat actor lookup
  app.get('/api/osint/threat-actors/:name', async (req, res) => {
    try {
      const { name } = req.params;
      console.log(`🎯 Looking up threat actor: ${name}`);

      const response = await fetch('https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json', {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
      });

      if (!response.ok) {
        throw new Error(`GitHub fetch failed: ${response.status}`);
      }

      const data = await response.json();

      // Search for the specific threat actor
      const actor = data.values.find((actor: any) =>
        actor.value.toLowerCase().includes(name.toLowerCase()) ||
        actor.meta?.synonyms?.some((synonym: string) =>
          synonym.toLowerCase().includes(name.toLowerCase())
        )
      );

      if (!actor) {
        return res.status(404).json({
          error: `Threat actor '${name}' not found in MISP Galaxy database`,
          suggestion: 'Try using partial names or known aliases'
        });
      }

      // Format detailed actor information
      let formatted = `╭─ Threat Actor: ${actor.value}\n`;
      formatted += `├─ UUID: ${actor.uuid}\n`;
      formatted += `├─\n`;
      formatted += `├─ Description:\n`;
      formatted += `├─ ${actor.description}\n`;
      formatted += `├─\n`;

      if (actor.meta) {
        const meta = actor.meta;

        if (meta.country) {
          formatted += `├─ Country/Origin: ${meta.country}\n`;
        }

        if (meta['attribution-confidence']) {
          formatted += `├─ Attribution Confidence: ${meta['attribution-confidence']}%\n`;
        }

        if (meta['cfr-suspected-state-sponsor']) {
          formatted += `├─ Suspected State Sponsor: ${meta['cfr-suspected-state-sponsor']}\n`;
        }

        if (meta['cfr-suspected-victims']) {
          formatted += `├─ Known Victims: ${meta['cfr-suspected-victims'].slice(0, 5).join(', ')}\n`;
          if (meta['cfr-suspected-victims'].length > 5) {
            formatted += `├─   (and ${meta['cfr-suspected-victims'].length - 5} more)\n`;
          }
        }

        if (meta['cfr-target-category']) {
          formatted += `├─ Target Categories: ${meta['cfr-target-category'].join(', ')}\n`;
        }

        if (meta['cfr-type-of-incident']) {
          formatted += `├─ Incident Type: ${meta['cfr-type-of-incident']}\n`;
        }

        if (meta.synonyms) {
          formatted += `├─ Known Aliases: ${meta.synonyms.join(', ')}\n`;
        }

        if (meta.refs) {
          formatted += `├─\n├─ References:\n`;
          meta.refs.slice(0, 8).forEach((ref: string, index: number) => {
            formatted += `├─ ${index + 1}. ${ref}\n`;
          });
          if (meta.refs.length > 8) {
            formatted += `├─   (and ${meta.refs.length - 8} more references)\n`;
          }
        }
      }

      formatted += `└─ Intelligence sourced from MISP Galaxy\n`;

      res.json({
        formatted,
        actor: actor.value,
        source: 'MISP Galaxy'
      });

    } catch (error) {
      console.error('❌ Threat actor lookup error:', error);
      res.status(500).json({
        error: 'Failed to lookup threat actor',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // SpiderFoot API endpoint
  app.post("/api/spiderfoot", async (req, res) => {
    try {
      // Validate request body using Zod
      const spiderFootSchema = z.object({
        target: z.string().min(1, 'Target is required'),
        scanType: z.string().default('footprint')
      });

      const validationResult = spiderFootSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const { target, scanType } = validationResult.data;
      const cleanTarget = target.toLowerCase().trim();

      // Generate mock SpiderFoot results
      const generateFindings = (type: string, count: number) => {
        const findings = [];
        const confidenceLevels = ['High', 'Medium', 'Low'];

        for (let i = 0; i < count; i++) {
          findings.push({
            type: type,
            data: `${type}_data_${i}_for_${cleanTarget}`,
            source: `Module_${type.replace(/\s/g, '_')}`,
            confidence: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)]
          });
        }
        return findings;
      };

      const mockResults = {
        modules: {
          'DNS Records': { findings: generateFindings('DNS A Record', 3) },
          'WHOIS Data': { findings: generateFindings('WHOIS Information', 2) },
          'SSL Certificate': { findings: generateFindings('SSL/TLS Certificate', 2) },
          'Email Addresses': { findings: generateFindings('Email Address', 5) },
          'Social Media': { findings: generateFindings('Social Media Profile', 4) },
          'Breach Data': { findings: generateFindings('Data Breach Record', 1) },
          'Vulnerabilities': { findings: generateFindings('CVE', 2) },
          'Subdomains': { findings: generateFindings('Subdomain', 8) },
          'IP Intelligence': { findings: generateFindings('IP Geolocation', 2) }
        },
        summary: {
          total_findings: 0,
          high_confidence: 0,
          medium_confidence: 0,
          low_confidence: 0
        },
        metadata: {
          target: cleanTarget,
          scan_type: scanType,
          timestamp: new Date().toISOString(),
          modules_used: Object.keys({
            'DNS Records': true,
            'WHOIS Data': true,
            'SSL Certificate': true,
            'Email Addresses': true,
            'Social Media': true,
            'Breach Data': true,
            'Vulnerabilities': true,
            'Subdomains': true,
            'IP Intelligence': true
          })
        }
      };

      // Calculate summary statistics
      let totalFindings = 0;
      let highConfidence = 0;
      let mediumConfidence = 0;
      let lowConfidence = 0;

      Object.values(mockResults.modules).forEach(module => {
        module.findings.forEach(finding => {
          totalFindings++;
          if (finding.confidence === 'High') highConfidence++;
          else if (finding.confidence === 'Medium') mediumConfidence++;
          else lowConfidence++;
        });
      });

      mockResults.summary = {
        total_findings: totalFindings,
        high_confidence: highConfidence,
        medium_confidence: mediumConfidence,
        low_confidence: lowConfidence
      };

      res.json(mockResults);
    } catch (error) {
      console.error('SpiderFoot error:', error);
      res.status(500).json({
        error: 'OSINT scan failed',
        modules: {},
        summary: {
          total_findings: 0,
          high_confidence: 0,
          medium_confidence: 0,
          low_confidence: 0
        },
        metadata: {
          target: req.body.target || 'unknown',
          scan_type: req.body.scanType || 'footprint',
          timestamp: new Date().toISOString(),
          modules_used: []
        }
      });
    }
  });

  // Wolfram Alpha query endpoint
  app.get('/api/wolfram/query', async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const { queryWolfram } = await import('./wolfram-service');
      const result = await queryWolfram(query);

      res.json(result);
    } catch (error) {
      console.error('Wolfram Alpha query error:', error);
      res.status(500).json({
        error: 'Failed to query Wolfram Alpha',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}