const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2 L21 20 L12 15.5 L3 20 Z" />
</svg>
`;

/**
 * Build a divIcon showing an arrow rotated to a given bearing, used to
 * indicate the direction of movement at a location history point.
 *
 * @param {Number} bearing Bearing in degrees, where 0 is north
 * @param {String} color CSS color for the arrow
 * @param {Number} size Arrow width/height in pixels
 * @returns {L.DivIcon} Leaflet icon
 */
export default (bearing, color, size) => {
  const style = [
    `width: ${size}px`,
    `height: ${size}px`,
    `margin-left: ${-size / 2}px`,
    `margin-top: ${-size / 2}px`,
    `color: ${color}`,
    `transform: rotate(${bearing}deg)`,
  ].join("; ");
  return L.divIcon({
    className: "",
    html: `<span class="ot-track-arrow" style="${style}">${svg}</span>`,
  });
};
