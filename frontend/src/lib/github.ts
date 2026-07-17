export type GithubAuth = { login: string; session: string };

const KEY = "shipstake:github-auth";

export function getGithubAuth(): GithubAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GithubAuth;
    return parsed.login && parsed.session ? parsed : null;
  } catch {
    return null;
  }
}

export function setGithubAuth(auth: GithubAuth) {
  window.localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearGithubAuth() {
  window.localStorage.removeItem(KEY);
}

/** Reads ?github=<login>&session=<secret> / ?github_error=<msg> left by the
 * backend's OAuth callback redirect, cleans them off the URL, and returns
 * what it found. */
export function consumeGithubCallbackParams(): { auth?: GithubAuth; error?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const login = params.get("github");
  const session = params.get("session");
  const error = params.get("github_error") ?? undefined;
  if (login || session || error) {
    params.delete("github");
    params.delete("session");
    params.delete("github_error");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
  }
  if (login && session) {
    const auth = { login, session };
    setGithubAuth(auth);
    return { auth, error };
  }
  return { error };
}
