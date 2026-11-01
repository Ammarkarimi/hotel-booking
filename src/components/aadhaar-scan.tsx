"use client";

// Scanning the Secure QR code of an Aadhaar at the front desk. Everything happens on this phone:
// the QR is read, UIDAI's signature is checked, and the name and photo are shown so staff can
// compare them with the guest. Nothing from the Aadhaar is sent anywhere or saved; when the screen
// closes it is gone. Only "verified by <staff> at <time>" is saved, by the caller.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImageUp, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Badge, Button, Modal, Tip } from "@/components/ui";
import { checkAadhaarQr, namesMatch, type QrCheck } from "@/lib/aadhaar-qr";

type Controls = { stop: () => void };

/** The JPEG 2000 decoder reads bytes with Node's Buffer methods, so give a plain byte array those two. */
class Bytes extends Uint8Array {
  readUInt16BE(o: number) {
    return (this[o] << 8) | this[o + 1];
  }
  readUInt32BE(o: number) {
    return this[o] * 0x1000000 + ((this[o + 1] << 16) | (this[o + 2] << 8) | this[o + 3]);
  }
}

/** The photo in the QR is JPEG 2000, which browsers cannot show, so it is decoded to a PNG here. */
async function photoToDataUrl(jp2: Uint8Array): Promise<string | null> {
  try {
    const mod = (await import("jpeg2000")) as typeof import("jpeg2000") & { default?: typeof import("jpeg2000") };
    const JpxImage = mod.JpxImage ?? mod.default?.JpxImage;
    const img = new JpxImage();
    img.parse(Bytes.from(jp2));
    const { width, height, componentsCount } = img;
    const items = img.tiles[0]?.items;
    if (!items || !width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const out = ctx.createImageData(width, height);
    for (let p = 0; p < width * height; p++) {
      const i = p * componentsCount;
      const grey = componentsCount < 3;
      out.data[p * 4] = items[i];
      out.data[p * 4 + 1] = grey ? items[i] : items[i + 1];
      out.data[p * 4 + 2] = grey ? items[i] : items[i + 2];
      out.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** The QR reader (ZXing compiled to WebAssembly): reads dense codes like the Aadhaar QR far better than JavaScript readers. */
async function qrReader() {
  const zxing = await import("zxing-wasm/reader");
  zxing.prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `${window.location.origin}/zxing_reader.wasm` : prefix + path) },
  });
  return async (input: Blob | ImageData) => {
    const found = await zxing.readBarcodes(input, { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 1 });
    return found.find((r) => r.isValid)?.text ?? null;
  };
}

export function AadhaarScanDialog({
  open,
  onClose,
  personName,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  /** The name in the booking, to compare with the card. */
  personName: string;
  onVerified: () => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const controls = useRef<Controls | null>(null);
  const [phase, setPhase] = useState<"scan" | "checking" | "result">("scan");
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<QrCheck | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stopCamera = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
  }, []);

  const handle = useCallback(
    async (text: string) => {
      stopCamera();
      setPhase("checking");
      const r = await checkAadhaarQr(text);
      setResult(r);
      setPhoto(r.ok && r.card.photo ? await photoToDataUrl(r.card.photo) : null);
      setPhase("result");
    },
    [stopCamera]
  );

  // Start the back camera while the scan step is showing, and read a frame a few times a second.
  useEffect(() => {
    if (!open || phase !== "scan") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;
    setCameraError("");
    (async () => {
      try {
        const read = await qrReader();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled || !video.current) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        controls.current = { stop: () => stream?.getTracks().forEach((t) => t.stop()) };
        const canvas = document.createElement("canvas");
        const tick = async () => {
          const v = video.current;
          if (cancelled || !v) return;
          if (v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx?.drawImage(v, 0, 0);
            const text = ctx ? await read(ctx.getImageData(0, 0, canvas.width, canvas.height)).catch(() => null) : null;
            if (text && !cancelled) return handle(text);
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        if (!cancelled)
          setCameraError(
            (e as Error).name === "NotAllowedError"
              ? "Camera permission was refused. Allow the camera, or choose a photo of the QR code."
              : "The camera could not be started. Choose a photo of the QR code instead."
          );
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      controls.current = null;
    };
  }, [open, phase, attempt, handle]);

  // Forget everything read from the card when the screen closes.
  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("scan");
      setResult(null);
      setPhoto(null);
      setSaving(false);
    }
  }, [open, stopCamera]);

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    stopCamera();
    setPhase("checking");
    try {
      const read = await qrReader();
      const text = await read(file);
      if (!text) throw new Error("no QR");
      await handle(text);
    } catch {
      setResult({ ok: false, reason: "not_aadhaar" });
      setPhase("result");
    } finally {
      if (picker.current) picker.current.value = "";
    }
  }

  function again() {
    setResult(null);
    setPhoto(null);
    setPhase("scan");
    setAttempt((a) => a + 1);
  }

  async function confirmMatch() {
    setSaving(true);
    try {
      await onVerified();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const card = result?.ok ? result.card : null;
  const reason = result && !result.ok ? result.reason : null;
  const nameOk = card ? namesMatch(card.name, personName) : false;

  return (
    <Modal open={open} onClose={onClose} title={`Verify Aadhaar: ${personName}`} description="Scan the QR code on the Aadhaar card, e-Aadhaar or Aadhaar app.">
      {phase === "scan" && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900">
            <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-white/70" />
          </div>
          {cameraError ? <Tip tone="warning">{cameraError}</Tip> : <p className="text-center text-sm text-slate-500">Hold the QR code inside the frame. It reads on its own.</p>}
          <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => fromPhoto(e.target.files?.[0])} />
          <Button variant="outline" className="w-full" onClick={() => picker.current?.click()}>
            <ImageUp className="h-4 w-4" /> Choose a photo or screenshot of the QR
          </Button>
          <p className="text-xs text-slate-500">Nothing from the Aadhaar is saved. Only “verified by you” and the time are kept.</p>
        </div>
      )}

      {phase === "checking" && <p className="py-10 text-center text-slate-500">Checking with UIDAI’s signature…</p>}

      {phase === "result" && result && (
        <div className="space-y-4">
          {card ? (
            <>
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">
                <ShieldCheck className="h-5 w-5" /> Genuine Aadhaar: signed by UIDAI
              </p>
              <div className="flex gap-4">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Photo on the Aadhaar" className="h-36 w-28 shrink-0 rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-center text-xs text-slate-500">No photo in this QR</div>
                )}
                <div className="min-w-0 space-y-1 text-[15px]">
                  <p className="text-lg font-bold">{card.name}</p>
                  <p className="text-slate-600">
                    {card.gender}
                    {card.dob && ` · born ${card.dob}`}
                  </p>
                  <p className="text-slate-600">{[card.district, card.state].filter(Boolean).join(", ")}</p>
                  {nameOk ? (
                    <Badge variant="success">Name matches the booking</Badge>
                  ) : (
                    <Badge variant="warning">Booking name: {personName}</Badge>
                  )}
                </div>
              </div>
              <Tip>
                <b>Look at the guest.</b> Mark verified only if the photo is the person in front of you{nameOk ? "" : " and the name is theirs"}.
              </Tip>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={again}>
                  <XCircle className="h-4 w-4" /> Not this person
                </Button>
                <Button variant="success" loading={saving} onClick={confirmMatch}>
                  <CheckCircle2 className="h-4 w-4" /> Photo matches: verified
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm">
                  {reason === "not_aadhaar" && <p className="font-semibold">This is not an Aadhaar QR code, or it could not be read.</p>}
                  {reason === "old_qr" && (
                    <p>
                      <b>This is an old Aadhaar QR without UIDAI’s signature</b>, so it cannot prove the card is genuine.
                    </p>
                  )}
                  {reason === "unsigned" && (
                    <p>
                      <b>Could not confirm this QR came from UIDAI.</b> The card may be fake, or printed before 2021 with an older UIDAI key.
                    </p>
                  )}
                  <p className="mt-1">Ask the guest to show the QR in the Aadhaar app or a newly downloaded e-Aadhaar, or check another photo ID.</p>
                </div>
              </div>
              <Button className="w-full" onClick={again}>
                {cameraError ? <Camera className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} Scan again
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
