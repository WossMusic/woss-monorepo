import React, { useState, useEffect, useRef } from "react";
import Dropzone from "react-dropzone";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Col,
  Row,
  Progress
} from "reactstrap";
import { countryOptions } from "components/Data/countries";
import CustomSelect from "components/Custom/CustomSelect.js";
import 'assets/css/AddBankAccount.css';

  // Define initial state outside the component
  const initialFormState = {
    profileType: "",
    legalName: "",
    email: "",
    nickname: "",
    country: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
    paymentMethod: "",
    accountName: "",
    bankName: "",
    swiftCode: "",
    iban: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "", // For ACH
    isThirdParty: null,           // true = new document upload required
    document_type: "",             // "Passport" or "ID"
    verificationType: "",          // for UI selection
    passportFile: null,            // for Third Party only
    idCardFront: null,             // for Third Party only
    idCardBack: null               // for Third Party only
  };

    const AddBankAccount = ({ isOpen, toggle, onSuccess, existingData = {} }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState(initialFormState);
    const [selectedCountry, setSelectedCountry] = useState({ value: "", label: "" });
    const passportInputRef = useRef(null);
    const idCardFrontInputRef = useRef(null);
    const idCardBackInputRef = useRef(null);

    const handleInputChange = (e) => {
  const { name, value } = e.target;

  setFormData((prevData) => {
    let updatedData = {
      ...prevData,
      [name]: value,
    };

    // Auto-sync legalName to accountName if it's "Personal"
    if (
      name === "legalName" &&
      prevData.isThirdParty === false &&
      prevData.profileType === "Individual"
    ) {
      updatedData.accountName = value;
    }

    // Reset related fields when payment method changes (Step 2 only)
    if (name === "paymentMethod") {
      updatedData = {
        ...updatedData,
        routingNumber: "",
        accountNumber: "",
        accountType: "",
        swiftCode: "",
        iban: "",
        bankName: "",
        accountName:
          prevData.profileType === "Company"
            ? ""
            : prevData.isThirdParty === false
            ? prevData.legalName || ""
            : "",
      };
    }

    return updatedData;
  });

  // Remove error for this field if it now has a value
  setErrors((prevErrors) => {
    const updatedErrors = { ...prevErrors };
    if (value && value.trim()) {
      delete updatedErrors[name];
    }

    // Also remove related field errors when paymentMethod changes
    if (name === "paymentMethod") {
      delete updatedErrors.routingNumber;
      delete updatedErrors.accountNumber;
      delete updatedErrors.accountType;
      delete updatedErrors.swiftCode;
      delete updatedErrors.iban;
      delete updatedErrors.bankName;
      delete updatedErrors.accountName;
    }

    return updatedErrors;
  });

  // Handle verificationType reset logic (already in your code)
    if (name === "verificationType") {
    setFormData((prevData) => ({
      ...prevData,
      verificationType: value,
      passportFile: null,
      idCardFront: null,
      idCardBack: null,
    }));
  }
};



 // ✅ FETCH FUNCTION: Defined once, reusable
const fetchUserDocument = async (updateOnlyEmail = false) => {
  try {
    const token = localStorage.getItem("woss_token");
    if (!token) return;

    const res = await fetch("http://localhost:4000/api/auth/profile/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (data.success && data.profile) {
      const profile = data.profile;

      setFormData((prev) => {
        const updated = {
          ...prev,
          email: profile.email || prev.email,
        };

        if (updateOnlyEmail) return updated;

        updated.document_type = profile.document_type || "";
        updated.verificationType = profile.document_type || "";

        updated.passport_file_url = profile.passport_file_url || "";
        updated.id_front_url = profile.id_front_url || "";
        updated.id_back_url = profile.id_back_url || "";

        if (updated.document_type === "Passport" && updated.passport_file_url) {
          updated.passportFile = {
            preview: updated.passport_file_url,
          };
        }


        if (updated.document_type === "ID Card") {
          if (updated.id_front_url) {
            updated.idCardFront = {
              preview: updated.id_front_url,
            };
          }
          if (updated.id_back_url) {
            updated.idCardBack = {
              preview: updated.id_back_url,
            };
          }
        }

        return updated;
      });
    }
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
  }
};


// ✅ FULL PROFILE LOAD (Step 3 or whenever full data needed)
useEffect(() => {
  if (isOpen) {
    fetchUserDocument();
  }
}, [isOpen]);


// ✅ EMAIL-ONLY fallback
useEffect(() => {
  if (isOpen && !formData.email) {
    fetchUserDocument(true);
  }
}, [isOpen, formData.email]);


// ✅ Auto-correct verification type if "Personal"
useEffect(() => {
  const shouldAutoCorrect =
    isOpen &&
    formData.isThirdParty === false &&
    formData.profileType === "Individual" && // ← only if Individual
    formData.document_type &&
    formData.verificationType !== formData.document_type;

  if (shouldAutoCorrect) {
    setFormData((prev) => ({
      ...prev,
      verificationType: prev.document_type,
    }));
  }
}, [isOpen, formData.isThirdParty, formData.profileType, formData.document_type, formData.verificationType]);


// ✅ Auto-load preview image only if "Personal" AND profileType is "Individual"
useEffect(() => {
  if (
    isOpen &&
    formData.isThirdParty === false &&
    formData.profileType === "Individual" &&
    formData.document_type &&
    formData.verificationType &&
    !formData.passportFile &&
    !formData.idCardFront &&
    !formData.idCardBack
  ) {
    if (
      formData.document_type === "Passport" &&
      formData.verificationType === "Passport" &&
      formData.passport_file_url
    ) {
      setFormData((prev) => ({
        ...prev,
        passportFile: {
          preview: formData.passport_file_url,
        },
      }));
    }

    if (
      formData.document_type === "ID Card" &&
      formData.verificationType === "ID Card"
    ) {
      setFormData((prev) => ({
        ...prev,
        idCardFront: formData.id_front_url ? { preview: formData.id_front_url } : null,
        idCardBack: formData.id_back_url ? { preview: formData.id_back_url } : null,
      }));
    }
  }
}, [
  isOpen,
  formData.isThirdParty,
  formData.profileType,
  formData.document_type,
  formData.verificationType,
  formData.passportFile,
  formData.idCardFront,
  formData.idCardBack,
  formData.passport_file_url,
  formData.id_front_url,
  formData.id_back_url,
]);


// ✅ Reset & reapply preview on switching "Personal" ↔ "Third Party"
useEffect(() => {
  if (!isOpen) return;

  setFormData((prev) => {
    const updated = {
      ...prev,
      passportFile: null,
      idCardFront: null,
      idCardBack: null,
    };

    if (!prev.isThirdParty) {
      if (prev.document_type === "Passport" && prev.passport_file_url) {
        updated.passportFile = {
          preview: prev.passport_file_url,
        };
      }

      if (prev.document_type === "ID Card") {
        if (prev.id_front_url) {
          updated.idCardFront = {
            preview: prev.id_front_url,
          };
        }
        if (prev.id_back_url) {
          updated.idCardBack = {
            preview: prev.id_back_url,
          };
        }
      }
    }

    return updated;
  });
}, [isOpen, formData.isThirdParty]);



const handleFileChange = async (e, fieldName) => {
  try {
    const file = (e?.target?.files?.[0]) || (e?.files?.[0]);
    if (!file) return;

    const token = localStorage.getItem("woss_token");
    console.log("🔐 Token sent:", token);

    if (!token) {
      alert("Authentication token missing. Please log in again.");
      return;
    }

    const formDataObj = new FormData();
    formDataObj.append("file", file);

    const res = await fetch("http://localhost:4000/api/bankaccounts/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, // ✅ correct format
      },
      body: formDataObj,
    });

    const text = await res.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch {
      console.error("❌ Could not parse server response as JSON:", text);
    }

    if (!res.ok || !result.success || !result.fileUrl) {
      console.error("❌ Upload failed:", {
        status: res.status,
        result,
      });
      alert(result.message || `Upload failed (status ${res.status})`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [fieldName]: {
        file,
        preview: result.fileUrl,
      },
    }));
  } catch (err) {
    console.error("❌ Upload error:", err);
    alert("Upload failed due to a network or server error.");
  }
};



  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1)); // Ensure step doesn't go below 1
  };


  useEffect(() => {
  if (!isOpen) {  // Reset only when modal is closed
      setFormData(initialFormState);
      setStep(1);
      setSelectedCountry({ value: "", label: "Select a Country" });
  }
}, [isOpen]);  // Run only when `isOpen` changes


const [errors, setErrors] = useState({});

  
 const validateFields = () => {
  let newErrors = {};


  // Step 1: Recipient Details
  if (step === 1) {
    if (formData.isThirdParty === null || typeof formData.isThirdParty === "undefined")
      newErrors.isThirdParty = true;
    if (!formData.profileType) newErrors.profileType = true;
    if (!formData.legalName || !formData.legalName.trim()) newErrors.legalName = true;
    if (!formData.email || !formData.email.trim()) newErrors.email = true;
    if (!formData.address || !formData.address.trim()) newErrors.address = true;
    if (!formData.city || !formData.city.trim()) newErrors.city = true;
    if (!formData.state || !formData.state.trim()) newErrors.state = true;
    if (!formData.zip || !formData.zip.trim()) newErrors.zip = true;
    if (!formData.country) newErrors.country = true;
  }


// Step 2: Payment Method
if (step === 2) {
  if (!formData.paymentMethod) newErrors.paymentMethod = true;

  const isACH = formData.paymentMethod === "ACH Transfer";
  const isWire = formData.paymentMethod === "Wire Transfer";
  const isInternational = formData.paymentMethod === "International Wire - USD";

  if (isACH || isWire) {
    if (!formData.accountName?.trim()) newErrors.accountName = true;
    if (!formData.bankName?.trim()) newErrors.bankName = true;
    if (!formData.routingNumber?.trim()) newErrors.routingNumber = true;
    if (!formData.accountNumber?.trim()) newErrors.accountNumber = true;
  }

  if (isACH && !formData.accountType) newErrors.accountType = true;

  if (isInternational) {
    if (!formData.accountName?.trim()) newErrors.accountName = true;
    if (!formData.bankName?.trim()) newErrors.bankName = true;
    if (!formData.swiftCode?.trim()) newErrors.swiftCode = true;
    if (!formData.iban?.trim()) newErrors.iban = true;
  }
}


 
// Step 3: Verification
if (step === 3 && !(formData.isThirdParty === false && formData.profileType === "Company")) {
  if (!formData.verificationType) {
    newErrors.verificationType = true;
  } else if (formData.isThirdParty === true) {
    if (formData.verificationType === "Passport" && !formData.passportFile) {
      newErrors.passportFile = true;
    }

    if (formData.verificationType === "ID Card") {
      if (!formData.idCardFront) newErrors.idCardFront = true;
      if (!formData.idCardBack) newErrors.idCardBack = true;
    }
  }
}

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

  
const nextStep = () => {
  if (validateFields()) {
    setStep((prev) => prev + 1);
  }
};
  
const getInputClass = (fieldName) => (errors[fieldName] ? "border border-danger" : "");

const getButtonClass = (profileType) => (
  `profile-option ${formData.profileType === profileType ? "selected" : ""} ${errors.profileType ? "border border-danger text-danger" : ""}`
);


useEffect(() => {
  const shouldAutofill =
    step === 2 &&
    formData.profileType === "Individual" &&
    !formData.accountName &&
    formData.legalName;

  if (shouldAutofill) {
    setFormData((prev) => ({
      ...prev,
      accountName: prev.legalName,
    }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [step, formData.profileType, formData.legalName]);


const handleSubmit = async () => {
  const token = localStorage.getItem("woss_token");

  let status = formData.isThirdParty ? "Pending" : "Verified";


  // 🛠️ Helper to upload a file and return the server URL
  const uploadFile = async (file) => {
    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);

      const res = await fetch("http://localhost:4000/api/bankaccounts/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataObj,
      });

      const result = await res.json();
      if (res.ok && result.fileUrl) {
        return result.fileUrl;
      } else {
        console.error("Upload failed:", result.message);
        return "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      return "";
    }
  };

  // ⬇ Upload documents
  let passportFileUrl = "";
  let idFrontUrl = "";
  let idBackUrl = "";

  if (formData.verificationType === "Passport") {
    if (formData.passportFile?.file) {
      passportFileUrl = await uploadFile(formData.passportFile.file);
    } else if (formData.passportFile?.preview) {
      passportFileUrl = formData.passportFile.preview;
    }
  }

  if (formData.idCardFront?.file) {
    idFrontUrl = await uploadFile(formData.idCardFront.file);
  } else if (formData.idCardFront?.preview) {
    idFrontUrl = formData.idCardFront.preview;
  }

  if (formData.idCardBack?.file) {
    idBackUrl = await uploadFile(formData.idCardBack.file);
  } else if (formData.idCardBack?.preview) {
    idBackUrl = formData.idCardBack.preview;
  }

  const payload = {
    ...formData,
    is_third_party: formData.isThirdParty,
    status,
    document_type: formData.verificationType,
    passport_file_url: passportFileUrl,
    id_front_url: idFrontUrl,
    id_back_url: idBackUrl,
  };

  const endpoint = formData.id
    ? "http://localhost:4000/api/bankaccounts/update"
    : "http://localhost:4000/api/bankaccounts/add";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (result.success) {
      toggle();
      onSuccess(
        formData.id
          ? "Bank account updated successfully"
          : "Bank account added successfully"
      );
    } else {
      alert(result.message || "Something went wrong.");
    }
  } catch (err) {
    console.error("❌ Server error:", err);
    alert("Server error.");
  }
};

// 🔁 Pre-fill form when editing existing data
useEffect(() => {
  if (isOpen && existingData && Object.keys(existingData).length > 0) {
    const normalized = {
      id: existingData.id || null,
      profileType: existingData.profile_type || "",
      legalName: existingData.legal_name || "",
      nickname: existingData.nickname || "",
      email: existingData.email || "",
      address: existingData.address || "",
      apartment: existingData.apartment || "",
      city: existingData.city || "",
      state: existingData.state || "",
      zip: existingData.zip || "",
      country: existingData.country || "",
      paymentMethod: existingData.payment_method || "",
      accountName: existingData.account_name || "",
      bankName: existingData.bank_name || "",
      swiftCode: existingData.swift_code || "",
      iban: existingData.iban || "",
      routingNumber: existingData.routing_number || "",
      accountNumber: existingData.account_number || "",
      accountType: existingData.account_type || "",
      isThirdParty: existingData.is_third_party === 1,
      verificationType: existingData.document_type || "",
      document_type: existingData.document_type || "",
      passportFile: existingData.passport_file_url
        ? { preview: existingData.passport_file_url }
        : null,
      idCardFront: existingData.id_front_url
        ? { preview: existingData.id_front_url }
        : null,
      idCardBack: existingData.id_back_url
        ? { preview: existingData.id_back_url }
        : null,
      passport_file_url: existingData.passport_file_url || "",
      id_front_url: existingData.id_front_url || "",
      id_back_url: existingData.id_back_url || "",
    };

    setFormData((prev) => ({
      ...prev,
      ...normalized,
    }));

    // Sync country dropdown
    setSelectedCountry({
      value: existingData.country || "",
      label: existingData.country || "Select a Country",
    });
  }
}, [isOpen, existingData]);




return (
  <Modal isOpen={isOpen} toggle={toggle} className="full-screen-modal" backdrop="static">
     <ModalHeader toggle={toggle} className="modal-header-custom">
       <span className="modal-title-custom">{step === 4 ? "Review" : "Recipient Details"}</span>
      </ModalHeader>
      <ModalBody className="modal-body-custom">
        <div className="step-indicator">
          <Progress value={(step / 4) * 100} className="progress-bar-custom" />
        </div>
        <Form>
     {step === 1 && (
        <>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Bank Account Ownership</Label>
                <div className="profile-selection d-flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    className={`profile-option ${formData.isThirdParty === false ? "selected" : ""} ${errors.isThirdParty ? "border border-danger text-danger" : ""}`}
                    onClick={() => {
                    setFormData((prev) => {
                      const isIndividual = prev.profileType === "Individual";
                      return {
                        ...prev,
                        isThirdParty: false,
                        verificationType: isIndividual ? (prev.document_type || "Passport") : "", // ← don't autofill if Company
                        accountName: isIndividual ? (prev.legalName || "") : prev.accountName,
                      };
                    });


                    setErrors((prevErrors) => {
                      const updated = { ...prevErrors };
                      delete updated.isThirdParty;
                      delete updated.verificationType;
                      delete updated.accountName;
                      return updated;
                    });
                  }}
                  >
                    <span className="radio-icon">{formData.isThirdParty === false ? "●" : "○"}</span>
                    <span className="h4 font-weight-bold">Personal</span>
                  </Button>

                  <Button
                    type="button"
                    className={`profile-option ${formData.isThirdParty === true ? "selected" : ""} ${errors.isThirdParty ? "border border-danger text-danger" : ""}`}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        isThirdParty: true,
                        verificationType: "",
                        accountName: "",
                      }));

                      setErrors((prevErrors) => {
                        const updated = { ...prevErrors };
                        delete updated.isThirdParty;
                        delete updated.verificationType;
                        delete updated.accountName;
                        return updated;
                      });
                    }}
                  >
                    <span className="radio-icon">{formData.isThirdParty === true ? "●" : "○"}</span>
                    <span className="h4 font-weight-bold">Third Party</span>
                  </Button>
                </div>
              </FormGroup>
            </Col>

            <Col md={6}>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Profile</Label>
                <div className="profile-selection">
                  <Button
                    type="button"
                    className={getButtonClass("Individual")}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        profileType: "Individual",
                        accountName: prev.isThirdParty ? "" : prev.legalName || "",
                      }));

                      setErrors((prevErrors) => {
                        const updated = { ...prevErrors };
                        delete updated.profileType;
                        delete updated.accountName;
                        return updated;
                      });
                    }}
                  >
                    <span className="radio-icon">{formData.profileType === "Individual" ? "●" : "○"}</span>
                    <span className="h4 font-weight-bold">Individual</span>
                  </Button>

                  <Button
                    type="button"
                    className={getButtonClass("Company")}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        profileType: "Company",
                        accountName: "", // Clear for Company so user can edit
                      }));

                      setErrors((prevErrors) => {
                        const updated = { ...prevErrors };
                        delete updated.profileType;
                        delete updated.accountName;
                        return updated;
                      });
                    }}
                  >
                    <span className="radio-icon">{formData.profileType === "Company" ? "●" : "○"}</span>
                    <span className="h4 font-weight-bold">Company</span>
                  </Button>
                </div>
              </FormGroup>
            </Col>
          </Row>

          {/* Legal Name & Nickname */}
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Legal Name</Label>
                <Input
                  type="text"
                  name="legalName"
                  value={formData.legalName || ""}
                  onChange={handleInputChange}
                  className={getInputClass("legalName")}
                  placeholder="Enter Legal Name"
                />
              </FormGroup>
            </Col>

            <Col md={6}>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Nickname (Optional)</Label>
                <Input
                  type="text"
                  name="nickname"
                  value={formData.nickname || ""}
                  onChange={handleInputChange}
                  placeholder="Enter Nickname"
                />
              </FormGroup>
            </Col>
          </Row>

          {/* Email (Read-only) */}
          <FormGroup>
            <Label className="styles__label_JN5HJ">Email</Label>
            <Input
              type="email"
              name="email"
              value={formData.email || ""}
              readOnly
            />
          </FormGroup>

          {/* Country */}
          <FormGroup>
            <Label className="styles__label_JN5HJ">Country</Label>
            <div className={`custom-select-container ${errors.country ? "border border-danger rounded" : ""}`}>
              <CustomSelect
                options={[{ value: "", label: "Select a Country" }, ...countryOptions]}
                value={selectedCountry}
                onChange={(selectedOption) => {
                  setSelectedCountry(selectedOption);
                  setFormData((prevData) => ({
                    ...prevData,
                    country: selectedOption.value,
                  }));

                  setErrors((prevErrors) => {
                    const updated = { ...prevErrors };
                    delete updated.country;
                    return updated;
                  });
                }}
              />
            </div>
          </FormGroup>

          {/* Address Fields */}
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Recipient Legal Address</Label>
                <Input
                  type="text"
                  name="address"
                  value={formData.address || ""}
                  onChange={handleInputChange}
                  className={getInputClass("address")}
                  placeholder="Enter Recipient Legal Address"
                />
              </FormGroup>
              <FormGroup>
                <Label className="styles__label_JN5HJ">City</Label>
                <Input
                  type="text"
                  name="city"
                  value={formData.city || ""}
                  onChange={handleInputChange}
                  className={getInputClass("city")}
                  placeholder="Enter City"
                />
              </FormGroup>
            </Col>

            <Col md={6}>
              <Row>
                <Col md={12}>
                  <FormGroup>
                    <Label className="styles__label_JN5HJ">Apartment, Suite, Floor (Optional)</Label>
                    <Input
                      type="text"
                      name="apartment"
                      value={formData.apartment || ""}
                      onChange={handleInputChange}
                      placeholder="Enter Apartment, Suite, Floor"
                    />
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label className="styles__label_JN5HJ">State/Province</Label>
                    <Input
                      type="text"
                      name="state"
                      value={formData.state || ""}
                      onChange={handleInputChange}
                      className={getInputClass("state")}
                      placeholder="Enter State"
                    />
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label className="styles__label_JN5HJ">Postal / ZIP Code</Label>
                    <Input
                      type="text"
                      name="zip"
                      value={formData.zip || ""}
                      onChange={handleInputChange}
                      className={getInputClass("zip")}
                      placeholder="Enter ZIP Code"
                    />
                  </FormGroup>
                </Col>
              </Row>
            </Col>
          </Row>
        </>
      )}



        {step === 2 && (
        <>
          <FormGroup className="full-width">
            <Label className="styles__label_JN5HJ">Select Payment Method</Label>
            <Input
              type="select"
              value={formData.paymentMethod || ""}
              name="paymentMethod"
              onChange={handleInputChange}
              className={`custom-select ${errors.paymentMethod ? "border border-danger" : ""}`}
            >
              <option value="">Select</option>
              <option value="ACH Transfer">ACH Transfer</option>
              <option value="Wire Transfer">Wire Transfer</option>
              <option value="International Wire">International Wire</option>
            </Input>
            {errors.paymentMethod}
          </FormGroup>

          {formData.paymentMethod === "ACH Transfer" && (
        <>
          <FormGroup>
            <Label className="styles__label_JN5HJ">Account Name</Label>
            <Input
              type="text"
              name="accountName"
              value={formData.accountName || ""}
              onChange={handleInputChange}
              className={getInputClass("accountName")}
              placeholder="Enter Account Name"
              readOnly={formData.profileType === "Individual"}
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Bank Name</Label>
            <Input
              type="text"
              name="bankName"
              value={formData.bankName || ""}
              onChange={handleInputChange}
              className={getInputClass("bankName")}
              placeholder="Enter Bank Name"
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Routing Number</Label>
            <Input
              type="number"
              name="routingNumber"
              value={formData.routingNumber}
              onChange={handleInputChange}
              className={getInputClass("routingNumber")}
              placeholder="Enter Routing Number"
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Account Number</Label>
            <Input
              type="number"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleInputChange}
              className={getInputClass("accountNumber")}
              placeholder="Enter Account Number"
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Account Type</Label>
            <Input
              type="select"
              name="accountType"
              value={formData.accountType}
              onChange={handleInputChange}
              className={getInputClass("accountType")}
            >
              <option value="">Select</option>
              <option value="Personal Checking">Personal Checking</option>
              <option value="Personal Savings">Personal Savings</option>
              <option value="Business Checking">Business Checking</option>
              <option value="Business Savings">Business Savings</option>
            </Input>
          </FormGroup>
        </>
      )}


          {formData.paymentMethod === "Wire Transfer" && (
        <>
          <FormGroup>
            <Label className="styles__label_JN5HJ">Account Name</Label>
            <Input
              type="text"
              name="accountName"
              value={formData.accountName || ""}
              onChange={handleInputChange}
              className={getInputClass("accountName")}
              placeholder="Enter Account Name"
              readOnly={formData.profileType === "Individual"}
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Bank Name</Label>
            <Input
              type="text"
              name="bankName"
              value={formData.bankName || ""}
              onChange={handleInputChange}
              className={getInputClass("bankName")}
              placeholder="Enter Bank Name"
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Routing Number</Label>
            <Input
              type="number"
              name="routingNumber"
              value={formData.routingNumber}
              onChange={handleInputChange}
              className={getInputClass("routingNumber")}
              placeholder="Enter Routing Number"
            />
          </FormGroup>

          <FormGroup>
            <Label className="styles__label_JN5HJ">Account Number</Label>
            <Input
              type="number"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleInputChange}
              className={getInputClass("accountNumber")}
              placeholder="Enter Account Number"
            />
          </FormGroup>
        </>
      )}


          {formData.paymentMethod === "International Wire" && (
            <>
              <FormGroup>
                <Label className="styles__label_JN5HJ">Account Name</Label>
              <Input
                  type="text"
                  name="accountName"
                  value={formData.accountName || ""}
                  onChange={handleInputChange}
                  className={getInputClass("accountName")}
                  placeholder="Enter Account Name"
                  readOnly={formData.profileType === "Individual"}
                />
              </FormGroup>

              <FormGroup>
                <Label className="styles__label_JN5HJ">Bank Name</Label>
                <Input
                  type="text"
                  name="bankName"
                  value={formData.bankName || ""}
                  onChange={handleInputChange}
                  className={getInputClass("bankName")}
                  placeholder="Enter Bank Name"
                />
              </FormGroup>

              <FormGroup>
                <Label className="styles__label_JN5HJ">SWIFT Code</Label>
                <Input
                  type="text"
                  name="swiftCode"
                  value={formData.swiftCode}
                  onChange={handleInputChange}
                  className={getInputClass("swiftCode")}
                  placeholder="Enter SWIFT Code"
                />
              </FormGroup>

              <FormGroup>
                <Label className="styles__label_JN5HJ">IBAN or Account Number</Label>
                <Input
                  type="number"
                  name="iban"
                  value={formData.iban}
                  onChange={handleInputChange}
                  className={getInputClass("iban")}
                  placeholder="Enter IBAN or Account Number"
                />
              </FormGroup>
            </>
          )}
        </>
      )}



  {/* Step 3: Verification Type */}
      {step === 3 && (
        <>
          {/* Select Verification Type */}
          <FormGroup>
            <Label className="styles__label_JN5HJ">Choose Verification Type</Label>
            <Input
              type="select"
              name="verificationType"
              value={formData.verificationType || ""}
              onChange={handleInputChange}
              className={errors.verificationType ? "border border-danger" : ""}
              disabled={formData.isThirdParty === false && formData.profileType === "Individual"}
            >
              {!formData.verificationType && <option value="">Select</option>}
              <option value="ID Card">ID Card</option>
              <option value="Passport">Passport</option>
            </Input>
            {!!errors.verificationType && (
              <div className="text-danger small mt-1">This field is required.</div>
            )}
          </FormGroup>

          {/* ==================== ID CARD Upload ==================== */}
          {formData.verificationType === "ID Card" && (
            <Row className="mt-4">
              {/* FRONT SIDE */}
              <Col md={6}>
                <FormGroup>
                  <Label className="styles__label_JN5HJ">Front Side</Label>
                  {(formData.isThirdParty || (formData.isThirdParty === false && formData.profileType === "Company")) ? (
                    <Dropzone onDrop={(files) => handleFileChange({ target: { files } }, "idCardFront")}>
                      {({ getRootProps, getInputProps }) => (
                        <div {...getRootProps()} className={`dropzone-custom ${errors.idCardFront ? "border border-danger" : ""}`}>
                          <input {...getInputProps()} />

                          {formData.idCardFront ? (
                            <div className="image-container position-relative">
                              <img
                                src={formData.idCardFront.preview}
                                alt="ID Front Preview"
                                className="img-preview"
                              />

                              {/* ❌ Remove Button */}
                              <button
                                type="button"
                                className="image-remove-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData((prev) => ({ ...prev, idCardFront: null }));
                                }}
                              >
                                ×
                              </button>

                              {/* ✅ Change Button */}
                              <div className="text-center mt-2">
                                <Button
                                  color="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    idCardFrontInputRef.current?.click();
                                  }}
                                >
                                  Change Image
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="dropzone-text">
                              <i className="fa fa-image" />
                              <br />
                              Drag & drop here
                            </p>
                          )}
                        </div>
                      )}
                    </Dropzone>
                  ) : (
                    formData.idCardFront && (
                      <div className="image-container position-relative">
                        <img
                          src={formData.idCardFront.preview}
                          alt="ID Front Preview"
                          className="img-preview"
                        />
                      </div>
                    )
                  )}

                  {/* 👇 Hidden input for manual file selection via "Change Image" */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={idCardFrontInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "idCardFront")}
                  />
                </FormGroup>
              </Col>

              {/* BACK SIDE */}
              <Col md={6}>
                <FormGroup>
                  <Label className="styles__label_JN5HJ">Back Side</Label>
                  {(formData.isThirdParty || (formData.isThirdParty === false && formData.profileType === "Company")) ? (
                    <Dropzone onDrop={(files) => handleFileChange({ target: { files } }, "idCardBack")}>
                      {({ getRootProps, getInputProps }) => (
                        <div {...getRootProps()} className={`dropzone-custom ${errors.idCardBack ? "border border-danger" : ""}`}>
                          <input {...getInputProps()} />

                          {formData.idCardBack ? (
                            <div className="image-container position-relative">
                              <img
                                src={formData.idCardBack.preview}
                                alt="ID Back Preview"
                                className="img-preview"
                              />

                              {/* ❌ Remove Button */}
                              <button
                                type="button"
                                className="image-remove-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData((prev) => ({ ...prev, idCardBack: null }));
                                }}
                              >
                                ×
                              </button>

                              {/* ✅ Change Button */}
                              <div className="text-center mt-2">
                                <Button
                                  color="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    idCardBackInputRef.current?.click();
                                  }}
                                >
                                  Change Image
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="dropzone-text">
                              <i className="fa fa-image" />
                              <br />
                              Drag & drop here
                            </p>
                          )}
                        </div>
                      )}
                    </Dropzone>
                  ) : (
                    formData.idCardBack && (
                      <div className="image-container position-relative">
                        <img src={formData.idCardBack.preview} alt="ID Back Preview" className="img-preview" />
                      </div>
                    )
                  )}

                  {/* 👇 Hidden input to trigger Change Image manually */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={idCardBackInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "idCardBack")}
                  />
                </FormGroup>
              </Col>
            </Row>
          )}

          {/* ==================== PASSPORT Upload ==================== */}
          {formData.verificationType === "Passport" && (
          <FormGroup>
              <Label className="styles__label_JN5HJ">Upload Passport</Label>

              {(formData.isThirdParty || (formData.isThirdParty === false && formData.profileType === "Company")) ? (
                <Dropzone onDrop={(files) => handleFileChange({ target: { files } }, "passportFile")}>
                  {({ getRootProps, getInputProps }) => (
                    <div {...getRootProps()} className={`dropzone-custom ${errors.passportFile ? "border border-danger" : ""}`}>
                      <input {...getInputProps()} />

                      {formData.passportFile ? (
                        <div className="image-container position-relative">
                          <img
                            src={formData.passportFile.preview}
                            alt="Passport Preview"
                            className="img-preview"
                          />

                          {/* ❌ Remove Button */}
                          <button
                            type="button"
                            className="image-remove-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({ ...prev, passportFile: null }));
                            }}
                          >
                            ×
                          </button>

                          {/* ✅ Change Button */}
                          <div className="text-center mt-2">
                            <Button
                              color="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                passportInputRef.current?.click();
                              }}
                            >
                              Change Image
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="dropzone-text">
                          <i className="fa fa-image" />
                          <br />
                          Drag & drop here
                        </p>
                      )}
                    </div>
                  )}
                </Dropzone>
              ) : (
                formData.passportFile && (
                  <div className="image-container position-relative">
                    <img
                      src={formData.passportFile.preview}
                      alt="Passport Preview"
                      className="img-preview"
                    />
                  </div>
                )
              )}

              {/* 👇 Hidden input to allow manual file selection from "Change Image" button */}
              <input
                type="file"
                accept="image/*"
                ref={passportInputRef}
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, "passportFile")}
              />
            </FormGroup>
          )}
        </>
      )}



       {step === 4 && (
        <div>
          <h2 className="text-center fw-bold">Final Review</h2>
          <Label className="text-center styles__label_JN5HJ">Please verify all the information before submitting.</Label>

          <hr className="my-4" />

          {/* Section: Recipient Details */}
          <div className="review-section">
            <h4 className="fw-bold">Recipient Details</h4>
            <ul className="h5">
              <li><strong>Bank Ownership:</strong> {formData.isThirdParty ? "Third Party" : "Personal"}</li>
              <li><strong>Profile:</strong> {formData.profileType}</li>
              <li><strong>Legal Name:</strong> {formData.legalName}</li>
              <li><strong>Email:</strong> {formData.email}</li>
              <li><strong>Nickname:</strong> {formData.nickname || "N/A"}</li>
              <li><strong>Country:</strong> {selectedCountry.label || "N/A"}</li>
              <li><strong>Address:</strong> {formData.address}</li>
              <li><strong>Apartment:</strong> {formData.apartment || "N/A"}</li>
              <li><strong>City:</strong> {formData.city}</li>
              <li><strong>State:</strong> {formData.state}</li>
              <li><strong>ZIP:</strong> {formData.zip}</li>
            </ul>
          </div>

          <hr className="my-4" />

          {/* Section: Payment Method */}
          <div className="review-section">
            <h4 className="fw-bold">Banking Details</h4>
            <ul className="h5">
              <li><strong>Method:</strong> {formData.paymentMethod}</li>

              {/* ACH Transfer Fields */}
                {formData.paymentMethod === "ACH Transfer" && (
                  <>
                    <li><strong>Account Name:</strong> {formData.accountName}</li>
                    <li><strong>Bank Name:</strong> {formData.bankName}</li>
                    <li><strong>Routing Number:</strong> {formData.routingNumber}</li>
                    <li><strong>Account Number:</strong> {formData.accountNumber}</li>
                    <li><strong>Account Type:</strong> {formData.accountType}</li>
                  </>
                )}


             {formData.paymentMethod === "Wire Transfer" && (
                <>
                  <li><strong>Account Name:</strong> {formData.accountName}</li>
                  <li><strong>Bank Name:</strong> {formData.bankName}</li>
                  <li><strong>Routing Number:</strong> {formData.routingNumber}</li>
                  <li><strong>Account Number:</strong> {formData.accountNumber}</li>
                </>
              )}

              {/* International Wire Fields */}
              {formData.paymentMethod === "International Wire" && (
                <>
                  <li><strong>Account Name:</strong> {formData.accountName}</li>
                  <li><strong>Bank Name:</strong> {formData.bankName}</li>
                  <li><strong>SWIFT Code:</strong> {formData.swiftCode}</li>
                  <li><strong>IBAN / Account Number:</strong> {formData.iban}</li>
                </>
              )}
            </ul>
          </div>

          <hr className="my-4" />

          {/* Section: Verification Type */}
        <div className="review-section">
            <h4 className="fw-bold">Verification Type</h4>
            <ul className="h5">
              <li>{formData.verificationType}</li>
            </ul>

            {/* Passport Preview */}
            {formData.verificationType === "Passport" && formData.passportFile?.preview && (
              <div className="image-preview-container">
                <img
                  src={formData.passportFile.preview}
                  alt="Passport Preview"
                  className="img-preview"
                />
              </div>
            )}

            {/* ID Card Preview */}
            {formData.verificationType === "ID Card" && (
              <div className="image-preview-container">
                {formData.idCardFront?.preview && (
                  <img
                    src={formData.idCardFront.preview}
                    alt="ID Front Preview"
                    className="img-preview"
                  />
                )}
                {formData.idCardBack?.preview && (
                  <img
                    src={formData.idCardBack.preview}
                    alt="ID Back Preview"
                    className="img-preview"
                  />
                )}
              </div>
            )}
         </div>
       </div>
      )}
    </Form>
   </ModalBody>
      <ModalFooter>
        {step > 1 && <Button outline color="primary" onClick={prevStep}>Back</Button>}
        {step < 4 ? <Button color="primary" onClick={nextStep}>Next</Button> : <Button color="primary" onClick={handleSubmit} >Complete</Button>}
      </ModalFooter>
    </Modal>
  );
};

export default AddBankAccount;
