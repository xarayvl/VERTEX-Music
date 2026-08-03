const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#312e81"/>
      <stop offset="0.55" stop-color="#7e22ce"/>
      <stop offset="1" stop-color="#db2777"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <circle cx="256" cy="204" r="78" fill="rgba(255,255,255,0.9)"/>
  <path d="M118 430c17-88 69-132 138-132s121 44 138 132" fill="rgba(255,255,255,0.9)"/>
</svg>`;

export const DEFAULT_AVATAR_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const coverSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171717"/>
      <stop offset="0.5" stop-color="#581c87"/>
      <stop offset="1" stop-color="#be185d"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" rx="72" fill="url(#cover)"/>
  <circle cx="400" cy="400" r="205" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="44"/>
  <circle cx="400" cy="400" r="55" fill="rgba(255,255,255,.9)"/>
  <path d="M400 195v150l130-75z" fill="rgba(255,255,255,.9)"/>
</svg>`;

export const DEFAULT_COVER_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(coverSvg)}`;
export const LIKED_SONGS_COVER_URL = DEFAULT_COVER_URL;
