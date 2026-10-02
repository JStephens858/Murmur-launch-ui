import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SparkMD5 from "spark-md5";
import * as tus from "tus-js-client";

import { currentUserKey } from "./current-user";
import { accessToken, PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type { MurmurResponse, PortalUser, StoreData } from "./types";

/**
 * Editing your own profile, as the app's EditProfileView does it.
 *
 * Text fields go through `updateUser`, the same mutation the app sends, and
 * only the fields that changed are sent: the backend treats a null argument
 * as "leave it", an empty string as "clear it", and re-runs NPI validation
 * whenever an NPI is present, so resending unchanged values is not free.
 *
 * The photo follows the app's upload protocol: ask `getUploadFileUrls` for a
 * profileImage slot (content type, size, MD5), then push the bytes to the
 * returned tus endpoint with the API token in the authorization header. The
 * upload server tells the API when the file lands and the API writes the
 * thumbnail and medium URLs onto the user, so the new picture appears on the
 * next profile fetch, not in the mutation's response.
 */

/** The editable fields, in the app's order. */
export interface EditableProfile {
  username: string;
  firstName: string;
  lastName: string;
  location: string;
  specialty: string;
  npi: string;
  disclosures: string;
  interests: string;
  bio: string;
  flair: string;
}

export const EDITABLE_FIELDS = [
  "username",
  "firstName",
  "lastName",
  "location",
  "specialty",
  "npi",
  "disclosures",
  "interests",
  "bio",
  "flair",
] as const satisfies readonly (keyof EditableProfile)[];

interface ProfileUser extends EditableProfile {
  userId: string;
  displayName: string | null;
  profilePicThumbnailUrl: string | null;
  profilePicMediumUrl: string | null;
}

const USER_FIELDS = /* GraphQL */ `
  userId
  username
  displayName
  firstName
  lastName
  npi
  specialty
  location
  flair
  interests
  bio
  disclosures
  profilePicThumbnailUrl
  profilePicMediumUrl
`;

const GET_PROFILE_FOR_EDIT = /* GraphQL */ `
  query getProfileForEdit {
    getProfile {
      success
      errorMsg
      errorCode
      results {
        user {
          ${USER_FIELDS}
        }
      }
    }
  }
`;

type RawUser = {
  [K in keyof ProfileUser]: ProfileUser[K] | null;
};

interface ProfileData {
  getProfile: MurmurResponse & {
    results: { user: RawUser | null } | { user: RawUser | null }[] | null;
  };
}

function normalize(user: RawUser): ProfileUser {
  const out = { ...user } as ProfileUser;
  for (const f of EDITABLE_FIELDS) out[f] = user[f] ?? "";
  return out;
}

export const editableProfileKey = ["currentUser", "edit"] as const;

/** The signed-in physician with every editable field, blanks as "". */
export function useEditableProfile() {
  return useQuery({
    queryKey: editableProfileKey,
    queryFn: async (): Promise<ProfileUser> => {
      const data = await portalQuery<ProfileData>(GET_PROFILE_FOR_EDIT);
      const res = data.getProfile;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load your profile",
          res.errorCode,
        );
      }
      const results = res.results;
      const user = Array.isArray(results)
        ? (results[0]?.user ?? null)
        : (results?.user ?? null);
      if (!user) throw new PortalApiError("Couldn't load your profile");
      return normalize(user);
    },
    staleTime: 0,
  });
}

const UPDATE_USER = /* GraphQL */ `
  mutation updateUser(
    $username: String
    $firstName: String
    $lastName: String
    $npi: String
    $specialty: String
    $location: String
    $flair: String
    $interests: String
    $bio: String
    $disclosures: String
  ) {
    updateUser(
      username: $username
      firstName: $firstName
      lastName: $lastName
      npi: $npi
      specialty: $specialty
      location: $location
      flair: $flair
      interests: $interests
      bio: $bio
      disclosures: $disclosures
    ) {
      success
      errorMsg
      errorCode
      results {
        user {
          ${USER_FIELDS}
        }
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface UpdateUserData {
  updateUser: MurmurResponse & {
    results: { user: RawUser | null } | null;
    store: StoreData | null;
  };
}

/** The fields whose value differs, for the mutation; nothing else is sent. */
export function changedFields(
  before: EditableProfile,
  after: EditableProfile,
): Partial<EditableProfile> {
  const out: Partial<EditableProfile> = {};
  for (const f of EDITABLE_FIELDS) {
    if (after[f].trim() !== before[f]) out[f] = after[f].trim();
  }
  return out;
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Partial<EditableProfile>) => {
      const data = await portalQuery<UpdateUserData>(UPDATE_USER, changes);
      const res = data.updateUser;
      if (!res.success) {
        // 504 is the backend's "duplicate username"; its message is terse.
        throw new PortalApiError(
          res.errorCode === 504
            ? "That username is already taken. Please choose another."
            : (res.errorMsg ?? "Couldn't save your profile"),
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const user = res.results?.user;
      const normalized = user ? normalize(user) : null;
      if (normalized) {
        client.setQueryData(editableProfileKey, normalized);
        // The store entity drives the profile page; merge in what changed so
        // it doesn't wait for a refetch. Only the store's own fields go in.
        const {
          username,
          specialty,
          flair,
          location,
          bio,
          disclosures,
          interests,
        } = normalized;
        client.setQueryData<PortalUser>(
          entityKey.user(normalized.userId),
          (prev) =>
            prev
              ? {
                  ...prev,
                  username,
                  specialty,
                  flair,
                  location,
                  bio,
                  disclosures,
                  interests,
                  displayName: normalized.displayName ?? prev.displayName,
                  profilePicThumbnailUrl: normalized.profilePicThumbnailUrl,
                  profilePicMediumUrl: normalized.profilePicMediumUrl,
                }
              : prev,
        );
      }
      await client.invalidateQueries({ queryKey: currentUserKey });
      return normalized;
    },
  });
}

const GET_UPLOAD_FILE_URLS = /* GraphQL */ `
  query getUploadFileUrls($requests: [UploadFileUrlIn]) {
    getUploadFileUrls(requests: $requests) {
      success
      errorMsg
      errorCode
      results {
        fileUrls {
          uploadType
          uploadFileUrl
          fileKey
        }
      }
    }
  }
`;

interface UploadUrlsData {
  getUploadFileUrls: MurmurResponse & {
    results: {
      fileUrls: {
        uploadType: string;
        uploadFileUrl: string;
        fileKey: string;
      }[];
    } | null;
  };
}

/** Longest edge of the uploaded picture; the app uploads camera-sized JPEGs, this keeps web uploads sane. */
const MAX_EDGE = 1200;
/** The app's jpegData(compressionQuality: 0.7). */
const JPEG_QUALITY = 0.7;

/** Re-encodes any image file as a JPEG no larger than MAX_EDGE on a side. */
export async function toProfileJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't encode the image")),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}

/**
 * Uploads a JPEG as the signed-in physician's profile picture, the app's
 * way: an upload slot from the API, then a tus upload to the server it names.
 */
export async function uploadProfileImage(jpeg: Blob): Promise<void> {
  const bytes = await jpeg.arrayBuffer();
  const md5Sum = SparkMD5.ArrayBuffer.hash(bytes);
  const data = await portalQuery<UploadUrlsData>(GET_UPLOAD_FILE_URLS, {
    requests: [
      {
        contentType: "image/jpeg",
        uploadType: "profileImage",
        size: bytes.byteLength,
        md5Sum,
      },
    ],
  });
  const res = data.getUploadFileUrls;
  const slot = res.results?.fileUrls[0];
  if (!res.success || !slot) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't start the photo upload",
      res.errorCode,
    );
  }
  // The app sends the bare token here (no "Bearer"), so this does too.
  const token = await accessToken();
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(jpeg, {
      endpoint: slot.uploadFileUrl,
      headers: { authorization: token },
      metadata: { filename: slot.fileKey, filetype: "image/jpeg" },
      retryDelays: [0, 1000, 3000],
      onError: (error) =>
        reject(new Error(`Photo upload failed: ${error.message}`)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
