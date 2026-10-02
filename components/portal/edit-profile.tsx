"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { currentUserKey } from "@/lib/portal/current-user";
import {
  changedFields,
  type EditableProfile,
  editableProfileKey,
  toProfileJpeg,
  uploadProfileImage,
  useEditableProfile,
  useUpdateProfile,
} from "@/lib/portal/edit-profile";
import { entityKey } from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import BackButton from "./back-button";
import { PortalError } from "./feed";
import PortalPageHeader from "./page-header";

/* The current photo comes from a user media host; plain <img>, see avatar.tsx. */
/* eslint-disable @next/next/no-img-element */

/**
 * The fields the app's EditProfileView offers, in its order and with its
 * labels. Username keeps the app's a-z, 0-9, _ rule; the backend replaces
 * anything else with an underscore anyway.
 */
const FIELDS: {
  name: keyof EditableProfile;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}[] = [
  { name: "username", label: "Username", hint: "a-z, 0-9 and _ only" },
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "location", label: "Location", placeholder: "San Diego, CA" },
  { name: "specialty", label: "Specialty" },
  { name: "npi", label: "NPI" },
  { name: "disclosures", label: "Disclosures", multiline: true },
  { name: "interests", label: "Interests", multiline: true },
  { name: "bio", label: "Bio", multiline: true },
  {
    name: "flair",
    label: "Post flair",
    hint: "Displays on your posts",
  },
];

/** How long to keep asking for the new photo's URLs after the upload lands. */
const PHOTO_POLL = { attempts: 6, intervalMs: 2000 };

export default function EditProfile() {
  const profile = useEditableProfile();
  if (profile.isError) {
    return (
      <>
        <PortalPageHeader
          title="Edit Profile"
          leading={<BackButton fallback="/profile" />}
        />
        <PortalError error={profile.error} retry={() => profile.refetch()} />
      </>
    );
  }
  if (!profile.data) {
    return (
      <>
        <PortalPageHeader
          title="Edit Profile"
          leading={<BackButton fallback="/profile" />}
        />
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      </>
    );
  }
  return <EditProfileForm key={profile.data.userId} initial={profile.data} />;
}

function EditProfileForm({
  initial,
}: {
  initial: EditableProfile & {
    userId: string;
    profilePicMediumUrl: string | null;
    profilePicThumbnailUrl: string | null;
  };
}) {
  const router = useRouter();
  const client = useQueryClient();
  const update = useUpdateProfile();

  const [draft, setDraft] = useState<EditableProfile>(() => ({ ...initial }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const changes = useMemo(
    () => changedFields(initial, draft),
    [initial, draft],
  );
  const dirty = Object.keys(changes).length > 0 || photo !== null;
  const usernameBad = draft.username.trim().length === 0;

  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const set = (name: keyof EditableProfile, value: string) =>
    setDraft((d) => ({
      ...d,
      [name]:
        name === "username"
          ? value.toLowerCase().replace(/[^a-z0-9_]/g, "")
          : value,
    }));

  const save = async () => {
    if (!dirty || saving || usernameBad) return;
    setSaving(true);
    setPhotoError(null);
    try {
      // Text first, then the photo, as the app does.
      if (Object.keys(changes).length > 0) {
        await update.mutateAsync(changes);
      }
      if (photo) {
        const before = initial.profilePicMediumUrl;
        await uploadProfileImage(await toProfileJpeg(photo));
        // The picture lands asynchronously; ask again until the URL moves.
        for (let i = 0; i < PHOTO_POLL.attempts; i++) {
          await new Promise((r) => setTimeout(r, PHOTO_POLL.intervalMs));
          await client.invalidateQueries({ queryKey: editableProfileKey });
          const now = client.getQueryData<{
            profilePicMediumUrl: string | null;
          }>(editableProfileKey);
          if (now && now.profilePicMediumUrl !== before) break;
        }
        await Promise.all([
          client.invalidateQueries({ queryKey: currentUserKey }),
          client.invalidateQueries({
            queryKey: entityKey.user(initial.userId),
          }),
        ]);
      }
      router.push("/profile");
    } catch (e) {
      if (photo && !(e instanceof Error && e.message.startsWith("Photo"))) {
        // The text save failed; the photo was never attempted.
      } else if (photo) {
        setPhotoError(e instanceof Error ? e.message : "Photo upload failed");
      }
      setSaving(false);
    }
  };

  const error = update.error ?? (photoError ? new Error(photoError) : null);
  const currentPic =
    previewUrl ?? initial.profilePicMediumUrl ?? initial.profilePicThumbnailUrl;

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PortalPageHeader
        title="Edit Profile"
        leading={<BackButton fallback="/profile" />}
        trailing={
          <Button
            type="submit"
            variant="glow"
            size="sm"
            className="rounded-full"
            disabled={!dirty || saving || usernameBad}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Change profile photo"
          className="group relative size-32 overflow-hidden rounded-full"
        >
          {currentPic ? (
            <img src={currentPic} alt="" className="size-full object-cover" />
          ) : (
            <span className="bg-muted text-muted-foreground flex size-full items-center justify-center text-4xl font-semibold">
              {(initial.firstName || initial.username || "?")[0]?.toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 flex items-end justify-center bg-black/0 pb-3 transition-colors group-hover:bg-black/30">
            <span className="bg-background/90 text-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow">
              <Camera className="size-3.5" aria-hidden />
              {photo ? "Change" : "Edit photo"}
            </span>
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setPhoto(f);
            setPhotoError(null);
            e.target.value = "";
          }}
        />
        {photo && (
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Keep current photo
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {FIELDS.map(({ name, label, placeholder, multiline, hint }) => {
          const id = `profile-${name}`;
          const common = {
            id,
            name,
            value: draft[name],
            placeholder,
            disabled: saving,
            "aria-invalid":
              name === "username" && usernameBad ? true : undefined,
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => set(name, e.target.value),
          };
          return (
            <div key={name} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium">
                {label}
              </label>
              {multiline ? (
                <Textarea {...common} rows={3} />
              ) : (
                <Input
                  {...common}
                  autoCapitalize={name === "username" ? "none" : undefined}
                  className={cn(
                    name === "username" && usernameBad && "border-destructive",
                  )}
                />
              )}
              {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
            </div>
          );
        })}

        {error && (
          <p role="alert" className="text-destructive-foreground text-sm">
            {error.message}
          </p>
        )}
      </div>
    </form>
  );
}
