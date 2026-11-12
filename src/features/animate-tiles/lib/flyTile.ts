export function flyTile(layer: HTMLElement, from: DOMRect, to: DOMRect) {
  const card = document.createElement('div');
  card.className = 'fly-tile';
  card.style.left = `${from.left + 10}px`;
  card.style.top = `${from.top + 4}px`;
  layer.appendChild(card);
  const dx = to.left + 8 - from.left;
  const dy = to.top + 4 - from.top;
  card
    .animate(
      [
        { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + 54}px) scale(1.15) rotate(-8deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.2 },
      ],
      { duration: 820, easing: 'ease-in-out' },
    )
    .finished.finally(() => card.remove());
}
