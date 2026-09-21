"use strict";

const openButton = document.querySelector(".open");
let feedbackTimer;
openButton.addEventListener("pointerdown", () => {
  window.clearTimeout(feedbackTimer);
  openButton.classList.add("is-touched");
});
function releaseTouch() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => openButton.classList.remove("is-touched"), 900);
}
window.addEventListener("pointerup", releaseTouch);
window.addEventListener("pointercancel", releaseTouch);

const invitation = document.querySelector(".invitation");
const transitionLayer = document.querySelector(".threshold-transition");
const seam = document.querySelector(".threshold-seam");
const leftPanel = document.querySelector(".threshold-panel--left");
const rightPanel = document.querySelector(".threshold-panel--right");
const film = document.querySelector(".promo-film");
const retryButton = document.querySelector(".film-retry");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* DEVELOPMENT AUDIO CONFIG */
const AUDIO_CONFIG = {
  filmVolume: .82,
  filmAudioDelay: .50,
  filmFadeIn: .45,
  filmFadeOutPreRoll: .80,
  filmVolumeAtWhiteStart: .72,
  filmFadeOut: 1.50,
  whiteVolume: .45,
  whiteFadeIn: .18,
  whiteFadeOut: .30,
  ambienceOpenVolume: .12,
  ambienceFilmVolume: .025,
  ambienceWhiteVolume: .08,
  ambienceLectureVolume: .05,
  openVolume: .55,
  doorVolume: .60,
  enterVolume: .55,
  enterFadeOut: .25,
  openDuration: 1.2,
  doorDuration: 1.3,
  whiteDuration: 1.4,
  enterDuration: .8,
};

const ENDING_TIMING = {
  whiteTransitionDuration: 1.50,
  whiteHoldBeforeText: 1.00,
  doorMessageReveal: .70,
  questionDelay: .55,
  questionReveal: .90,
  enterDelay: .70,
  enterReveal: .65,
};

const ENTER_VARIANT = 3;

const experienceAudio = {
  ambience: new Audio("assets/audio/ambience.mp4"),
  open: new Audio("assets/audio/open.mp4"),
  door: new Audio("assets/audio/door.mp4"),
  white: new Audio("assets/audio/white.mp4"),
  enter: new Audio(`assets/audio/enter_0${ENTER_VARIANT}.mp4`),
};

const audioStopTimers = new Map();
const volumeFades = new WeakMap();
let audioUnlocked = false;
let ambienceTargetVolume = AUDIO_CONFIG.ambienceOpenVolume;
let filmAudioDelayTimer;
let filmAudioPreFadeStarted = false;

Object.values(experienceAudio).forEach((audio) => {
  audio.preload = "auto";
  audio.load();
});
experienceAudio.ambience.loop = true;
experienceAudio.open.volume = AUDIO_CONFIG.openVolume;
experienceAudio.door.volume = AUDIO_CONFIG.doorVolume;
experienceAudio.white.volume = 0;
experienceAudio.enter.volume = AUDIO_CONFIG.enterVolume;
film.volume = 0;

function cancelVolumeFade(mediaElement) {
  const activeFade = volumeFades.get(mediaElement);
  if (!activeFade) return;
  window.cancelAnimationFrame(activeFade.frame);
  volumeFades.delete(mediaElement);
  activeFade.resolve(false);
}

function fadeVolume(mediaElement, targetVolume, duration) {
  cancelVolumeFade(mediaElement);
  const startVolume = mediaElement.volume;
  const safeTarget = Math.min(1, Math.max(0, targetVolume));
  if (duration <= 0 || startVolume === safeTarget) {
    mediaElement.volume = safeTarget;
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const fade = { frame: 0, resolve };
    const startedAt = performance.now();
    volumeFades.set(mediaElement, fade);
    const update = (now) => {
      if (volumeFades.get(mediaElement) !== fade) return;
      const progress = Math.min(1, (now - startedAt) / (duration * 1000));
      const eased = progress * progress * (3 - 2 * progress);
      mediaElement.volume = startVolume + (safeTarget - startVolume) * eased;
      if (progress < 1) {
        fade.frame = window.requestAnimationFrame(update);
      } else {
        volumeFades.delete(mediaElement);
        resolve(true);
      }
    };
    fade.frame = window.requestAnimationFrame(update);
  });
}

function stopAudioAsset(name) {
  const audio = experienceAudio[name];
  const timer = audioStopTimers.get(name);
  if (timer) window.clearTimeout(timer);
  audioStopTimers.delete(name);
  cancelVolumeFade(audio);
  audio.pause();
  if (audio.readyState > 0) audio.currentTime = 0;
}

function playAudioAsset(name, duration, label) {
  const audio = experienceAudio[name];
  stopAudioAsset(name);
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log(`[AUDIO] ${label}`);
  }).catch((error) => {
    console.warn(`[AUDIO] ${label} could not play.`, error);
  });
  const timer = window.setTimeout(() => stopAudioAsset(name), duration * 1000);
  audioStopTimers.set(name, timer);
}

function playFadedAudioAsset(name, duration, label, targetVolume, fadeIn, fadeOut) {
  const audio = experienceAudio[name];
  stopAudioAsset(name);
  audio.currentTime = 0;
  audio.volume = 0;
  audio.play().then(() => {
    if (audioStopTimers.get(name) !== fadeTimer) return;
    console.log(`[AUDIO] ${label}`);
    fadeVolume(audio, targetVolume, fadeIn);
  }).catch((error) => {
    console.warn(`[AUDIO] ${label} could not play.`, error);
  });
  const fadeTimer = window.setTimeout(() => {
    fadeVolume(audio, 0, fadeOut).then((completed) => {
      if (!completed || audioStopTimers.get(name) !== fadeTimer) return;
      audioStopTimers.delete(name);
      audio.pause();
      if (audio.readyState > 0) audio.currentTime = 0;
    });
  }, Math.max(0, duration - fadeOut) * 1000);
  audioStopTimers.set(name, fadeTimer);
}

function fadeAmbience(targetVolume, duration = .8) {
  ambienceTargetVolume = targetVolume;
  fadeVolume(experienceAudio.ambience, targetVolume, duration);
}

function unlockAudioAssets() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  [experienceAudio.door, experienceAudio.white, experienceAudio.enter].forEach((audio) => {
    audio.muted = true;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(() => { audio.muted = false; });
  });
}

function startAmbience() {
  if (!experienceAudio.ambience.paused) return;
  experienceAudio.ambience.volume = 0;
  experienceAudio.ambience.currentTime = 0;
  experienceAudio.ambience.play().then(() => {
    console.log("[AUDIO] Ambience started");
    fadeAmbience(ambienceTargetVolume, .9);
  }).catch((error) => console.warn("[AUDIO] Ambience could not play.", error));
}

function playOpenSound() {
  playAudioAsset("open", AUDIO_CONFIG.openDuration, "OPEN");
}

function playDoorSound() {
  playAudioAsset("door", AUDIO_CONFIG.doorDuration, "DOOR");
}

function playWhiteSound() {
  playFadedAudioAsset("white", AUDIO_CONFIG.whiteDuration, "WHITE",
    AUDIO_CONFIG.whiteVolume, AUDIO_CONFIG.whiteFadeIn, AUDIO_CONFIG.whiteFadeOut);
  fadeAmbience(AUDIO_CONFIG.ambienceWhiteVolume, ENDING_TIMING.whiteTransitionDuration);
}

function playEnterSound() {
  playFadedAudioAsset("enter", AUDIO_CONFIG.enterDuration, `ENTER variant ${ENTER_VARIANT}`,
    AUDIO_CONFIG.enterVolume, 0, AUDIO_CONFIG.enterFadeOut);
  fadeAmbience(AUDIO_CONFIG.ambienceLectureVolume, .7);
}

function duckAmbienceForFilm() {
  fadeAmbience(AUDIO_CONFIG.ambienceFilmVolume, .7);
  console.log("[AUDIO] Film ambience duck");
}

function startFilmAudioEntrance() {
  window.clearTimeout(filmAudioDelayTimer);
  cancelVolumeFade(film);
  filmAudioPreFadeStarted = false;
  film.volume = 0;
  filmAudioDelayTimer = window.setTimeout(() => {
    fadeVolume(film, AUDIO_CONFIG.filmVolume, AUDIO_CONFIG.filmFadeIn);
  }, AUDIO_CONFIG.filmAudioDelay * 1000);
}

function startFilmAudioPreFade() {
  if (filmAudioPreFadeStarted) return;
  filmAudioPreFadeStarted = true;
  fadeVolume(film, AUDIO_CONFIG.filmVolume * AUDIO_CONFIG.filmVolumeAtWhiteStart,
    AUDIO_CONFIG.filmFadeOutPreRoll);
}

// Wait until playback is active and consecutive decoded frames are available.
function waitForPlaybackReady() {
  return new Promise((resolve, reject) => {
    let frameId;
    let firstMediaTime;
    const cleanup = () => {
      window.clearTimeout(timeout);
      film.removeEventListener("loadeddata", check);
      film.removeEventListener("canplay", check);
      film.removeEventListener("playing", check);
      film.removeEventListener("error", fail);
      if (frameId !== undefined) film.cancelVideoFrameCallback(frameId);
    };
    const finish = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Film could not be prepared.")); };
    const check = () => {
      if (film.readyState < HTMLMediaElement.HAVE_FUTURE_DATA || film.paused || frameId !== undefined) return;
      if (typeof film.requestVideoFrameCallback === "function") {
        const confirmMovingFrame = (_now, metadata) => {
          frameId = undefined;
          if (firstMediaTime === undefined) {
            firstMediaTime = metadata.mediaTime;
            frameId = film.requestVideoFrameCallback(confirmMovingFrame);
          } else if (metadata.mediaTime > firstMediaTime) {
            finish();
          } else {
            frameId = film.requestVideoFrameCallback(confirmMovingFrame);
          }
        };
        frameId = film.requestVideoFrameCallback(confirmMovingFrame);
      } else finish();
    };
    const timeout = window.setTimeout(fail, 15000);
    film.addEventListener("loadeddata", check);
    film.addEventListener("canplay", check);
    film.addEventListener("playing", check);
    film.addEventListener("error", fail);
    if (film.error) fail();
    else check();
  });
}

function prepareFilm() {
  // Called synchronously from the click to preserve user activation for audio.
  film.volume = 0;
  const playback = film.play();
  return Promise.resolve(playback).catch((error) => {
    if (error.name !== "NotAllowedError") throw error;
    // Some mobile policies still require muted playback.
    film.muted = true;
    return film.play();
  }).then(waitForPlaybackReady);
}

// data-phase: invitation | opening | waiting-for-film | film-error | opened.
// "threshold:opened" fires only after the panels finish and a frame is ready.
async function openInvitation() {
  if (!["invitation", "film-error"].includes(invitation.dataset.phase)) return;
  const isRetry = invitation.dataset.phase === "film-error";
  if (!isRetry) {
    unlockAudioAssets();
    startAmbience();
    playOpenSound();
  }
  invitation.dataset.phase = "opening";
  openButton.disabled = true;
  retryButton.hidden = true;
  window.clearTimeout(feedbackTimer);
  transitionLayer.hidden = false;
  transitionLayer.setAttribute("aria-hidden", "false");
  if (isRetry && film.error) film.load();

  // Attach rejection handling immediately while the opening sequence runs.
  const prepared = prepareFilm().then(() => null, (error) => error);
  const animate = (element, frames, options) =>
    element.animate(frames, { fill: "forwards", ...options }).finished;

  let fade;
  if (!isRetry) {
    fade = animate(transitionLayer, [{ opacity: 0 }, { opacity: 1 }], {
      duration: reducedMotion.matches ? 180 : 380, easing: "ease-in",
    });
    animate(openButton, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
  }

  invitation.dataset.phase = "waiting-for-film";
  const error = await prepared;
  if (error) {
    film.pause();
    invitation.dataset.phase = "film-error";
    retryButton.hidden = false;
    retryButton.focus({ preventScroll: true });
    invitation.dispatchEvent(new CustomEvent("threshold:film-error", { detail: error, bubbles: true }));
    return;
  }

  if (!isRetry) {
    await fade;
    if (!reducedMotion.matches) await animate(seam, [
      { opacity: 0, transform: "scaleY(.025)", offset: 0 },
      { opacity: .7, transform: "scaleY(.025)", offset: .2 },
      { opacity: 1, transform: "scaleY(1)", offset: .8 },
      { opacity: 1, transform: "scaleY(1)", offset: 1 },
    ], { duration: 450, easing: "ease-in-out" });
  }

  invitation.dataset.phase = "opening";
  playDoorSound();
  startFilmAudioEntrance();
  const panelTiming = { duration: reducedMotion.matches ? 220 : 900, easing: "cubic-bezier(.45, 0, .2, 1)" };
  const panelFrames = (direction) => reducedMotion.matches
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ transform: "translateX(0)" }, { transform: `translateX(${direction}100%)` }];
  await Promise.all([
    animate(leftPanel, panelFrames("-"), panelTiming),
    animate(rightPanel, panelFrames(""), panelTiming),
    animate(seam, [{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion.matches ? 0 : 200 }),
  ]);
  invitation.dataset.phase = "opened";
  invitation.dispatchEvent(new CustomEvent("threshold:opened", { bubbles: true }));
  // Native ended handling preserves the existing video display.
}

openButton.addEventListener("click", openInvitation);
retryButton.addEventListener("click", openInvitation);

const ending = document.querySelector(".film-ending");
const endingTitle = document.querySelector(".ending-title");
const endingQuestion = document.querySelector(".ending-question");
const enterButton = document.querySelector(".enter");
const enterLabel = document.querySelector(".enter-label");
const enterLine = document.querySelector(".enter-line");
const endingWhite = document.querySelector(".ending-white");
let enterFeedbackTimer;

let endingAnimations = [];
let endingTextAnimations = [];
let endingFrameRequest;
let endingGeneration = 0;
let endingRevealTimer;

function prepareCharacterResolve(element, accessibleText) {
  if (accessibleText) element.setAttribute("aria-label", accessibleText);
  const textNodes = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    Array.from(textNode.data).forEach((character) => {
      if (/\s/u.test(character)) {
        fragment.append(character);
        return;
      }
      const span = document.createElement("span");
      span.className = "resolve-character";
      span.setAttribute("aria-hidden", "true");
      span.textContent = character;
      fragment.append(span);
    });
    textNode.replaceWith(fragment);
  });
}

prepareCharacterResolve(endingTitle, "THE DOOR IS OPEN.");
prepareCharacterResolve(endingQuestion, "AI 시대, 당신은 무엇을 만들 것인가?");
prepareCharacterResolve(enterLabel);
enterLine.style.opacity = "0";
enterLine.style.transform = "scaleX(0)";
enterLine.style.transformOrigin = "center";
enterLine.style.animationPlayState = "paused";

// Drive only the white dissolve from media time so it completes before freeze.
function syncEnding(allowStart = true) {
  if (!Number.isFinite(film.duration) || film.seeking) return;
  const transitionDuration = ENDING_TIMING.whiteTransitionDuration * 1000;
  const whiteStart = Math.max(0, film.duration - ENDING_TIMING.whiteTransitionDuration);
  const preFadeStart = Math.max(0, whiteStart - AUDIO_CONFIG.filmFadeOutPreRoll);
  if (allowStart && !filmAudioPreFadeStarted && film.currentTime >= preFadeStart &&
      invitation.dataset.phase === "opened") {
    startFilmAudioPreFade();
  }
  const elapsed = (film.currentTime - whiteStart) * 1000;
  if (!invitation.dataset.endingPhase) {
    if (!allowStart || elapsed < 0 || invitation.dataset.phase !== "opened") return;
    startWhiteDissolve();
  }
  endingAnimations.forEach((animation) => { animation.currentTime = Math.max(0, elapsed); });
  if (elapsed >= transitionDuration && invitation.dataset.endingPhase === "white-dissolve") {
    holdWhiteBeforeEnding();
  }
}

function startWhiteDissolve() {
  invitation.dataset.endingPhase = "white-dissolve";
  endingGeneration++;
  window.clearTimeout(endingRevealTimer);
  window.clearTimeout(filmAudioDelayTimer);
  transitionLayer.classList.add("is-white");
  fadeVolume(film, 0, AUDIO_CONFIG.filmFadeOut);
  playWhiteSound();
  const white = endingWhite.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: ENDING_TIMING.whiteTransitionDuration * 1000, easing: "ease-in-out", fill: "forwards",
  });
  white.pause();
  endingAnimations = [white];
}

function holdWhiteBeforeEnding() {
  if (invitation.dataset.endingPhase !== "white-dissolve") return;
  const generation = endingGeneration;
  invitation.dataset.endingPhase = "white-hold";
  window.clearTimeout(endingRevealTimer);
  endingRevealTimer = window.setTimeout(() => {
    if (generation !== endingGeneration || invitation.dataset.endingPhase !== "white-hold") return;
    revealWhiteEnding();
  }, ENDING_TIMING.whiteHoldBeforeText * 1000);
}

function revealWhiteEnding() {
  if (invitation.dataset.endingPhase !== "white-hold") return;
  const generation = endingGeneration;
  invitation.dataset.endingPhase = "message-revealing";
  ending.hidden = false;
  const resolveCharacters = (element, delay, duration, opacity, blur, stagger, tracking) => {
    if (reducedMotion.matches) {
      return [element.animate([{ opacity: 0 }, { opacity }], {
        delay, duration: 180, easing: "ease-out", fill: "forwards",
      })];
    }

    const characters = [...element.querySelectorAll(".resolve-character")];
    const center = (characters.length - 1) / 2;
    const order = characters.map((character, index) => ({ character, index }))
      .sort((a, b) => {
        const aScore = Math.abs(a.index - center) + ((a.index * 7) % 5) * .12;
        const bScore = Math.abs(b.index - center) + ((b.index * 7) % 5) * .12;
        return aScore - bScore || a.index - b.index;
      });
    const maxDelay = Math.max(0, (characters.length - 1) * stagger);
    const characterDuration = Math.max(180, duration - maxDelay);
    const computed = getComputedStyle(element);
    const finalSpacing = parseFloat(computed.letterSpacing) || 0;
    const startSpacing = finalSpacing + (parseFloat(computed.fontSize) || 16) * tracking;
    const animations = [
      element.animate([{ opacity: 0 }, { opacity }], {
        delay, duration: 80, easing: "ease-out", fill: "forwards",
      }),
      element.animate([{ letterSpacing: `${startSpacing}px` }, { letterSpacing: `${finalSpacing}px` }], {
        delay, duration, easing: "cubic-bezier(.22, .61, .36, 1)", fill: "forwards",
      }),
    ];
    order.forEach(({ character }, rank) => {
      animations.push(character.animate(
        [{ opacity: .04, filter: `blur(${blur}px)` }, { opacity: 1, filter: "blur(0)" }],
        { delay: delay + rank * stagger, duration: characterDuration,
          easing: "cubic-bezier(.22, .61, .36, 1)", fill: "backwards" },
      ));
    });
    return animations;
  };
  const questionStart = ENDING_TIMING.doorMessageReveal + ENDING_TIMING.questionDelay;
  const enterStart = questionStart + ENDING_TIMING.questionReveal + ENDING_TIMING.enterDelay;
  const titleDuration = ENDING_TIMING.doorMessageReveal * 1000;
  const questionDuration = ENDING_TIMING.questionReveal * 1000;
  const enterDuration = ENDING_TIMING.enterReveal * 1000;
  const messageAnimations = [
    ...resolveCharacters(endingTitle, 0, titleDuration, .9, 4, 22, .025),
    ...resolveCharacters(endingQuestion, reducedMotion.matches ? 120 : questionStart * 1000,
      questionDuration, .88, 5, 28, .015),
    ...resolveCharacters(enterButton, reducedMotion.matches ? 240 : enterStart * 1000,
      enterDuration, 1, 3, 22, .03),
  ];
  if (!reducedMotion.matches) {
    const underline = enterLine.animate(
      [{ opacity: 0, transform: "scaleX(0)" }, { opacity: .4, transform: "scaleX(1)" }],
      { delay: enterStart * 1000 + enterDuration + 150, duration: 650,
        easing: "cubic-bezier(.22, .61, .36, 1)", fill: "forwards" },
    );
    underline.finished.then(() => {
      if (generation !== endingGeneration) return;
      underline.cancel();
      enterLine.style.opacity = "";
      enterLine.style.transform = "";
      enterLine.style.animationPlayState = "";
    }).catch(() => {});
    messageAnimations.push(underline);
  } else {
    enterLine.style.opacity = ".4";
    enterLine.style.transform = "scaleX(1)";
  }
  endingTextAnimations = messageAnimations;
  Promise.all(messageAnimations.map((animation) => animation.finished)).then(() => {
    if (generation !== endingGeneration || invitation.dataset.endingPhase !== "message-revealing") return;
    enterButton.disabled = false;
    invitation.dataset.endingPhase = "ready";
    invitation.dispatchEvent(new CustomEvent("threshold:ending-ready", { bubbles: true }));
  }).catch(() => {
    // Canceled by a repeated DEVELOPMENT ENDING TEST.
  });
}

function trackEnding() {
  syncEnding();
  if (!film.paused && !film.ended) endingFrameRequest = window.requestAnimationFrame(trackEnding);
}
film.addEventListener("playing", () => {
  window.cancelAnimationFrame(endingFrameRequest);
  duckAmbienceForFilm();
  trackEnding();
});
film.addEventListener("timeupdate", () => syncEnding());
film.addEventListener("seeked", () => syncEnding());
film.addEventListener("pause", () => window.cancelAnimationFrame(endingFrameRequest));
film.addEventListener("ended", () => {
  window.cancelAnimationFrame(endingFrameRequest);
  // Finish the already-running dissolve; the fully white screen hides freeze.
  syncEnding(false);
});


function enterFeedback() {
  window.clearTimeout(enterFeedbackTimer);
  enterButton.classList.add("is-touched");
  enterFeedbackTimer = window.setTimeout(() => enterButton.classList.remove("is-touched"), 900);
}
enterButton.addEventListener("pointerdown", enterFeedback);
enterButton.addEventListener("click", () => {
  if (invitation.dataset.endingPhase !== "ready") return;
  playEnterSound();
  enterFeedback();
  invitation.dataset.endingPhase = "entered";
  // Integration hook only; keep the white final message visible for STEP 05.
  invitation.dispatchEvent(new CustomEvent("threshold:enter", { bubbles: true }));
});

/* DEVELOPMENT ENDING TEST
   Remove this entire independent block before final deployment.
   Desktop DEBUG only: press E after OPEN to replay the last six seconds.
   Touch-only/mobile devices, the first invitation screen and lecture states are excluded. */
(() => {
  const desktopDebug = window.matchMedia("(min-width: 600px) and (hover: hover) and (pointer: fine)");
  let seeking = false;

  window.addEventListener("keydown", (event) => {
    if (!desktopDebug.matches || event.code !== "KeyE" || event.repeat ||
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || seeking) return;
    if (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    if (!["opening", "waiting-for-film", "opened"].includes(invitation.dataset.phase) ||
        !Number.isFinite(film.duration)) return;

    event.preventDefault();
    seeking = true;
    stopAudioAsset("white");
    window.clearTimeout(filmAudioDelayTimer);
    window.clearTimeout(endingRevealTimer);
    duckAmbienceForFilm();
    endingGeneration++;
    // Reset the overlay; the media-time trigger starts it again during playback.
    ending.hidden = true;
    ending.classList.remove("is-visible");
    transitionLayer.classList.remove("is-white");
    endingTextAnimations.forEach((animation) => animation.cancel());
    endingTextAnimations = [];
    [endingTitle, endingQuestion, enterButton, endingWhite].forEach((element) => {
      element.getAnimations().forEach((animation) => animation.cancel());
    });
    enterLine.style.opacity = "0";
    enterLine.style.transform = "scaleX(0)";
    enterLine.style.transformOrigin = "center";
    enterLine.style.animationPlayState = "paused";
    enterButton.disabled = true;
    window.clearTimeout(enterFeedbackTimer);
    enterButton.classList.remove("is-touched");
    delete invitation.dataset.endingPhase;
    filmAudioPreFadeStarted = false;

    film.currentTime = Math.max(0, film.duration - 6);
    fadeVolume(film, AUDIO_CONFIG.filmVolume, AUDIO_CONFIG.filmFadeIn);
    const playback = film.paused ? film.play() : Promise.resolve();
    Promise.resolve(playback).catch((error) => {
      console.warn("DEVELOPMENT ENDING TEST: playback could not start.", error);
    }).finally(() => { seeking = false; });
  });
})();

// STEP 05: consume the existing ENTER hook without navigation or a new page.
(() => {
  const lecture = document.querySelector(".lecture");
  let started = false;
  invitation.addEventListener("threshold:enter", async () => {
    if (started) return;
    started = true;
    invitation.dataset.phase = "lecture-transition";
    enterButton.disabled = true;
    lecture.hidden = false;
    lecture.setAttribute("aria-busy", "true");

    // Fade the parent, preserving the fixed media-driven child animations.
    ending.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedMotion.matches ? 150 : 350, easing: "ease-out", fill: "forwards",
    });
    // An opaque black layer slowly covers the white ending, with no cut.
    await lecture.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reducedMotion.matches ? 200 : 1000, easing: "ease-in-out", fill: "forwards",
    }).finished;
    transitionLayer.setAttribute("aria-hidden", "true");
    film.pause();
    invitation.dispatchEvent(new CustomEvent("threshold:lecture-visible", { bubbles: true }));

    const delays = [0, 160, 320, 500, 750, 1100];
    await Promise.all([...lecture.querySelectorAll(".lecture-reveal")].map((element, index) =>
      element.animate(reducedMotion.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, filter: "blur(2px)", transform: "translateY(3px)" },
           { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }], {
        delay: delays[index], duration: reducedMotion.matches ? 180 : 700,
        easing: "ease-out", fill: "forwards",
      }).finished,
    ));
    invitation.dataset.phase = "lecture";
    lecture.setAttribute("aria-busy", "false");
    lecture.focus({ preventScroll: true });
  });
})();
