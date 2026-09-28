import type { Metadata } from "next";
import { SuperComputer } from "@/components/supercomputer/super-computer";

export const metadata: Metadata = { title: "Super Computer" };

export default function SuperComputerPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SuperComputer />
    </div>
  );
}
