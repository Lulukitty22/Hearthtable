// Who is using the app: a guest, someone signed in with Google who has not chosen an Alias yet,
// or an account (pending or approved). Sign-in is Google only (Campaigns and Shared Data, Guest
// viewing and accounts); nothing from the Google account is stored or shown.

import { watchAccount, type Account } from "@hearthtable/storage";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";

export type Viewer =
  | { readonly status: "loading" }
  | { readonly status: "guest" }
  /** Signed in with Google; the account document has not loaded yet. */
  | { readonly status: "signed-in"; readonly uid: string }
  /** Signed in, with no Alias chosen yet. */
  | { readonly status: "no-alias"; readonly uid: string }
  | { readonly status: "account"; readonly account: Account }
  | { readonly status: "failed"; readonly message: string };

export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>({ status: "loading" });

  useEffect(() => {
    let stopAccount: Unsubscribe | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopAccount?.();
      stopAccount = undefined;
      if (!user) {
        setViewer({ status: "guest" });
        return;
      }
      const uid = user.uid;
      setViewer({ status: "signed-in", uid });
      stopAccount = watchAccount(
        db,
        uid,
        (account) =>
          setViewer(
            account
              ? { status: "account", account }
              : { status: "no-alias", uid },
          ),
        (message) => setViewer({ status: "failed", message }),
      );
    });
    return () => {
      stopAuth();
      stopAccount?.();
    };
  }, []);

  return viewer;
}

export async function signInWithGoogle(): Promise<string | undefined> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return undefined;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "auth/cancelled-popup-request") return undefined;
    // Also reported when the window finished but its result never arrived, which can happen on
    // the emulator while Google's helper script is still loading; trying again then works.
    if (code === "auth/popup-closed-by-user")
      return "the sign-in window closed before signing in finished. If you chose an account, please try again.";
    return error instanceof Error ? error.message : String(error);
  }
}

export function signOutOfGoogle(): Promise<void> {
  return signOut(auth);
}
