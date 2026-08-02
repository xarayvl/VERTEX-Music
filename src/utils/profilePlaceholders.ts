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
