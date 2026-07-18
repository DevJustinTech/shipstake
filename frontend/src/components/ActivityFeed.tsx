"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { BACKEND_URL } from "@/lib/contract";
import { getGithubAuth } from "@/lib/github";

type Commit = { sha: string; message: string; author: string; date: string; url: string };
type Activity = { repo: string; commits: Commit[] };

const POLL_MS = 30_000;

/** Live commit ticker under a commitment — the verifier's view of the repo,
 *  so the card shows the exact evidence that will (or won't) save the stake.
 *  Renders nothing until the backend answers; a dead backend or an
 *  unregistered commitment just means no feed, never a broken card. */
export function ActivityFeed({ id }: { id: number }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [newestSha, setNewestSha] = useState<string | null>(null);
  const prevTop = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams();
        const auth = getGithubAuth();
        if (auth) {
          params.set("github_login", auth.login);
          params.set("session", auth.session);
        }
        const query = params.size ? `?${params}` : "";
        const resp = await fetch(`${BACKEND_URL}/commitments/${id}/activity${query}`);
        if (!resp.ok || cancelled) return;
        const data: Activity = await resp.json();
        if (cancelled) return;
        const top = data.commits[0]?.sha ?? null;
        if (top && prevTop.current !== null && top !== prevTop.current) setNewestSha(top);
        prevTop.current = top;
        setActivity(data);
      } catch {
        // verifier unreachable — keep whatever we last showed
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  if (!activity) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-line pt-2 font-mono text-xs">
      <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted">
        <span className="inline-flex size-1.5 animate-blink rounded-full bg-primary" aria-hidden="true" />
        watching {activity.repo}
      </span>
      {activity.commits.length === 0 ? (
        <span className="text-muted/70">no commits yet — the clock is running</span>
      ) : (
        <ul className="flex flex-col gap-1">
          {activity.commits.map((c) => (
            <li
              key={c.sha}
              className={`flex items-baseline gap-2 ${c.sha === newestSha ? "animate-pop" : ""}`}
            >
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-primary hover:underline"
              >
                {c.sha}
              </a>
              <span className="truncate text-foreground/90">{c.message}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted">
                {formatDistanceToNowStrict(new Date(c.date), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
