const mapFrame = document.querySelector(`#map-frame`);
const projectTypeFrame = document.querySelector(`#project-type-frame`);

const query = new URLSearchParams(window.location.search);
const sharedQuery = query.toString();

const buildUrl = (path) => {
  const url = new URL(path, window.location.href);
  url.search = sharedQuery;
  return url.href;
};

mapFrame.src = buildUrl(`../maps/`);
projectTypeFrame.src = buildUrl(`../charts/project-type/`);
