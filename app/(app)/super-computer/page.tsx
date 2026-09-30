import type { Metadata } from "next";
import { SuperComputer } from "@/components/supercomputer/super-computer";

export const metadata: Metadata = { title: "Super Computer" };
// One agent step (a model turn with thinking) can take a few minutes.
export const maxDuration = 300;

export default function SuperComputerPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SuperComputer />
    </div>
  );
}
