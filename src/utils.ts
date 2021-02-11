export function isDocumentVisible() {
  if (
    typeof document !== "undefined" &&
    typeof document.visibilityState !== "undefined"
  ) {
    return document.visibilityState !== "hidden";
  }
  // always assume it's visible
  return true;
}

export function isOnline() {
  if (typeof navigator.onLine !== "undefined") {
    return navigator.onLine;
  }
  // always assume it's online
  return true;
}
