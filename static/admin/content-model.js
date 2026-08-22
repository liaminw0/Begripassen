export const contentModels = {
  home: {
    singular: "homepagina",
    plural: "Homepagina",
    description: "Werk één rustig onderdeel tegelijk bij. De andere onderdelen blijven bewaard.",
    publishLabel: "Wijzigingen publiceren",
    sections: [
      {
        id: "intro",
        label: "Introductie",
        title: "Bovenaan de homepagina",
        description: "De korte boodschap die bezoekers als eerste lezen.",
        fields: [
          { name: "heading", label: "Hoofdtekst", type: "textarea", required: true, maxLength: 2000, rows: 5, help: "Leg in enkele zinnen uit waar BEGR!P voor staat." },
        ],
      },
      {
        id: "about",
        label: "Over ons",
        title: "Over BEGR!P",
        description: "Vertel wie jullie zijn en geef bezoekers een logische volgende stap.",
        fields: [
          { name: "about", label: "Tekst", type: "textarea", required: true, maxLength: 2000, rows: 6 },
          { name: "about_image", altName: "about_image_alt", label: "Afbeelding", type: "image", help: "Liggend beeld werkt het beste, bijvoorbeeld 1600 × 1000 pixels." },
          { name: "about_link_text", label: "Tekst op de knop", type: "text", maxLength: 120, placeholder: "Bijvoorbeeld: Lees meer over ons" },
          { name: "about_link_url", label: "Waar gaat de knop heen?", type: "url", maxLength: 500, placeholder: "https://… of /blogs/…" },
        ],
      },
      {
        id: "newsletter",
        label: "Nieuwsbrief",
        title: "Nieuwsbrief",
        description: "Nodig bezoekers uit om zich in te schrijven.",
        fields: [
          { name: "newsletter", label: "Introductietekst", type: "textarea", required: true, maxLength: 2000, rows: 5 },
        ],
      },
      {
        id: "support",
        label: "Steun ons",
        title: "Steun BEGR!P",
        description: "Beschrijf hoe bezoekers kunnen helpen en voeg maximaal twee acties toe.",
        fields: [
          { name: "support", label: "Introductietekst", type: "textarea", required: true, maxLength: 2000, rows: 6 },
          { name: "support_primary_text", label: "Eerste knoptekst", type: "text", maxLength: 120 },
          { name: "support_primary_url", label: "Link van de eerste knop", type: "url", maxLength: 500, placeholder: "https://…" },
          { name: "support_secondary_text", label: "Tweede knoptekst", type: "text", maxLength: 120 },
          { name: "support_secondary_url", label: "Link van de tweede knop", type: "url", maxLength: 500, placeholder: "https://…" },
        ],
      },
      {
        id: "contact",
        label: "Contact",
        title: "Contactgegevens",
        description: "Houd deze gegevens actueel zodat bezoekers jullie makkelijk bereiken.",
        fields: [
          { name: "contact", label: "Introductietekst", type: "textarea", required: true, maxLength: 2000, rows: 5 },
          { name: "contact_phone_label", label: "Naam van telefoonoptie", type: "text", maxLength: 120, layout: "half" },
          { name: "contact_phone", label: "Telefoonnummer", type: "tel", maxLength: 80, layout: "half" },
          { name: "contact_email_label", label: "Naam van e-mailoptie", type: "text", maxLength: 120, layout: "half" },
          { name: "contact_email", label: "E-mailadres", type: "email", maxLength: 254, layout: "half" },
          { name: "contact_instagram_label", label: "Naam van Instagram-optie", type: "text", maxLength: 120, layout: "half" },
          { name: "contact_instagram_handle", label: "Instagramnaam", type: "text", maxLength: 120, placeholder: "@begripassen", layout: "half" },
          { name: "contact_instagram_url", label: "Instagramlink", type: "url", maxLength: 500 },
        ],
      },
    ],
  },
  events: {
    singular: "evenement",
    plural: "Evenementen",
    description: "Plan activiteiten, houd praktische informatie actueel en publiceer wanneer alles klopt.",
    newLabel: "Nieuw evenement",
    publishLabel: "Evenement publiceren",
    sections: [
      {
        id: "basis",
        label: "Praktische informatie",
        title: "Wat, waar en wanneer?",
        description: "Dit is de informatie die bezoekers in het overzicht en bovenaan de pagina zien.",
        fields: [
          { name: "title", label: "Titel", type: "text", required: true, maxLength: 140, placeholder: "Naam van het evenement" },
          { name: "date", label: "Datum en tijd", type: "datetime-local", required: true, layout: "half" },
          { name: "location", label: "Locatie", type: "text", maxLength: 180, layout: "half", placeholder: "Bijvoorbeeld: De Witte Bal" },
          { name: "organiser", label: "Organisator", type: "text", maxLength: 180, placeholder: "Bijvoorbeeld: BEGR!P" },
          { name: "summary", label: "Korte samenvatting", type: "textarea", maxLength: 280, rows: 3, help: "Eén of twee zinnen voor het evenementenoverzicht." },
        ],
      },
      {
        id: "image",
        label: "Omslag",
        title: "Omslagafbeelding",
        description: "Een liggende afbeelding werkt het beste op de detailpagina.",
        fields: [
          { name: "image", altName: "image_alt", label: "Omslagafbeelding", type: "image", help: "Aanbevolen: minimaal 1600 × 900 pixels, maximaal 6 MB." },
        ],
      },
      {
        id: "content",
        label: "Beschrijving",
        title: "Vertel bezoekers meer",
        description: "Gebruik alleen de opmaak die helpt om de tekst prettig leesbaar te maken.",
        fields: [
          { name: "body", label: "Beschrijving", type: "richtext", required: true },
        ],
      },
      {
        id: "signup",
        label: "Aanmelden",
        title: "Aanmelden",
        description: "Toon alleen een aanmeldknop als er een werkende link beschikbaar is.",
        fields: [
          { name: "show_signup", label: "Bezoekers kunnen zich online aanmelden", type: "checkbox" },
          { name: "signup_link", label: "Aanmeldlink", type: "url", maxLength: 500, condition: "show_signup", placeholder: "https://…" },
        ],
      },
    ],
  },
  blogs: {
    singular: "blog",
    plural: "Blogs",
    description: "Schrijf updates en verhalen met eenvoudige opmaak en duidelijke afbeeldingen.",
    newLabel: "Nieuwe blog",
    publishLabel: "Blog publiceren",
    sections: [
      {
        id: "basis",
        label: "Basis",
        title: "Titel en samenvatting",
        description: "Deze informatie helpt bezoekers beslissen of ze verder willen lezen.",
        fields: [
          { name: "title", label: "Titel", type: "text", required: true, maxLength: 140 },
          { name: "date", label: "Publicatiedatum", type: "date", required: true, layout: "half" },
          { name: "author", label: "Auteur", type: "text", maxLength: 120, layout: "half" },
          { name: "summary", label: "Korte samenvatting", type: "textarea", maxLength: 280, rows: 3, required: true, help: "Maximaal twee korte zinnen voor het blogoverzicht." },
        ],
      },
      {
        id: "image",
        label: "Omslag",
        title: "Omslagafbeelding",
        description: "Kies een herkenbaar beeld dat bij het verhaal past.",
        fields: [
          { name: "image", altName: "image_alt", label: "Omslagafbeelding", type: "image", help: "Aanbevolen: minimaal 1600 × 900 pixels, maximaal 6 MB." },
        ],
      },
      {
        id: "content",
        label: "Artikel",
        title: "Schrijf het artikel",
        description: "Tussenkoppen en korte alinea’s maken een lang verhaal beter leesbaar.",
        fields: [
          { name: "body", label: "Artikel", type: "richtext", required: true },
        ],
      },
    ],
  },
};

export function fieldsForType(type) {
  return contentModels[type].sections.flatMap((section) => section.fields);
}

function localDate(offsetHours = 0) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function amsterdamDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function createEmptyItem(type) {
  const fields = {};
  for (const field of fieldsForType(type)) {
    if (field.name === "body") continue;
    fields[field.name] = field.type === "checkbox" ? false : "";
    if (field.altName) fields[field.altName] = "";
  }
  if (type === "events") {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    fields.date = amsterdamDateTime(date);
    fields.organiser = "BEGR!P";
    fields.draft = true;
  }
  if (type === "blogs") {
    fields.date = localDate();
    fields.author = "BEGR!P";
    fields.draft = true;
  }
  return { type, path: "", publicUrl: "", sha: "", fields, body: "" };
}

export function inputValue(field, value) {
  const raw = String(value ?? "");
  if (field.type === "datetime-local") return raw.slice(0, 16);
  if (field.type === "date") return raw.slice(0, 10);
  return raw;
}

export function formatDutchDate(value, includeTime = false) {
  if (!value) return "Datum ontbreekt";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return String(value);
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const formatted = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(date);
  return includeTime && hour ? `${formatted} om ${hour}:${minute}` : formatted;
}

export function resolveImageUrl(value, itemPath = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(?:https:)?\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("blob:")) return raw;
  if (itemPath.endsWith("/index.md")) {
    const base = `/${itemPath.replace(/^content\//, "").replace(/index\.md$/, "")}`;
    return `${base}${raw.replace(/^\/+/, "")}`;
  }
  return raw;
}

function safeUrl(value, allowRelative = false) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (allowRelative && (raw.startsWith("/") || raw.startsWith("#"))) return true;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateItem(type, fields, body) {
  const errors = {};
  for (const field of fieldsForType(type)) {
    const value = field.name === "body" ? String(body || "").trim() : fields[field.name];
    if (field.required && !String(value ?? "").trim()) errors[field.name] = "Dit veld is verplicht.";
    if (field.maxLength && String(value || "").length > field.maxLength) errors[field.name] = `Gebruik maximaal ${field.maxLength} tekens.`;
    if (field.type === "url" && value && !safeUrl(value, type === "home")) errors[field.name] = "Vul een geldig webadres in.";
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.name] = "Vul een geldig e-mailadres in.";
    if (field.type === "image" && fields[field.name] && !String(fields[field.altName] || "").trim()) errors[field.altName] = "Beschrijf kort wat er op de afbeelding staat.";
  }
  if (type === "events" && fields.show_signup && !fields.signup_link) errors.signup_link = "Vul de aanmeldlink in.";
  return errors;
}

export function draftStorageKey(type, path = "") {
  return `begrip-cms-draft:v2:${type}:${path || "nieuw"}`;
}
