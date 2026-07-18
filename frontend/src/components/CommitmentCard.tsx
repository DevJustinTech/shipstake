"use client";

import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BACKEND_URL, CONTRACT_ADDRESS, COMMITMENT_DEVICE_ABI, STATUS_LABEL } from "@/lib/contract";
import { getTrackedAmount } from "@/lib/storage";
import { WindowCard } from "@/components/ui/WindowCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/anim/Countdown";
import { CheckInBurst } from "@/components/anim/CheckInBurst";
import { ActivityFeed } from "@/components/ActivityFeed";

const STATUS_BADGE_COLOR: Record<(typeof STATUS_LABEL)[number], "amber" | "lime" | "red" | "muted"> = {
  active: "amber",
  fulfilled: "lime",
  failed: "red",
  withdrawn: "muted",
};

const STATUS_ACCENT: Record<(typeof STATUS_LABEL)[number], "amber" | "primary" | "pink" | "cyan"> = {
  active: "amber",
  fulfilled: "primary",
  failed: "pink",
  withdrawn: "cyan",
};

/** The contract zeroes `amount` when a stake leaves it (slashed or
 * withdrawn), so for settled commitments say where the money went instead
 * of showing "0 MON staked". The original figure comes from localStorage
 * (recorded at creation); older commitments fall back to wording alone. */
function StakeLine({
  status,
  onchainAmount,
  id,
}: {
  status: (typeof STATUS_LABEL)[number];
  onchainAmount: bigint;
  id: number;
}) {
  if (status === "active" || status === "fulfilled") {
    return (
      <span>
        <span className="text-primary">{formatEther(onchainAmount)}</span> MON staked
        {status === "fulfilled" && " — ready to withdraw"}
      </span>
    );
  }
  const original = getTrackedAmount(id);
  const amount = original !== null ? `${formatEther(original)} MON` : "Stake";
  return status === "failed" ? (
    <span>
      <span className="text-glow-red">{amount} slashed</span> → sent to beneficiary
    </span>
  ) : (
    <span>
      <span className="text-primary">{amount} reclaimed</span> — you shipped it
    </span>
  );
}

export function CommitmentCard({ id }: { id: number }) {
  const { address } = useAccount();
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const { data, refetch, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMMITMENT_DEVICE_ABI,
    functionName: "getCommitment",
    args: [BigInt(id)],
    // The backend auto-verifies without any click from us — poll so its
    // checkIn() visibly flips this card (and fires the burst) on its own.
    query: { refetchInterval: 15_000 },
  });

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Without this, a successful withdraw/claim left the card stale — still
  // showing a live button that, if clicked again, sent a doomed duplicate
  // transaction ("transaction failed" in the wallet).
  useEffect(() => {
    if (txConfirmed) refetch();
  }, [txConfirmed, refetch]);

  useEffect(() => {
    if (!data) return;
    const status = STATUS_LABEL[data.status];
    if (prevStatus.current === "active" && status === "fulfilled") {
      setBurst(true);
    }
    prevStatus.current = status;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="border-2 border-dashed border-line px-4 py-4 font-mono text-xs text-muted">
        loading #{id}…
      </div>
    );
  }

  const status = STATUS_LABEL[data.status];
  const deadline = new Date(Number(data.deadline) * 1000);
  const deadlinePassed = Date.now() > deadline.getTime();
  const isCreator = address?.toLowerCase() === data.creator.toLowerCase();

  async function handleVerify() {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/commitments/${id}/verify`, { method: "POST" });
      const json = await res.json();
      setVerifyMessage(json.verified ? "Verified — checked in onchain!" : (json.reason ?? "Not verified yet"));
      if (json.verified) refetch();
    } catch {
      setVerifyMessage("Couldn't reach the verifier backend");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="relative">
      <CheckInBurst active={burst} onDone={() => setBurst(false)} />
      <WindowCard title={`commitment_${id}.log`} accent={STATUS_ACCENT[status]}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{data.description}</p>
            <Badge color={STATUS_BADGE_COLOR[status]}>{status}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
            <StakeLine status={status} onchainAmount={data.amount} id={id} />
            {status === "active" && <Countdown deadline={deadline} />}
            {status !== "active" && <span>{deadline.toLocaleString()}</span>}
          </div>

          {(status === "active" || status === "fulfilled") && <ActivityFeed id={id} />}

          <div className="flex flex-wrap gap-2 pt-1">
            {status === "active" && !deadlinePassed && (
              <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
                {verifying ? "Checking…" : "Verify now"}
              </Button>
            )}

            {status === "active" && deadlinePassed && (
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: COMMITMENT_DEVICE_ABI,
                    functionName: "claimFailedStake",
                    args: [BigInt(id)],
                  })
                }
                disabled={isPending || isConfirming}
              >
                {isConfirming ? "Confirming…" : "Claim failed stake"}
              </Button>
            )}

            {status === "fulfilled" && isCreator && (
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: COMMITMENT_DEVICE_ABI,
                    functionName: "withdrawFulfilled",
                    args: [BigInt(id)],
                  })
                }
                disabled={isPending || isConfirming}
              >
                {isConfirming ? "Confirming…" : "Withdraw stake"}
              </Button>
            )}
          </div>

          {verifyMessage && <p className="font-mono text-xs text-muted">{verifyMessage}</p>}
          {writeError && (
            <p className="font-mono text-xs text-glow-red">
              {(writeError as { shortMessage?: string }).shortMessage ?? writeError.message.split("\n")[0]}
            </p>
          )}
        </div>
      </WindowCard>
    </div>
  );
}
