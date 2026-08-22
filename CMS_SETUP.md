# BEGR!P websitebeheer

De beheeromgeving staat op `/admin/` en gebruikt Cloudflare Pages Functions voor de beveiligde API. Redacteuren zien alleen de homepagina, evenementen en blogs; repositorybestanden en Hugo-metadata blijven verborgen.

## Inhoudsmodel

- Homepagina: `content/_index.md` (TOML-frontmatter)
- Evenementen: `content/events/<datum>-<titel>/index.md`
- Blogs: `content/blogs/<datum>-<titel>/index.md`
- Afbeeldingen bij evenementen en blogs: de lokale `media/`-map van de inhoudsbundel
- Afbeeldingen van de homepagina: `static/images/uploads/`

Bestaande bundle- en legacy `.md`-inhoud blijft leesbaar. Bij het bewerken blijft het bestaande pad ongewijzigd, zodat openbare URL's niet veranderen.

## Bestaande omgevingsvariabelen

De implementatie behoudt dezelfde bindingnamen en vereist geen wijziging van bestaande geheime waarden:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (standaard `main`)
- `GITHUB_TOKEN`
- `CMS_PASSWORD`
- `CMS_SESSION_SECRET`

Optioneel:

- `GITHUB_COMMITTER_NAME`
- `GITHUB_COMMITTER_EMAIL`

Gebruik voor `GITHUB_TOKEN` alleen schrijfrechten voor de inhoud van deze repository. Stel bij Cloudflare daarnaast een rate-limitregel in voor `POST /api/cms/login`; rate limiting kan niet betrouwbaar in een stateless Pages Function worden bijgehouden.

## Beveiligingsmodel

1. Inloggen vergelijkt het bestaande teamwachtwoord server-side en maakt een ondertekende, `HttpOnly`, `Secure`, `SameSite=Strict` sessiecookie van 12 uur.
2. De sessie bevat een willekeurig CSRF-token. Iedere wijziging vereist dit token én een same-origin verzoek.
3. Alle API-routes controleren inhoudstype en toegestane repositorypaden voordat GitHub wordt benaderd.
4. Velden, datums, URL-schema's, Markdown en afbeeldingsverwijzingen worden server-side gevalideerd.
5. Uploads zijn beperkt tot gecontroleerde JPG-, PNG- en WebP-bestanden; SVG/HTML, verkeerde magic bytes en bestanden boven 6 MB worden geweigerd.
6. Een blob-revisie voorkomt dat twee redacteuren elkaars wijzigingen ongemerkt overschrijven.
7. Content en nieuwe afbeeldingen worden samen in één commit opgeslagen.
8. Beheer- en API-responses krijgen no-store-, CSP-, frame- en content-type-beveiligingsheaders.

Geheime waarden worden uitsluitend uit de serveromgeving gelezen. Zet deze nooit in frontendcode, Hugo-configuratie of repositorybestanden.

## Publiceren

Een commit op de ingestelde branch start de gekoppelde site-deployment. De beheeromgeving meldt daarom eerst dat de inhoud is opgeslagen en daarna dat de website wordt bijgewerkt; zij claimt niet dat de deployment al klaar is.

De bestaande GitHub Actions-workflow bouwt en publiceert Hugo naar GitHub Pages. GitHub Pages voert geen Cloudflare Functions uit. Productie moet `/admin/` daarom via het Cloudflare Pages-project met dezelfde repository en bindings aanbieden, of de beheerroutes bewust uitsluiten van een uitsluitend statische GitHub Pages-host.

## Lokaal controleren

```sh
npm test
npm run check
npm run test:browser
hugo --minify
```

De tests controleren onder andere frontmatter-compatibiliteit, padisolatie, URL/HTML-validatie, uploadsignaturen, login, sessieondertekening, CSRF en veilige standaardconcepten. De browsertest vereist een lokale Chromium-installatie en controleert daarnaast toetsenbordfocus, herstel na herladen, opslaan, voorbeeldweergave en desktop-/mobiele overloop.
