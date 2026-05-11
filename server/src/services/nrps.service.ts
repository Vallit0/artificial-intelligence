// LTI NRPS (Names and Role Provisioning Services) — fetch the course
// roster from the platform so we can pre-create LtiSessions for students
// who will practice via web link (never doing an LTI launch). The cron
// drives this; an admin can also trigger it on demand.
//
// IMS NRPS 2.0 response shape:
//   {
//     id: "<contextId>",
//     context: { id, title, label },
//     members: [
//       { user_id, status, roles[], name?, given_name?, family_name?,
//         email?, lis_person_sourcedid? },
//       ...
//     ]
//   }
//
// Paging follows RFC 5988 Link headers (rel="next"). Moodle paginates at
// 100 by default — we follow until exhausted, capped at MAX_PAGES to
// guard against runaway loops.

import { getPlatformAccessToken } from './lti.service.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger({ component: 'nrps' });

const SCOPE_MEMBERSHIP = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
const CONTENT_TYPE_MEMBERSHIP = 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json';
const MAX_PAGES = 50;

const ROLE_LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
const STATUS_ACTIVE = 'Active';

export interface RosterMember {
  ltiUserId: string;       // platform-scoped sub
  email: string | null;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  sourcedId: string | null; // lis_person_sourcedid — institutional ID when shared
  roles: string[];
  status: string;           // "Active" | "Inactive" | "Deleted"
}

export interface FetchRosterResult {
  members: RosterMember[];
  pagesFetched: number;
}

interface NrpsRawMember {
  user_id: string;
  status?: string;
  roles?: string[];
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  lis_person_sourcedid?: string;
}

interface NrpsRawResponse {
  id?: string;
  members?: NrpsRawMember[];
}

// Parse RFC 5988 Link header to extract the next-page URL. Moodle returns
// it as: Link: <https://...?membership_page=2>; rel="next"
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return null;
}

function mapMember(raw: NrpsRawMember): RosterMember {
  return {
    ltiUserId: raw.user_id,
    email: raw.email ?? null,
    name: raw.name ?? null,
    givenName: raw.given_name ?? null,
    familyName: raw.family_name ?? null,
    sourcedId: raw.lis_person_sourcedid ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    status: raw.status ?? STATUS_ACTIVE,
  };
}

// Fetch the full membership list for a course, following pagination.
// Only Active learners are returned to the caller — instructors and
// inactive/deleted members are filtered out, since the sync only exists
// to pre-create student accounts that can receive grades.
export async function fetchCourseRoster(
  platformId: string,
  membershipsUrl: string,
): Promise<FetchRosterResult> {
  const token = await getPlatformAccessToken(platformId, [SCOPE_MEMBERSHIP]);

  const all: RosterMember[] = [];
  let url: string | null = membershipsUrl;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: CONTENT_TYPE_MEMBERSHIP,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`NRPS fetch failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as NrpsRawResponse;
    const members = (data.members ?? []).map(mapMember);
    all.push(...members);

    url = parseNextLink(res.headers.get('link'));
    pages += 1;
  }

  if (pages >= MAX_PAGES && url) {
    log.warn({ platformId, pages }, 'NRPS pagination cap hit — roster may be truncated');
  }

  const learners = all.filter(
    (m) => m.status === STATUS_ACTIVE && m.roles.includes(ROLE_LEARNER),
  );

  log.info(
    { platformId, total: all.length, learners: learners.length, pages },
    'NRPS roster fetched',
  );

  return { members: learners, pagesFetched: pages };
}

export const NRPS_SCOPES = {
  MEMBERSHIP_READONLY: SCOPE_MEMBERSHIP,
} as const;
