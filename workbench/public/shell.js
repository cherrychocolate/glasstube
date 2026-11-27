/* Standalone adapter for the MyCraft service shell. */
let osPage = 'bilibili';
const osData = {settings: {volume: 60}};
const esc = value => String(value).replace(/[&<>"']/g, character =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
let osContent = () => '';
let osClick = () => {};
let osNavigate = page => {
  osPage = page === 'center' ? 'bilibili' : page;
  renderOS();
  requestAnimationFrame(() => window.LegoGamepad.refreshFocus(true));
};
let renderOS = () => {
  document.querySelector('.os-page-surface').innerHTML = osContent();
};

const focusables = () => [...document.querySelectorAll('.bili-app [data-bili-id]')]
  .filter(element => !element.disabled && !element.closest('[inert],[hidden]') && element.getClientRects().length);
function topScrollArea(element) {
  const header = element.closest('.bili-watch-heading, .bili-head');
  return header?.closest('.bili-browse-scroll, .bili-body');
}
document.addEventListener('focusin', event => {
  const area = topScrollArea(event.target);
  if (area) area.scrollTop = 0;
});

function focusElement(element) {
  if (!element) return false;
  document.querySelector('.device-focus')?.classList.remove('device-focus');
  element.classList.add('device-focus');
  element.focus({preventScroll:true});
  const top = topScrollArea(element);
  if (top) top.scrollTop = 0;
  else element.scrollIntoView({block:'nearest',inline:'nearest'});
  return true;
}
window.LegoGamepad = {
  focusElement,
  refreshFocus() {
    const controls = focusables();
    return focusElement(controls.find(control => control.hasAttribute('data-focus-default')) || controls[0]);
  }
};
function browseUp(active, controls) {
  const scroller = active.closest('.bili-browse-scroll');
  if (!scroller) return false;
  const resourceSelector = '.bili-video-card,.bili-hero,.bili-topic-tile,.bili-search-person';
  const resources = controls.filter(control=>scroller.contains(control)&&control.matches(resourceSelector));
  const current = active.getBoundingClientRect();
  const above = resources.map(control=>({control,rect:control.getBoundingClientRect()}))
    .filter(({rect})=>rect.top<current.top-8);
  if (above.length) {
    const top = Math.max(...above.map(({rect})=>rect.top));
    const x = current.left+current.width/2;
    const distance = ({rect})=>Math.abs(rect.left+rect.width/2-x);
    const row = above.filter(({rect})=>top-rect.top<=8);
    const nearest = row.reduce((best,item)=>distance(item)<distance(best)?item:best);
    focusElement(nearest.control);
    return true;
  }
  if (active.matches(resourceSelector)) {
    const tab = active.closest('.bili-app').querySelector('.bili-section-bar [aria-current="page"]');
    scroller.scrollTop=0;
    return focusElement(tab);
  }
  return false;
}
document.addEventListener('click', event => osClick(event));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    window.BilibiliService?.back();
    return;
  }
  if (!event.key.startsWith('Arrow') || event.target.matches('input,textarea,select')) return;
  event.preventDefault();
  const active = document.activeElement;
  const controls = focusables();
  if (!controls.includes(active)) return window.LegoGamepad.refreshFocus();
  if (event.key==='ArrowUp' && browseUp(active,controls)) return;
  const center = element => {
    const rect = element.getBoundingClientRect();
    return [rect.x + rect.width / 2, rect.y + rect.height / 2];
  };
  const origin = center(active);
  const axis = ['ArrowLeft','ArrowRight'].includes(event.key) ? 0 : 1;
  const sign = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
  const candidates = controls.flatMap(control => {
    const point = center(control);
    const distance = (point[axis] - origin[axis]) * sign;
    const offset = Math.abs(point[1-axis] - origin[1-axis]);
    return distance > 2 ? [{control, score:distance + 3 * offset}] : [];
  });
  candidates.sort((a,b) => a.score - b.score);
  focusElement(candidates[0]?.control);
});
document.addEventListener('DOMContentLoaded', () => window.BilibiliService.open(), {once:true});
