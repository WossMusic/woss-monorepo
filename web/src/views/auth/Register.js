import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandHoldingDollar, faMusic, faCompactDisc, faFileArrowUp } from "@fortawesome/free-solid-svg-icons";
import {
  Modal,
  ModalHeader,
  ModalBody,
  Button,
  Card,
  CardHeader,
  CardBody,
  FormGroup,
  Form,
  Input,
  Container,
  Row,
  Col,
  Label,
} from "reactstrap";
import AuthHeader from "components/Headers/AuthHeader";
import { countryOptions } from "components/Data/countries";
import CustomSelect from "components/Custom/CustomSelect";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import useWebsiteConfig from "hooks/useWebsiteConfig";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    role: "",
    fullName: "",
    email: "",
    phone: "",
    country: "",
    password: "",
    confirmPassword: "",
    registrationCode: "",
    documentType: "",
    passportFile: null,
    idFront: null,
    idBack: null,
  });

  const [passportPreview, setPassportPreview] = React.useState(null);
  const [idFrontPreview, setIdFrontPreview] = React.useState(null);
  const [idBackPreview, setIdBackPreview] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState("");
  const [missingFields, setMissingFields] = React.useState([]);
  const [fadeOut, setFadeOut] = React.useState(false);
  const [errorPopup, setErrorPopup] = React.useState({ show: false, message: "" });
  const [warningPopup, setWarningPopup] = React.useState({ show: false, message: "" });
  const [fadeOutWarning, setFadeOutWarning] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  // OTP state for registration
  const [otpOpen, setOtpOpen] = React.useState(false);
  const [otpDigits, setOtpDigits] = React.useState(["", "", "", "", "", ""]);
  const [otpSending, setOtpSending] = React.useState(false);
  const [otpVerifying, setOtpVerifying] = React.useState(false);
  const [mfaToken, setMfaToken] = React.useState("");
  // Phone OTP for REGISTER (mirrors Login.js behavior/styling)
  const otpRefs = useRef([]);
  const [coolReg, setCoolReg] = useState(0); // resend cooldown (seconds)

  const setDigit = (i, raw) => {
  const d = String(raw).replace(/\D/g, "").slice(-1);
  setOtpDigits(prev => {
    const next = [...prev];
    next[i] = d;
    return next;
  });
  if (d && i < 5) otpRefs.current[i + 1]?.focus();
};

const onOtpKeyDown = (i, e) => {
  if (e.key === "Backspace" && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  if (e.key === "ArrowLeft" && i > 0) otpRefs.current[i - 1]?.focus();
  if (e.key === "ArrowRight" && i < 5) otpRefs.current[i + 1]?.focus();
};

const onOtpPaste = (e) => {
  const txt = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const clean = txt.replace(/\D/g, "").slice(0, 6);
  if (!clean) return;
  const arr = Array(6).fill("");
  for (let i = 0; i < clean.length; i++) arr[i] = clean[i];
  setOtpDigits(arr);
  otpRefs.current[Math.min(clean.length, 5)]?.focus();
  e.preventDefault();
};

// Send code + start cooldown (same UX as Login)
const openOtpReg = async () => {
  if (otpSending || coolReg > 0) return;
  try {
    await sendOtp();           // your existing send function
    setCoolReg(60);            // 60s cooldown like Login (tweak if you want)
  } catch {}
};

useEffect(() => {
  if (coolReg <= 0) return;
  const t = setInterval(() => setCoolReg((s) => (s > 0 ? s - 1 : 0)), 1000);
  return () => clearInterval(t);
}, [coolReg]);

  const config = useWebsiteConfig();
    // ---------- Show branded loader while config loads ----------
  // while config loads
    if (!config) {
      return (
         <div class="fw-loading-root">
          <div class="fw-loader-container">
            <div class="fw-loader-plate">
              <div class="fw-loader"></div>
            </div>
          </div>
        </div>
      );
    }



  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    if (!minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      return "Password must be at least 8 characters, include 1 uppercase, 1 lowercase, 1 number, and 1 special character.";
    }
    return "";
  };

  const showErrorPopup = (message) => {
    setFadeOut(false);
    setErrorPopup({ show: false, message: "" });
    setTimeout(() => {
      setErrorPopup({ show: true, message });
      setTimeout(() => setFadeOut(true), 2000);
      setTimeout(() => setErrorPopup({ show: false, message: "" }), 3500);
    }, 100);
  };

  const showWarningPopup = (message) => {
    setFadeOutWarning(false);
    setWarningPopup({ show: true, message });
    setTimeout(() => setFadeOutWarning(true), 2000);
    setTimeout(() => setWarningPopup({ show: false, message: "" }), 3500);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (step === 3 && name === "password") setPasswordError(validatePassword(value));
    setFormData({ ...formData, [name]: value });
  };

  const handleNext = async () => {
    const stepFields = {
      1: ["registrationCode"],
      2: ["role", "email"],
      3: ["fullName", "phone", "country", "password", "confirmPassword"],
    };

    if (stepFields[step]) {
      const currentFields = stepFields[step];
      const missing = currentFields.filter((field) => !formData[field]);
      if (missing.length > 0) {
        setMissingFields(missing);
        if (step === 1) showErrorPopup("Please enter your registration code.");
        if (step === 2) showErrorPopup("Missing role or email.");
        if (step === 3) showErrorPopup("Please complete all personal info.");
        return;
      }

      if (step === 1) {
        try {
          const res = await fetch(`${config.domain}/api/auth/validate-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationCode: formData.registrationCode.trim() }),
          });          
          const data = await res.json();
          if (!data.success) {
            showErrorPopup("Invalid or expired registration code.");
            return;
          }
          setFormData((prevData) => ({
            ...prevData,
            email: data.email,
            role: data.role,
          }));
          setStep(2);
          return;
        } catch (err) {
          console.error("Validation error:", err);
          showErrorPopup("Server error validating registration code.");
          return;
        }
      }

      if (step === 3) {
        if (formData.password !== formData.confirmPassword) {
          showErrorPopup("Passwords do not match.");
          return;
        }
        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,])[A-Za-z\d@$!%*?&.,]{8,}$/;
        if (!strongPassword.test(formData.password)) {
          showErrorPopup("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
          return;
        }
      }

      setMissingFields([]);
    }
    setSubmitted(false);
    setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  // ---------- Registration submission (after OTP) ----------
  const doRegister = async (tokenFromOtp) => {
    try {
      const body = new FormData();
      Object.keys(formData).forEach((key) => {
        const v = formData[key];
        body.append(key, v instanceof File ? v : v ?? "");
      });
      body.append("mfa_token", tokenFromOtp || mfaToken || "");

      const res = await fetch(`${config.domain}/api/auth/register`, {
        method: "POST",
        body,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // No auto-login. Send to Pending page with context.
        sessionStorage.removeItem("woss_token");
        sessionStorage.removeItem("woss_user");
        sessionStorage.setItem("pending_email", data.email || formData.email);
        sessionStorage.setItem("pending_project_name", data.project_name || formData.fullName || "Your Project");
        setSuccessMessage("Registration submitted. Awaiting approval...");
        setTimeout(() => navigate("/auth/pending"), 800);
      } else {
        showErrorPopup(data.error || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      showErrorPopup("Server error while registering.");
    }
  };

  // ---------- OTP: send / verify ----------
  const sendOtp = async () => {
    try {
      setOtpSending(true);
      const res = await fetch(`${config.domain}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpOpen(true);
      } else {
        showErrorPopup(data.message || "Could not send code.");
      }
    } catch (e) {
      console.error("request-otp error:", e);
      showErrorPopup("Could not send code.");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    try {
      setOtpVerifying(true);
      const res = await fetch(`${config.domain}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone, code })
      });
      const data = await res.json();
      if (res.ok && data.success && data.mfa_token) {
        setMfaToken(data.mfa_token);
        setOtpOpen(false);
        await doRegister(data.mfa_token);
      } else {
        showErrorPopup(data.message || "Incorrect code.");
      }
    } catch (e) {
      console.error("verifyOtp error:", e);
      showErrorPopup("Incorrect code.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const isImage = (file) => file && ["image/jpeg", "image/png"].includes(file.type);

    if (!formData.documentType) {
      showWarningPopup("Please select a document type.");
      return;
    }    

    if (formData.documentType === "Passport") {
      if (!formData.passportFile || !isImage(formData.passportFile)) {
        showErrorPopup("Please upload a valid Passport file (PNG or JPG).");
        return;
      }
    } else if (formData.documentType === "ID Card") {
      if (!formData.idFront || !formData.idBack) {
        showErrorPopup("Please upload both ID Card images.");
        return;
      }
      if (!isImage(formData.idFront) || !isImage(formData.idBack)) {
        showErrorPopup("ID Card files must be PNG or JPG images.");
        return;
      }
    }

    // if not yet OTP-verified → send code and stop; doRegister will be called after verify
    if (!mfaToken) {
      await sendOtp();
      return;
    }

    await doRegister(mfaToken);
  };




  return (
    <>
      {errorPopup.show && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#dc3545",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 9999,
            opacity: fadeOut ? 0 : 1,
            transition: "opacity 1.5s ease-in-out",
          }}
        >
          {errorPopup.message}
        </div>
      )}

      {warningPopup.show && (
        <div
          style={{
            position: "fixed",
            top: "70px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#ffc107",
            color: "#212529",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 9999,
            opacity: fadeOutWarning ? 0 : 1,
            transition: "opacity 1.5s ease-in-out",
            minWidth: "280px",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "0.85rem", marginBottom: "5px" }}>
            Hello!
          </div>
          {warningPopup.message}
        </div>
      )}

      <AuthHeader />

      <div className="white-body">
        <Container fluid className="px-0">
          <div className="form-wrapper">
            <Card className="bg-white border-0 rounded-0 w-100 card-register">
              <CardHeader className="bg-transparent text-center">
                <h1 className="text-center text-dark">
                  {step === 1 && "Welcome!"}
                  {step === 2 && "Woss Music Account"}
                  {step === 3 && "Tell us about you"}
                  {step === 4 && "Documents Verification"}
                </h1>

                <div className="text-center text-muted mb-4">
                  <small className="h4 text-dark">
                    {step === 1 && "Enter your registration code to begin."}
                    {step === 2 && "Your role has been assigned based on the invitation."}
                    {step === 3 && "Please fill in your personal and login information to continue."}
                    {step === 4 && "Upload valid verification documents (Passport or ID Card) to proceed."}
                  </small>
                </div>

                <div className="step-wrapper mb-4">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`step-circle ${step === s ? "active" : ""}`} />
                  ))}
                </div>

                <h2 className="text-dark">
                  {step === 1 && "Portal Registration Code"}
                  {step === 2 && "Invitation Type"}
                  {step === 3 && "Personal Information"}
                  {step === 4 && "Identity Verification"}
                </h2>
              </CardHeader>
              <CardBody className="px-4 py-5">
                <Form onSubmit={step === 4 ? handleSubmit : (e) => e.preventDefault()}>
                  {step === 1 && (
                    <FormGroup>
                      <label className="text-dark">Registration Code</label>
                      <Input
                        className={`input-muted ${missingFields.includes("registrationCode") ? "border-danger" : ""}`}
                        type="text"
                        name="registrationCode"
                        placeholder="Enter your code"
                        value={formData.registrationCode}
                        onChange={handleChange}
                        required
                      />
                    </FormGroup>
                  )}

                  {step === 2 && (
                    <Row className="text-center mt--4 mb--3">
                      {[
                        { role: "Royalty Share", icon: faHandHoldingDollar },
                        { role: "Artist/Manager", icon: faMusic },
                        { role: "Distributor", icon: faCompactDisc },
                      ].map(({ role, icon }) => {
                        const isActive = formData.role === role;
                        return (
                          <Col key={role} md="4" className="mb-3">
                            <Button
                              block
                              outline
                              color="darker"
                              className={`selector-button ${isActive ? "active" : "grayed-out"}`}
                              onClick={() => {
                                if (!isActive) showErrorPopup("You cannot change your assigned role.");
                              }}
                              type="button"
                              disabled={!isActive}
                            >
                              {role}
                              <div className="mt-2">
                                <FontAwesomeIcon icon={icon} size="2x" />
                              </div>
                            </Button>
                          </Col>
                        );
                      })}
                    </Row>
                  )}

                  {step === 3 && (
                    <>
                      {[
                        { label: "Full Name", name: "fullName", type: "text" },
                        { label: "Email", name: "email", type: "email", readOnly: true },
                      ].map(({ label, name, type, readOnly }) => (
                        <FormGroup key={name} className="mb-3">
                          <label className="text-dark">{label}</label>
                          <Input
                            className={`input-muted ${missingFields.includes(name) ? "border-danger" : ""}`}
                            type={type}
                            name={name}
                            placeholder={`Enter your ${label.toLowerCase()}`}
                            value={formData[name]}
                            onChange={handleChange}
                            required
                            readOnly={readOnly || false}
                          />
                        </FormGroup>
                      ))}

                      <FormGroup className="mb-3">
                        <label className="text-dark">Phone Number</label>
                        <PhoneInput
                          country={"us"}
                          preferredCountries={["us"]}
                          value={formData.phone}
                          onChange={(value) => setFormData({ ...formData, phone: `+${value}` })}
                          enableSearch
                          inputProps={{ name: "phone", required: true }}
                          inputClass={`input-muted form-control ${missingFields.includes("phone") ? "border-danger" : ""}`}
                          containerStyle={{ width: "100%" }}
                          buttonStyle={{ border: "1px solid #ced4da", borderRadius: "0.375rem 0 0 0.375rem" }}
                          inputStyle={{
                            width: "100%",
                            height: "calc(1.5em + 0.75rem + 15px)",
                            fontSize: "1rem",
                            paddingLeft: "48px",
                            border: "1px solid #ced4da",
                            borderRadius: "0.375rem",
                          }}
                          masks={{ do: "(...) ... ...." }}
                          countryCodeEditable={false}
                        />
                      </FormGroup>

                      <FormGroup className="mb-3">
                        <label className="text-dark">Country</label>
                        <CustomSelect
                          options={countryOptions}
                          value={countryOptions.find(option => option.value === formData.country)}
                          onChange={(selectedOption) => setFormData({ ...formData, country: selectedOption.value })}
                          placeholder="Select a Country"
                        />
                      </FormGroup>

                      <FormGroup className="mb-3">
                        <label className="text-dark">Password</label>
                        <Input
                          className={`input-muted ${missingFields.includes("password") ? "border-danger" : ""}`}
                          type="password"
                          name="password"
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                        />
                        {passwordError && (
                          <div className="text-danger mt-1" style={{ fontSize:"0.6rem",fontWeight: "bold" }}>
                            {passwordError}
                          </div>
                        )}
                      </FormGroup>

                      <FormGroup className="mb-3 position-relative">
                        <label className="text-dark">Confirm Password</label>
                        <Input
                          className={`input-muted ${missingFields.includes("confirmPassword") ? "border-danger" : ""}`}
                          type="password"
                          name="confirmPassword"
                          placeholder="Enter your confirm password"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                        />
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <div
                            className="text-danger"
                            style={{
                              position: "absolute", right: "10px", top: "70%",
                              transform: "translateY(-50%)", fontSize: "0.85rem", fontWeight: "bold",
                            }}
                          >
                            Passwords do not match
                          </div>
                        )}
                      </FormGroup>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <FormGroup className="mt--2 text-center">
                        <Row className="justify-content-center">
                          {["Passport", "ID Card"].map((type) => (
                            <Col xs="12" sm="6" md="4" className="mb-3" key={type}>
                              <Button
                                block
                                outline
                                color="darker"
                                className={`selector-button ${formData.documentType === type ? "active" : ""}`}
                                onClick={() => {
                                  setFormData({ ...formData, documentType: type });
                                  setMissingFields((prev) => prev.filter((f) => f !== "documentType"));
                                }}
                                type="button"
                                style={{
                                  borderColor: missingFields.includes("documentType") ? "red" : "",
                                  borderWidth: missingFields.includes("documentType") ? "2px" : "",
                                }}
                              >
                                {type}
                              </Button>
                            </Col>
                          ))}
                        </Row>
                        {submitted && missingFields.includes("documentType") && (
                          <div className="text-danger text-center mt-2">Please select a document type.</div>
                        )}
                      </FormGroup>

                      {formData.documentType === "Passport" && (
                        <FormGroup className="mt-3 text-center">
                          <input
                            type="file"
                            id="passportUpload"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setFormData({ ...formData, passportFile: file });
                                setPassportPreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                          <label htmlFor="passportUpload" className="upload-label mx-auto">
                            {passportPreview ? (
                              <img src={passportPreview} alt="Passport Preview" className="upload-preview-image" />
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faFileArrowUp} size="2x" />
                                <div className="mt-2">Upload Passport Photo</div>
                              </>
                            )}
                          </label>
                        </FormGroup>
                      )}

                      {formData.documentType === "ID Card" && (
                        <Row className="justify-content-center">
                          <Col xs="12" md="6" className="mt-2 text-center">
                            <input
                              type="file"
                              id="idFrontUpload"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  setFormData({ ...formData, idFront: file });
                                  setIdFrontPreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                            <label htmlFor="idFrontUpload" className="upload-label mx-auto">
                              {idFrontPreview ? (
                                <img src={idFrontPreview} alt="ID Front" className="upload-preview-image" />
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faFileArrowUp} size="2x" />
                                  <div className="mt-2">Upload ID Front</div>
                                </>
                              )}
                            </label>
                          </Col>

                          <Col xs="12" md="6" className="mt-2 text-center">
                            <input
                              type="file"
                              id="idBackUpload"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  setFormData({ ...formData, idBack: file });
                                  setIdBackPreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                            <label htmlFor="idBackUpload" className="upload-label mx-auto">
                              {idBackPreview ? (
                                <img src={idBackPreview} alt="ID Back" className="upload-preview-image" />
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faFileArrowUp} size="2x" />
                                  <div className="mt-2">Upload ID Back</div>
                                </>
                              )}
                            </label>
                          </Col>
                        </Row>
                      )}
                    </>
                  )}

                  <hr />

                  {successMessage && (
                    <div className="alert alert-success text-center">{successMessage}</div>
                  )}

                  <div className="d-flex justify-content-between mt-4">
                    {step > 1 ? (
                      <Button outline color="darker" onClick={handlePrev}>
                        Back
                      </Button>
                    ) : (
                      <span />
                    )}
                    {step < 4 ? (
                      <Button outline color="darker" onClick={handleNext}>
                        Next
                      </Button>
                    ) : (
                      <Button color="darker" type="submit" disabled={otpSending}>
                        {otpSending ? "Sending code..." : "Finish"}
                      </Button>
                    )}
                  </div>
                </Form>
              </CardBody>
            </Card>
          </div>
        </Container>
      </div>

      {/* OTP Modal for REGISTER (styled like Login.js) */}
<Modal
  isOpen={otpOpen}
  toggle={() => setOtpOpen(false)}
  centered
  className="reset-mfa-modal"
>
  <ModalHeader className="modal-header-primary">
    Verify your phone
  </ModalHeader>

  <ModalBody>
    <FormGroup className="text-center">
      <Label className="d-block mb-2">
        <span className="h5 d-block text-muted">
          Click <strong>"Send Code"</strong> to receive it on your phone.
          <br />
          We&apos;ll send the code to: {formData.phone || "your phone"}
        </span>
      </Label>

      {/* Send Code above the inputs */}
      <div className="code-input-wrap text-center">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary inline-send-btn"
          onClick={openOtpReg}
          disabled={otpSending || coolReg > 0}
        >
          {otpSending
            ? "Sending..."
            : coolReg > 0
            ? `Resend ${coolReg}s`
            : "Send Code"}
        </button>

        <hr className="mt-2 mb-2" />
        <span className="d-block font-weight-bold">Enter the 6-digit code</span>
        <hr className="mt-2 mb-3" />

        <div className="otp-inputs mt-2" onPaste={onOtpPaste}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => (otpRefs.current[i] = el)}
              className="otp-box"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              value={otpDigits[i]}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onOtpKeyDown(i, e)}
              aria-label={`Register OTP digit ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </FormGroup>

    <div className="d-flex justify-content-center gap-2 mt-3">
      <Button color="dark" onClick={() => setOtpOpen(false)}>
        Cancel
      </Button>
      <Button
        color="primary"
        onClick={verifyOtp}
        disabled={otpVerifying || otpDigits.join("").length !== 6}
      >
        {otpVerifying ? "Verifying..." : "Verify"}
      </Button>
    </div>
  </ModalBody>
</Modal>

    </>
  );
}

export default Register;
