"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_SENSITIVITIES,
  SENSITIVITY_LABEL,
  type ActivityLevel,
  type DogSize,
  type Sensitivity,
} from "@/data/customers";
import {
  EMPTY_QUEUE,
  enqueueRecord,
  queueSummary,
  syncQueue,
  type StallQueueState,
  type StallSyncOutcome,
} from "@/lib/stall-queue";
import { createBrowserQueueStorage } from "@/lib/stall-queue-browser";
import type { StallRecord } from "@/lib/stall-record";

// A draft dog while the conversation is still going: strings throughout, shaped
// into a StallRecord dog only at save time.
type DraftDog = {
  name: string;
  breed: string;
  bornAt: string;
  size: DogSize | "";
  activity: ActivityLevel | "";
  sensitivities: Sensitivity[];
  allergies: string;
  photoData: string;
};

const EMPTY_DOG: DraftDog = {
  name: "",
  breed: "",
  bornAt: "",
  size: "",
  activity: "",
  sensitivities: [],
  allergies: "",
  photoData: "",
};

type Draft = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  dogs: DraftDog[];
  marketing: boolean;
  photoConsent: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  dogs: [],
  marketing: false,
  photoConsent: false,
};

type Screen =
  | "start"
  | "name"
  | "email"
  | "phone"
  | "address"
  | "dog-name"
  | "dog-breed"
  | "dog-born"
  | "dog-size"
  | "dog-activity"
  | "dog-sensitivities"
  | "dog-allergies"
  | "dog-more"
  | "consent"
  | "photos"
  | "saved";

const DOG_SCREENS: Screen[] = [
  "dog-name",
  "dog-breed",
  "dog-born",
  "dog-size",
  "dog-activity",
  "dog-sensitivities",
  "dog-allergies",
];

// Same labels as the account DogForm, so the vocabulary Michaela speaks at the
// table matches the one customers see at home.
const SIZES: { value: DogSize; label: string }[] = [
  { value: "small", label: "Wee one" },
  { value: "medium", label: "Middle sized" },
  { value: "large", label: "Big unit" },
];

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "low", label: "Steady" },
  { value: "moderate", label: "Middling" },
  { value: "high", label: "Never stops" },
];

/** Downscale a camera photo to a queue-sized JPEG data URL. */
async function fileToPhotoData(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable image"));
      img.src = url;
    });
    const longest = Math.max(image.width, image.height);
    const scale = longest > 1280 ? 1280 / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The stall signup form, spec 10.1.1: one question per screen, thumb-sized targets,
 * every field skippable, saved locally before any network, synced when signal
 * allows, wiped at end of day because the iPad is borrowed.
 */
export default function StallForm() {
  const storageRef = useRef(createBrowserQueueStorage<StallRecord>());
  const syncingRef = useRef(false);
  const queueRef = useRef<StallQueueState>(EMPTY_QUEUE);
  const [queue, setQueueState] = useState<StallQueueState>(EMPTY_QUEUE);
  const [screen, setScreen] = useState<Screen>("start");
  const [dogIndex, setDogIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, dogs: [{ ...EMPTY_DOG }] });
  const [sessionEnded, setSessionEnded] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  const setQueue = useCallback((state: StallQueueState) => {
    queueRef.current = state;
    setQueueState(state);
  }, []);

  /** Post one record; map the response onto a queue outcome. */
  const sender = useCallback(async (record: StallRecord): Promise<StallSyncOutcome> => {
    const res = await fetch("/api/stall/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) return "synced";
    if (res.status === 401) {
      setSessionEnded(true);
      return "retry";
    }
    return res.status === 400 ? "rejected" : "retry";
  }, []);

  const runSync = useCallback(
    async (includeFailed: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const after = await syncQueue(queueRef.current, sender, includeFailed);
        setQueue(after);
        try {
          await storageRef.current.save(after);
        } catch {
          setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [sender, setQueue],
  );

  // Load the queue, then try a sync; keep trying whenever signal comes back.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storageRef.current.load();
      if (cancelled) return;
      setQueue(loaded);
      void runSync(false);
    })();
    const onOnline = () => void runSync(false);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [runSync, setQueue]);

  function patchDog(patch: Partial<DraftDog>) {
    setDraft((d) => ({
      ...d,
      dogs: d.dogs.map((dog, i) => (i === dogIndex ? { ...dog, ...patch } : dog)),
    }));
  }

  const dog = draft.dogs[dogIndex] ?? EMPTY_DOG;

  function next() {
    if (screen === "name") setScreen("email");
    else if (screen === "email") setScreen("phone");
    else if (screen === "phone") setScreen("address");
    else if (screen === "address") setScreen("dog-name");
    else if (screen === "dog-name" && !dog.name.trim()) setScreen("consent");
    else if (DOG_SCREENS.includes(screen)) {
      const at = DOG_SCREENS.indexOf(screen);
      setScreen(at + 1 < DOG_SCREENS.length ? DOG_SCREENS[at + 1] : "dog-more");
    }
  }

  function back() {
    if (screen === "email") setScreen("name");
    else if (screen === "phone") setScreen("email");
    else if (screen === "address") setScreen("phone");
    else if (screen === "dog-name") setScreen("address");
    else if (DOG_SCREENS.includes(screen)) {
      const at = DOG_SCREENS.indexOf(screen);
      setScreen(DOG_SCREENS[at - 1]);
    } else if (screen === "dog-more") setScreen("dog-allergies");
    else if (screen === "consent") setScreen(dog.name.trim() ? "dog-more" : "dog-name");
    else if (screen === "photos") setScreen("consent");
  }

  async function save() {
    const record: StallRecord = {
      clientId: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      address: {
        line1: draft.line1.trim(),
        line2: draft.line2.trim(),
        city: draft.city.trim(),
        postcode: draft.postcode.trim().toUpperCase(),
      },
      dogs: draft.dogs
        .filter((d) => d.name.trim())
        .map((d) => ({
          value: {
            name: d.name.trim(),
            ...(d.breed.trim() ? { breed: d.breed.trim() } : {}),
            ...(d.bornAt ? { bornAt: d.bornAt } : {}),
            ...(d.size ? { size: d.size } : {}),
            ...(d.activity ? { activity: d.activity } : {}),
            ...(d.sensitivities.length ? { sensitivities: d.sensitivities } : {}),
            ...(d.allergies.trim()
              ? {
                  allergies: d.allergies
                    .split(",")
                    .map((a) => a.trim().toLowerCase())
                    .filter(Boolean),
                }
              : {}),
          },
          ...(d.photoData ? { photoData: d.photoData } : {}),
        })),
      consent: { marketing: draft.marketing, photo: draft.photoConsent },
    };

    // Local first, always: the queue in memory and on disk before any network.
    const after = enqueueRecord(queueRef.current, record);
    setQueue(after);
    try {
      await storageRef.current.save(after);
    } catch {
      setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
    }
    setScreen("saved");
    void runSync(false);
  }

  async function endDay() {
    if (
      !window.confirm(
        "End the day? This wipes every record from this iPad. Anything not yet synced is lost.",
      )
    ) {
      return;
    }
    // The wipe is local and unconditional; the logout call is best effort. The
    // borrowed iPad must come up clean even with no signal at the pack-down.
    try {
      await storageRef.current.wipe();
    } catch {
      // deleteDatabase resolving is the best a browser offers; carry on to logout.
    }
    setQueue(EMPTY_QUEUE);
    try {
      await fetch("/api/stall/session", { method: "DELETE" });
    } catch {
      // Offline: the cookie dies on its own within 14 hours.
    }
    window.location.reload();
  }

  async function choosePhoto(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photoData = await fileToPhotoData(file);
      setDraft((d) => ({
        ...d,
        dogs: d.dogs.map((dg, at) => (at === i ? { ...dg, photoData } : dg)),
      }));
    } catch {
      // A photo that will not read is skipped; the signup still saves.
    }
  }

  const summary = queueSummary(queue);
  const namedDogs = draft.dogs.filter((d) => d.name.trim());

  const bigBtn = { fontSize: "1.15rem", padding: "1.05rem 1.4rem" } as const;
  const bigInput = { fontSize: "1.3rem", padding: "0.9rem" } as const;

  /** Back, Skip, Next in a row, all thumb sized. Skip clears the screen's field. */
  function nav(onSkip: () => void, nextLabel = "Next") {
    return (
      <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
        <button className="btn" type="button" onClick={back} style={bigBtn}>
          Back
        </button>
        <button
          className="btn"
          type="button"
          style={{ ...bigBtn, marginLeft: "auto" }}
          onClick={() => {
            onSkip();
            next();
          }}
        >
          Skip
        </button>
        <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
          {nextLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <p className="notice" aria-live="polite" style={{ marginBottom: "1.2rem" }}>
        {summary.label}
        {summary.failed > 0 && screen === "start" && " Use Sync now below."}
      </p>
      {sessionEnded && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          The stall session has ended. Records are safe on this iPad. Reload this page and
          enter the PIN to carry on syncing.
        </p>
      )}
      {storageWarning && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          {storageWarning}
        </p>
      )}

      {screen === "start" && (
        <div className="panel">
          <p className="panel__title">Stall signups</p>
          <p style={{ marginBottom: "1.2rem" }}>
            Records save to this iPad first and sync themselves when there is signal.
          </p>
          <button
            className="btn btn--solid-ink btn--block"
            type="button"
            style={{ fontSize: "1.3rem", padding: "1.2rem" }}
            onClick={() => {
              setDraft({ ...EMPTY_DRAFT, dogs: [{ ...EMPTY_DOG }] });
              setDogIndex(0);
              setScreen("name");
            }}
          >
            New signup
          </button>
          <p style={{ marginTop: "1rem" }}>
            <Link className="btn btn--block" href="/stall/sale" style={bigBtn}>
              Record a sale
            </Link>
          </p>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={() => void runSync(true)}>
              Sync now
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => void endDay()}
            >
              End the day
            </button>
          </div>
        </div>
      )}

      {screen === "name" && (
        <div className="panel">
          <p className="panel__title">What is their name?</p>
          <label className="field">
            <span>Their name</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={bigInput}
            />
          </label>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={() => setScreen("start")}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                setDraft((d) => ({ ...d, name: "" }));
                next();
              }}
            >
              Skip
            </button>
            <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
              Next
            </button>
          </div>
        </div>
      )}

      {screen === "email" && (
        <div className="panel">
          <p className="panel__title">Best email for them?</p>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">
              This is how their account reaches them. Skippable, but without it there is no
              sign-in and no welcome email.
            </span>
          </label>
          {nav(() => setDraft((d) => ({ ...d, email: "" })))}
        </div>
      )}

      {screen === "phone" && (
        <div className="panel">
          <p className="panel__title">A phone number?</p>
          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              style={bigInput}
            />
          </label>
          {nav(() => setDraft((d) => ({ ...d, phone: "" })))}
        </div>
      )}

      {screen === "address" && (
        <div className="panel">
          <p className="panel__title">Where do they live?</p>
          <label className="field">
            <span>First line</span>
            <input
              value={draft.line1}
              onChange={(e) => setDraft({ ...draft, line1: e.target.value })}
              style={bigInput}
            />
          </label>
          <label className="field">
            <span>Second line</span>
            <input
              value={draft.line2}
              onChange={(e) => setDraft({ ...draft, line2: e.target.value })}
              style={bigInput}
            />
          </label>
          <div className="form-grid form-grid--2">
            <label className="field">
              <span>Town or city</span>
              <input
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                style={bigInput}
              />
            </label>
            <label className="field">
              <span>Postcode</span>
              <input
                autoCapitalize="characters"
                value={draft.postcode}
                onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
                style={bigInput}
              />
            </label>
          </div>
          {nav(() => setDraft((d) => ({ ...d, line1: "", line2: "", city: "", postcode: "" })))}
        </div>
      )}

      {screen === "dog-name" && (
        <div className="panel">
          <p className="panel__title">
            {dogIndex === 0 ? "And who is the dog?" : "And the next dog's name?"}
          </p>
          <label className="field">
            <span>Dog&apos;s name</span>
            <input
              autoFocus
              value={dog.name}
              onChange={(e) => patchDog({ name: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">Skipping this skips the dog questions.</span>
          </label>
          {/* Skip here jumps straight to consent rather than calling next(), because
              next() would read the dog name from a closure taken before the clear. */}
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                patchDog({ ...EMPTY_DOG });
                setScreen("consent");
              }}
            >
              Skip
            </button>
            <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
              Next
            </button>
          </div>
        </div>
      )}

      {screen === "dog-breed" && (
        <div className="panel">
          <p className="panel__title">What is {dog.name || "the dog"}?</p>
          <label className="field">
            <span>Breed</span>
            <input
              value={dog.breed}
              onChange={(e) => patchDog({ breed: e.target.value })}
              placeholder="Cane Corso, or a good guess"
              style={bigInput}
            />
          </label>
          {nav(() => patchDog({ breed: "" }))}
        </div>
      )}

      {screen === "dog-born" && (
        <div className="panel">
          <p className="panel__title">Roughly when was {dog.name || "the dog"} born?</p>
          <label className="field">
            <span>A rough date is fine</span>
            <input
              type="date"
              value={dog.bornAt}
              onChange={(e) => patchDog({ bornAt: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">
              &quot;About three&quot; is the first of the month, three years back. It only
              feeds puppy, adult or senior.
            </span>
          </label>
          {nav(() => patchDog({ bornAt: "" }))}
        </div>
      )}

      {screen === "dog-size" && (
        <div className="panel">
          <p className="panel__title">How big is {dog.name || "the dog"}?</p>
          <div className="chips">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.size === s.value}
                onClick={() => patchDog({ size: dog.size === s.value ? "" : s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ size: "" }))}
        </div>
      )}

      {screen === "dog-activity" && (
        <div className="panel">
          <p className="panel__title">How much go has {dog.name || "the dog"} got?</p>
          <div className="chips">
            {ACTIVITY.map((a) => (
              <button
                key={a.value}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.activity === a.value}
                onClick={() => patchDog({ activity: dog.activity === a.value ? "" : a.value })}
              >
                {a.label}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ activity: "" }))}
        </div>
      )}

      {screen === "dog-sensitivities" && (
        <div className="panel">
          <p className="panel__title">Anything {dog.name || "the dog"} struggles with?</p>
          <div className="chips">
            {ALL_SENSITIVITIES.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.sensitivities.includes(s)}
                onClick={() =>
                  patchDog({
                    sensitivities: dog.sensitivities.includes(s)
                      ? dog.sensitivities.filter((x) => x !== s)
                      : [...dog.sensitivities, s],
                  })
                }
              >
                {SENSITIVITY_LABEL[s]}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ sensitivities: [] }))}
        </div>
      )}

      {screen === "dog-allergies" && (
        <div className="panel">
          <p className="panel__title">Any ingredients that upset them?</p>
          <label className="field">
            <span>Separate with commas</span>
            <input
              value={dog.allergies}
              onChange={(e) => patchDog({ allergies: e.target.value })}
              placeholder="chicken, wheat"
              style={bigInput}
            />
          </label>
          {nav(() => patchDog({ allergies: "" }))}
        </div>
      )}

      {screen === "dog-more" && (
        <div className="panel">
          <p className="panel__title">Another dog at home?</p>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.2rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                setDraft((d) => ({ ...d, dogs: [...d.dogs, { ...EMPTY_DOG }] }));
                setDogIndex(draft.dogs.length);
                setScreen("dog-name");
              }}
            >
              Yes, add one
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={bigBtn}
              onClick={() => setScreen("consent")}
            >
              No, carry on
            </button>
          </div>
        </div>
      )}

      {screen === "consent" && (
        <div className="panel">
          <p className="panel__title">Now this bit is yours, not ours</p>
          <p style={{ marginBottom: "1.2rem" }}>
            Michaela hands you the iPad here. Tap whichever you are happy with, or neither.
            Nothing is ticked unless you tick it.
          </p>
          <div className="chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button
              type="button"
              className="chip"
              style={{ fontSize: "1rem", padding: "1.1rem", textAlign: "left" }}
              aria-pressed={draft.marketing}
              onClick={() => setDraft((d) => ({ ...d, marketing: !d.marketing }))}
            >
              Email me the new stuff and the member offers. Unsubscribe any time.
            </button>
            <button
              type="button"
              className="chip"
              style={{ fontSize: "1rem", padding: "1.1rem", textAlign: "left" }}
              aria-pressed={draft.photoConsent}
              onClick={() => setDraft((d) => ({ ...d, photoConsent: !d.photoConsent }))}
            >
              {namedDogs.length
                ? `You can share ${namedDogs.map((d) => d.name.trim()).join(" and ")}'s photo on Dogs of the Day.`
                : "You can share my dog's photo on Dogs of the Day."}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => setScreen("photos")}
            >
              Done, hand it back
            </button>
          </div>
        </div>
      )}

      {screen === "photos" && (
        <div className="panel">
          <p className="panel__title">{namedDogs.length ? "Last thing: a photo" : "Last thing"}</p>
          {namedDogs.length === 0 && (
            <p style={{ marginBottom: "1.2rem" }}>No dog on this one, so nothing to snap.</p>
          )}
          {draft.dogs.map((d, i) =>
            d.name.trim() ? (
              <div key={i} className="photo-pick" style={{ marginBottom: "1rem" }}>
                {d.photoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="photo-pick__preview" src={d.photoData} alt={d.name} />
                ) : null}
                <label className="btn btn--solid-ink" style={{ ...bigBtn, cursor: "pointer" }}>
                  {d.photoData ? `Retake ${d.name}` : `Snap ${d.name}`}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void choosePhoto(i, e)}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            ) : null,
          )}
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto", fontSize: "1.25rem" }}
              onClick={() => void save()}
            >
              Save this signup
            </button>
          </div>
        </div>
      )}

      {screen === "saved" && (
        <div className="panel">
          <p className="panel__title">Saved on this iPad</p>
          <p style={{ marginBottom: "1.2rem" }}>
            It will sync itself the moment there is signal. Nothing more to do.
          </p>
          <button
            className="btn btn--solid-ink btn--block"
            type="button"
            style={{ fontSize: "1.3rem", padding: "1.2rem" }}
            onClick={() => setScreen("start")}
          >
            Back to the start
          </button>
        </div>
      )}
    </div>
  );
}
