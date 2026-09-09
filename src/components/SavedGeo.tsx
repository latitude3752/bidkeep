"use client";

import { useEffect } from "react";

const KEY = "bidkeep-pop-state";

/** Remembers a filter value (POP state by default, or any other single
 * query param via paramName/storageKey) after the visitor picks one, and
 * re-applies it on a later visit that doesn't already specify that param. */
export default function SavedGeo({
  currentState,
  storageKey = KEY,
  paramName = "state",
}: {
  currentState: string;
  storageKey?: string;
  paramName?: string;
}) {
  useEffect(() => {
    if (currentState && currentState !== "all") {
      window.localStorage.setItem(storageKey, currentState);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    // A visitor who explicitly clears the filter still has the param key in
    // the URL (e.g. "myZip="), just with an empty value -- params.get() can't
    // tell that apart from the param being absent entirely, which used to
    // make an explicit clear immediately get overwritten by the remembered
    // value below. params.has() distinguishes "cleared" from "never set".
    if (params.has(paramName)) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const saved = window.localStorage.getItem(storageKey);
    if (!saved || saved === "all") return;
    params.set(paramName, saved);
    window.location.replace(`${window.location.pathname}?${params.toString()}`);
  }, [currentState, storageKey, paramName]);

  return null;
}
