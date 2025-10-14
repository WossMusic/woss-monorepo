import React, { useEffect, useMemo, useRef, useState } from "react";

export default function OtpModal({
  open,
  phone,
  verifying,
  sending,
  error = "",
  onVerify,
  onResend,
  onClose,
  cooldownSeconds = 30,
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(cooldownSeconds);
  const refs = useRef([...Array(6)].map(() => React.createRef()));

  // Format phone for display
  // NANP (+1) -> +1 (AAA) BBB-CCCC ; fallback for others.
  const displayPhone = useMemo(() => {
    if (!phone) return "";
    const digitsOnly = String(phone).replace(/\D/g, "");
    const hasPlus = String(phone).trim().startsWith("+");

    if (digitsOnly.length === 11 && digitsOnly[0] === "1") {
      const area = digitsOnly.slice(1, 4);
      const central = digitsOnly.slice(4, 7);
      const line = digitsOnly.slice(7, 11);
      return `+1 (${area}) ${central}-${line}`;
    }
    if (digitsOnly.length === 10) {
      const area = digitsOnly.slice(0, 3);
      const central = digitsOnly.slice(3, 6);
      const line = digitsOnly.slice(6, 10);
      return `+1 (${area}) ${central}-${line}`;
    }

    const m = digitsOnly.match(/^(\d{1,3})(\d{4,14})$/);
    if (m) {
      const cc = m[1];
      const rest = m[2];
      const chunks = [];
      for (let i = 0; i < rest.length; ) {
        const remaining = rest.length - i;
        const len = remaining > 4 ? 3 : remaining;
        chunks.push(rest.slice(i, i + len));
        i += len;
      }
      return `+${cc} ${chunks.join(" ")}`;
    }
    return hasPlus ? `+${digitsOnly}` : digitsOnly;
  }, [phone]);

  const code = digits.join("");
  const isComplete = code.length === 6 && /^\d{6}$/.test(code);

  useEffect(() => {
    if (open) {
      setTimeout(() => refs.current[0]?.current?.focus(), 50);
      setDigits(["", "", "", "", "", ""]);
      setCooldown(cooldownSeconds);
    }
  }, [open, cooldownSeconds]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, cooldown]);

  const handleChange = (i, val) => {
    const v = val.replace(/\D/g, "").slice(0, 1);
    if (!v && digits[i] === "") return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        setDigits(next);
        return;
      }
      if (i > 0) refs.current[i - 1]?.current?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.current?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.current?.focus();
    if (e.key === "Enter" && isComplete) onVerify(code);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array.from({ length: 6 }, (_, idx) => text[idx] || "");
    setDigits(next);
    const lastIndex = Math.min(text.length, 6) - 1;
    refs.current[Math.max(0, lastIndex)]?.current?.focus();
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(cooldownSeconds);
    await onResend?.();
  };

  if (!open) return null;

  return (
    <div className="otp-overlay" role="dialog" aria-modal="true" aria-labelledby="otp-title">
      <div className="otp-modal">
        <button className="otp-close" aria-label="Close" onClick={onClose}>×</button>

        <h5 id="otp-title" className="otp-title">Verify your phone</h5>
        <p className="otp-subtitle">
          We sent a 6-digit code to <strong>{displayPhone}</strong>.
        </p>

        <div className="otp-inputs" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs.current[i]}
              className="otp-box"
              type="tel"
              inputMode="numeric"
              aria-label={`Digit ${i + 1}`}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              maxLength={1}
            />
          ))}
        </div>

        {error ? <div className="otp-error">{error}</div> : null}

        <div className="otp-actions">
          <button
            className={`otp-btn otp-btn-primary ${verifying ? "is-loading" : ""}`}
            disabled={!isComplete || verifying}
            onClick={() => onVerify?.(code)}
          >
            {verifying ? <span className="otp-spinner" /> : "Verify"}
          </button>
          <button className="otp-btn otp-btn-ghost" onClick={onClose}>Cancel</button>
        </div>

        <button
          className="otp-resend"
          disabled={sending || cooldown > 0}
          onClick={handleResend}
          aria-disabled={sending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : (sending ? "Sending..." : "Resend code")}
        </button>
      </div>
    </div>
  );
}
