import { expect, it, vi } from "vitest";
import { requestMedicalLocation } from "./location";
it("requests permission only on invocation, with a timeout and minimized precision", async () => {
  const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: 30.490123, longitude: 79.160123 } } as GeolocationPosition));
  expect(getCurrentPosition).not.toHaveBeenCalled();
  expect(await requestMedicalLocation({ getCurrentPosition })).toEqual({ lat: 30.4901, lng: 79.1601 });
  expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
});
it("preserves a denied-permission failure instead of supplying a guessed location", async () => {
  const getCurrentPosition = vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback | null) => fail?.({ code: 1 } as GeolocationPositionError));
  await expect(requestMedicalLocation({ getCurrentPosition })).rejects.toMatchObject({ code: 1 });
});
