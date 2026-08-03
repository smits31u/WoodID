import type { ContentStatus, PhotoAngle, Species } from '../generated/prisma/client.js';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PAGE_STYLE = `
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { font-size: 1.4rem; }
  nav a { margin-right: 1rem; }
  .item { border: 1px solid #ccc; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .item img { max-width: 160px; max-height: 160px; object-fit: cover; border-radius: 4px; margin-right: 0.5rem; }
  .meta { color: #555; font-size: 0.9rem; margin: 0.5rem 0; }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .actions form { display: inline; }
  button { padding: 0.4rem 0.8rem; border-radius: 4px; border: 1px solid #888; cursor: pointer; }
  .approve { background: #d9f2d9; }
  .reject { background: #f2d9d9; }
  label { display: block; font-size: 0.85rem; margin-top: 0.4rem; }
  input[type=text] { width: 100%; padding: 0.3rem; box-sizing: border-box; }
  .empty { color: #777; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head>
<body>
<nav>
  <a href="/admin/reference-photos?status=PENDING">Reference photos</a>
  <a href="/admin/species-suggestions?status=PENDING">Species suggestions</a>
</nav>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

type ReferencePhotoWithSpecies = {
  id: number;
  imageUrl: string;
  angle: PhotoAngle;
  status: ContentStatus;
  deviceId: string;
  createdAt: Date;
  species: Species;
};

export function renderReferencePhotosPage(
  photos: ReferencePhotoWithSpecies[],
  status: string,
): string {
  const items =
    photos.length === 0
      ? '<p class="empty">Nothing here.</p>'
      : photos
          .map(
            (photo) => `
    <div class="item">
      <img src="${escapeHtml(photo.imageUrl)}" alt="">
      <strong>${escapeHtml(photo.species.commonName)}</strong> (${escapeHtml(photo.species.scientificName)})
      <div class="meta">
        Angle: ${escapeHtml(photo.angle)} · Device: ${escapeHtml(photo.deviceId)} ·
        Submitted: ${photo.createdAt.toISOString()}
      </div>
      <div class="actions">
        <form method="POST" action="/admin/reference-photos/${photo.id}/approve">
          <button class="approve" type="submit">Approve</button>
        </form>
        <form method="POST" action="/admin/reference-photos/${photo.id}/reject">
          <button class="reject" type="submit">Reject</button>
        </form>
      </div>
    </div>`,
          )
          .join('\n');

  return page(`Reference photos — ${status}`, items);
}

type SpeciesSuggestionWithPhotos = {
  id: number;
  proposedCommonName: string;
  proposedScientificName: string | null;
  submitterNotes: string | null;
  deviceId: string;
  createdAt: Date;
  photos: { id: number; imageUrl: string }[];
};

export function renderSpeciesSuggestionsPage(
  suggestions: SpeciesSuggestionWithPhotos[],
  status: string,
): string {
  const items =
    suggestions.length === 0
      ? '<p class="empty">Nothing here.</p>'
      : suggestions
          .map((suggestion) => {
            const thumbnails = suggestion.photos
              .map((photo) => `<img src="${escapeHtml(photo.imageUrl)}" alt="">`)
              .join('');
            return `
    <div class="item">
      <div>${thumbnails}</div>
      <div class="meta">
        Device: ${escapeHtml(suggestion.deviceId)} · Submitted: ${suggestion.createdAt.toISOString()}
      </div>
      ${suggestion.submitterNotes ? `<p>${escapeHtml(suggestion.submitterNotes)}</p>` : ''}
      <form method="POST" action="/admin/species-suggestions/${suggestion.id}/approve">
        <label>Common name
          <input type="text" name="commonName" value="${escapeHtml(suggestion.proposedCommonName)}" required>
        </label>
        <label>Scientific name
          <input type="text" name="scientificName" value="${escapeHtml(suggestion.proposedScientificName ?? '')}" required>
        </label>
        <div class="actions">
          <button class="approve" type="submit">Approve &amp; create species</button>
        </div>
      </form>
      <form method="POST" action="/admin/species-suggestions/${suggestion.id}/reject">
        <div class="actions">
          <button class="reject" type="submit">Reject</button>
        </div>
      </form>
    </div>`;
          })
          .join('\n');

  return page(`Species suggestions — ${status}`, items);
}
