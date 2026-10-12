import type { ApplicationStatus, ParsedJobEvent } from "../domain";

export type JobEmail = {
  messageId: string;
  threadId: string | null;
  from: string;
  subject: string;
  text: string;
  links?: Array<{ url: string; text: string }>;
  receivedAt: Date;
};

const TECHNOLOGIES: Array<[RegExp, string]> = [
  [/\bpython\b/i, "Python"],
  [/\breact(?:\.js|js)?\b/i, "React"],
  [/\bnext(?:\.js|js)\b/i, "Next.js"],
  [/\bnode(?:\.js|js)?\b/i, "Node.js"],
  [/\btypescript\b/i, "TypeScript"],
  [/\bjavascript\b/i, "JavaScript"],
  [/\bphp\b/i, "PHP"],
  [/\blaravel\b/i, "Laravel"],
  [/\bjava\b/i, "Java"],
  [/\b\.net\b|\bdotnet\b/i, ".NET"],
  [/\bangular\b/i, "Angular"],
  [/\bvue(?:\.js|js)?\b/i, "Vue.js"],
  [/\baws\b/i, "AWS"],
  [/\bpostgres(?:ql)?\b/i, "PostgreSQL"]
];

function clean(value: string | undefined): string {
  return (value ?? "")
    .replace(/%%str_to_replace_open_tracking%%/gi, " ")
    .replace(/[\u034f\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:|\-–—]+|[\s|\-–—]+$/g, "")
    .trim();
}

function cleanCompany(value: string): string {
  return value.replace(/\p{P}+/gu, " ").replace(/\s+/g, " ").trim();
}

function statusFrom(subject: string, text: string): ApplicationStatus | null {
  const content = `${subject} ${text}`;

  if (/\b(canceled|cancelled)\b.*\b(interview|event)\b|\b(interview|event)\b.*\b(canceled|cancelled)\b/i.test(content)) return null;
  if (/unlikely to progress|not selected|regret to inform|will not be (?:moving|proceeding)|unfortunately.{0,80}(?:position|application)/i.test(content)) return "REJECTED";
  if (/\bwithdrawn?\b|withdrew (?:my|your) application/i.test(content)) return "WITHDRAWN";
  if (/\bjob offer\b|\boffer of employment\b|pleased to offer you/i.test(content)) return "OFFER";
  if (/\bassessment\b|\bcoding challenge\b|\btechnical test\b|\bskills test\b/i.test(content)) return "ASSESSMENT";
  if (/\binterview\b/i.test(content)) return "INTERVIEW";
  if (/\bunder review\b|reviewing your (?:application|profile)|\bscreening\b/i.test(content)) return "SCREENING";
  if (/application.{0,80}(?:submitted|received|sent)|thank you for applying|successfully submitted|thanks for (?:completing|your) application/i.test(content)) return "APPLIED";
  return null;
}

function extractTitleAndCompany(email: JobEmail): { title: string; company: string } {
  const { subject, text } = email;
  let match = subject.match(/^Application update for (.+?) at (.+)$/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = subject.match(/^Your application for (.+?) at (.+)$/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = subject.match(/(?:^|,\s*)your application was sent to (.+)$/i);
  if (match) {
    const company = clean(match[1]);
    const lines = text.split(/\n+/).map(clean).filter(Boolean);
    const heading = lines.findIndex((line) => /application was sent to/i.test(line));
    return { title: heading >= 0 ? clean(lines[heading + 1]) : "", company };
  }

  match = text.match(
    /application for (.+?) was successfully submitted to (.+?)(?=\s+(?:seek|jobstreet)\b|[.\n]|$)/i
  );
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = text.match(/(?:applying|applied) for (?:the )?(.+?) (?:role|position) at (.+?)(?:[.!]|$)/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = text.match(/(?:role|position) of (.+?) at (.+?)(?:[.!]|$)/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = subject.match(/^Indeed Application:\s*(.+?)(?:\s*\||$)/i);
  if (match) {
    const company = text.match(/\bat (.+?)(?:[.!]|$)/i)?.[1];
    return { title: clean(match[1]), company: clean(company) };
  }

  match = subject.match(/application (?:was )?sent to (.+)$/i);
  if (match) {
    const title = text.match(/(?:for|as) (?:the )?(.+?)(?: role| position| at )/i)?.[1];
    return { title: clean(title), company: clean(match[1]) };
  }

  match = subject.match(/^(.+?)\s+(?:technical|hr|final)?\s*interview(?::[^/]*)?\s*\/\s*(.+)$/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = subject.match(/^Job Offer:\s*(.+?)\s*\|\s*(.+)$/i);
  if (match) return { title: clean(match[1]), company: clean(match[2]) };

  match = subject.match(/(?:interview|assessment|offer).{0,30}(?:for|[-–—])\s*(.+?)(?:\s+at\s+(.+))?$/i);
  return { title: clean(match?.[1]), company: clean(match?.[2]) };
}

function extractTechStack(content: string): string[] {
  return TECHNOLOGIES.filter(([pattern]) => pattern.test(content)).map(([, name]) => name);
}

function isKnownJobDetailUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const pathHasId = (prefix: string) => path.startsWith(prefix) && path.slice(prefix.length).split("/").some(Boolean);

  return (
    (on("linkedin.com") && pathHasId("/jobs/view/")) ||
    (["indeed.com", "indeed.co.uk", "indeed.com.au", "indeed.ca"].some(on) &&
      (path === "/viewjob" || path === "/rc/clk") && Boolean(url.searchParams.get("jk"))) ||
    (["jobstreet.com", "jobstreet.com.ph", "jobstreet.com.sg", "jobstreet.com.my", "jobstreet.co.id"].some(on) &&
      pathHasId("/job/")) ||
    (["seek.com.au", "seek.co.nz"].some(on) && pathHasId("/job/")) ||
    (on("jobs.lever.co") && path.split("/").filter(Boolean).length >= 2) ||
    ((on("boards.greenhouse.io") || on("job-boards.greenhouse.io")) && /\/jobs\/[^/]+/.test(path)) ||
    (on("myworkdayjobs.com") && /\/job\/.+/.test(path))
  );
}

function extractJobPostingUrl(email: JobEmail, title: string): string | null {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const candidates = (email.links ?? []).flatMap((link) => {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      return [];
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return [];

    const normalizedText = link.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const textIsUrl = link.text.trim() === link.url.trim();
    const labelled =
      /\b(?:view|see|open)\s+(?:the\s+)?job(?:\s+posting)?\b|\bjob\s+(?:posting|details)\b/i.test(link.text) ||
      (!textIsUrl && normalizedTitle.length >= 4 && normalizedText.includes(normalizedTitle));
    const priority = labelled ? 2 : isKnownJobDetailUrl(url) ? 1 : 0;
    return priority ? [{ url: link.url.trim(), priority }] : [];
  });

  const highestPriority = Math.max(0, ...candidates.map(({ priority }) => priority));
  const matches = [...new Set(candidates.filter(({ priority }) => priority === highestPriority).map(({ url }) => url))];
  return matches.length === 1 ? matches[0] : null;
}

export function parseJobEmail(email: JobEmail): ParsedJobEvent | null {
  if (email.from.toLowerCase().includes("github.com")) return null;

  const status = statusFrom(email.subject, email.text);
  if (!status) return null;

  const { title, company: parsedCompany } = extractTitleAndCompany(email);
  const company = cleanCompany(parsedCompany);
  if (!title || !company || title.length > 160 || company.length > 160) return null;
  return {
    messageId: email.messageId,
    threadId: email.threadId,
    receivedAt: email.receivedAt,
    title,
    company,
    techStack: extractTechStack(`${email.subject} ${email.text}`),
    status,
    jobPostingUrl: extractJobPostingUrl(email, title)
  };
}
