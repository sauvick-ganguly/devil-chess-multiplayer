
import move from "../assets/sounds/move.mp3";
import capture from "../assets/sounds/capture.mp3";
import check from "../assets/sounds/check.mp3";
import checkmate from "../assets/sounds/checkmate.mp3";
import promote from "../assets/sounds/promote.mp3";

const sounds = {
    move: new Audio(move),
    capture: new Audio(capture),
    check: new Audio(check),
    checkmate: new Audio(checkmate),
    promote: new Audio(promote),
};

Object.values(sounds).forEach((audio) => {
    audio.preload = "auto";
});

const playing = new Set();
let soundCallCount = 0;

export function playSound(type) {
    console.count(`playSound called: ${type}`);
    console.trace("Sound call source");

    const audio = sounds[type];

    if (!audio) {
        console.warn("Sound not found:", type);
        return;
    }

    audio.currentTime = 0;

    audio.play()
        .then(() => console.log("Played:", type))
        .catch(err => console.error("Audio error:", err));
}
