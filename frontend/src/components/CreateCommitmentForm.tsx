"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Github, X } from "lucide-react";
import { parseEther, parseEventLogs, isAddress } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { format } from "date-fns";
import { BACKEND_URL, CONTRACT_ADDRESS, COMMITMENT_DEVICE_ABI } from "@/lib/contract";
import { trackId } from "@/lib/storage";
import {
  clearGithubAuth,
  consumeGithubCallbackParams,
  getGithubAuth,
  type GithubAuth,
} from "@/lib/github";
import { RepoPicker, type RepoOption } from "@/components/RepoPicker";
import { WindowCard } from "@/components/ui/WindowCard";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";

const inputClass =
  "rounded-none border-2 border-line bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none";
const labelClass = "flex flex-col gap-1 text-xs font-mono uppercase tracking-wide text-muted";
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const minutes = Array.from({ length: 12 }, (_, minute) => minute * 5);
// Wallet confirmation + block inclusion eat real time between the client-side
// check and the contract's own `deadline <= block.timestamp` check — without
// this buffer, a deadline picked just a few minutes out can race and revert.
const MIN_DEADLINE_BUFFER_SECONDS = BigInt(10 * 60);

export function CreateCommitmentForm({ onCreated }: { onCreated: () => void }) {
  const { isConnected } = useAccount();
  const [description, setDescription] = useState("");
  const [repo, setRepo] = useState<RepoOption | null>(null);
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [stake, setStake] = useState("0.1");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [validating, setValidating] = useState(false);
  const [auth, setAuth] = useState<GithubAuth | null>(null);

  useEffect(() => {
    const { error: oauthError } = consumeGithubCallbackParams();
    if (oauthError) setError(`GitHub connect failed: ${oauthError}`);
    setAuth(getGithubAuth());
  }, []);

  useEffect(() => {
    if (!auth) {
      setRepos([]);
      setRepo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setReposLoading(true);
      try {
        const params = new URLSearchParams({ login: auth.login, session: auth.session });
        const resp = await fetch(`${BACKEND_URL}/github/repos?${params}`);
        if (resp.status === 401) {
          // stale or revoked session (e.g. verifier DB reset) — force a reconnect
          if (!cancelled) {
            clearGithubAuth();
            setAuth(null);
            setError("Your GitHub connection expired — connect again.");
          }
          return;
        }
        if (!resp.ok) {
          const detail = (await resp.json().catch(() => null))?.detail;
          throw new Error(detail ?? `Couldn't load your repos (${resp.status})`);
        }
        const data = await resp.json();
        if (!cancelled) setRepos(data.repos);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your repos");
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!receipt) return;

    (async () => {
      setRegistering(true);
      try {
        const logs = parseEventLogs({
          abi: COMMITMENT_DEVICE_ABI,
          logs: receipt.logs,
          eventName: "CommitmentCreated",
        });
        const id = logs[0]?.args.id;
        if (id === undefined) throw new Error("Couldn't find the commitment id in the tx receipt");

        const resp = await fetch(`${BACKEND_URL}/commitments/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commitment_id: Number(id),
            github_owner: repo?.owner,
            github_repo: repo?.name,
            github_author: null,
            github_login: auth?.login ?? null,
            session: auth?.session ?? null,
          }),
        });
        if (!resp.ok) {
          const detail = (await resp.json().catch(() => null))?.detail;
          throw new Error(detail ?? `Verifier rejected the registration (${resp.status})`);
        }

        trackId(Number(id), parseEther(stake || "0"));
        setDescription("");
        setRepo(null);
        setBeneficiary("");
        setDeadline("");
        onCreated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to register commitment with the verifier");
      } finally {
        setRegistering(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!auth) {
      setError("Connect your GitHub first");
      return;
    }
    if (!isAddress(beneficiary)) {
      setError("Beneficiary must be a valid address");
      return;
    }
    if (!description || !repo || !deadline) {
      setError("Fill in every field");
      return;
    }

    const deadlineUnix = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    const nowUnix = BigInt(Math.floor(Date.now() / 1000));
    if (deadlineUnix <= nowUnix + MIN_DEADLINE_BUFFER_SECONDS) {
      setError("Deadline must be at least 10 minutes out — wallet confirmation and block time eat into it");
      return;
    }

    // Confirm the verifier can actually see the repo BEFORE locking funds —
    // a private repo with an expired GitHub session would be unverifiable.
    setValidating(true);
    try {
      const params = new URLSearchParams({
        owner: repo.owner,
        repo: repo.name,
        github_login: auth.login,
        session: auth.session,
      });
      const resp = await fetch(`${BACKEND_URL}/repos/validate?${params}`);
      if (!resp.ok) {
        const detail = (await resp.json().catch(() => null))?.detail;
        setError(detail ?? "The verifier can't read that repo");
        return;
      }
    } catch {
      setError("Couldn't reach the verifier to validate the repo — is the backend running?");
      return;
    } finally {
      setValidating(false);
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: COMMITMENT_DEVICE_ABI,
      functionName: "createCommitment",
      args: [beneficiary as `0x${string}`, deadlineUnix, description],
      value: parseEther(stake || "0"),
    });
  }

  const busy = validating || isPending || isConfirming || registering;
  const deadlinePickerRef = useRef<HTMLDivElement>(null);
  const selectedDeadlineDate = deadline ? new Date(`${deadline.slice(0, 10)}T00:00:00`) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (deadlinePickerRef.current && !deadlinePickerRef.current.contains(event.target as Node)) {
        setDeadlinePickerOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDeadlinePickerOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectDeadlineDate(date: Date | undefined) {
    if (!date) return;
    const time = deadline.split("T")[1] || "12:00";
    setDeadline(`${format(date, "yyyy-MM-dd")}T${time}`);
  }

  function selectDeadlineTime(hour: number, minute: number) {
    const date = deadline.split("T")[0];
    if (!date) return;
    setDeadline(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return (
    <WindowCard title="new_commitment.sol" accent="primary">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <label className={labelClass}>
          Goal
          <input
            className={inputClass}
            placeholder="Ship the auth flow"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {auth ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-line bg-surface px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-muted">
                <Github className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Connected as <span className="text-primary">{auth.login}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearGithubAuth();
                  setAuth(null);
                }}
              >
                Disconnect
              </Button>
            </div>
            <RepoPicker repos={repos} value={repo} onSelect={setRepo} loading={reposLoading} />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 border-2 border-primary bg-primary/5 px-4 py-4">
            <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-muted">
              <Github className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Step 1 — connect GitHub to pick the repo you&apos;ll stake on
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                setError(null);
                try {
                  const resp = await fetch(`${BACKEND_URL}/auth/github/status`);
                  const { configured } = await resp.json();
                  if (!configured) {
                    setError(
                      "The verifier has no GitHub OAuth app configured — fill GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in backend/.env (see README) and restart it.",
                    );
                    return;
                  }
                } catch {
                  setError("Couldn't reach the verifier — is the backend running?");
                  return;
                }
                window.location.href = `${BACKEND_URL}/auth/github/login`;
              }}
            >
              Connect GitHub
            </Button>
          </div>
        )}

        <label className={labelClass}>
          Beneficiary — gets your stake if you miss the deadline
          <input
            className={`${inputClass} font-mono`}
            placeholder="0x..."
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div ref={deadlinePickerRef} className="relative flex flex-col gap-1">
            <span className="text-xs font-mono uppercase tracking-wide text-muted">Deadline</span>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={deadlinePickerOpen}
              onClick={() => setDeadlinePickerOpen((open) => !open)}
              className={`${inputClass} flex cursor-pointer items-center justify-between gap-3 text-left transition-colors hover:border-primary`}
            >
              <span className={deadline ? "text-foreground" : "text-muted/60"}>
                {deadline ? format(new Date(deadline), "MMM d, yyyy 'at' HH:mm") : "Pick date & time"}
              </span>
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </button>

            {deadlinePickerOpen && (
              <div
                role="dialog"
                aria-label="Choose deadline date and time"
                className="absolute left-0 top-full z-30 mt-2 w-fit border-2 border-primary bg-surface p-3 shadow-brutal"
              >
                <div className="mb-3 flex items-center justify-between border-b-2 border-line pb-2">
                  <span className="font-head text-xs uppercase text-foreground">Set deadline</span>
                  <button
                    type="button"
                    onClick={() => setDeadlinePickerOpen(false)}
                    className="grid size-7 cursor-pointer place-items-center border-2 border-line text-muted transition-colors hover:border-primary hover:text-primary"
                    aria-label="Close deadline picker"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDeadlineDate}
                  onSelect={selectDeadlineDate}
                  disabled={{ before: today }}
                />
                <div className="mt-3 border-t-2 border-line pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted">Time</span>
                    <span className="font-head text-sm text-primary">
                      {deadline.split("T")[1] || "--:--"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted">Hour</p>
                      <div className="grid grid-cols-6 gap-1">
                        {hours.map((hour) => {
                          const active = deadline.split("T")[1]?.slice(0, 2) === String(hour).padStart(2, "0");
                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={!selectedDeadlineDate}
                              onClick={() => selectDeadlineTime(hour, Number(deadline.split("T")[1]?.slice(3, 5) || 0))}
                              className={`h-7 cursor-pointer border text-[10px] font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                                active
                                  ? "border-primary bg-primary text-background"
                                  : "border-line text-foreground hover:border-primary hover:text-primary"
                              }`}
                            >
                              {String(hour).padStart(2, "0")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted">Minute</p>
                      <div className="grid grid-cols-3 gap-1">
                        {minutes.map((minute) => {
                          const active = deadline.split("T")[1]?.slice(3, 5) === String(minute).padStart(2, "0");
                          return (
                            <button
                              key={minute}
                              type="button"
                              disabled={!selectedDeadlineDate}
                              onClick={() => selectDeadlineTime(Number(deadline.split("T")[1]?.slice(0, 2) || 12), minute)}
                              className={`h-7 cursor-pointer border text-[10px] font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                                active
                                  ? "border-primary bg-primary text-background"
                                  : "border-line text-foreground hover:border-primary hover:text-primary"
                              }`}
                            >
                              {String(minute).padStart(2, "0")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <label className={labelClass}>
            Stake (MON)
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
          </label>
        </div>

        {(error || writeError) && (
          <p className="border-2 border-glow-red bg-glow-red/10 px-3 py-2 text-xs text-glow-red">
            {error ?? writeError?.message}
          </p>
        )}

        <Button type="submit" disabled={!isConnected || !auth || busy} size="lg">
          {!isConnected
            ? "Connect a wallet first"
            : !auth
              ? "Connect GitHub first"
              : validating
              ? "Checking the repo…"
              : isPending
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Waiting for confirmation…"
                  : registering
                    ? "Registering with verifier…"
                    : "Stake it"}
        </Button>
      </form>
    </WindowCard>
  );
}
