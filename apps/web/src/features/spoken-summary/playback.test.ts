import { expect, it, vi } from "vitest";
import { SummaryPlayback } from "./playback";
it("ignores audio arriving after cancellation", async () => {
  const revoke = vi.fn(); const create = vi.fn(() => "blob:fixture");
  const player = new SummaryPlayback(revoke);
  let finish!: (blob: Blob) => void;
  const pending = player.load(() => new Promise(resolve => { finish = resolve; }), create);
  player.stop(); finish(new Blob(["audio"]));
  expect(await pending).toBeNull(); expect(create).not.toHaveBeenCalled();
});
it("releases audio URLs on replay and unmount cleanup", async () => {
  const revoke = vi.fn(); const player = new SummaryPlayback(revoke);
  const load = () => player.load(async () => new Blob(["audio"]), () => "blob:fixture");
  expect(await load()).toBe("blob:fixture");
  await load(); expect(revoke).toHaveBeenCalledTimes(1);
  player.stop(); expect(revoke).toHaveBeenCalledTimes(2);
});
