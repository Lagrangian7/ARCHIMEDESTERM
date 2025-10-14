interface Window {
  MathJax?: {
    typesetPromise: () => Promise<void>;
    tex?: any;
    startup?: any;
  };
}
