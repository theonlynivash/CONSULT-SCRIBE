// Minimal ambient types for the Web Speech API (not in lib.dom.d.ts).
export {};

declare global {
  interface Window {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  }
}
