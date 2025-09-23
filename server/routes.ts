import type { Express } from "express";
import { createServer, type Server } from "http";
import https from "https";
import { storage } from "./storage";
import { messageSchema, type Message, insertUserPreferencesSchema, insertDocumentSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { weatherService } from "./weather-service";
import { knowledgeService } from "./knowledge-service";
import { BbsService } from "./bbs-service";
import { gutendxService } from "./gutendx-service";
import { marketstackService } from "./marketstack-service";
import { radioGardenService } from "./radio-garden-service";
import multer from "multer";
import { z } from "zod";
import WebSocket, { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as dns } from 'dns';
import { SshwiftyService } from './sshwifty-service';
import { mudService } from './mud-service';
import { insertMudProfileSchema, insertMudSessionSchema } from '@shared/schema';
import session from 'express-session';
import { parse } from 'cookie';
import signature from 'cookie-signature';
import { getSession } from './replitAuth';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // SPACEWAR game endpoint (must be BEFORE Vite middleware to avoid processing)
  app.get('/spacewar.html', (req, res) => {
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
let limbAnimationSpeed;
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
const ufoSpawnInterval = 20 * 60;
const ufoSpeed = 5;
const ufoPoints = 50;
const ufoLaserSpeed = 5;
const ufoFireProbability = 1.0;
const invaderFireProbability = 0.01;
const nyanCatSpawnInterval = 5 * 60;
const nyanCatSpeed = 6;
const nyanCatBombProbability = 0.1;
const pointsPerHit = 10;
const blinkInterval = 30;
const ufoHaloSize = 60;
const cityBlockWidth = 30;
const cityBlockHeight = 20;
const numCityBlocks = 35;
const skylineLevel = -80; // Y level where skyline starts (relative to center)

function setup() {
  createCanvas(windowWidth, windowHeight);
  limbAnimationSpeed = TWO_PI / 20;
  spawnInvaders();
  initializeCitySkyline();
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

function initializeCitySkyline() {
  cityBlocks = [];
  let totalWidth = numCityBlocks * cityBlockWidth;
  let startX = -totalWidth / 2;
  let groundY = height / 2 - 80; // Position skyline above bottom of screen
  
  for (let i = 0; i < numCityBlocks; i++) {
    let buildingHeight = random(3, 8); // Random building heights
    for (let k = 0; k < buildingHeight; k++) {
      cityBlocks.push({
        x: startX + i * cityBlockWidth,
        y: groundY - k * cityBlockHeight,
        width: cityBlockWidth,
        height: cityBlockHeight,
        destroyed: false,
        buildingId: i // Track which building this belongs to
      });
    }
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

  if (pattern === 'wheel') {
    for (let i = 0; i < numInvaders; i++) {
      let angle = (TWO_PI / numInvaders) * i;
      invaders.push({
        angle: angle,
        color: color(0, random(100, 200), 0),
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
        color: color(0, random(100, 200), 0),
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
        color: color(0, random(100, 200), 0),
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
        color: color(0, random(100, 200), 0),
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
    fill(0, 255, 0);
    noStroke();
    rect(laser.x, laser.y, 5, 5);
  }

  const { speed, spread } = getLevelModifiers();
  const limbOffset = sin(frameCount * limbAnimationSpeed) * limbAnimationAmplitude;
  for (let i = invaders.length - 1; i >= 0; i--) {
    let invader = invaders[i];
    let x, y;
    
    if (invader.pattern === 'wheel') {
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
    }
    
    push();
    translate(x, y);
    fill(0, 255, 0, glowAlpha);
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
      
      // Prevent invaders from flying below skyline level
      if (y > height / 2 + skylineLevel - 30) {
        y = height / 2 + skylineLevel - 30;
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
        
        // Remove invader and laser
        invaders.splice(j, 1);
        playerLasers.splice(i, 1);
        score += pointsPerHit;
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

  fill(0, 255, 0);
  textSize(20);
  text("Score: " + score, -width / 2 + 20, -height / 2 + 40);
  text("Level: " + level, -width / 2 + 20, -height / 2 + 70);
  text("Invaders: " + invaders.length, -width / 2 + 20, -height / 2 + 100);
  
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

function renderCitySkyline() {
  for (let block of cityBlocks) {
    if (!block.destroyed) {
      fill(100, 100, 200); // Blue-gray city color
      stroke(150, 150, 255);
      strokeWeight(1);
      rect(block.x, block.y, block.width, block.height);
    }
  }
  
  // Render turrets on the sides
  renderTurrets();
}

function renderTurrets() {
  let groundY = height / 2 - 80;
  let leftTurretX = -width / 2 + 30;
  let rightTurretX = width / 2 - 70;
  let turretHeight = 180; // Make turrets much taller than skyline
  
  // Left turret
  fill(80, 80, 120);
  stroke(120, 120, 180);
  strokeWeight(2);
  rect(leftTurretX, groundY - turretHeight, 40, turretHeight); // Tall base
  fill(60, 60, 100);
  rect(leftTurretX + 5, groundY - turretHeight - 20, 30, 25); // Top section
  rect(leftTurretX + 10, groundY - turretHeight - 35, 20, 20); // Cannon mount
  stroke(255, 100, 100);
  strokeWeight(6);
  line(leftTurretX + 20, groundY - turretHeight - 25, leftTurretX + 40, groundY - turretHeight - 30); // Cannon barrel
  
  // Right turret
  fill(80, 80, 120);
  stroke(120, 120, 180);
  strokeWeight(2);
  rect(rightTurretX, groundY - turretHeight, 40, turretHeight); // Tall base
  fill(60, 60, 100);
  rect(rightTurretX + 5, groundY - turretHeight - 20, 30, 25); // Top section
  rect(rightTurretX + 10, groundY - turretHeight - 35, 20, 20); // Cannon mount
  stroke(255, 100, 100);
  strokeWeight(6);
  line(rightTurretX + 20, groundY - turretHeight - 25, rightTurretX, groundY - turretHeight - 30); // Cannon barrel
  
  noStroke();
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
        destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
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
        destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
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
        destroySkylineBlock(j, block.x + block.width/2, block.y + block.height/2);
        nyanCatBombs.splice(i, 1);
        break;
      }
    }
  }
}

function destroySkylineBlock(blockIndex, explosionX, explosionY) {
  cityBlocks[blockIndex].destroyed = true;
  
  // Create explosion particles
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: explosionX,
      y: explosionY,
      vx: random(-4, 4),
      vy: random(-4, 4),
      lifetime: 40
    });
  }
}

function isSkylineDestroyed() {
  return cityBlocks.every(block => block.destroyed);
}

function gameOver() {
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
    initializeCitySkyline();
    spawnInvaders();
  }, 3000);
}

function mousePressed() {
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

  // Radio streaming endpoint (must be BEFORE auth middleware)
  app.get('/api/radio/stream', (req, res) => {
    const streamUrl = 'https://ice.somafm.com/groovesalad';
    
    // Parse the URL
    const url = new URL(streamUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ARCHIMEDES-Radio/1.0)',
        'Accept': 'audio/*',
        'Connection': 'keep-alive'
      }
    };
    
    const proxyReq = https.request(options, (proxyRes: any) => {
      // Set CORS and streaming headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      
      // Copy headers from the original stream
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Accept-Ranges', 'none');
      
      // Copy ICY headers if present (Shoutcast metadata)
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.startsWith('icy-')) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      console.log(`✅ Radio stream: ${proxyRes.statusCode} - ${proxyRes.headers['content-type']}`);
      
      if (proxyRes.statusCode !== 200) {
        console.log(`❌ Radio stream error: ${proxyRes.statusCode}`);
        res.status(503).json({ 
          error: 'Stream unavailable',
          status: proxyRes.statusCode 
        });
        return;
      }
      
      // Set status code
      res.status(proxyRes.statusCode);
      
      // Pipe the audio stream
      proxyRes.pipe(res);
      
      proxyRes.on('error', (error: any) => {
        console.error('❌ Stream error:', error);
        res.end();
      });
    });
    
    proxyReq.on('error', (error: any) => {
      console.error('❌ Radio proxy error:', error);
      res.status(503).json({ 
        error: 'Radio stream unavailable',
        message: 'Unable to connect to Soma FM Groove Salad stream'
      });
    });
    
    proxyReq.setTimeout(30000, () => {
      console.log('⏰ Radio stream timeout');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(503).json({ error: 'Stream timeout' });
      }
    });
    
    proxyReq.end();
  });

  // Setup authentication middleware
  await setupAuth(app);

  // Initialize services
  const bbsService = new BbsService();
  
  // Initialize starter data
  try {
    await bbsService.initializeStarterData();
    await bbsService.initializeVirtualSystems();
    console.log("✅ BBS service initialized successfully");
  } catch (error) {
    console.error("⚠️  BBS service initialization failed, continuing without initial data:", error instanceof Error ? error.message : String(error));
  }

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
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

  // MUD Profile routes
  app.get("/api/mud/profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getUserMudProfiles(userId);
      res.json(profiles);
    } catch (error) {
      console.error("Get MUD profiles error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/mud/profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validationResult = insertMudProfileSchema.safeParse({
        ...req.body,
        userId
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid profile data",
          details: validationResult.error.errors
        });
      }
      
      const profile = await storage.createMudProfile(validationResult.data);
      res.json(profile);
    } catch (error) {
      console.error("Create MUD profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/mud/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getMudProfile(req.params.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Ensure user owns this profile
      if (profile.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Get MUD profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/mud/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getMudProfile(req.params.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      if (profile.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const validationResult = insertMudProfileSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid profile data",
          details: validationResult.error.errors
        });
      }
      
      const updatedProfile = await storage.updateMudProfile(req.params.id, validationResult.data);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Update MUD profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/mud/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getMudProfile(req.params.id);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      if (profile.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteMudProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete MUD profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // MUD Session routes
  app.get("/api/mud/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserMudSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Get MUD sessions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/mud/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validationResult = insertMudSessionSchema.safeParse({
        ...req.body,
        userId
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid session data",
          details: validationResult.error.errors
        });
      }
      
      // If profileId is provided, validate ownership
      if (validationResult.data.profileId) {
        const profile = await storage.getMudProfile(validationResult.data.profileId);
        if (!profile || profile.userId !== userId) {
          return res.status(403).json({ error: "Profile access denied" });
        }
      }
      
      const session = await storage.createMudSession(validationResult.data);
      res.json(session);
    } catch (error) {
      console.error("Create MUD session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/mud/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const sessions = await storage.getUserMudSessions(req.user.claims.sub);
      const session = sessions.find(s => s.id === req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Get MUD session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/mud/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserMudSessions(userId);
      const session = sessions.find(s => s.id === req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const validationResult = insertMudSessionSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid session data",
          details: validationResult.error.errors
        });
      }
      
      // If profileId is being updated, validate ownership
      if (validationResult.data.profileId) {
        const profile = await storage.getMudProfile(validationResult.data.profileId);
        if (!profile || profile.userId !== userId) {
          return res.status(403).json({ error: "Profile access denied" });
        }
      }
      
      const updatedSession = await storage.updateMudSession(req.params.id, validationResult.data);
      res.json(updatedSession);
    } catch (error) {
      console.error("Update MUD session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/mud/sessions/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserMudSessions(userId);
      const session = sessions.find(s => s.id === req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      await storage.closeMudSession(session.sessionId);
      mudService.closeConnection(session.sessionId, 'Session closed via API');
      
      res.json({ success: true, message: 'Session closed' });
    } catch (error) {
      console.error("Close MUD session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chat endpoint (enhanced with user support)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, mode = "natural", sessionId } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validModes = ["natural", "technical"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }

      const currentSessionId = sessionId || randomUUID();
      
      // Check if user is authenticated to link conversation
      let userId = null;
      const user = req.user as any;
      if (req.isAuthenticated?.() && user?.claims?.sub) {
        userId = user.claims.sub;
      }
      
      // Add user message to conversation
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, userMessage);
      
      // Link conversation to user if authenticated
      if (userId) {
        const conversation = await storage.getConversation(currentSessionId);
        if (conversation && !conversation.userId) {
          // Update the conversation to link it to the user and persist in storage
          await storage.updateConversationUserId(currentSessionId, userId);
        }
      }
      
      // Get conversation history for context
      const conversation = await storage.getConversation(currentSessionId);
      const conversationHistory = Array.isArray(conversation?.messages) ? conversation.messages as Message[] : [];
      
      // Generate AI response using LLM with knowledge base integration
      const responseContent = await llmService.generateResponse(message, mode as "natural" | "technical", conversationHistory, userId);
      
      const assistantMessage = {
        role: "assistant" as const,
        content: responseContent,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, assistantMessage);
      
      res.json({
        response: responseContent,
        sessionId: currentSessionId,
        mode,
      });
      
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only allow text files
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'text/html',
        'text/xml',
      ];
      
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|json|csv|html|xml)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only text files are allowed'));
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
          // Convert buffer to string
          const content = file.buffer.toString('utf8');
          
          if (content.length === 0) {
            return { type: 'error', file: file.originalname, error: "File is empty" };
          }

          if (content.length > 5000000) { // 5MB text limit to match frontend
            return { type: 'error', file: file.originalname, error: "File content is too large (max 5MB)" };
          }

          // Process the document
          const document = await knowledgeService.processDocument(content, {
            userId,
            fileName: `${randomUUID()}-${file.originalname}`,
            originalName: file.originalname,
            fileSize: file.size.toString(),
            mimeType: file.mimetype,
          });

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
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
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
          errors.push({ file: 'Unknown', error: "Processing failed" });
        }
      });

      res.json({ 
        message: `Successfully uploaded ${results.length} of ${req.files.length} documents`,
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

  // Get user documents
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getUserDocuments(userId);
      
      // Return limited info for list view
      const documentsInfo = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        summary: doc.summary,
        keywords: doc.keywords,
        uploadedAt: doc.uploadedAt,
        lastAccessedAt: doc.lastAccessedAt,
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

  // Delete document
  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      
      const success = await knowledgeService.deleteDocument(documentId, userId);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Failed to delete document" });
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
      console.error("Multiple quotes error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quotes";
      res.status(500).json({ error: message });
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


  // BBS Directory API endpoints
  app.get("/api/bbs/systems", async (req, res) => {
    try {
      const category = req.query.category as string;
      const search = req.query.search as string;
      
      let systems;
      if (search) {
        systems = await bbsService.searchBbsSystems(search);
      } else if (category) {
        systems = await bbsService.getBbsByCategory(category);
      } else {
        systems = await bbsService.getAllBbsSystems();
      }
      
      res.json(systems);
    } catch (error) {
      console.error("BBS systems error:", error);
      res.status(500).json({ error: "Failed to fetch BBS systems" });
    }
  });

  app.get("/api/bbs/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const systems = await bbsService.getPopularBbsSystems(limit);
      res.json(systems);
    } catch (error) {
      console.error("Popular BBS error:", error);
      res.status(500).json({ error: "Failed to fetch popular BBS systems" });
    }
  });

  app.get("/api/bbs/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await bbsService.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("BBS favorites error:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/bbs/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bbsId, nickname } = req.body;
      
      if (!bbsId) {
        return res.status(400).json({ error: "BBS ID is required" });
      }
      
      await bbsService.addToFavorites(userId, bbsId, nickname);
      res.json({ success: true });
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  app.get("/api/bbs/virtual-systems", async (req, res) => {
    try {
      const systems = await bbsService.getVirtualSystems();
      res.json(systems);
    } catch (error) {
      console.error("Virtual systems error:", error);
      res.status(500).json({ error: "Failed to fetch virtual systems" });
    }
  });

  // Radio Garden API endpoints
  app.get('/api/radio/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }
      
      const stations = await radioGardenService.search(query, limit);
      res.json(stations);
    } catch (error) {
      console.error('Radio Garden search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/radio/popular', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const stations = await radioGardenService.getPopularStations(limit);
      res.json(stations);
    } catch (error) {
      console.error('Radio Garden popular stations error:', error);
      res.status(500).json({ error: 'Failed to get popular stations' });
    }
  });

  app.get('/api/radio/countries', async (req, res) => {
    try {
      const countries = await radioGardenService.getCountries();
      res.json(countries);
    } catch (error) {
      console.error('Radio Garden countries error:', error);
      res.status(500).json({ error: 'Failed to get countries' });
    }
  });

  app.get('/api/radio/channel/:channelId', async (req, res) => {
    try {
      const channelId = req.params.channelId;
      const channel = await radioGardenService.getChannelDetails(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      res.json(channel);
    } catch (error) {
      console.error('Radio Garden channel error:', error);
      res.status(500).json({ error: 'Failed to get channel details' });
    }
  });

  app.get('/api/radio/random', async (req, res) => {
    try {
      const station = await radioGardenService.getRandomStation();
      
      if (!station) {
        return res.status(404).json({ error: 'No stations available' });
      }
      
      res.json(station);
    } catch (error) {
      console.error('Radio Garden random station error:', error);
      res.status(500).json({ error: 'Failed to get random station' });
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

      console.log(`🔍 WHOIS lookup for: ${domain}`);

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

  app.get('/api/osint/dns/:domain', async (req, res) => {
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

  app.get('/api/osint/geoip/:ip', async (req, res) => {
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
        if (htmlLower.includes('angular') || html.includes('ng-')) {
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
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
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

  // theHarvester OSINT endpoint
  app.post('/api/theharvester', async (req, res) => {
    try {
      // Validate request body using Zod
      const harvestSchema = z.object({
        domain: z.string().min(1, 'Domain is required'),
        source: z.string().default('all'),
        limit: z.number().int().min(1).max(1000).default(100)
      });
      
      const validationResult = harvestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }
      
      const { domain, source, limit } = validationResult.data;

      const cleanDomain = domain.toLowerCase().trim();
      
      // Simulate progressive OSINT data gathering
      const mockResults = {
        emails: [
          `info@${cleanDomain}`,
          `contact@${cleanDomain}`,
          `admin@${cleanDomain}`,
          `support@${cleanDomain}`,
          `sales@${cleanDomain}`,
          `webmaster@${cleanDomain}`,
          `noreply@${cleanDomain}`,
          `security@${cleanDomain}`
        ].slice(0, Math.floor(Math.random() * 8) + 2),
        
        subdomains: [
          `www.${cleanDomain}`,
          `mail.${cleanDomain}`,
          `ftp.${cleanDomain}`,
          `api.${cleanDomain}`,
          `blog.${cleanDomain}`,
          `shop.${cleanDomain}`,
          `dev.${cleanDomain}`,
          `test.${cleanDomain}`,
          `staging.${cleanDomain}`,
          `cdn.${cleanDomain}`,
          `assets.${cleanDomain}`,
          `static.${cleanDomain}`
        ].slice(0, Math.floor(Math.random() * 12) + 3),
        
        ips: [
          `192.168.1.${Math.floor(Math.random() * 255)}`,
          `10.0.0.${Math.floor(Math.random() * 255)}`,
          `172.16.0.${Math.floor(Math.random() * 255)}`,
          `8.8.8.8`,
          `1.1.1.1`
        ].slice(0, Math.floor(Math.random() * 5) + 2),
        
        urls: [
          `https://${cleanDomain}`,
          `https://www.${cleanDomain}`,
          `https://${cleanDomain}/about`,
          `https://${cleanDomain}/contact`,
          `https://${cleanDomain}/login`,
          `https://${cleanDomain}/api`,
          `https://${cleanDomain}/admin`,
          `https://blog.${cleanDomain}`,
          `https://shop.${cleanDomain}/products`,
          `https://api.${cleanDomain}/v1`
        ].slice(0, Math.floor(Math.random() * 10) + 4),
        
        certificates: [
          `CN=${cleanDomain}, O=Example Organization, C=US`,
          `CN=*.${cleanDomain}, O=Example Organization, C=US`,
          `CN=www.${cleanDomain}, O=Wildcard Certificate, C=US`
        ].slice(0, Math.floor(Math.random() * 3) + 1),
        
        metadata: {
          domain: cleanDomain,
          source: source,
          timestamp: new Date().toISOString(),
          total_results: 0
        }
      };

      // Calculate total results
      mockResults.metadata.total_results = 
        mockResults.emails.length +
        mockResults.subdomains.length +
        mockResults.ips.length +
        mockResults.urls.length +
        mockResults.certificates.length;

      res.json(mockResults);
    } catch (error) {
      console.error('theHarvester error:', error);
      res.status(500).json({ 
        error: 'OSINT harvest failed',
        emails: [],
        subdomains: [],
        ips: [],
        urls: [],
        certificates: [],
        metadata: {
          domain: req.body.domain || 'unknown',
          source: req.body.source || 'all',
          timestamp: new Date().toISOString(),
          total_results: 0
        }
      });
    }
  });

  // CORS proxy for radio streaming - helps bypass CORS restrictions
  app.get("/api/radio-proxy", async (req, res) => {
    try {
      const streamUrl = req.query.url as string;
      
      if (!streamUrl) {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      console.log(`📻 Proxying radio stream: ${streamUrl}`);

      // Set CORS headers for audio streaming
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Fetch the stream and proxy it
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'RadioPlayer/1.0',
          'Accept': 'audio/*,*/*;q=0.1',
        }
      });

      if (!response.ok) {
        throw new Error(`Stream server returned ${response.status}`);
      }

      // Set appropriate headers for audio streaming
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      
      // Pipe the response directly
      if (response.body) {
        const reader = response.body.getReader();
        
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            console.error('Streaming error:', error);
            res.end();
          }
        };
        
        pump();
      }

    } catch (error) {
      console.error("Radio proxy error:", error);
      res.status(500).json({ error: "Failed to proxy stream" });
    }
  });

  // Chat system API endpoints
  
  // Get online users
  app.get("/api/chat/online-users", isAuthenticated, async (req: any, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error("Get online users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's direct chats
  app.get("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chats = await storage.getUserDirectChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Get direct chats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start or get existing direct chat
  app.post("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherUserId } = req.body;

      if (!otherUserId || otherUserId === userId) {
        return res.status(400).json({ error: "Invalid other user ID" });
      }

      const chat = await storage.getOrCreateDirectChat(userId, otherUserId);
      res.json(chat);
    } catch (error) {
      console.error("Create direct chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get messages for a specific chat
  app.get("/api/chat/conversations/:chatId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatId } = req.params;
      const { limit = 50 } = req.query;

      // Verify user has access to this chat
      const userChats = await storage.getUserDirectChats(userId);
      const hasAccess = userChats.some(chat => chat.id === chatId);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getChatMessages(chatId, parseInt(limit));
      res.json(messages);
    } catch (error) {
      console.error("Get chat messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message
  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatId, content, toUserId } = req.body;

      if (!content || !chatId || !toUserId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify user has access to this chat
      const userChats = await storage.getUserDirectChats(userId);
      const hasAccess = userChats.some(chat => chat.id === chatId);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const message = await storage.sendMessage({
        chatId,
        fromUserId: userId,
        toUserId,
        content,
        messageType: "text",
        isRead: false,
        isDelivered: false,
      });

      // Emit message via WebSocket to connected users
      chatWss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN && 
            (client.userId === userId || client.userId === toUserId)) {
          client.send(JSON.stringify({
            type: 'message',
            data: message
          }));
        }
      });

      res.json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark messages as read
  app.put("/api/chat/messages/:messageId/read", isAuthenticated, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get unread message count
  app.get("/api/chat/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize Sshwifty service
  const sshwiftyService = new SshwiftyService(httpServer);
  SshwiftyService.setupStaticRoutes(app);
  console.log('Sshwifty service initialized');

  // Create WebSocket server for chat system
  const chatWss = new WebSocketServer({
    server: httpServer,
    path: '/ws/chat'
  });

  // Handle chat WebSocket connections
  chatWss.on('connection', (ws: any, req) => {
    console.log('Chat WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            try {
              // Set user ID for this connection
              ws.userId = message.userId;
              
              // Update user presence as online (if method exists)
              try {
                await storage.updateUserPresence?.(message.userId, true, ws.id);
              } catch (error) {
                console.error('Error updating user presence:', error);
              }
              
              // Mark messages as delivered for this user (if method exists)  
              try {
                await storage.markMessagesAsDelivered?.(message.userId);
              } catch (error) {
                console.error('Error marking messages as delivered:', error);
              }
              
              // Broadcast user online status
              chatWss.clients.forEach((client: any) => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                  client.send(JSON.stringify({
                    type: 'user_online',
                    data: { userId: message.userId }
                  }));
                }
              });
              
              ws.send(JSON.stringify({
                type: 'auth_success',
                data: { connected: true }
              }));
            } catch (error) {
              console.error('Error during WebSocket auth:', error);
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Authentication failed' }
              }));
            }
            break;

          case 'typing':
            // Broadcast typing indicator to other user
            chatWss.clients.forEach((client: any) => {
              if (client.readyState === WebSocket.OPEN && 
                  client.userId === message.toUserId) {
                client.send(JSON.stringify({
                  type: 'typing',
                  data: {
                    fromUserId: ws.userId,
                    chatId: message.chatId,
                    isTyping: message.isTyping
                  }
                }));
              }
            });
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', async () => {
      console.log('Chat WebSocket client disconnected');
      
      if (ws.userId) {
        try {
          // Set user offline
          await storage.updateUserPresence?.(ws.userId, false);
          
          // Broadcast user offline status
          chatWss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
              client.send(JSON.stringify({
                type: 'user_offline',
                data: { userId: ws.userId }
              }));
            }
          });
        } catch (error) {
          console.error('Error updating user presence on disconnect:', error);
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('Chat WebSocket error:', error);
    });
  });

  console.log('Chat WebSocket server initialized on /ws/chat');

  // Helper function to authenticate WebSocket connections using Express sessions
  async function authenticateWebSocket(req: any): Promise<{ userId: string | null, isAuthenticated: boolean }> {
    return new Promise((resolve) => {
      try {
        // Use Express session parser directly on WebSocket upgrade request
        const sessionParser = getSession();
        
        // Create a mock response object for session parsing
        const mockRes: any = {
          getHeader: () => {},
          setHeader: () => {},
          end: () => {}
        };
        
        // Parse the session using Express session middleware
        sessionParser(req, mockRes, async () => {
          try {
            // Check if session exists and contains passport data
            if (!req.session) {
              console.log('WebSocket authentication failed: No session data');
              resolve({ userId: null, isAuthenticated: false });
              return;
            }

            if (!req.session.passport || !req.session.passport.user) {
              console.log('WebSocket authentication failed: No passport user in session');
              resolve({ userId: null, isAuthenticated: false });
              return;
            }

            // Get user from passport session data
            const user = req.session.passport.user;
            
            // Validate user claims and expiration
            if (!user.claims || !user.claims.sub) {
              console.log('WebSocket authentication failed: No user claims in session');
              resolve({ userId: null, isAuthenticated: false });
              return;
            }

            // Check if token is expired
            const now = Math.floor(Date.now() / 1000);
            if (user.expires_at && now > user.expires_at) {
              console.log('WebSocket authentication failed: Token expired');
              resolve({ userId: null, isAuthenticated: false });
              return;
            }

            const userId = user.claims.sub;
            console.log(`WebSocket authentication successful for user: ${userId}`);
            resolve({ userId, isAuthenticated: true });
            
          } catch (error) {
            console.error('WebSocket session validation error:', error);
            resolve({ userId: null, isAuthenticated: false });
          }
        });
        
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        resolve({ userId: null, isAuthenticated: false });
      }
    });
  }

  // Create WebSocket server for MUD connections
  const mudWss = new WebSocketServer({
    server: httpServer,
    path: '/ws/mud'
  });

  // Handle MUD WebSocket connections
  mudWss.on('connection', async (ws: any, req) => {
    console.log('MUD WebSocket client connected');
    
    // Authenticate WebSocket connection using Express sessions
    const auth = await authenticateWebSocket(req);
    
    if (!auth.isAuthenticated || !auth.userId) {
      console.log('MUD WebSocket authentication failed');
      ws.close(1008, 'Authentication failed - valid session required');
      return;
    }
    
    ws.userId = auth.userId;
    ws.isAuthenticated = true;
    
    console.log(`MUD WebSocket authenticated for user: ${auth.userId}`);
    
    // Send authentication success
    ws.send(JSON.stringify({
      type: 'auth_success',
      message: 'Authentication successful'
    }));

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // All operations require authentication (already validated on connection)
        
        if (message.type === 'connect') {
          const { host, port, sessionId, profileId } = message;
          
          // Validate required parameters
          if (!host || !port || !sessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Missing required parameters: host, port, sessionId'
            }));
            return;
          }

          // Validate session ownership - ensure sessionId belongs to authenticated user
          try {
            const existingSession = await storage.getMudSession(sessionId);
            if (existingSession && existingSession.userId !== ws.userId) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Session access denied - session belongs to another user'
              }));
              return;
            }
          } catch (error) {
            console.error('Session validation error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session validation failed'
            }));
            return;
          }

          // If profileId is provided, validate ownership
          if (profileId) {
            try {
              const profile = await storage.getMudProfile(profileId);
              if (!profile || profile.userId !== ws.userId) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Profile access denied'
                }));
                return;
              }
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Profile validation failed'
              }));
              return;
            }
          }

          // Create MUD connection using the MUD service
          try {
            await mudService.createConnection(ws, host, parseInt(port), sessionId, ws.userId);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Connection failed';
            ws.send(JSON.stringify({
              type: 'error',
              message: errorMessage
            }));
          }
        } else if (message.type === 'send') {
          // Send raw data to MUD connection - validate session ownership
          const { sessionId, data } = message;
          if (!sessionId || !data) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Missing sessionId or data for send operation'
            }));
            return;
          }

          // Validate session ownership before sending data
          if (!mudService.validateSessionOwnership(sessionId, ws.userId)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Send denied - session access not authorized'
            }));
            return;
          }

          mudService.sendData(sessionId, data);
        } else if (message.type === 'disconnect') {
          const { sessionId } = message;
          if (!sessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Missing sessionId for disconnect operation'
            }));
            return;
          }

          // Validate session ownership before disconnecting
          if (!mudService.validateSessionOwnership(sessionId, ws.userId)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Disconnect denied - session access not authorized'
            }));
            return;
          }

          mudService.closeConnection(sessionId, 'Client requested disconnect');
        }
      } catch (error) {
        console.error('Invalid MUD WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('MUD WebSocket client disconnected');
    });

    ws.on('error', (error: Error) => {
      console.error('MUD WebSocket error:', error);
    });
  });

  console.log('MUD WebSocket server initialized on /ws/mud');
  
  return httpServer;
}

