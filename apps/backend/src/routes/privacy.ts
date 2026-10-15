import type { FastifyPluginAsync } from 'fastify';
import { escapeHtml } from '../admin/render.js';

const CONTACT_EMAIL = 'smits31u@gmail.com';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Information we collect',
    body:
      'Photos you take to identify a wood species. Photos you choose to submit as a ' +
      'reference photo or species suggestion. A device ID: a random identifier generated on ' +
      'your device the first time you contribute, used only to attribute that contribution — ' +
      "it isn't derived from any hardware identifier or tied to your name, email, or location. " +
      'We do not collect your name, email address, location, or any other personal ' +
      'information, and Grainscope has no user accounts.',
  },
  {
    title: 'How we use it',
    body:
      "Photos you take to identify a species are sent to Anthropic's Claude API for analysis " +
      'and are not stored on our server afterward — we only keep the identification result. ' +
      'Photos you submit as a reference photo or species suggestion are reviewed and, if ' +
      'approved, added to the public species database shown to all users, credited only by ' +
      'your anonymous device ID. We may use aggregated, non-identifying data to improve ' +
      'identification accuracy and expand the species catalog.',
  },
  {
    title: 'Third-party services',
    body:
      "Anthropic (Claude API) — analyzes submitted photos to identify wood species. See " +
      "Anthropic's privacy policy for how they handle that data. CITES Species+ — species " +
      'names (not photos or personal data) are checked against this database for ' +
      'conservation status. USDA Forest Products Laboratory — a static reference dataset for ' +
      'wood properties; no data is sent to USDA.',
  },
  {
    title: 'Data retention',
    body:
      'Your identification history is stored only on your device (never uploaded to our ' +
      'servers) and can be cleared at any time from the History screen. Photos submitted only ' +
      'for identification are not retained after the request completes. Reference photos and ' +
      'species suggestions you contribute are retained on our server as part of the species ' +
      'database until you request their removal.',
  },
  {
    title: 'No account required',
    body:
      "Grainscope doesn't require you to create an account, sign in, or provide any personal " +
      'information to identify wood species.',
  },
];

function renderPrivacyPolicyPage(): string {
  const sections = SECTIONS.map(
    (section) => `
    <section>
      <h2>${escapeHtml(section.title)}</h2>
      <p>${escapeHtml(section.body)}</p>
    </section>`,
  ).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grainscope — Privacy Policy</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 700px; margin: 2rem auto; padding: 0 1.5rem; color: #222; line-height: 1.5; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    p { color: #444; margin-top: 0; }
    a { color: #a15c2f; }
  </style>
</head>
<body>
  <h1>Grainscope — Privacy Policy</h1>
  <p>Grainscope is built to work without collecting personal information. This page explains
  what we do collect and how it's used.</p>
  ${sections}
  <section>
    <h2>Contact us</h2>
    <p>Questions about this policy, or requests to remove content you've contributed:
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  </section>
</body>
</html>`;
}

const privacyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/privacy', async (_request, reply) => {
    reply.type('text/html').send(renderPrivacyPolicyPage());
  });
};

export default privacyRoutes;
