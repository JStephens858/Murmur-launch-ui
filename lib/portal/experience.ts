import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import { type CVItem, cvItemsKey } from "./profile";

/**
 * The Experience section of a profile, as the app's ProfileExperienceView2
 * and EditExperienceListView do it.
 *
 * Items are CV items. The editor deals in a title, a description, start and
 * end years and an "is current" flag; the older descriptive columns
 * (practiceType, discipline, companyName, location) are read but no longer
 * written, matching the app's makeCVItemIn. Saving always sends the whole
 * list: `setCVItemsForUser` replaces the user's items with what it is given,
 * so one entry's add, edit or delete is "the list with that change", renumbered
 * from 1, exactly as the app's saveEditingCv builds it.
 */

export interface CVItemType {
  id: string;
  name: string;
}

const GET_CV_ITEM_TYPES = /* GraphQL */ `
  query getCVItemTypes {
    getCVItemTypes {
      success
      results {
        itemTypes {
          id
          name
        }
      }
    }
  }
`;

/** The server's display names for item types; the fallbacks below cover the gap while it loads. */
export function useCVItemTypes() {
  return useQuery({
    queryKey: ["cvItemTypes"],
    queryFn: async (): Promise<CVItemType[]> => {
      const data = await portalQuery<{
        getCVItemTypes: {
          success: boolean;
          results: { itemTypes: CVItemType[] } | null;
        };
      }>(GET_CV_ITEM_TYPES);
      return data.getCVItemTypes.results?.itemTypes ?? [];
    },
    staleTime: 60 * 60_000,
  });
}

const SET_CV_ITEMS = /* GraphQL */ `
  mutation setCVItemsForUser($userId: ID!, $items: [CVItemIn!]!) {
    setCVItemsForUser(userId: $userId, items: $items) {
      success
      errorMsg
      errorCode
      results {
        items {
          itemId
          indexInList
          itemType
          title
          practiceType
          discipline
          companyName
          location
          description
          start
          end
          isCurrent
        }
      }
    }
  }
`;

/** What the app sends per item (makeCVItemIn). */
export interface CVItemIn {
  itemId: string | null;
  indexInList: number;
  itemType: string;
  title: string;
  description: string;
  start: string;
  end: string;
  isCurrent: boolean;
}

export function useSetCVItems(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (items: CVItemIn[]): Promise<CVItem[]> => {
      const data = await portalQuery<{
        setCVItemsForUser: {
          success: boolean;
          errorMsg: string | null;
          errorCode: number | null;
          results: { items: CVItem[] } | null;
        };
      }>(SET_CV_ITEMS, { userId, items });
      const res = data.setCVItemsForUser;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't save your experience",
          res.errorCode ?? undefined,
        );
      }
      return [...(res.results?.items ?? [])].sort(
        (a, b) => a.indexInList - b.indexInList,
      );
    },
    onSuccess: (items) => {
      client.setQueryData(cvItemsKey(userId), items);
    },
  });
}

/** An entry being added or edited in the sheet. itemId null means new. */
export interface CVDraft {
  itemId: string | null;
  itemType: string;
  title: string;
  description: string;
  start: string;
  end: string;
  isCurrent: boolean;
}

export function draftFrom(item: CVItem): CVDraft {
  return {
    itemId: item.itemId,
    itemType: item.itemType,
    title: item.title ?? "",
    description: item.description ?? "",
    start: item.start ?? "",
    end: item.end ?? "",
    isCurrent: !!item.isCurrent,
  };
}

export function emptyDraft(itemType: string): CVDraft {
  return {
    itemId: null,
    itemType,
    title: "",
    description: "",
    start: "",
    end: "",
    isCurrent: false,
  };
}

/**
 * The full list to send for one change, as the app's saveEditingCv builds
 * it: existing items in order with the edited one swapped in (or dropped when
 * deleting), a new one appended, indexInList renumbered from 1.
 */
export function listWithChange(
  items: CVItem[],
  draft: CVDraft,
  action: "save" | "delete",
): CVItemIn[] {
  const toIn = (d: CVDraft, index: number): CVItemIn => ({
    itemId: d.itemId,
    indexInList: index,
    itemType: d.itemType,
    title: d.title.trim(),
    description: d.description.trim(),
    start: d.start.trim(),
    end: d.isCurrent ? "" : d.end.trim(),
    isCurrent: d.isCurrent,
  });
  const out: CVItemIn[] = [];
  let index = 1;
  for (const item of items) {
    if (item.itemId === draft.itemId) {
      if (action === "save") out.push(toIn(draft, index++));
    } else {
      out.push(toIn(draftFrom(item), index++));
    }
  }
  if (draft.itemId === null && action === "save") out.push(toIn(draft, index));
  return out;
}

/* ---------------------------------------------------------------------- */
/* Sections, field specs and names: a port of ProfileExperienceSections.   */

export interface TypeOption {
  id: string;
  name: string;
}

export interface ExperienceGroup {
  id: string;
  label: string;
  typeOptions: TypeOption[];
  /** Rendered as add/delete chips (areas of focus): one value, no role or dates. */
  isTagLike: boolean;
  items: CVItem[];
}

export interface FieldSpec {
  isTagLike: boolean;
  primaryLabel: string;
  primaryPlaceholder: string;
  secondaryLabel: string | null;
  secondaryPlaceholder: string;
}

/** Ordered sections and the item types in each; ids mirror the server's getCVItemTypes list. */
const SECTION_DEFS: { label: string; typeIds: string[] }[] = [
  {
    label: "Education",
    typeIds: ["undergrad", "graduate", "medSchool", "otherSchool"],
  },
  {
    label: "Training",
    typeIds: ["internship", "residency", "fellowship", "otherTraining"],
  },
  {
    label: "Areas of focus",
    typeIds: ["specialty", "subSpecialty", "areaOfFocus", "otherSpecialty"],
  },
  { label: "Practice", typeIds: ["practice"] },
  { label: "Hospital affiliation", typeIds: ["hospitalAffiliation"] },
  { label: "Organizations", typeIds: ["organization"] },
];
const OTHER_TYPE_ID = "otherExperience";
/** Tag sections always add this type; the specialty variants are grouped here for display only. */
export const TAG_ADD_TYPE_ID = "areaOfFocus";
const NAMED_TYPE_IDS = new Set(SECTION_DEFS.flatMap((d) => d.typeIds));

const FALLBACK_NAMES: Record<string, string> = {
  undergrad: "University",
  graduate: "Post Graduate",
  medSchool: "Medical School",
  otherSchool: "Other Education",
  internship: "Internship",
  residency: "Residency",
  fellowship: "Fellowship",
  otherTraining: "Other Training",
  specialty: "Specialty",
  subSpecialty: "SubSpecialty",
  areaOfFocus: "Area of Focus",
  otherSpecialty: "Other Specialty",
  practice: "Practice",
  otherEmployment: "Other Employment",
  hospitalAffiliation: "Hospital Affiliation",
  license: "License",
  organization: "Organization",
  otherExperience: "Other Experience",
};

function humanize(raw: string): string {
  if (!raw || raw === "generic") return "Experience";
  const spaced = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Server name first, then the curated fallback, then a humanised id. */
export function friendlyName(itemType: string, types: CVItemType[]): string {
  return (
    types.find((t) => t.id === itemType)?.name ??
    FALLBACK_NAMES[itemType] ??
    humanize(itemType)
  );
}

const spec = (
  primaryLabel: string,
  primaryPlaceholder: string,
  secondaryLabel: string | null,
  secondaryPlaceholder = "",
  isTagLike = false,
): FieldSpec => ({
  isTagLike,
  primaryLabel,
  primaryPlaceholder,
  secondaryLabel,
  secondaryPlaceholder,
});

export function fieldSpec(itemType: string): FieldSpec {
  switch (itemType) {
    // Areas of focus / specialties: one value, no role or dates.
    case "specialty":
      return spec("Specialty", "e.g. Cardiology", null, "", true);
    case "subSpecialty":
    case "subspecialty":
      return spec(
        "Subspecialty",
        "e.g. Interventional Cardiology",
        null,
        "",
        true,
      );
    case "areaOfFocus":
    case "areasOfFocus":
      return spec("Area of focus", "e.g. Heart Failure", null, "", true);
    case "otherSpecialty":
      return spec("Specialty / focus", "e.g. Echocardiography", null, "", true);
    // Education.
    case "undergrad":
    case "university":
    case "college":
      return spec(
        "University / college",
        "e.g. Duke University",
        "Degree / major",
        "e.g. B.S., Biology",
      );
    case "graduate":
      return spec(
        "University",
        "e.g. Stanford University",
        "Degree / major",
        "e.g. M.P.H.",
      );
    case "medSchool":
      return spec(
        "Medical school",
        "e.g. Johns Hopkins School of Medicine",
        "Degree",
        "e.g. M.D.",
      );
    case "otherSchool":
      return spec(
        "School",
        "e.g. Institute of Technology",
        "Program / focus",
        "e.g. Certificate",
      );
    // Training.
    case "internship":
      return spec(
        "Hospital / program",
        "e.g. Mayo Clinic",
        "Specialty / focus",
        "e.g. Internal Medicine",
      );
    case "residency":
      return spec(
        "Hospital",
        "e.g. Mayo Clinic",
        "Specialty",
        "e.g. Internal Medicine",
      );
    case "fellowship":
    case "subFellowship":
      return spec(
        "Hospital / program",
        "e.g. Massachusetts General Hospital",
        "Specialty / discipline",
        "e.g. Interventional Cardiology",
      );
    case "otherTraining":
      return spec(
        "Hospital / program",
        "e.g. Mayo Clinic",
        "Focus",
        "e.g. Surgical Skills",
      );
    // Practice / employment.
    case "practice":
    case "medicalPractice":
      return spec(
        "Practice / clinic",
        "e.g. Bay Cardiology Group",
        "Role",
        "e.g. Attending Physician",
      );
    case "otherEmployment":
    case "employment":
      return spec(
        "Employer / organization",
        "e.g. Kaiser Permanente",
        "Title / role",
        "e.g. Staff Physician",
      );
    case "academia":
    case "advisor":
      return spec(
        "Organization",
        "e.g. Stanford University",
        "Role",
        "e.g. Clinical Professor",
      );
    // Affiliations / credentials.
    case "hospitalAffiliation":
      return spec(
        "Hospital",
        "e.g. UCSF Medical Center",
        "Role",
        "e.g. Attending",
      );
    case "license":
      return spec(
        "Issuing state / board",
        "e.g. California Medical Board",
        "License number",
        "e.g. A12345",
      );
    case "organization":
      return spec(
        "Organization",
        "e.g. American Heart Association",
        "Role",
        "e.g. Member, Fellow",
      );
    // Catch-all.
    case "otherExperience":
      return spec("Name", "e.g. JACC", "Role / detail", "e.g. Reviewer");
    default:
      return spec("Institution", "Institution name", "Role");
  }
}

/**
 * Items grouped into the sections above. With `includeEmpty` (the editor)
 * every section appears so the user can add to it; without it (the profile)
 * only sections with items. "Other" holds otherExperience plus any item whose
 * type belongs to no named section (legacy data). Organizations stays last.
 */
export function groupItems(
  items: CVItem[],
  types: CVItemType[],
  includeEmpty: boolean,
): ExperienceGroup[] {
  const result: ExperienceGroup[] = [];
  const option = (id: string): TypeOption => ({
    id,
    name: friendlyName(id, types),
  });
  for (const def of SECTION_DEFS) {
    const groupItems = items.filter((i) => def.typeIds.includes(i.itemType));
    if (groupItems.length === 0 && !includeEmpty) continue;
    result.push({
      id: def.label,
      label: def.label,
      typeOptions: def.typeIds.map(option),
      isTagLike: def.typeIds.every((id) => fieldSpec(id).isTagLike),
      items: groupItems,
    });
  }
  const otherItems = items.filter((i) => !NAMED_TYPE_IDS.has(i.itemType));
  if (otherItems.length > 0 || includeEmpty) {
    const optionIds = [OTHER_TYPE_ID];
    for (const item of otherItems) {
      if (!optionIds.includes(item.itemType)) optionIds.push(item.itemType);
    }
    result.push({
      id: "Other",
      label: "Other",
      typeOptions: optionIds.map(option),
      isTagLike: false,
      items: otherItems,
    });
  }
  const orgs = result.findIndex((g) => g.id === "Organizations");
  if (orgs >= 0) result.push(...result.splice(orgs, 1));
  return result;
}

/** The type options of the section that owns an item type, so an edit can switch within it. */
export function typeOptionsFor(
  itemType: string,
  types: CVItemType[],
): TypeOption[] {
  const option = (id: string): TypeOption => ({
    id,
    name: friendlyName(id, types),
  });
  const def = SECTION_DEFS.find((d) => d.typeIds.includes(itemType));
  if (def) return def.typeIds.map(option);
  const ids = [OTHER_TYPE_ID];
  if (itemType !== OTHER_TYPE_ID) ids.push(itemType);
  return ids.map(option);
}

/** "2014 – Present", "2014", "Present" or null. */
export function yearRange(item: CVItem): string | null {
  const s = item.start ?? "";
  const e = item.isCurrent ? "Present" : (item.end ?? "");
  if (!s && !e) return null;
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}
