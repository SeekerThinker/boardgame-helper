// Keep the Table OS backdrop dismissal separate from the generic delegated
// data-os-action handler in tabletop.js. The backdrop used to carry
// data-os-action="close", which meant any click inside the sheet could climb
// through Element.closest() and be misclassified as a close action whenever
// the clicked control did not itself match a delegated selector.
//
// This capture-phase boundary removes that ambiguous action marker before the
// bubbling handler runs. Direct clicks on the empty backdrop are forwarded to
// the real close button, so keyboard/button dismissal and backdrop dismissal
// still share the same application close path.
const BACKDROP_SELECTOR = '.tableos-backdrop';
const LEGACY_CLOSE_SELECTOR = '.tableos-backdrop[data-os-action="close"]';

function isolateBackdrop(backdrop) {
  if (!(backdrop instanceof Element)) return;
  if (backdrop.matches(LEGACY_CLOSE_SELECTOR)) {
    backdrop.removeAttribute('data-os-action');
  }
  backdrop.setAttribute('data-os-backdrop', '');
}

document.addEventListener('click', event => {
  const origin = event.target instanceof Element ? event.target : null;
  if (!origin) return;
  const backdrop = origin.closest(BACKDROP_SELECTOR);
  if (!backdrop) return;

  // This runs before tabletop.js's bubbling listener, preventing ordinary
  // controls from resolving the backdrop as their nearest data-os-action.
  isolateBackdrop(backdrop);

  if (origin !== backdrop) return;
  event.preventDefault();
  backdrop.querySelector('.tableos-header [data-os-action="close"]')?.click();
}, true);

const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(BACKDROP_SELECTOR)) isolateBackdrop(node);
      node.querySelectorAll?.(LEGACY_CLOSE_SELECTOR).forEach(isolateBackdrop);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.querySelectorAll(LEGACY_CLOSE_SELECTOR).forEach(isolateBackdrop);
