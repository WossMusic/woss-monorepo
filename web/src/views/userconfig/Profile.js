import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

// reactstrap components
import {
  Card,
  CardHeader,
  CardBody,
  FormGroup,
  Input,
  Container,
  Row,
  Col,
  Button,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
} from "reactstrap";

// core components
import { languageOptions } from "components/Data/languagesPreferences.js";
import CustomSelect from "components/Custom/CustomSelect.js";
import ProfileHeader from "components/Headers/ProfileHeader.js";

function Profile() {
  const [profileData, setProfileData] = useState({
    project_name: "",
    label: "",
    role: "",
    account_status: "",
    email: "",
    phone: "",
  });

  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions[0]);
  const [selectedDateFormat, setSelectedDateFormat] = useState("MM-DD-YYYY");
  const [loading, setLoading] = useState(true);

  // ===== Popup system (same feel as Login.js) =====
  const [errorToast, setErrorToast] = useState({ show: false, message: "" });
  const [successToast, setSuccessToast] = useState({ show: false, message: "" });
  const [fadeOutErr, setFadeOutErr] = useState(false);
  const [fadeOutOk, setFadeOutOk] = useState(false);

  const showErrorPopup = (message = "Something went wrong.") => {
    setFadeOutErr(false);
    setErrorToast({ show: true, message });
    setTimeout(() => setFadeOutErr(true), 2000);
    setTimeout(() => setErrorToast({ show: false, message: "" }), 3500);
  };

  const showSuccessPopup = (message = "Done!") => {
    setFadeOutOk(false);
    setSuccessToast({ show: true, message });
    setTimeout(() => setFadeOutOk(true), 2000);
    setTimeout(() => setSuccessToast({ show: false, message: "" }), 3500);
  };

  // OTP (step 1)
  const [otpBoxes, setOtpBoxes] = useState(["", "", "", "", "", ""]);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const otpRefs = useRef([]);

  // OTP (step 2)
  const [otpBoxesCurrent, setOtpBoxesCurrent] = useState(["", "", "", "", "", ""]);
  const [otpEnabledCurrent, setOtpEnabledCurrent] = useState(false);
  const currentOtpRefs = useRef([]);

  // OTP (step 3)
  const [otpBoxesNew, setOtpBoxesNew] = useState(["", "", "", "", "", ""]);
  const [otpEnabledNew, setOtpEnabledNew] = useState(false);
  const newOtpRefs = useRef([]);

  // ===== API base / auth headers =====
  const apiBase = "http://localhost:4000";
  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("woss_token") || ""}`,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("woss_token");
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await axios.get(`${apiBase}/api/auth/profile/me`, {
          headers: authHeaders(),
        });
        if (res.data?.success && res.data.profile) {
          setProfileData(res.data.profile);
        }
      } catch (err) {
        console.error("❌ Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ===== Reset 2FA Modal State =====
  const [showReset, setShowReset] = useState(false);
  const [step, setStep] = useState(1); // 1: email, 2: current phone, 3: new phone

  // Tokens
  const [emailToken, setEmailToken] = useState("");
  const [oldPhoneToken, setOldPhoneToken] = useState("");
  const [, setNewPhoneToken] = useState("");

  // Inputs
  const [emailCode, setEmailCode] = useState("");
  const [currentPhoneCode, setCurrentPhoneCode] = useState("");
  const [newPhone, setNewPhone] = useState(""); // DIGITS ONLY in state
  const [newPhoneCode, setNewPhoneCode] = useState("");

  // Loaders
  const [loadingEmailSend, setLoadingEmailSend] = useState(false);
  const [loadingEmailVerify, setLoadingEmailVerify] = useState(false);
  const [loadingCurrentSend, setLoadingCurrentSend] = useState(false);
  const [loadingCurrentVerify, setLoadingCurrentVerify] = useState(false);
  const [loadingNewSend, setLoadingNewSend] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);

  // Cooldowns (seconds)
  const [coolEmail, setCoolEmail] = useState(0);
  const [coolCurrent, setCoolCurrent] = useState(0);
  const [coolNew, setCoolNew] = useState(0);

  // ----- Change Password modal state -----
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [cpStep, setCpStep] = useState(1); // 1: email, 2: current phone, 3: new password

  // tokens
  const [cpEmailToken, setCpEmailToken] = useState("");
  const [cpPhoneToken, setCpPhoneToken] = useState("");

  // inputs
  const [cpEmailCode, setCpEmailCode] = useState("");
  const [cpCurrentPhoneCode, setCpCurrentPhoneCode] = useState("");
  const [cpCurrentPwd, setCpCurrentPwd] = useState("");
  const [cpNewPwd, setCpNewPwd] = useState("");
  const [cpNewPwd2, setCpNewPwd2] = useState("");

  // loaders
  const [cpLoadingEmailSend, setCpLoadingEmailSend] = useState(false);
  const [cpLoadingEmailVerify, setCpLoadingEmailVerify] = useState(false);
  const [cpLoadingCurrentSend, setCpLoadingCurrentSend] = useState(false);
  const [cpLoadingCurrentVerify, setCpLoadingCurrentVerify] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);

  // cooldowns
  const [cpCoolEmail, setCpCoolEmail] = useState(0);
  const [cpCoolCurrent, setCpCoolCurrent] = useState(0);

  // OTP boxes & refs (email step)
  const [cpOtpEmail, setCpOtpEmail] = useState(["", "", "", "", "", ""]);
  const [cpOtpEmailEnabled, setCpOtpEmailEnabled] = useState(false);
  const cpOtpEmailRefs = useRef([]);

  // OTP boxes & refs (current phone step)
  const [cpOtpPhone, setCpOtpPhone] = useState(["", "", "", "", "", ""]);
  const [cpOtpPhoneEnabled, setCpOtpPhoneEnabled] = useState(false);
  const cpOtpPhoneRefs = useRef([]);

  // CP cooldown timers
  useEffect(() => {
    if (!cpCoolEmail) return;
    const t = setTimeout(() => setCpCoolEmail((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cpCoolEmail]);

  useEffect(() => {
    if (!cpCoolCurrent) return;
    const t = setTimeout(() => setCpCoolCurrent((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cpCoolCurrent]);

  // Add blur to bootstrap backdrop when 2FA modal is open
  useEffect(() => {
    if (!showReset) return;
    const applyBlur = () => {
      const b = document.querySelector(".modal-backdrop");
      if (b) b.classList.add("blurred-backdrop");
    };
    const t = setTimeout(applyBlur, 10);
    return () => clearTimeout(t);
  }, [showReset]);

  // 2FA cooldown timers
  useEffect(() => {
    if (!coolEmail) return;
    const t = setTimeout(() => setCoolEmail((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [coolEmail]);

  useEffect(() => {
    if (!coolCurrent) return;
    const t = setTimeout(() => setCoolCurrent((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [coolCurrent]);

  useEffect(() => {
    if (!coolNew) return;
    const t = setTimeout(() => setCoolNew((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [coolNew]);

  // === STEP 1: email code send/verify (2FA) ===
  const sendEmailCode = async () => {
    if (coolEmail > 0) return;
    setLoadingEmailSend(true);
    try {
      await axios.post(`${apiBase}/api/auth/mfa/email/request`, {}, { headers: authHeaders() });
      setCoolEmail(30);
      setOtpEnabled(true);
      setTimeout(() => otpRefs.current?.[0]?.focus(), 10);
      showSuccessPopup("Code sent to your email.");
    } catch (e) {
      console.error("sendEmailCode error:", e);
      showErrorPopup("Could not send the email code.");
    } finally {
      setLoadingEmailSend(false);
    }
  };

  const verifyEmailCode = async () => {
    setLoadingEmailVerify(true);
    try {
      const { data } = await axios.post(
        `${apiBase}/api/auth/mfa/email/verify`,
        { code: emailCode },
        { headers: authHeaders() }
      );
      if (data?.success && data?.token) {
        setEmailToken(data.token);
        showSuccessPopup("Email verified.");
        setStep(2);
      } else {
        showErrorPopup("Invalid or expired code.");
      }
    } catch (e) {
      console.error("verifyEmailCode error:", e);
      showErrorPopup("Could not verify email code.");
    } finally {
      setLoadingEmailVerify(false);
    }
  };

  // === STEP 2: current phone code send/verify (2FA) ===
  const requestCurrentCode = async () => {
    if (coolCurrent > 0) return;
    setLoadingCurrentSend(true);
    try {
      await axios.post(`${apiBase}/api/auth/mfa/reset/request-sms`, {}, { headers: authHeaders() });
      setCoolCurrent(30);
      setOtpEnabledCurrent(true);
      setTimeout(() => currentOtpRefs.current?.[0]?.focus(), 10);
      showSuccessPopup("SMS sent to your current phone.");
    } catch (e) {
      console.error("requestCurrentCode error:", e);
      showErrorPopup("Could not send the SMS to your current phone.");
    } finally {
      setLoadingCurrentSend(false);
    }
  };

  const verifyCurrentCode = async () => {
    setLoadingCurrentVerify(true);
    try {
      const { data } = await axios.post(
        `${apiBase}/api/auth/mfa/reset/verify-current`,
        { code: currentPhoneCode },
        { headers: authHeaders() }
      );
      if (data?.success && data?.old_phone_token) {
        setOldPhoneToken(data.old_phone_token);
        setStep(3);
        showSuccessPopup("Current phone verified.");
      } else {
        showErrorPopup("Incorrect code for current phone.");
      }
    } catch (e) {
      console.error("verifyCurrentCode error:", e);
      showErrorPopup("Incorrect code for current phone.");
    } finally {
      setLoadingCurrentVerify(false);
    }
  };

  // === STEP 3: new phone send/verify + finalize (2FA) ===
  const requestNewCode = async () => {
    if (coolNew > 0) return;
    const digits = String(newPhone).replace(/\D/g, "");
    const e164 = digits ? `+${digits}` : "";
    if (!e164) return;

    setLoadingNewSend(true);
    try {
      await axios.post(
        `${apiBase}/api/auth/mfa/reset/request-new-sms`,
        { new_phone: e164 },
        { headers: authHeaders() }
      );
      setCoolNew(30);
      setOtpEnabledNew(true);
      setTimeout(() => newOtpRefs.current?.[0]?.focus(), 10);
      showSuccessPopup("SMS sent to your new phone.");
    } catch (e) {
      console.error("requestNewCode error:", e);
      showErrorPopup("Could not send the SMS to your new phone.");
    } finally {
      setLoadingNewSend(false);
    }
  };

  // One-click verify + finalize for Step 3 "Update 2FA"
  const handleUpdate2FA = async () => {
    if (!emailToken || !oldPhoneToken) return;

    const code = newPhoneCode.trim();
    const digits = String(newPhone || "").replace(/\D/g, "");
    if (!digits || code.length !== 6) return;

    const e164 = `+${digits}`;

    setSavingFinal(true);
    try {
      // verify code for THIS new phone
      const { data: verify } = await axios.post(
        `${apiBase}/api/auth/mfa/reset/verify-new`,
        { new_phone: e164, code },
        { headers: authHeaders() }
      );

      if (!verify?.success || !verify?.new_phone_token) {
        showErrorPopup(verify?.message || "Invalid or expired code for the new phone.");
        setSavingFinal(false);
        return;
      }

      const token = verify.new_phone_token;
      setNewPhoneToken(token);

      // finalize
      const { data: done } = await axios.post(
        `${apiBase}/api/auth/mfa/reset`,
        {
          email_token: emailToken,
          old_phone_token: oldPhoneToken,
          new_phone: e164,
          new_phone_token: token,
        },
        { headers: authHeaders() }
      );

      if (done?.success) {
        showSuccessPopup("2FA updated successfully.");

        // close & reset state
        setShowReset(false);
        setStep(1);
        setEmailToken(""); setOldPhoneToken(""); setNewPhoneToken("");
        setEmailCode(""); setCurrentPhoneCode(""); setNewPhoneCode(""); setNewPhone("");
        setCoolEmail(0); setCoolCurrent(0); setCoolNew(0);
        setOtpEnabled(false); setOtpBoxes(Array(6).fill(""));
        setOtpEnabledCurrent(false); setOtpBoxesCurrent(Array(6).fill(""));
        setOtpEnabledNew(false); setOtpBoxesNew(Array(6).fill(""));

        // refresh profile
        try {
          const res = await axios.get(`${apiBase}/api/auth/profile/me`, { headers: authHeaders() });
          if (res.data?.success && res.data.profile) setProfileData(res.data.profile);
        } catch {}
      } else {
        showErrorPopup(done?.message || "Could not update 2FA.");
      }
    } catch (e) {
      console.error("update2FA error:", e?.response?.data || e);
      showErrorPopup(e?.response?.data?.message || "Could not update 2FA.");
    } finally {
      setSavingFinal(false);
    }
  };

  // ===== STEP 1 (Email) OTP handlers =====
  function handleOtpChange(i, val) {
    const v = String(val).replace(/\D/g, "").slice(0, 1);
    setOtpBoxes((prev) => {
      const next = [...prev];
      next[i] = v;
      setEmailCode(next.join(""));
      return next;
    });
    if (v && i < 5) otpRefs.current?.[i + 1]?.focus();
  }
  function handleOtpKeyDown(i, e) {
    const key = e.key;
    if (key === "Backspace") {
      e.preventDefault();
      setOtpBoxes((prev) => {
        const next = [...prev];
        if (next[i]) {
          next[i] = "";
        } else if (i > 0) {
          next[i - 1] = "";
          otpRefs.current?.[i - 1]?.focus();
        }
        setEmailCode(next.join(""));
        return next;
      });
      return;
    }
    if (key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      otpRefs.current?.[i - 1]?.focus();
    }
    if (key === "ArrowRight" && i < 5) {
      e.preventDefault();
      otpRefs.current?.[i + 1]?.focus();
    }
  }
  function handleOtpPaste(e) {
    const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
    const digits = txt.replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length) {
      e.preventDefault();
      const next = Array(6).fill("");
      for (let k = 0; k < digits.length; k++) next[k] = digits[k];
      setOtpBoxes(next);
      setEmailCode(next.join(""));
      otpRefs.current?.[Math.min(digits.length, 6) - 1]?.focus();
    }
  }

  // ===== STEP 2 (Current phone) OTP handlers =====
  function handleOtpChangeCurrent(i, val) {
    const v = String(val).replace(/\D/g, "").slice(0, 1);
    setOtpBoxesCurrent((prev) => {
      const next = [...prev];
      next[i] = v;
      setCurrentPhoneCode(next.join(""));
      return next;
    });
    if (v && i < 5) currentOtpRefs.current?.[i + 1]?.focus();
  }
  function handleOtpKeyDownCurrent(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setOtpBoxesCurrent((prev) => {
        const next = [...prev];
        if (next[i]) next[i] = "";
        else if (i > 0) {
          next[i - 1] = "";
          currentOtpRefs.current?.[i - 1]?.focus();
        }
        setCurrentPhoneCode(next.join(""));
        return next;
      });
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      currentOtpRefs.current?.[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      currentOtpRefs.current?.[i + 1]?.focus();
    }
  }
  function handleOtpPasteCurrent(e) {
    const digits = ((e.clipboardData || window.clipboardData).getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    if (!digits.length) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let k = 0; k < digits.length; k++) next[k] = digits[k];
    setOtpBoxesCurrent(next);
    setCurrentPhoneCode(next.join(""));
    currentOtpRefs.current?.[Math.min(digits.length, 6) - 1]?.focus();
  }

  // ===== STEP 3 (New phone) OTP handlers =====
  function handleOtpChangeNew(i, val) {
    const v = String(val).replace(/\D/g, "").slice(0, 1);
    setOtpBoxesNew((prev) => {
      const next = [...prev];
      next[i] = v;
      setNewPhoneCode(next.join(""));
      return next;
    });
    if (v && i < 5) newOtpRefs.current?.[i + 1]?.focus();
  }
  function handleOtpKeyDownNew(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setOtpBoxesNew((prev) => {
        const next = [...prev];
        if (next[i]) next[i] = "";
        else if (i > 0) {
          next[i - 1] = "";
          newOtpRefs.current?.[i - 1]?.focus();
        }
        setNewPhoneCode(next.join(""));
        return next;
      });
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      newOtpRefs.current?.[i - 1]?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      newOtpRefs.current?.[i + 1]?.focus();
    }
  }
  function handleOtpPasteNew(e) {
    const digits = ((e.clipboardData || window.clipboardData).getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    if (!digits.length) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let k = 0; k < digits.length; k++) next[k] = digits[k];
    setOtpBoxesNew(next);
    setNewPhoneCode(next.join(""));
    newOtpRefs.current?.[Math.min(digits.length, 6) - 1]?.focus();
  }

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  // ===== Change Password logic =====

  // Step 1 — Email: request + verify
  const cpSendEmailCode = async () => {
    if (cpCoolEmail > 0) return;
    setCpLoadingEmailSend(true);
    try {
      await axios.post(`${apiBase}/api/auth/mfa/email/request`, {}, { headers: authHeaders() });
      setCpCoolEmail(30);
      setCpOtpEmailEnabled(true);
      setTimeout(() => cpOtpEmailRefs.current?.[0]?.focus(), 10);
      showSuccessPopup("Code sent to your email.");
    } catch (e) {
      console.error("cpSendEmailCode error:", e);
      showErrorPopup("Could not send email code.");
    } finally {
      setCpLoadingEmailSend(false);
    }
  };

  const cpVerifyEmailCode = async () => {
    if (cpEmailCode.trim().length !== 6) return;
    setCpLoadingEmailVerify(true);
    try {
      const { data } = await axios.post(
        `${apiBase}/api/auth/mfa/email/verify`,
        { code: cpEmailCode },
        { headers: authHeaders() }
      );
      if (data?.success && data?.token) {
        setCpEmailToken(data.token);
        setCpStep(2);
        showSuccessPopup("Email verified.");
      } else {
        showErrorPopup("Incorrect email code.");
      }
    } catch (e) {
      console.error("cpVerifyEmailCode error:", e);
      showErrorPopup("Incorrect email code.");
    } finally {
      setCpLoadingEmailVerify(false);
    }
  };

  // Step 2 — Current phone: request + verify
  const cpRequestCurrentCode = async () => {
    if (cpCoolCurrent > 0) return;
    setCpLoadingCurrentSend(true);
    try {
      await axios.post(`${apiBase}/api/auth/mfa/reset/request-sms`, {}, { headers: authHeaders() });
      setCpCoolCurrent(30);
      setCpOtpPhoneEnabled(true);
      setTimeout(() => cpOtpPhoneRefs.current?.[0]?.focus(), 10);
      showSuccessPopup("SMS sent to your current phone.");
    } catch (e) {
      console.error("cpRequestCurrentCode error:", e);
      showErrorPopup("Could not send SMS code.");
    } finally {
      setCpLoadingCurrentSend(false);
    }
  };

  const cpVerifyCurrentCode = async () => {
    if (cpCurrentPhoneCode.trim().length !== 6) return;
    setCpLoadingCurrentVerify(true);
    try {
      const { data } = await axios.post(
        `${apiBase}/api/auth/mfa/reset/verify-current`,
        { code: cpCurrentPhoneCode },
        { headers: authHeaders() }
      );
      if (data?.success && data?.old_phone_token) {
        setCpPhoneToken(data.old_phone_token);
        setCpStep(3);
        showSuccessPopup("Phone verified.");
      } else {
        showErrorPopup("Incorrect SMS code.");
      }
    } catch (e) {
      console.error("cpVerifyCurrentCode error:", e);
      showErrorPopup("Incorrect SMS code.");
    } finally {
      setCpLoadingCurrentVerify(false);
    }
  };

// Step 3 — Update password
const handleUpdatePassword = async () => {
  if (!cpEmailToken || !cpPhoneToken) return;
  if (!cpCurrentPwd || !cpNewPwd || !cpNewPwd2) {
    showErrorPopup("Please fill all password fields.");
    return;
  }
  if (cpNewPwd !== cpNewPwd2) {
    showErrorPopup("New passwords do not match.");
    return;
  }
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,]).{8,}$/;
  if (!strong.test(cpNewPwd)) {
    showErrorPopup("Password must be 8+ chars with upper, lower, number, symbol.");
    return;
  }

  setCpSaving(true);
  try {
    const res = await axios.post(
      `${apiBase}/api/auth/password/change`,
      {
        current_password: cpCurrentPwd,
        new_password: cpNewPwd,
        email_token: cpEmailToken,
        old_phone_token: cpPhoneToken,
      },
      { headers: authHeaders() }
    );

    const data = res.data || {};
    if (data.success) {
      showSuccessPopup(data.message || "Password updated successfully.");
      // reset modal state
      setShowChangePwd(false);
      setCpStep(1);
      setCpEmailToken(""); setCpPhoneToken("");
      setCpEmailCode(""); setCpCurrentPhoneCode("");
      setCpCurrentPwd(""); setCpNewPwd(""); setCpNewPwd2("");
      setCpCoolEmail(0); setCpCoolCurrent(0);
      setCpOtpEmailEnabled(false); setCpOtpEmail(["","","","","",""]);
      setCpOtpPhoneEnabled(false); setCpOtpPhone(["","","","","",""]);
    } else {
      showErrorPopup(data.message || "Could not update password.");
    }
  } catch (e) {
    console.error("handleUpdatePassword error:", e?.response?.data || e);
    const msg = e?.response?.data?.message || "Could not update password.";
    showErrorPopup(msg);
  } finally {
    setCpSaving(false);
  }
};


  // Email step OTP handlers (Change Password)
  function cpOtpChange(i, val) {
    const v = String(val).replace(/\D/g, "").slice(0, 1);
    setCpOtpEmail((prev) => {
      const next = [...prev];
      next[i] = v;
      setCpEmailCode(next.join(""));
      return next;
    });
    if (v && i < 5) cpOtpEmailRefs.current?.[i + 1]?.focus();
  }
  function cpOtpKeyDown(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setCpOtpEmail((prev) => {
        const n = [...prev];
        if (n[i]) n[i] = "";
        else if (i > 0) {
          n[i - 1] = "";
          cpOtpEmailRefs.current?.[i - 1]?.focus();
        }
        setCpEmailCode(n.join(""));
        return n;
      });
    }
  }
  function cpOtpPaste(e) {
    const d = ((e.clipboardData || window.clipboardData).getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    if (!d.length) return;
    e.preventDefault();
    const n = Array(6).fill("");
    for (let k = 0; k < d.length; k++) n[k] = d[k];
    setCpOtpEmail(n);
    setCpEmailCode(n.join(""));
    cpOtpEmailRefs.current?.[Math.min(d.length, 6) - 1]?.focus();
  }

  // Phone step OTP handlers (Change Password)
  function cpOtpChangePhone(i, val) {
    const v = String(val).replace(/\D/g, "").slice(0, 1);
    setCpOtpPhone((prev) => {
      const next = [...prev];
      next[i] = v;
      setCpCurrentPhoneCode(next.join(""));
      return next;
    });
    if (v && i < 5) cpOtpPhoneRefs.current?.[i + 1]?.focus();
  }
  function cpOtpKeyDownPhone(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setCpOtpPhone((prev) => {
        const n = [...prev];
        if (n[i]) n[i] = "";
        else if (i > 0) {
          n[i - 1] = "";
          cpOtpPhoneRefs.current?.[i - 1]?.focus();
        }
        setCpCurrentPhoneCode(n.join(""));
        return n;
      });
    }
  }
  function cpOtpPastePhone(e) {
    const d = ((e.clipboardData || window.clipboardData).getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    if (!d.length) return;
    e.preventDefault();
    const n = Array(6).fill("");
    for (let k = 0; k < d.length; k++) n[k] = d[k];
    setCpOtpPhone(n);
    setCpCurrentPhoneCode(n.join(""));
    cpOtpPhoneRefs.current?.[Math.min(d.length, 6) - 1]?.focus();
  }

  return (
    <>
      {/* popups */}
      {errorToast.show && (
        <div className={`danger-popup ${fadeOutErr ? "fade-out" : ""}`}>
          {errorToast.message}
        </div>
      )}
      {successToast.show && (
        <div className={`success-popup ${fadeOutOk ? "fade-out" : ""}`}>
          {successToast.message}
        </div>
      )}

      <ProfileHeader />
      <Container className="mt--6" fluid>
        <Row>
          <Col xl="12">
            <Card className="shadow-card">
              <CardHeader>
                <Row className="align-items-center">
                  <Col xs="8">
                    <h3 className="mb-0 text-white">Profile Details</h3>
                  </Col>
                </Row>
              </CardHeader>
              <CardBody>
                {/* Profile Info */}
                <div className="profile-header d-flex align-items-center">
                  <div className="profile-image">
                    <img
                      alt="..."
                      className="rounded-circle"
                      src={require("assets/img/theme/team-4.jpg")}
                    />
                  </div>
                  <div className="profile-info">
                    <h5 className="h3">
                      {profileData.project_name || ""}{" "}
                      <span className="text-success" style={{ fontSize: "16px" }}>
                        <span className="text-dark mr-1">/</span>
                        {profileData.account_status || ""}
                      </span>
                    </h5>
                    <div className="ml--0 h6 font-weight-700 text-muted text-uppercase">
                      <i className="ni location_pin" /> {profileData.role || ""}
                    </div>
                  </div>
                </div>

                <hr className="my-4" />

                {/* User Information */}
                <h6 className="heading-small text-muted mb-4">User Information</h6>
                <div className="pl-lg-4">
                  <Row>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Project Name</label>
                        <Input type="text" readOnly value={profileData.project_name || ""} />
                      </FormGroup>
                    </Col>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Label</label>
                        <Input type="text" readOnly value={profileData.label || ""} />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Email</label>
                        <Input type="email" readOnly value={profileData.email || ""} />
                      </FormGroup>
                    </Col>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Phone</label>
                        <Input type="text" readOnly value={profileData.phone || ""} />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Role</label>
                        <Input type="text" readOnly value={profileData.role || ""} />
                      </FormGroup>
                    </Col>
                    <Col lg="6">
                      <FormGroup>
                        <label className="form-control-label">Account Status</label>
                        <Input type="text" readOnly value={profileData.account_status || ""} />
                      </FormGroup>
                    </Col>
                  </Row>
                </div>

                <hr className="my-4" />

                {/* Preferences */}
                <h6 className="heading-small text-muted mb-4">Preferences</h6>
                <div className="pl-lg-4">
                  <FormGroup>
                    <label className="form-control-label">Preferred Language</label>
                    <CustomSelect
                      options={languageOptions}
                      value={selectedLanguage}
                      onChange={setSelectedLanguage}
                      isSearchable={false}
                    />
                  </FormGroup>          
                </div>

                <hr className="my-4" />

                {/* Security */}
                <h6 className="heading-small text-muted mb-4">Security</h6>
                <div className="pl-lg-4">
                  <Row>
                    <Col>
                      <div className="d-flex align-items-center flex-wrap" style={{ gap: "14px" }}>
                        <Button
                          color="primary"
                          outline
                          type="button"
                          className="mb-0 d-inline-flex align-items-center"
                          onClick={() => {
                            setShowChangePwd(true);
                            setCpStep(1);
                            setCpEmailToken(""); setCpPhoneToken("");
                            setCpEmailCode(""); setCpCurrentPhoneCode("");
                            setCpCurrentPwd(""); setCpNewPwd(""); setCpNewPwd2("");
                            setCpCoolEmail(0); setCpCoolCurrent(0);
                            setCpOtpEmailEnabled(false); setCpOtpEmail(["", "", "", "", "", ""]);
                            setCpOtpPhoneEnabled(false); setCpOtpPhone(["", "", "", "", "", ""]);
                          }}
                        >
                          <i className="fas fa-lock" aria-hidden="true" />
                          Change Password
                        </Button>

                        <Button
                          color="primary"
                          outline
                          type="button"
                          className="mb-0 d-inline-flex align-items-center"
                          onClick={() => {
                            setShowReset(true);
                            setStep(1);
                            setEmailToken("");
                            setOldPhoneToken("");
                            setNewPhoneToken("");
                            setEmailCode("");
                            setCurrentPhoneCode("");
                            setNewPhoneCode("");
                            setNewPhone("");
                            setCoolEmail(0);
                            setCoolCurrent(0);
                            setCoolNew(0);
                            setOtpEnabled(false);
                            setOtpBoxes(["", "", "", "", "", ""]);
                            setOtpEnabledCurrent(false);
                            setOtpBoxesCurrent(["", "", "", "", "", ""]);
                            setOtpEnabledNew(false);
                            setOtpBoxesNew(["", "", "", "", "", ""]);
                          }}
                        >
                          <i className="fas fa-mobile-alt" aria-hidden="true" />
                          Reset 2FA
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
{/* ===== Change Password Modal ===== */}
<Modal
  isOpen={showChangePwd}
  toggle={() => setShowChangePwd(false)}
  centered
  className="reset-mfa-modal"
>
  <ModalHeader className="modal-header-primary">
    Change Password
  </ModalHeader>

  <ModalBody>
    {/* Step dots */}
    <div className="step-dots mb-3">
      <span className={`step-dot ${cpStep === 1 ? "active" : ""}`} />
      <span className={`step-dot ${cpStep === 2 ? "active" : ""}`} />
      <span className={`step-dot ${cpStep === 3 ? "active" : ""}`} />
    </div>

    {/* STEP 1 — EMAIL */}
    {cpStep === 1 && (
      <>
        <FormGroup>
          <Label className="d-block text-center mb-2">
            <span className="h5 d-block text-muted">
              Click <strong>"Send Code"</strong> to receive it by email.
            </span>
          </Label>

          <div className="code-input-wrap text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary inline-send-btn"
              onClick={cpSendEmailCode}
              disabled={cpLoadingEmailSend || cpCoolEmail > 0}
              aria-label="Send email verification code"
            >
              {cpLoadingEmailSend
                ? "Sending..."
                : cpCoolEmail > 0
                ? `Resend ${cpCoolEmail}s`
                : "Send Code"}
            </button>

            <hr className="mt-2 mb-2" />
            <span className="d-block font-weight-bold">Enter the 6-digit code</span>
            <hr className="mt-2 mb-4" />

            <div className="otp-inputs mt-2 mb-4" onPaste={cpOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (cpOtpEmailRefs.current[i] = el)}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={cpOtpEmail[i]}
                  disabled={!cpOtpEmailEnabled}
                  onChange={(e) => cpOtpChange(i, e.target.value)}
                  onKeyDown={(e) => cpOtpKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowChangePwd(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={cpVerifyEmailCode}
            disabled={cpLoadingEmailVerify || cpEmailCode.trim().length !== 6}
          >
            {cpLoadingEmailVerify ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </>
    )}

    {/* STEP 2 — CURRENT PHONE */}
    {cpStep === 2 && (
      <>
        <FormGroup className="text-center">
          <Label className="d-block mb-2">
            <span className="h5 d-block text-muted">
              Click <strong>"Send Code"</strong> to receive it on your current phone.
              <br /> {profileData.phone ? `We'll send the code to: ${profileData.phone}` : ""}
            </span>
          </Label>

          <div className="code-input-wrap text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary inline-send-btn"
              onClick={cpRequestCurrentCode}
              disabled={cpLoadingCurrentSend || cpCoolCurrent > 0}
            >
              {cpLoadingCurrentSend
                ? "Sending..."
                : cpCoolCurrent > 0
                ? `Resend ${cpCoolCurrent}s`
                : "Send Code"}
            </button>

            <hr className="mt-2 mb-2" />
            <span className="d-block font-weight-bold">Enter the 6-digit code</span>
            <hr className="mt-2 mb-3" />

            <div className="otp-inputs mt-2" onPaste={cpOtpPastePhone}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (cpOtpPhoneRefs.current[i] = el)}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={cpOtpPhone[i]}
                  disabled={!cpOtpPhoneEnabled}
                  onChange={(e) => cpOtpChangePhone(i, e.target.value)}
                  onKeyDown={(e) => cpOtpKeyDownPhone(i, e)}
                  aria-label={`Current phone digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowChangePwd(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={cpVerifyCurrentCode}
            disabled={cpLoadingCurrentVerify || cpCurrentPhoneCode.trim().length !== 6}
          >
            {cpLoadingCurrentVerify ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </>
    )}

    {/* STEP 3 — NEW PASSWORD */}
    {cpStep === 3 && (
      <>
        <FormGroup className="text-left">
          <Label className="h4">Update your password</Label>
        </FormGroup>

        <FormGroup className="text-left">
          <Label>Current Password</Label>
          <Input
            type="password"
            value={cpCurrentPwd}
            onChange={(e) => setCpCurrentPwd(e.target.value)}
            placeholder="Enter current password"
          />
        </FormGroup>

        <FormGroup className="text-left">
          <Label>New Password</Label>
          <Input
            type="password"
            value={cpNewPwd}
            onChange={(e) => setCpNewPwd(e.target.value)}
            placeholder="Enter new password"
          />
        </FormGroup>

        <FormGroup className="text-left">
          <Label>Confirm New Password</Label>
          <Input
            type="password"
            value={cpNewPwd2}
            onChange={(e) => setCpNewPwd2(e.target.value)}
            placeholder="Re-enter new password"
          />
          {cpNewPwd2 && cpNewPwd !== cpNewPwd2 && (
            <div className="text-danger mt-1" style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
              Passwords do not match
            </div>
          )}
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowChangePwd(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={handleUpdatePassword}
            disabled={
              !cpEmailToken ||
              !cpPhoneToken ||
              !cpCurrentPwd ||
              !cpNewPwd ||
              cpNewPwd !== cpNewPwd2 ||
              cpSaving
            }
          >
            {cpSaving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </>
    )}
  </ModalBody>
</Modal>

{/* ===== Reset 2FA Modal ===== */}
<Modal
  isOpen={showReset}
  toggle={() => setShowReset(false)}
  centered
  className="reset-mfa-modal"
>
  <ModalHeader className="modal-header-primary">
    Reset 2FA
  </ModalHeader>
  <ModalBody>
    {/* Step dots */}
    <div className="step-dots mb-3">
      <span className={`step-dot ${step === 1 ? "active" : ""}`} />
      <span className={`step-dot ${step === 2 ? "active" : ""}`} />
      <span className={`step-dot ${step === 3 ? "active" : ""}`} />
    </div>

    {/* STEP 1 — EMAIL */}
    {step === 1 && (
      <>
        <FormGroup>
          <Label className="d-block text-center mb-2">
            <span className="h5 d-block text-muted">
              Click <strong>"Send Code"</strong> to receive it by email.
            </span>
          </Label>

          <div className="code-input-wrap text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary inline-send-btn"
              onClick={sendEmailCode}
              disabled={loadingEmailSend || coolEmail > 0}
              aria-label="Send email verification code"
            >
              {loadingEmailSend
                ? "Sending..."
                : coolEmail > 0
                ? `Resend ${coolEmail}s`
                : "Send Code"}
            </button>

            <hr className="mt-2 mb-2" />
            <span className="d-block font-weight-bold">Enter the 6-digit code</span>
            <hr className="mt-2 mb-4" />

            <div className="otp-inputs mt-2 mb-4" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={otpBoxes[i]}
                  disabled={!otpEnabled}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowReset(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={verifyEmailCode}
            disabled={loadingEmailVerify || emailCode.trim().length !== 6}
          >
            {loadingEmailVerify ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </>
    )}

    {/* STEP 2 — CURRENT PHONE */}
    {step === 2 && (
      <>
        <FormGroup className="text-center">
          <Label className="d-block mb-2">
            <span className="h5 d-block text-muted">
              Click <strong>"Send Code"</strong> to receive it on your current phone.
              <br /> {profileData.phone ? `We'll send the code to: ${profileData.phone}` : ""}
            </span>
          </Label>

          <div className="code-input-wrap text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary inline-send-btn"
              onClick={requestCurrentCode}
              disabled={loadingCurrentSend || coolCurrent > 0}
            >
              {loadingCurrentSend
                ? "Sending..."
                : coolCurrent > 0
                ? `Resend ${coolCurrent}s`
                : "Send Code"}
            </button>

            <hr className="mt-2 mb-2" />
            <span className="d-block font-weight-bold">Enter the 6-digit code</span>
            <hr className="mt-2 mb-3" />

            <div className="otp-inputs mt-2" onPaste={handleOtpPasteCurrent}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (currentOtpRefs.current[i] = el)}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={otpBoxesCurrent[i]}
                  disabled={!otpEnabledCurrent}
                  onChange={(e) => handleOtpChangeCurrent(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDownCurrent(i, e)}
                  aria-label={`Current phone digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowReset(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={verifyCurrentCode}
            disabled={loadingCurrentVerify || currentPhoneCode.trim().length !== 6}
          >
            {loadingCurrentVerify ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </>
    )}

    {/* STEP 3 — NEW PHONE */}
    {step === 3 && (
      <>
        <FormGroup>
          <Label className="h4">New Phone Number</Label>
          <PhoneInput
            country={"us"}
            value={newPhone} // digits-only state
            onChange={(v) => setNewPhone(String(v).replace(/\D/g, ""))}
            enableSearch
            countryCodeEditable={false}
            autoFormat={false}
            placeholder=""
            inputProps={{ name: "new_phone", required: true }}
            containerStyle={{ width: "100%" }}
          />
        </FormGroup>

        <FormGroup className="text-center">
          <Label className="d-block mb-2">
            <span className="h5 d-block text-muted">
              Click <strong>"Send Code"</strong> to receive it on your new phone.
            </span>
          </Label>

          <div className="code-input-wrap text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary inline-send-btn"
              onClick={requestNewCode}
              disabled={loadingNewSend || coolNew > 0 || !newPhone}
            >
              {loadingNewSend ? "Sending..." : coolNew > 0 ? `Resend ${coolNew}s` : "Send Code"}
            </button>

            <hr className="mt-2 mb-2" />
            <span className="d-block font-weight-bold">Enter the 6-digit code</span>
            <hr className="mt-2 mb-3" />

            <div className="otp-inputs mt-2" onPaste={handleOtpPasteNew}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (newOtpRefs.current[i] = el)}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={otpBoxesNew[i]}
                  disabled={!otpEnabledNew}
                  onChange={(e) => handleOtpChangeNew(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDownNew(i, e)}
                  aria-label={`New phone digit ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormGroup>

        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button color="dark" onClick={() => setShowReset(false)}>Cancel</Button>
          <Button
            color="primary"
            onClick={handleUpdate2FA}
            disabled={
              !emailToken || !oldPhoneToken || !newPhone || newPhoneCode.trim().length !== 6 || savingFinal
            }
          >
            {savingFinal ? "Updating..." : "Update 2FA"}
          </Button>
        </div>
      </>
    )}
  </ModalBody>
</Modal>

    </>
  );
}

export default Profile;
